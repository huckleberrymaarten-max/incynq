-- ============================================================================
-- InCynq — Live Now, follow-aware
-- ============================================================================
-- Replaces the flat get_live_now() with something that stays the same size
-- whether three DJs are broadcasting or thirty.
--
-- THE RULE:
--   DJs you follow      → always shown in the strip, by name.
--   Everyone else       → collapsed behind a count ("🔴 6 others live").
--
-- Why: a flat list works at three performers and becomes a wall at thirty —
-- the same failure as the composer showing every tag at once. Following a
-- performer is the resident saying "surface this one", and the strip should
-- honour that rather than showing everyone equally.
--
-- Discovery still works: the count is tappable and opens the full list, so a
-- resident who follows nobody sees "🔴 3 live" and can browse them.
--
-- Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- The strip — performers this resident follows who are on air right now
-- ----------------------------------------------------------------------------
create or replace function public.get_live_following()
returns table (
  session_id     uuid,
  event_id       uuid,
  performer_id   uuid,
  brand_name     text,
  brand_handle   text,
  brand_logo_url text,
  title          text,
  started_at     timestamptz,
  auto_end_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.event_id, s.performer_id,
         p.brand_name, p.brand_handle, p.brand_logo_url,
         e.title, s.started_at, s.auto_end_at
    from public.live_sessions s
    join public.profiles p on p.id = s.performer_id
    join public.events   e on e.id = s.event_id
    join public.follows  f on f.following_id = s.performer_id
   where s.status = 'live'
     and s.auto_end_at > now()
     and f.follower_id = auth.uid()
   order by s.started_at desc;
$$;


-- ----------------------------------------------------------------------------
-- How many OTHER performers are live (the collapsed count)
-- ----------------------------------------------------------------------------
create or replace function public.count_live_others()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.live_sessions s
   where s.status = 'live'
     and s.auto_end_at > now()
     and (
       auth.uid() is null
       or not exists (
         select 1 from public.follows f
          where f.follower_id = auth.uid() and f.following_id = s.performer_id
       )
     );
$$;


-- ----------------------------------------------------------------------------
-- The full list, behind the count. Followed first, then the rest.
-- ----------------------------------------------------------------------------
create or replace function public.get_live_all()
returns table (
  session_id     uuid,
  event_id       uuid,
  performer_id   uuid,
  brand_name     text,
  brand_handle   text,
  brand_logo_url text,
  title          text,
  genres         jsonb,
  started_at     timestamptz,
  auto_end_at    timestamptz,
  is_following   boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.event_id, s.performer_id,
         p.brand_name, p.brand_handle, p.brand_logo_url,
         e.title,
         (select pp.genres from public.performer_profiles pp where pp.profile_id = s.performer_id),
         s.started_at, s.auto_end_at,
         exists (
           select 1 from public.follows f
            where f.follower_id = auth.uid() and f.following_id = s.performer_id
         ) as is_following
    from public.live_sessions s
    join public.profiles p on p.id = s.performer_id
    join public.events   e on e.id = s.event_id
   where s.status = 'live' and s.auto_end_at > now()
   order by is_following desc, s.started_at desc;
$$;


grant execute on function public.get_live_following() to authenticated, service_role;
grant execute on function public.count_live_others()  to anon, authenticated, service_role;
grant execute on function public.get_live_all()       to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- Confirm
select routine_name
  from information_schema.routines
 where routine_schema = 'public'
   and routine_name in ('get_live_following','count_live_others','get_live_all')
 order by routine_name;
