-- ============================================================================
-- InCynq — gig history for the performer profile
-- ============================================================================
-- Listener numbers were stored on the session and shown nowhere except a toast
-- that vanishes in a few seconds. "How did Friday go?" is a real question and
-- the answer was disappearing.
--
-- Lives on the PROFILE, not the event card: events are hidden 24h after their
-- date, so a card-based history would evaporate with them. The profile is also
-- where the earnings view goes when the tip jar is built, so audience and money
-- end up side by side — which is the pair a DJ actually wants to compare.
--
-- Safe to re-run.
-- ============================================================================

create or replace function public.get_performer_gigs(
  p_performer_id uuid,
  p_limit        integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x.started_at desc), '[]'::jsonb)
    from (
      select s.id,
             s.started_at,
             s.ended_at,
             s.hours_consumed,
             -- Minutes is what a DJ thinks in; 0.333 hours means nothing.
             round(coalesce(s.hours_consumed, 0) * 60)::integer as minutes,
             coalesce(s.total_listeners, 0) as total_listeners,
             coalesce(s.peak_listeners, 0)  as peak_listeners,
             s.ended_reason,
             e.title,
             e.date as event_date
        from public.live_sessions s
        join public.events e on e.id = s.event_id
       where s.performer_id = p_performer_id
         and s.status = 'ended'
       order by s.started_at desc
       limit greatest(1, least(coalesce(p_limit, 20), 100))
    ) x;
$$;


-- Lifetime totals — the numbers worth putting at the top of the list.
create or replace function public.get_performer_stats(p_performer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'gigs',            count(*),
    'total_minutes',   coalesce(round(sum(hours_consumed) * 60), 0)::integer,
    'total_listeners', coalesce(sum(total_listeners), 0)::integer,
    'best_crowd',      coalesce(max(peak_listeners), 0)::integer
  )
    from public.live_sessions
   where performer_id = p_performer_id and status = 'ended';
$$;


grant execute on function public.get_performer_gigs(uuid, integer) to authenticated, service_role;
grant execute on function public.get_performer_stats(uuid)         to authenticated, service_role;

notify pgrst, 'reload schema';

select routine_name
  from information_schema.routines
 where routine_schema = 'public'
   and routine_name in ('get_performer_gigs','get_performer_stats')
 order by routine_name;
