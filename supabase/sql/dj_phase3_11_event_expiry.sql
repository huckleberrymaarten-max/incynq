-- ============================================================================
-- InCynq — marking a gig as ended, and letting it expire
-- ============================================================================
-- THE PROBLEM
--   A finished set and a dropped one look identical afterwards: both sessions
--   are 'ended', the badge goes back to LIVE SET, Go Live returns. So a gig sits
--   there looking like it's about to start, forever, whether the DJ wrapped up
--   properly or their connection died. And no event ever leaves the list.
--
-- WHAT WE CANNOT DO
--   Tell a deliberate finish from a drop. A DJ who drops and comes back has two
--   sessions on one event; a DJ who drops and gives up has one. Nothing
--   distinguishes them, so anything built on "did they mean to stop" is guessing.
--
-- THE SAFE SHAPE
--   1. State a FACT, don't infer intent: "Set ended 21:14" when the most recent
--      session is over. True either way, and it says nothing about whether more
--      is coming.
--   2. Never block Go Live. If a DJ drops at 21:14 and comes back at 21:40, they
--      tap Go Live and carry on. Locking them out to keep the UI tidy would be
--      the worst possible trade.
--   3. Hide on a PREDICTABLE clock — 24h after the event's own date, not after a
--      session ended. A gig that never ran still disappears; a gig that ran
--      three times still disappears once. Nothing is deleted.
--
-- Safe to re-run.
-- ============================================================================

create or replace function public.list_events()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x.date nulls last, x.time_slt), '[]'::jsonb)
    from (
      select e.id, e.user_id, e.performer_id, e.title, e.location_name, e.slurl,
             e.date, e.time_slt, e.description, e.image_url, e.boost_tier,
             e.boost_expires_at, e.rsvp_count, e.interested_count, e.created_at,
             e.is_official, e.is_live_set,
             -- deliberately NOT e.stream_url — see get_live_stream()
             (select s.id from public.live_sessions s
               where s.event_id = e.id and s.status = 'live' and s.auto_end_at > now()
               limit 1) as live_session_id,

             -- When the most recent session finished. Null if it never ran.
             -- Used for "Set ended HH:MM" — a statement of fact, not a lock.
             (select max(s.ended_at) from public.live_sessions s
               where s.event_id = e.id and s.status = 'ended') as last_ended_at,

             -- How many times it has gone live. A DJ who dropped and came back
             -- has more than one, which is worth seeing rather than hiding.
             (select count(*) from public.live_sessions s
               where s.event_id = e.id and s.status = 'ended') as session_count,

             to_jsonb(cr) - 'id' as profiles,
             case when e.performer_id is null then null
                  else jsonb_build_object(
                    'id', pf.id, 'brand_name', pf.brand_name,
                    'brand_handle', pf.brand_handle, 'brand_logo_url', pf.brand_logo_url)
             end as performer
        from public.events e
        left join lateral (
          select username, display_name, avatar_url, id
            from public.profiles where id = e.user_id
        ) cr on true
        left join public.profiles pf on pf.id = e.performer_id
       -- 24h grace after the event's own date. Generous enough that a set
       -- running past midnight, or a date typed in another timezone, doesn't
       -- vanish early.
       --
       -- The date is now required on the create form, so new events always have
       -- one. The null check stays for any row created before that — losing
       -- someone's gig to a rule it predates would be worse than the clutter.
       where e.date is null
          or e.date >= (current_date - interval '1 day')
    ) x;
$$;

grant execute on function public.list_events() to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- What's visible now, and what has dropped off
select
  (select count(*) from public.events) as total_events,
  jsonb_array_length(public.list_events()) as visible_events;
