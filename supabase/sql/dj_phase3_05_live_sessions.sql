-- ============================================================================
-- InCynq — DJ / Performer: live sessions (Phase 3, step 2)
-- ============================================================================
-- Go Live / End Set, with airtime metered per minute against hours_balance.
--
-- MODEL (decided 19 Sep):
--   Airtime is a BALANCE, not a booking. The DJ buys hours; broadcasting spends
--   the minutes actually used. No set length is chosen in advance.
--
--   The clock starts on Go Live and stops on End Set. The session is CAPPED at
--   whatever hours the performer has, so nobody broadcasts past their balance —
--   the cap is a safety limit, not a purchase.
--
--   Settled at the END, not drawn down continuously. A continuous draw-down
--   needs a cron and keeps billing a DJ whose connection dropped; settling on
--   end means a crashed session is closed by the sweep and charged only its
--   capped duration.
--
-- STREAM URL PROTECTION:
--   A DJ's stream address is permanent — the same Shoutcast/Icecast URL for
--   every gig, for years. Phase 3 step 1 returned it in the events list via
--   `select *`, so one unauthenticated request harvested every DJ's address at
--   once, forever. That is fixed here: the events list no longer exposes it,
--   and it is obtainable only through get_live_stream(), which answers only
--   while a session is actually live, and only to a signed-in resident.
--
--   This does not make it secret — a browser that plays audio must fetch it,
--   and devtools will show it. It makes it per-gig and per-listener instead of
--   free to everyone. Truly hiding it would need InCynq to proxy the audio,
--   which would put InCynq in the streaming business. Deliberately not done.
--
-- Safe to re-run.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. live_sessions
-- ----------------------------------------------------------------------------
create table if not exists public.live_sessions (
  id              uuid primary key default gen_random_uuid(),
  performer_id    uuid not null references public.profiles(id) on delete cascade,
  event_id        uuid not null references public.events(id)   on delete cascade,
  status          text not null default 'live'
                    check (status in ('live', 'ended', 'cancelled')),
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  -- Hard stop: started_at + whatever hours the performer had at Go Live.
  auto_end_at     timestamptz not null,
  hours_at_start  numeric not null,
  hours_consumed  numeric,
  ended_reason    text check (ended_reason in ('performer', 'auto', 'admin')),
  created_at      timestamptz not null default now()
);

create index if not exists idx_live_sessions_performer on public.live_sessions(performer_id);
create index if not exists idx_live_sessions_event     on public.live_sessions(event_id);
-- One live session per performer. Partial unique index, so ended sessions don't collide.
create unique index if not exists idx_live_sessions_one_live
  on public.live_sessions(performer_id) where status = 'live';

grant select on public.live_sessions to anon, authenticated;
grant select, insert, update, delete on public.live_sessions to service_role;

alter table public.live_sessions enable row level security;

drop policy if exists live_sessions_public_read on public.live_sessions;
create policy live_sessions_public_read on public.live_sessions
  for select using (true);

drop policy if exists live_sessions_service_all on public.live_sessions;
create policy live_sessions_service_all on public.live_sessions
  for all to service_role using (true) with check (true);
-- Writes go through the RPCs below. No raw client inserts.


-- ----------------------------------------------------------------------------
-- 2. Who may act as this performer?
-- ----------------------------------------------------------------------------
create or replace function public.owns_performer(p_performer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = p_performer_id
       and account_type = 'performer'
       and brand_owner_id = auth.uid()
  );
$$;


-- ----------------------------------------------------------------------------
-- 3. go_live
-- ----------------------------------------------------------------------------
create or replace function public.go_live(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event     record;
  v_hours     numeric;
  v_session   record;
  v_auto_end  timestamptz;
begin
  select id, performer_id, is_live_set, stream_url, title
    into v_event
    from public.events where id = p_event_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Event not found');
  end if;

  if not v_event.is_live_set or v_event.performer_id is null then
    return jsonb_build_object('ok', false, 'error', 'This event is not a live set');
  end if;

  if not public.owns_performer(v_event.performer_id) then
    return jsonb_build_object('ok', false, 'error', 'Not your gig');
  end if;

  if coalesce(v_event.stream_url, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Add your stream URL to the event first');
  end if;

  -- Already live? Return the existing session rather than erroring, so a double
  -- tap or a reconnect lands somewhere sensible.
  select * into v_session
    from public.live_sessions
   where performer_id = v_event.performer_id and status = 'live';

  if found then
    return jsonb_build_object(
      'ok', true, 'already_live', true,
      'session_id', v_session.id,
      'started_at', v_session.started_at,
      'auto_end_at', v_session.auto_end_at
    );
  end if;

  select coalesce(hours_balance, 0) into v_hours
    from public.performer_profiles where profile_id = v_event.performer_id;

  -- A minute is the smallest unit we bill, so refuse below that.
  if coalesce(v_hours, 0) < (1.0 / 60.0) then
    return jsonb_build_object('ok', false, 'error', 'No airtime left — top up to go live');
  end if;

  v_auto_end := now() + (v_hours * interval '1 hour');

  insert into public.live_sessions (performer_id, event_id, auto_end_at, hours_at_start)
  values (v_event.performer_id, p_event_id, v_auto_end, v_hours)
  returning * into v_session;

  return jsonb_build_object(
    'ok', true,
    'session_id',  v_session.id,
    'started_at',  v_session.started_at,
    'auto_end_at', v_auto_end,
    'hours_available', v_hours
  );
end;
$$;


-- ----------------------------------------------------------------------------
-- 4. end_set — settle the airtime actually used
-- ----------------------------------------------------------------------------
-- Shared by the performer's End Set button, the auto-end sweep, and admin.
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

  update public.performer_profiles
     set hours_balance = greatest(0, coalesce(hours_balance, 0) - v_used),
         updated_at    = now()
   where profile_id = v_session.performer_id
  returning hours_balance into v_remaining;

  update public.live_sessions
     set status = 'ended', ended_at = v_end,
         hours_consumed = v_used, ended_reason = p_reason
   where id = p_session_id;

  return jsonb_build_object(
    'ok', true,
    'hours_consumed',  v_used,
    'minutes_consumed', round(v_used * 60),
    'hours_remaining', coalesce(v_remaining, 0),
    'ended_reason',    p_reason
  );
end;
$$;


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
  return public.settle_session(p_session_id, 'performer');
end;
$$;


-- ----------------------------------------------------------------------------
-- 5. sweep_live_sessions — close anything past its cap
-- ----------------------------------------------------------------------------
-- Call on a schedule, and also opportunistically from the client (see below),
-- so a forgotten session can't sit "live" forever.
create or replace function public.sweep_live_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r       record;
  v_count integer := 0;
begin
  for r in
    select id from public.live_sessions
     where status = 'live' and auto_end_at <= now()
  loop
    perform public.settle_session(r.id, 'auto');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;


-- ----------------------------------------------------------------------------
-- 6. What's live right now (public — no stream URL)
-- ----------------------------------------------------------------------------
create or replace function public.get_live_now()
returns table (
  session_id    uuid,
  event_id      uuid,
  performer_id  uuid,
  brand_name    text,
  brand_handle  text,
  brand_logo_url text,
  title         text,
  started_at    timestamptz,
  auto_end_at   timestamptz
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
   where s.status = 'live' and s.auto_end_at > now()
   order by s.started_at desc;
$$;


-- ----------------------------------------------------------------------------
-- 7. get_live_stream — the ONLY way to obtain a stream URL
-- ----------------------------------------------------------------------------
-- Answers only while the session is genuinely live, and only to a signed-in
-- resident. Not granted to anon.
create or replace function public.get_live_stream(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_url text;
  v_session record;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in to listen');
  end if;

  select s.* into v_session
    from public.live_sessions s
   where s.event_id = p_event_id and s.status = 'live' and s.auto_end_at > now();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Not broadcasting right now');
  end if;

  select stream_url into v_url from public.events where id = p_event_id;

  if coalesce(v_url, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'No stream on this event');
  end if;

  return jsonb_build_object('ok', true, 'stream_url', v_url, 'session_id', v_session.id);
end;
$$;


-- ----------------------------------------------------------------------------
-- 8. Events list WITHOUT stream_url
-- ----------------------------------------------------------------------------
-- Phase 3 step 1 had the client do `select *` on events, which handed every
-- DJ's permanent stream address to anyone who asked. This replaces it.
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
             -- deliberately NOT e.stream_url
             (select s.id from public.live_sessions s
               where s.event_id = e.id and s.status = 'live' and s.auto_end_at > now()
               limit 1) as live_session_id,
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
    ) x;
$$;


grant execute on function public.owns_performer(uuid)        to authenticated, service_role;
grant execute on function public.go_live(uuid)               to authenticated, service_role;
grant execute on function public.end_set(uuid)               to authenticated, service_role;
grant execute on function public.settle_session(uuid, text)  to service_role;
grant execute on function public.sweep_live_sessions()       to anon, authenticated, service_role;
grant execute on function public.get_live_now()              to anon, authenticated, service_role;
-- NOT anon: a stream URL requires a signed-in listener.
grant execute on function public.get_live_stream(uuid)       to authenticated, service_role;
grant execute on function public.list_events()               to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- Confirm
-- ----------------------------------------------------------------------------
select routine_name
  from information_schema.routines
 where routine_schema = 'public'
   and routine_name in ('go_live','end_set','settle_session','sweep_live_sessions',
                        'get_live_now','get_live_stream','list_events','owns_performer')
 order by routine_name;
