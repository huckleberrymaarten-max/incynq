-- ============================================================================
-- InCynq — Live listener count
-- ============================================================================
-- A DJ playing to an unknown number is flying blind. This tells them how many
-- people are listening through InCynq.
--
-- WHY IT IS COUNTED HERE AND NOT FROM THE STREAM:
--   The audio comes straight from the DJ's own Shoutcast/Icecast server, so
--   InCynq never sees the connection. Shoutcast does expose a listener count,
--   but reading it needs the DJ's admin credentials and would count everyone
--   listening from anywhere — not the number that matters to InCynq.
--
-- HOW IT WORKS:
--   The player heartbeats every 30s while audio is playing. A listener is
--   "present" if seen in the last 60s. Stop listening, close the tab, lose
--   connection — the row goes stale and they drop out on their own. No cleanup
--   job is needed for correctness; the delete below is only housekeeping.
--
-- HONEST LIMITATION: this counts people with the player open, not people
-- actually listening. Someone who wanders off with a tab open still counts.
-- Good enough, and far better than nothing.
--
-- Safe to re-run.
-- ============================================================================

create table if not exists public.live_listeners (
  session_id   uuid not null references public.live_sessions(id) on delete cascade,
  user_id      uuid not null references public.profiles(id)      on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index if not exists idx_live_listeners_seen on public.live_listeners(session_id, last_seen_at);

grant select on public.live_listeners to authenticated;
grant select, insert, update, delete on public.live_listeners to service_role;

alter table public.live_listeners enable row level security;

drop policy if exists live_listeners_service_all on public.live_listeners;
create policy live_listeners_service_all on public.live_listeners
  for all to service_role using (true) with check (true);
-- No client-side read policy: the count comes from the RPCs below, so one
-- listener can't enumerate who else is in the room.


-- ----------------------------------------------------------------------------
-- heartbeat — called by the player every 30s, returns the current count
-- ----------------------------------------------------------------------------
create or replace function public.listener_ping(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_live  boolean;
  v_count integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;

  select true into v_live
    from public.live_sessions
   where id = p_session_id and status = 'live' and auto_end_at > now();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Session is not live');
  end if;

  insert into public.live_listeners (session_id, user_id)
  values (p_session_id, auth.uid())
  on conflict (session_id, user_id)
  do update set last_seen_at = now();

  select count(*)::integer into v_count
    from public.live_listeners
   where session_id = p_session_id
     and last_seen_at > now() - interval '60 seconds';

  return jsonb_build_object('ok', true, 'listeners', v_count);
end;
$$;


-- ----------------------------------------------------------------------------
-- leaving — drop out immediately rather than waiting to go stale
-- ----------------------------------------------------------------------------
create or replace function public.listener_leave(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', true);
  end if;
  delete from public.live_listeners
   where session_id = p_session_id and user_id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;


-- ----------------------------------------------------------------------------
-- the count, for the DJ's own session
-- ----------------------------------------------------------------------------
create or replace function public.get_listener_count(p_session_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.live_listeners
   where session_id = p_session_id
     and last_seen_at > now() - interval '60 seconds';
$$;


-- ----------------------------------------------------------------------------
-- Peak + total, kept on the session when it ends
-- ----------------------------------------------------------------------------
-- Worth having: "14 people listened" is a better memory of a gig than a live
-- number that vanishes when the set does.
alter table public.live_sessions
  add column if not exists peak_listeners  integer default 0,
  add column if not exists total_listeners integer default 0;


-- settle_session gains the listener stats. Everything else about it is
-- unchanged from dj_phase3_05.
create or replace function public.settle_session(p_session_id uuid, p_reason text)
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

  -- Never bill past the cap, however late the sweep runs.
  v_end := least(now(), v_session.auto_end_at);

  v_used := extract(epoch from (v_end - v_session.started_at)) / 3600.0;
  if v_used < 0 then v_used := 0; end if;
  -- Bill whole minutes, rounded up: a 47m12s set costs 48 minutes, not 47.2.
  v_used := ceil(v_used * 60.0) / 60.0;
  v_used := least(v_used, v_session.hours_at_start);

  -- Everyone who tuned in at any point, not just those present at the end.
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

  -- Presence rows have done their job; the totals live on the session now.
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


-- Peak is updated as it happens, since it can't be reconstructed afterwards.
create or replace function public.listener_ping(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_live  boolean;
  v_count integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Not signed in');
  end if;

  select true into v_live
    from public.live_sessions
   where id = p_session_id and status = 'live' and auto_end_at > now();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Session is not live');
  end if;

  insert into public.live_listeners (session_id, user_id)
  values (p_session_id, auth.uid())
  on conflict (session_id, user_id)
  do update set last_seen_at = now();

  select count(*)::integer into v_count
    from public.live_listeners
   where session_id = p_session_id
     and last_seen_at > now() - interval '60 seconds';

  update public.live_sessions
     set peak_listeners = greatest(coalesce(peak_listeners, 0), v_count)
   where id = p_session_id;

  return jsonb_build_object('ok', true, 'listeners', v_count);
end;
$$;


grant execute on function public.listener_ping(uuid)      to authenticated, service_role;
grant execute on function public.listener_leave(uuid)     to authenticated, service_role;
grant execute on function public.get_listener_count(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

select routine_name
  from information_schema.routines
 where routine_schema = 'public'
   and routine_name in ('listener_ping','listener_leave','get_listener_count','settle_session')
 order by routine_name;
