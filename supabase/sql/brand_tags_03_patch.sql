-- ============================================================================
-- InCynq — Brand Hashtags — PATCH 03
-- ============================================================================
-- Run AFTER brand_tags_01_schema.sql.
-- Applies two corrections that were missing from the v1 file:
--   1. A paid custom tag can't duplicate a word that already exists as a
--      standard interest tag (it's free for everyone — no purchase needed).
--   2. Identity-tag generation: the collision suffix loop in v1 was dead code.
--      Now a clash with a SHARED tag means no identity tag (don't hijack
--      #vintage), while two brands with the same name get 01, 02 like handles.
-- Safe to re-run.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Validator — add the standard-taxonomy collision check
-- ----------------------------------------------------------------------------
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

  foreach v_word in array public.get_tag_word_list('tag_blocked_words') loop
    if v_word <> '' and position(v_word in v_norm) > 0 then
      return jsonb_build_object('status','block','tag',v_norm,'label',p_label,
        'reason','Contains blocked content. Not permitted on InCynq.');
    end if;
  end loop;

  foreach v_word in array public.get_tag_word_list('tag_protected_words') loop
    if v_word <> '' and v_norm = v_word then
      return jsonb_build_object('status','block','tag',v_norm,'label',p_label,
        'reason','Reserved for InCynq. Cannot be assigned to a brand.');
    end if;
  end loop;

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

  -- NEW: already a free standard tag?
  if p_tag_type = 'descriptive' and to_regclass('public.interest_tags') is not null then
    select t.name into v_word from public.interest_tags t
     where public.normalize_tag(t.name) = v_norm;

    if found then
      return jsonb_build_object('status','block','tag',v_norm,'label',p_label,
        'reason', format('Already a standard tag (%s) — free for every brand, no purchase needed.', v_word));
    end if;
  end if;

  -- plural / singular variant
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

  -- one-character typo
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
    null;
  end;

  foreach v_word in array public.get_tag_word_list('tag_reserved_words') loop
    if v_word <> '' and v_norm = v_word then
      return jsonb_build_object('status','warn','tag',v_norm,'label',p_label,
        'reason','Very broad category word. Fine to create, but it will describe a lot of brands.');
    end if;
  end loop;

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


-- ----------------------------------------------------------------------------
-- 2. Identity tags — fix the dead suffix loop
-- ----------------------------------------------------------------------------
create or replace function public.ensure_brand_identity_tag(p_brand_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name   text;
  v_norm   text;
  v_try    text;
  v_word   text;
  v_n      integer := 0;
  v_check  jsonb;
  v_tag_id uuid;
  v_old    record;
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

  -- don't hijack a SHARED tag
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

  -- category words must not be auto-claimed
  foreach v_word in array public.get_tag_word_list('tag_reserved_words') loop
    if v_word <> '' and v_norm = v_word then
      return jsonb_build_object('status','skipped',
        'reason','Brand name is a category word — not auto-claimed.');
    end if;
  end loop;

  -- two brands, same name -> suffix 01, 02 (same convention as handles)
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
-- 3. Re-run the backfill with the corrected logic
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


-- ----------------------------------------------------------------------------
-- 4. Check — this one RETURNS ROWS, so you'll actually see it
-- ----------------------------------------------------------------------------
select bt.label, bt.tag, bt.tag_type, p.brand_name, p.account_type
  from public.brand_tags bt
  join public.brand_tag_assignments a on a.tag_id = bt.id
  join public.profiles p on p.id = a.brand_id
 order by bt.tag_type, bt.tag;
