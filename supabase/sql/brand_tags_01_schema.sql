-- ============================================================================
-- InCynq — Brand Hashtags (v1)
-- ============================================================================
-- Two classes of tag:
--   identity    -- auto-generated from the brand name (#slcompare). Free.
--                  Exclusive to that brand. Regenerated on rename.
--   descriptive -- admin-created on request, paid. SHARED: assignable to any
--                  number of brands (#vintage sits on many).
--
-- Safe to re-run.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Helper — normalisation
-- ----------------------------------------------------------------------------
-- Hashtags are alphanumeric only. NOTE this differs from brand HANDLES, which
-- keep dots and hyphens. "S.L. Compare" -> handle @s.l.compare, tag #slcompare.
create or replace function public.normalize_tag(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]', '', 'g');
$$;


-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------
create table if not exists public.brand_tags (
  id          uuid primary key default gen_random_uuid(),
  tag         text not null unique,                  -- normalised, e.g. 'vintage'
  label       text not null,                         -- display casing, e.g. 'Vintage'
  tag_type    text not null default 'descriptive'
                check (tag_type in ('identity', 'descriptive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.brand_tag_assignments (
  id          uuid primary key default gen_random_uuid(),
  tag_id      uuid not null references public.brand_tags(id) on delete cascade,
  brand_id    uuid not null references public.profiles(id)   on delete cascade,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (tag_id, brand_id)
);

create index if not exists idx_brand_tag_assignments_brand on public.brand_tag_assignments(brand_id);
create index if not exists idx_brand_tag_assignments_tag   on public.brand_tag_assignments(tag_id);
create index if not exists idx_brand_tags_type             on public.brand_tags(tag_type);


-- ----------------------------------------------------------------------------
-- 3. GRANTs + RLS
-- ----------------------------------------------------------------------------
grant select on public.brand_tags to anon;
grant select on public.brand_tags to authenticated;
grant select, insert, update, delete on public.brand_tags to service_role;

grant select on public.brand_tag_assignments to anon;
grant select on public.brand_tag_assignments to authenticated;
grant select, insert, update, delete on public.brand_tag_assignments to service_role;

alter table public.brand_tags            enable row level security;
alter table public.brand_tag_assignments enable row level security;

drop policy if exists brand_tags_public_read on public.brand_tags;
create policy brand_tags_public_read on public.brand_tags
  for select using (true);

drop policy if exists brand_tags_service_all on public.brand_tags;
create policy brand_tags_service_all on public.brand_tags
  for all to service_role using (true) with check (true);

drop policy if exists brand_tag_assignments_public_read on public.brand_tag_assignments;
create policy brand_tag_assignments_public_read on public.brand_tag_assignments
  for select using (true);

drop policy if exists brand_tag_assignments_service_all on public.brand_tag_assignments;
create policy brand_tag_assignments_service_all on public.brand_tag_assignments
  for all to service_role using (true) with check (true);

-- All writes go through the SECURITY DEFINER RPCs below. No raw client inserts.


-- ----------------------------------------------------------------------------
-- 4. Identity tags are exclusive — enforce one assignment only
-- ----------------------------------------------------------------------------
create or replace function public.brand_tags_enforce_identity_exclusive()
returns trigger
language plpgsql
as $$
declare
  v_type text;
  v_count integer;
begin
  select tag_type into v_type from public.brand_tags where id = new.tag_id;

  if v_type = 'identity' then
    select count(*) into v_count
      from public.brand_tag_assignments
     where tag_id = new.tag_id
       and brand_id <> new.brand_id;

    if v_count > 0 then
      raise exception 'Identity tags are exclusive to one brand.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_brand_tags_identity_exclusive on public.brand_tag_assignments;
create trigger trg_brand_tags_identity_exclusive
  before insert or update on public.brand_tag_assignments
  for each row execute function public.brand_tags_enforce_identity_exclusive();


-- ----------------------------------------------------------------------------
-- 5. Word lists + fee — seeded into app_content (editable in admin, no deploy)
-- ----------------------------------------------------------------------------
insert into public.app_content (key, value) values
  ('custom_tag_fee',      '350'),
  ('max_tags_per_brand',  '6'),
  -- BLOCK: explicit. Matched as substrings, so 'vintagexxx' is caught too.
  ('tag_blocked_words',   'sex,porn,xxx,nude,naked,escort,bdsm,fetish,nsfw,adult'),
  -- BLOCK: platform impersonation. Exact match.
  ('tag_protected_words', 'incynq,official,admin,support,staff,moderator,team,verified,cynqified'),
  -- WARN: category-level words. Exact match only, so '#vintagefurniture' passes clean.
  ('tag_reserved_words',  'shop,store,shopping,brand,business,sl,secondlife,fashion,clothing,clothes,furniture,decor,homedecor,events,event,music,art,roleplay,freebie,free,sale,new,best,top')
on conflict (key) do nothing;


create or replace function public.get_tag_word_list(p_key text)
returns text[]
language sql
stable
as $$
  select coalesce(
    (select string_to_array(regexp_replace(lower(value), '\s', '', 'g'), ',')
       from public.app_content where key = p_key),
    array[]::text[]
  );
$$;


-- ----------------------------------------------------------------------------
-- 6. Validation
-- ----------------------------------------------------------------------------
-- Returns jsonb:
--   { status: 'ok' | 'warn' | 'block',
--     tag, label, reason, suggest_tag_id, suggest_label }
--
-- 'warn' is advisory — admin_create_tag(p_force => true) overrides it.
-- 'block' can never be overridden.
create or replace function public.validate_brand_tag(
  p_label   text,
  p_tag_type text default 'descriptive'
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_norm     text;
  v_word     text;
  v_existing record;
  v_near     record;
  v_stem     text;
begin
  v_norm := public.normalize_tag(p_label);

  -- length / character sanity ------------------------------------------------
  if v_norm = '' then
    return jsonb_build_object('status','block','tag',v_norm,'label',p_label,
      'reason','Tag must contain at least one letter or number.');
  end if;

  if length(v_norm) < 2 then
    return jsonb_build_object('status','block','tag',v_norm,'label',p_label,
      'reason','Too short — minimum 2 characters.');
  end if;

  if length(v_norm) > 30 then
    return jsonb_build_object('status','block','tag',v_norm,'label',p_label,
      'reason','Too long — maximum 30 characters.');
  end if;

  -- explicit content (substring match) ---------------------------------------
  foreach v_word in array public.get_tag_word_list('tag_blocked_words') loop
    if v_word <> '' and position(v_word in v_norm) > 0 then
      return jsonb_build_object('status','block','tag',v_norm,'label',p_label,
        'reason','Contains blocked content. Not permitted on InCynq.');
    end if;
  end loop;

  -- platform impersonation (exact match) -------------------------------------
  foreach v_word in array public.get_tag_word_list('tag_protected_words') loop
    if v_word <> '' and v_norm = v_word then
      return jsonb_build_object('status','block','tag',v_norm,'label',p_label,
        'reason','Reserved for InCynq. Cannot be assigned to a brand.');
    end if;
  end loop;

  -- exact duplicate ----------------------------------------------------------
  select id, label, tag_type into v_existing
    from public.brand_tags where tag = v_norm;

  if found then
    if v_existing.tag_type = 'identity' then
      return jsonb_build_object('status','block','tag',v_norm,'label',p_label,
        'reason','Already an identity tag belonging to another brand.');
    end if;
    return jsonb_build_object('status','block','tag',v_norm,'label',p_label,
      'reason','This tag already exists — assign the existing one instead.',
      'suggest_tag_id', v_existing.id, 'suggest_label', v_existing.label);
  end if;

  -- near-duplicate: plural / singular variant --------------------------------
  v_stem := v_norm;
  if right(v_norm,2) = 'es' and length(v_norm) > 4 then
    v_stem := left(v_norm, length(v_norm)-2);
  elsif right(v_norm,1) = 's' and length(v_norm) > 3 then
    v_stem := left(v_norm, length(v_norm)-1);
  end if;

  select id, label into v_near from public.brand_tags
   where tag = v_stem or tag = v_norm || 's' or tag = v_norm || 'es'
   limit 1;

  if found then
    return jsonb_build_object('status','warn','tag',v_norm,'label',p_label,
      'reason','Very close to an existing tag — likely the same thing.',
      'suggest_tag_id', v_near.id, 'suggest_label', v_near.label);
  end if;

  -- near-duplicate: one-character typo ---------------------------------------
  -- Only fires on same-length-ish words, so #vintage vs #vintageclothes is clean.
  begin
    select id, label into v_near from public.brand_tags
     where length(v_norm) >= 4
       and abs(length(tag) - length(v_norm)) <= 1
       and levenshtein(tag, v_norm) <= 1
     limit 1;

    if found then
      return jsonb_build_object('status','warn','tag',v_norm,'label',p_label,
        'reason','One character away from an existing tag — possible typo.',
        'suggest_tag_id', v_near.id, 'suggest_label', v_near.label);
    end if;
  exception when others then
    null;  -- fuzzystrmatch not installed; plural check above still applies
  end;

  -- category-level generic word ----------------------------------------------
  foreach v_word in array public.get_tag_word_list('tag_reserved_words') loop
    if v_word <> '' and v_norm = v_word then
      return jsonb_build_object('status','warn','tag',v_norm,'label',p_label,
        'reason','Very broad category word. Fine to create, but it will describe a lot of brands.');
    end if;
  end loop;

  -- already a standard taxonomy tag (free for everyone) ----------------------
  if p_tag_type = 'descriptive' and to_regclass('public.interest_tags') is not null then
    select t.name into v_word from public.interest_tags t
     where public.normalize_tag(t.name) = v_norm;

    if found then
      return jsonb_build_object('status','block','tag',v_norm,'label',p_label,
        'reason', format('Already a standard tag (%s) — free for every brand, no purchase needed.', v_word));
    end if;
  end if;

  -- collides with another brand's name or handle -----------------------------
  if p_tag_type = 'descriptive' then
    perform 1 from public.profiles
     where public.normalize_tag(coalesce(brand_handle, '')) = v_norm
        or public.normalize_tag(coalesce(brand_name, ''))   = v_norm
     limit 1;

    if found then
      return jsonb_build_object('status','warn','tag',v_norm,'label',p_label,
        'reason','Matches an existing brand name or handle — could look like impersonation.');
    end if;
  end if;

  return jsonb_build_object('status','ok','tag',v_norm,'label',p_label,'reason',null);
end;
$$;

-- Optional but recommended — enables the typo check above.
do $$ begin
  create extension if not exists fuzzystrmatch;
exception when others then
  raise notice 'fuzzystrmatch unavailable; typo detection disabled (plural check still active).';
end $$;


-- ----------------------------------------------------------------------------
-- 7. Auto identity tag (#slcompare from "SLCompare")
-- ----------------------------------------------------------------------------
-- Call at brand activation AND after a rename. Idempotent.
-- Skips silently if the name normalises to something blocked/reserved/taken —
-- in that case the brand simply has no identity tag and you assign a
-- descriptive one by hand.
create or replace function public.ensure_brand_identity_tag(p_brand_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name    text;
  v_norm    text;
  v_try     text;
  v_n       integer := 0;
  v_check   jsonb;
  v_tag_id  uuid;
  v_old     record;
begin
  select coalesce(nullif(brand_name,''), nullif(display_name,''), username)
    into v_name from public.profiles where id = p_brand_id;

  if v_name is null then
    return jsonb_build_object('status','skipped','reason','Brand not found.');
  end if;

  v_norm := public.normalize_tag(v_name);
  if v_norm = '' or length(v_norm) < 2 then
    return jsonb_build_object('status','skipped','reason','Name produces no usable tag.');
  end if;

  -- retire any previous identity tag for this brand (rename case)
  for v_old in
    select a.id as assignment_id, t.id as tag_id
      from public.brand_tag_assignments a
      join public.brand_tags t on t.id = a.tag_id
     where a.brand_id = p_brand_id and t.tag_type = 'identity'
  loop
    delete from public.brand_tag_assignments where id = v_old.assignment_id;
    delete from public.brand_tags where id = v_old.tag_id;
  end loop;

  -- Don't hijack a SHARED tag: if the brand name is already a descriptive or
  -- standard tag, it stays shared and this brand simply gets no identity tag.
  -- (A collision with another IDENTITY tag is different — that gets a suffix.)
  if exists (select 1 from public.brand_tags
              where tag = v_norm and tag_type = 'descriptive') then
    return jsonb_build_object('status','skipped',
      'reason','Name is already a shared tag; not claimed as an identity tag.');
  end if;

  if to_regclass('public.interest_tags') is not null then
    if exists (select 1 from public.interest_tags
                where public.normalize_tag(name) = v_norm) then
      return jsonb_build_object('status','skipped',
        'reason','Name is already a standard tag; not claimed as an identity tag.');
    end if;
  end if;

  -- blocked / protected words must not be auto-claimed
  v_check := public.validate_brand_tag(v_name, 'identity');
  if v_check->>'status' = 'block'
     and v_check->>'reason' not like 'This tag already exists%' then
    return jsonb_build_object('status','skipped','reason', v_check->>'reason');
  end if;

  foreach v_try in array public.get_tag_word_list('tag_reserved_words') loop
    if v_try <> '' and v_norm = v_try then
      return jsonb_build_object('status','skipped',
        'reason','Brand name is a category word — not auto-claimed.');
    end if;
  end loop;

  -- collision suffix, same convention as handles (01, 02, ...)
  v_try := v_norm;
  while exists (select 1 from public.brand_tags where tag = v_try) loop
    v_n := v_n + 1;
    v_try := v_norm || lpad(v_n::text, 2, '0');
  end loop;

  insert into public.brand_tags (tag, label, tag_type)
  values (v_try, v_name, 'identity')
  returning id into v_tag_id;

  insert into public.brand_tag_assignments (tag_id, brand_id, sort_order)
  values (v_tag_id, p_brand_id, 0);

  return jsonb_build_object('status','created','tag', v_try, 'tag_id', v_tag_id);
end;
$$;


-- ----------------------------------------------------------------------------
-- 8. Admin RPCs
-- ----------------------------------------------------------------------------
-- Uses profiles.admin_role. 'admin' is included for the future role system;
-- nothing holds that value today.
create or replace function public.is_tag_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select admin_role in ('owner', 'admin')
       from public.profiles where id = auth.uid()),
    false
  );
$$;


create or replace function public.admin_create_tag(
  p_label text,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check  jsonb;
  v_tag_id uuid;
begin
  if not public.is_tag_admin() then
    raise exception 'Not authorised.';
  end if;

  v_check := public.validate_brand_tag(p_label, 'descriptive');

  if v_check->>'status' = 'block' then
    return v_check;
  end if;

  if v_check->>'status' = 'warn' and not p_force then
    return v_check;   -- caller shows the warning + a "create anyway" button
  end if;

  insert into public.brand_tags (tag, label, tag_type)
  values (v_check->>'tag', trim(p_label), 'descriptive')
  returning id into v_tag_id;

  return jsonb_build_object('status','created','tag_id',v_tag_id,
    'tag', v_check->>'tag', 'label', trim(p_label));
end;
$$;


create or replace function public.admin_assign_tag(
  p_tag_id   uuid,
  p_brand_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max   integer;
  v_count integer;
begin
  if not public.is_tag_admin() then
    raise exception 'Not authorised.';
  end if;

  select coalesce((select value::integer from public.app_content
                    where key = 'max_tags_per_brand'), 6) into v_max;

  select count(*) into v_count
    from public.brand_tag_assignments where brand_id = p_brand_id;

  if v_count >= v_max then
    return jsonb_build_object('status','error',
      'reason', format('Brand is at the %s-tag limit.', v_max));
  end if;

  insert into public.brand_tag_assignments (tag_id, brand_id, sort_order)
  values (p_tag_id, p_brand_id, v_count)
  on conflict (tag_id, brand_id) do nothing;

  return jsonb_build_object('status','assigned');
end;
$$;


create or replace function public.admin_unassign_tag(
  p_tag_id   uuid,
  p_brand_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_tag_admin() then
    raise exception 'Not authorised.';
  end if;

  delete from public.brand_tag_assignments
   where tag_id = p_tag_id and brand_id = p_brand_id;

  return jsonb_build_object('status','removed');
end;
$$;


-- Renames IN PLACE — keeps every existing assignment intact.
create or replace function public.admin_rename_tag(
  p_tag_id    uuid,
  p_new_label text,
  p_force     boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check jsonb;
  v_norm  text;
begin
  if not public.is_tag_admin() then
    raise exception 'Not authorised.';
  end if;

  v_norm := public.normalize_tag(p_new_label);

  -- same normalised tag = display-casing change only, always allowed
  if exists (select 1 from public.brand_tags where id = p_tag_id and tag = v_norm) then
    update public.brand_tags
       set label = trim(p_new_label), updated_at = now()
     where id = p_tag_id;
    return jsonb_build_object('status','renamed','tag',v_norm);
  end if;

  v_check := public.validate_brand_tag(p_new_label, 'descriptive');

  if v_check->>'status' = 'block' then
    return v_check;
  end if;

  if v_check->>'status' = 'warn' and not p_force then
    return v_check;
  end if;

  update public.brand_tags
     set tag = v_check->>'tag', label = trim(p_new_label), updated_at = now()
   where id = p_tag_id;

  return jsonb_build_object('status','renamed','tag', v_check->>'tag');
end;
$$;


create or replace function public.admin_delete_tag(p_tag_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_tag_admin() then
    raise exception 'Not authorised.';
  end if;

  delete from public.brand_tags where id = p_tag_id;  -- assignments cascade
  return jsonb_build_object('status','deleted');
end;
$$;


-- ----------------------------------------------------------------------------
-- 9. Read helpers (app + admin)
-- ----------------------------------------------------------------------------
-- Identity tag always sorts first.
create or replace function public.get_brand_tags(p_brand_id uuid)
returns table (
  tag_id   uuid,
  tag      text,
  label    text,
  tag_type text
)
language sql
stable
as $$
  select t.id, t.tag, t.label, t.tag_type
    from public.brand_tag_assignments a
    join public.brand_tags t on t.id = a.tag_id
   where a.brand_id = p_brand_id
   order by (t.tag_type = 'identity') desc, a.sort_order, t.label;
$$;


-- Tag pool with usage counts, for the admin Tags section.
create or replace function public.get_tag_pool()
returns table (
  tag_id      uuid,
  tag         text,
  label       text,
  tag_type    text,
  brand_count bigint,
  created_at  timestamptz
)
language sql
stable
as $$
  select t.id, t.tag, t.label, t.tag_type,
         count(a.id) as brand_count, t.created_at
    from public.brand_tags t
    left join public.brand_tag_assignments a on a.tag_id = t.id
   group by t.id
   order by t.tag_type, count(a.id) desc, t.label;
$$;


grant execute on function public.normalize_tag(text)                      to anon, authenticated, service_role;
grant execute on function public.validate_brand_tag(text, text)           to authenticated, service_role;
grant execute on function public.ensure_brand_identity_tag(uuid)          to authenticated, service_role;
grant execute on function public.admin_create_tag(text, boolean)          to authenticated, service_role;
grant execute on function public.admin_assign_tag(uuid, uuid)             to authenticated, service_role;
grant execute on function public.admin_unassign_tag(uuid, uuid)           to authenticated, service_role;
grant execute on function public.admin_rename_tag(uuid, text, boolean)    to authenticated, service_role;
grant execute on function public.admin_delete_tag(uuid)                   to authenticated, service_role;
grant execute on function public.get_brand_tags(uuid)                     to anon, authenticated, service_role;
grant execute on function public.get_tag_pool()                           to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 10. Backfill — identity tags for every existing brand
-- ----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select id from public.profiles
     where account_type in ('brand','founding_brand','performer')
  loop
    perform public.ensure_brand_identity_tag(r.id);
  end loop;
end $$;
