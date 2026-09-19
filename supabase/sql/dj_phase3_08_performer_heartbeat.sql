-- ============================================================================
-- InCynq — Performer heartbeat (dropped connections)
-- ============================================================================
-- THE PROBLEM
--   Airtime is settled on elapsed time between Go Live and End set. If the DJ's
--   connection drops mid-gig, nothing tells the database — the session stays
--   'live' and the clock keeps running. The DJ comes back an hour later, taps
--   End set, and pays for an hour they weren't broadcasting. The airtime cap
--   bounds it, but it doesn't make it right.
--
-- THE FIX
--   The performer's browser pings while live, same as listeners do. If the
--   pings stop for longer than the grace period, the sweep ends the session and
--   bills only up to the LAST HEARTBEAT — not up to now.
--
-- THE TRADE-OFF, STATED PLAINLY
--   The browser tab is the meter. A DJ who closes InCynq but keeps streaming
--   from their own software will be cut off after the grace period. That is
--   worse than over-billing in one way (it's visible, mid-gig) and better in
--   another (they keep their airtime and can Go Live again immediately).
--   Ten minutes is generous enough to survive a reload, a phone call, or a
--   brief network blip, and short enough that a real drop doesn't cost much.
--
-- Safe to re-run.
-- ============================================================================

alter table public.live_sessions
  add column if not exists last_heartbeat_at timestamptz;

-- Existing live sessions: treat the start as the last known heartbeat, so they
-- aren't swept instantly on deploy.
update public.live_sessions
   set last_heartbeat_at = coalesce(last_heartbeat_at, started_at)
 where status = 'live';

-- 'dropped' joins the existing reasons so the DJ can be told what happened.
do $$
begin
  alter table public.live_sessions drop constraint if exists live_sessions_ended_reason_check;
  alter table public.live_sessions add constraint live_sessions_ended_reason_check
    check (ended_reason in ('performer', 'auto', 'admin', 'dropped'));
end $$;


-- ----------------------------------------------------------------------------
-- The performer's own heartbeat
-- ----------------------------------------------------------------------------
-- Returns the listener count too, so the DJ's browser makes one call rather
-- than two.
create or replace function public.performer_heartbeat(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_count   integer;
begin
  select * into v_session from public.live_sessions where id = p_session_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Session not found');
  end if;
  if not public.owns_performer(v_session.performer_id) then
    return jsonb_build_object('ok', false, 'error', 'Not your session');
  end if;
  if v_session.status <> 'live' then
    return jsonb_build_object('ok', false, 'error', 'Session is not live', 'ended', true);
  end if;

  update public.live_sessions
     set last_heartbeat_at = now()
   where id = p_session_id;

  select count(*)::integer into v_count
    from public.live_listeners
   where session_id = p_session_id
     and last_seen_at > now() - interval '60 seconds';

  return jsonb_build_object(
    'ok', true,
    'listeners',   v_count,
    'auto_end_at', v_session.auto_end_at
  );
end;
$$;


-- ----------------------------------------------------------------------------
-- settle_session gains an explicit end time
-- ----------------------------------------------------------------------------
-- So a dropped session can be billed to its last heartbeat rather than to now.
create or replace function public.settle_session(
  p_session_id uuid,
  p_reason     text,
  p_end_at     timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session   record;
  v_end       timestamptz;
  v_used      numeric;
  v_remaining numeric;
  v_total     integer;
begin
  select * into v_session from public.live_sessions where id = p_session_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Session not found');
  end if;
  if v_session.status <> 'live' then
    return jsonb_build_object('ok', true, 'already_ended', true,
      'hours_consumed', v_session.hours_consumed);
  end if;

  -- Bill to the explicit end time when given (a dropped connection bills to the
  -- last heartbeat), otherwise to now. Never past the cap, however late the
  -- sweep runs, and never before the start.
  v_end := least(coalesce(p_end_at, now()), v_session.auto_end_at);
  if v_end < v_session.started_at then v_end := v_session.started_at; end if;

  v_used := extract(epoch from (v_end - v_session.started_at)) / 3600.0;
  if v_used < 0 then v_used := 0; end if;
  -- Bill whole minutes, rounded up: a 47m12s set costs 48 minutes, not 47.2.
  v_used := ceil(v_used * 60.0) / 60.0;
  v_used := least(v_used, v_session.hours_at_start);

  select count(*)::integer into v_total
    from public.live_listeners where session_id = p_session_id;

  update public.performer_profiles
     set hours_balance = greatest(0, coalesce(hours_balance, 0) - v_used),
         updated_at    = now()
   where profile_id = v_session.performer_id
  returning hours_balance into v_remaining;

  update public.live_sessions
     set status = 'ended', ended_at = v_end,
         hours_consumed = v_used, ended_reason = p_reason,
         total_listeners = coalesce(v_total, 0)
   where id = p_session_id;

  delete from public.live_listeners where session_id = p_session_id;

  return jsonb_build_object(
    'ok', true,
    'hours_consumed',   v_used,
    'minutes_consumed', round(v_used * 60),
    'hours_remaining',  coalesce(v_remaining, 0),
    'total_listeners',  coalesce(v_total, 0),
    'ended_reason',     p_reason
  );
end;
$$;

-- The two-argument form is gone; end_set and the sweep call the three-arg one.
drop function if exists public.settle_session(uuid, text);


create or replace function public.end_set(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_performer uuid;
begin
  select performer_id into v_performer from public.live_sessions where id = p_session_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Session not found');
  end if;
  if not public.owns_performer(v_performer) then
    return jsonb_build_object('ok', false, 'error', 'Not your session');
  end if;
  return public.settle_session(p_session_id, 'performer', null);
end;
$$;


-- ----------------------------------------------------------------------------
-- The sweep now handles both ways a session can be abandoned
-- ----------------------------------------------------------------------------
create or replace function public.sweep_live_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r        record;
  v_count  integer := 0;
  -- Generous enough to survive a page reload, a phone call or a brief network
  -- blip. Short enough that a genuine drop doesn't cost the DJ much airtime.
  v_grace  interval := interval '10 minutes';
begin
  -- 1. Past the airtime cap — bill the full capped duration.
  for r in
    select id from public.live_sessions
     where status = 'live' and auto_end_at <= now()
  loop
    perform public.settle_session(r.id, 'auto', null);
    v_count := v_count + 1;
  end loop;

  -- 2. Heartbeat gone quiet — bill only up to the last one we heard.
  for r in
    select id, coalesce(last_heartbeat_at, started_at) as last_beat
      from public.live_sessions
     where status = 'live'
       and coalesce(last_heartbeat_at, started_at) < now() - v_grace
  loop
    perform public.settle_session(r.id, 'dropped', r.last_beat);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


grant execute on function public.performer_heartbeat(uuid)                  to authenticated, service_role;
grant execute on function public.settle_session(uuid, text, timestamptz)    to service_role;
grant execute on function public.end_set(uuid)                              to authenticated, service_role;
grant execute on function public.sweep_live_sessions()                      to anon, authenticated, service_role;

notify pgrst, 'reload schema';

select routine_name
  from information_schema.routines
 where routine_schema = 'public'
   and routine_name in ('performer_heartbeat','settle_session','end_set','sweep_live_sessions')
 order by routine_name;
