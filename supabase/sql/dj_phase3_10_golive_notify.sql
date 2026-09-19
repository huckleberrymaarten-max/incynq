-- ============================================================================
-- InCynq — tell people when the gig they RSVP'd to actually starts
-- ============================================================================
-- RSVP and Interested were write-only: you marked yourself going, a counter
-- went up, and nothing ever came of it. In SL people forget events constantly,
-- so the whole value of saying "I'm going" is being reminded when it starts.
--
-- WHY ON GO LIVE, NOT ON A SCHEDULE:
--   The advertised start time is informational — nothing enforces it, and DJs
--   start when the previous set finishes, not when the poster said. Firing on
--   Go Live means the notification is always true: it's happening NOW. It also
--   needs no cron, which is one less thing to silently stop working.
--
-- Safe to re-run.
-- ============================================================================

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
  v_name      text;
  v_notified  integer := 0;
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
  -- tap or a reconnect lands somewhere sensible — and DON'T notify again.
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

  insert into public.live_sessions (performer_id, event_id, auto_end_at, hours_at_start, last_heartbeat_at)
  values (v_event.performer_id, p_event_id, v_auto_end, v_hours, now())
  returning * into v_session;

  -- ── Tell the people who said they were coming ──
  -- RSVP'd ('going') ONLY, not 'interested'. Interested is the softer signal —
  -- a maybe, not a commitment — and it stays that way rather than being used as
  -- an excuse to notify. Keeps the two buttons meaningfully different.
  --
  -- Best-effort: a notification failure must never stop a set from starting.
  begin
    select coalesce(nullif(brand_name, ''), display_name, username)
      into v_name from public.profiles where id = v_event.performer_id;

    insert into public.notifications (user_id, type, actor_id, text)
    select r.user_id, 'system', v_event.performer_id,
           '🔴 ' || coalesce(v_name, 'Your DJ') || ' is live now — ' || v_event.title
      from public.event_rsvps r
     where r.event_id = p_event_id
       and r.status = 'going'
       and r.user_id <> v_event.performer_id;

    get diagnostics v_notified = row_count;
  exception when others then
    -- Don't let a notification problem block the gig.
    v_notified := 0;
  end;

  return jsonb_build_object(
    'ok', true,
    'session_id',  v_session.id,
    'started_at',  v_session.started_at,
    'auto_end_at', v_auto_end,
    'hours_available', v_hours,
    'notified', v_notified
  );
end;
$$;

grant execute on function public.go_live(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';

-- Confirm the columns this relies on actually exist
select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='event_rsvps') as event_rsvps_cols,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='notifications') as notifications_cols;
