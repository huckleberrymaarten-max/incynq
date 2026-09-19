-- ============================================================================
-- InCynq — Interest Tag Deduplication (v1)
-- ============================================================================
-- PROBLEM: interest_tags.subcategory_id is a single FK, so a tag belongs to ONE
-- subcategory. 61 words are duplicated across 332 rows (#newrelease exists 32
-- times). The composer flattens the tree and shows every copy.
--
-- FIX: one row per unique tag + a link table for the many subcategories it
-- belongs to.
--
-- SAFE TO RUN NOW: user_interests is empty (0 rows) and posts.tags is text[],
-- so nothing points at the tag ids being merged. This gets much harder after
-- launch.
--
-- Backups are taken first. Rollback instructions at the bottom.
-- Run brand_tags_01_schema.sql BEFORE this (needs normalize_tag).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Safety
-- ----------------------------------------------------------------------------
do $$
begin
  if (select count(*) from public.user_interests) > 0 then
    raise exception 'user_interests is no longer empty — STOP. This migration needs a repointing step before it is safe.';
  end if;
end $$;

drop table if exists public.interest_tags_backup;
drop table if exists public.interest_subcategories_backup;

create table public.interest_tags_backup          as select * from public.interest_tags;
create table public.interest_subcategories_backup as select * from public.interest_subcategories;


-- ----------------------------------------------------------------------------
-- 1. Merge duplicate subcategories (the "Rentals, Rentals" case)
-- ----------------------------------------------------------------------------
-- Survivor = oldest row per (category_id, normalised slug). Tags repoint to it.
with ranked as (
  select id, category_id,
         public.normalize_tag(coalesce(nullif(slug,''), name)) as key,
         row_number() over (
           partition by category_id, public.normalize_tag(coalesce(nullif(slug,''), name))
           order by created_at, id
         ) as rn,
         first_value(id) over (
           partition by category_id, public.normalize_tag(coalesce(nullif(slug,''), name))
           order by created_at, id
         ) as survivor_id
    from public.interest_subcategories
)
update public.interest_tags t
   set subcategory_id = r.survivor_id
  from ranked r
 where t.subcategory_id = r.id
   and r.rn > 1;

with ranked as (
  select id,
         row_number() over (
           partition by category_id, public.normalize_tag(coalesce(nullif(slug,''), name))
           order by created_at, id
         ) as rn
    from public.interest_subcategories
)
delete from public.interest_subcategories sc
 using ranked r
 where sc.id = r.id and r.rn > 1;


-- ----------------------------------------------------------------------------
-- 2. Link table — a tag can live under many subcategories
-- ----------------------------------------------------------------------------
create table if not exists public.interest_tag_links (
  id             uuid primary key default gen_random_uuid(),
  tag_id         uuid not null references public.interest_tags(id)          on delete cascade,
  subcategory_id uuid not null references public.interest_subcategories(id) on delete cascade,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (tag_id, subcategory_id)
);

create index if not exists idx_interest_tag_links_tag on public.interest_tag_links(tag_id);
create index if not exists idx_interest_tag_links_sub on public.interest_tag_links(subcategory_id);

grant select on public.interest_tag_links to anon, authenticated;
grant select, insert, update, delete on public.interest_tag_links to service_role;

alter table public.interest_tag_links enable row level security;

drop policy if exists interest_tag_links_public_read on public.interest_tag_links;
create policy interest_tag_links_public_read on public.interest_tag_links
  for select using (true);

drop policy if exists interest_tag_links_service_all on public.interest_tag_links;
create policy interest_tag_links_service_all on public.interest_tag_links
  for all to service_role using (true) with check (true);


-- ----------------------------------------------------------------------------
-- 3. Capture every existing (tag word -> subcategory) pair BEFORE deduping
-- ----------------------------------------------------------------------------
create temp table tag_pairs as
select public.normalize_tag(t.name) as key,
       t.subcategory_id,
       t.sort_order
  from public.interest_tags t
 where t.subcategory_id is not null;


-- ----------------------------------------------------------------------------
-- 4. Dedupe interest_tags to one row per word
-- ----------------------------------------------------------------------------
-- Survivor = oldest row. Its own subcategory_id stays as its "home" so any
-- existing admin/app code that reads that column keeps working during the
-- transition. The link table is the real source of truth from here.
create temp table tag_survivors as
select distinct on (public.normalize_tag(name))
       id as survivor_id,
       public.normalize_tag(name) as key
  from public.interest_tags
 order by public.normalize_tag(name), created_at, id;

delete from public.interest_tags t
 where not exists (
   select 1 from tag_survivors s where s.survivor_id = t.id
 );


-- ----------------------------------------------------------------------------
-- 5. Rebuild the links from the captured pairs
-- ----------------------------------------------------------------------------
insert into public.interest_tag_links (tag_id, subcategory_id, sort_order)
select s.survivor_id, p.subcategory_id, min(p.sort_order)
  from tag_pairs p
  join tag_survivors s on s.key = p.key
 where exists (select 1 from public.interest_subcategories sc where sc.id = p.subcategory_id)
 group by s.survivor_id, p.subcategory_id
on conflict (tag_id, subcategory_id) do nothing;


-- ----------------------------------------------------------------------------
-- 6. Stop it happening again
-- ----------------------------------------------------------------------------
create unique index if not exists idx_interest_tags_unique_word
  on public.interest_tags (public.normalize_tag(name));


-- ----------------------------------------------------------------------------
-- 7. Admin RPCs for the Interests screen
-- ----------------------------------------------------------------------------
-- Adds a tag to a subcategory. If the word already exists anywhere, this LINKS
-- the existing tag instead of creating a duplicate.
create or replace function public.admin_link_interest_tag(
  p_subcategory_id uuid,
  p_label          text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key    text;
  v_tag_id uuid;
  v_label  text;
  v_new    boolean := false;
begin
  if not public.is_tag_admin() then
    raise exception 'Not authorised.';
  end if;

  v_label := trim(p_label);
  if left(v_label, 1) <> '#' then
    v_label := '#' || v_label;
  end if;

  v_key := public.normalize_tag(v_label);
  if v_key = '' then
    return jsonb_build_object('status','error','reason','Tag must contain letters or numbers.');
  end if;

  select id into v_tag_id from public.interest_tags
   where public.normalize_tag(name) = v_key;

  if not found then
    insert into public.interest_tags (subcategory_id, name, slug, sort_order)
    values (p_subcategory_id, v_label, v_key,
            coalesce((select max(sort_order)+1 from public.interest_tag_links
                       where subcategory_id = p_subcategory_id), 0))
    returning id into v_tag_id;
    v_new := true;
  end if;

  insert into public.interest_tag_links (tag_id, subcategory_id, sort_order)
  values (v_tag_id, p_subcategory_id,
          coalesce((select max(sort_order)+1 from public.interest_tag_links
                     where subcategory_id = p_subcategory_id), 0))
  on conflict (tag_id, subcategory_id) do nothing;

  return jsonb_build_object(
    'status', case when v_new then 'created' else 'linked' end,
    'tag_id', v_tag_id, 'label', v_label,
    'also_used_in', (
      select count(*) from public.interest_tag_links
       where tag_id = v_tag_id and subcategory_id <> p_subcategory_id
    )
  );
end;
$$;


-- Removes a tag from ONE subcategory. Deletes the tag entirely only if that
-- was its last link.
create or replace function public.admin_unlink_interest_tag(
  p_tag_id         uuid,
  p_subcategory_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_remaining integer;
begin
  if not public.is_tag_admin() then
    raise exception 'Not authorised.';
  end if;

  delete from public.interest_tag_links
   where tag_id = p_tag_id and subcategory_id = p_subcategory_id;

  select count(*) into v_remaining
    from public.interest_tag_links where tag_id = p_tag_id;

  if v_remaining = 0 then
    delete from public.interest_tags where id = p_tag_id;
    return jsonb_build_object('status','deleted');
  end if;

  return jsonb_build_object('status','unlinked','remaining_links', v_remaining);
end;
$$;


-- Powers the third column of the Interests screen, including the
-- "also used in" count so you can see reuse instead of recreating a tag.
create or replace function public.get_subcategory_tags(p_subcategory_id uuid)
returns table (
  tag_id       uuid,
  name         text,
  slug         text,
  sort_order   integer,
  also_used_in bigint
)
language sql
stable
as $$
  select t.id, t.name, t.slug, l.sort_order,
         (select count(*) from public.interest_tag_links l2
           where l2.tag_id = t.id and l2.subcategory_id <> p_subcategory_id)
    from public.interest_tag_links l
    join public.interest_tags t on t.id = l.tag_id
   where l.subcategory_id = p_subcategory_id
   order by l.sort_order, t.name;
$$;


-- ----------------------------------------------------------------------------
-- 8. Composer feed — identity tag first, then brand tags, then standard
-- ----------------------------------------------------------------------------
-- Takes CATEGORY ids (what the composer chips actually are) and expands to
-- their subcategories internally. Null/empty = every standard tag.
--
-- Order: identity tag first (preselect = true), then the brand's custom tags,
-- then the category's standard tags. Each word appears exactly once.
create or replace function public.get_composer_tags(
  p_brand_id      uuid default null,
  p_category_ids  uuid[] default null
)
returns table (
  tag_id     uuid,
  label      text,
  slug       text,
  tag_type   text,
  preselect  boolean
)
language sql
stable
as $$
  select * from (
    -- identity + custom tags for this brand
    select bt.id as tag_id, bt.label, bt.tag as slug, bt.tag_type,
           (bt.tag_type = 'identity') as preselect
      from public.brand_tag_assignments a
      join public.brand_tags bt on bt.id = a.tag_id
     where p_brand_id is not null and a.brand_id = p_brand_id

    union all

    -- standard taxonomy tags for the selected categories, one row per word
    select t.id, t.name, t.slug, 'standard'::text, false
      from public.interest_tags t
     where p_category_ids is null
        or array_length(p_category_ids, 1) is null
        or exists (
          select 1
            from public.interest_tag_links l
            join public.interest_subcategories sc on sc.id = l.subcategory_id
           where l.tag_id = t.id
             and sc.category_id = any(p_category_ids)
        )
  ) q
  order by case q.tag_type
             when 'identity'    then 0
             when 'descriptive' then 1
             else 2
           end,
           q.label;
$$;


-- ----------------------------------------------------------------------------
-- 9. (moved) The standard-tag collision check now lives inside
-- validate_brand_tag in brand_tags_01_schema.sql, so the two files can be
-- re-run in any order without clobbering each other.
-- ----------------------------------------------------------------------------

grant execute on function public.admin_link_interest_tag(uuid, text)     to authenticated, service_role;
grant execute on function public.admin_unlink_interest_tag(uuid, uuid)   to authenticated, service_role;
grant execute on function public.get_subcategory_tags(uuid)              to anon, authenticated, service_role;
grant execute on function public.get_composer_tags(uuid, uuid[])         to anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 10. Result
-- ----------------------------------------------------------------------------
do $$
declare v_tags integer; v_links integer; v_subs integer;
begin
  select count(*) into v_tags  from public.interest_tags;
  select count(*) into v_links from public.interest_tag_links;
  select count(*) into v_subs  from public.interest_subcategories;
  raise notice 'Tags: % (was 491) · Links: % · Subcategories: %', v_tags, v_links, v_subs;
end $$;


-- ============================================================================
-- ROLLBACK (only while the backup tables still exist)
-- ============================================================================
-- drop index if exists idx_interest_tags_unique_word;
-- drop table if exists public.interest_tag_links;
-- delete from public.interest_tags;
-- insert into public.interest_tags select * from public.interest_tags_backup;
-- delete from public.interest_subcategories;
-- insert into public.interest_subcategories select * from public.interest_subcategories_backup;
-- ============================================================================
