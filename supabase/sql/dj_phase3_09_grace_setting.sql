-- ============================================================================
-- InCynq — heartbeat grace period becomes an admin setting
-- ============================================================================
-- sweep_live_sessions() had the grace period hardcoded at 10 minutes. Neither
-- of us knows whether that's right — it's a number that only reality can tune:
--
--   TOO SHORT → a DJ who closes the InCynq tab but keeps streaming from their
--               own software gets cut off mid-set. Visible and disruptive.
--   TOO LONG  → a genuine connection drop costs airtime they didn't use.
--
-- So it moves to app_content, editable in the admin Content tab, same as every
-- price. Change it when a DJ complains rather than redeploying SQL.
--
-- The signal to watch is live_sessions.ended_reason:
--   'performer' → tapped End set. Normal.
--   'auto'      → hit their airtime cap. Normal.
--   'dropped'   → heartbeat went quiet. A few is fine; lots means DJs aren't
--                 keeping the tab open, so raise the grace or rethink.
--
-- Safe to re-run.
-- ============================================================================

insert into public.app_content (key, value)
values ('live_heartbeat_grace_minutes', '10')
on conflict (key) do nothing;


create or replace function public.sweep_live_sessions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r        record;
  v_count  integer := 0;
  v_grace  interval;
  v_mins   integer;
begin
  select coalesce(nullif(value, '')::integer, 10) into v_mins
    from public.app_content where key = 'live_heartbeat_grace_minutes';

  -- Guard rails around whatever is typed in admin: under a minute would end
  -- sessions almost instantly (the browser pings every 60s), and beyond a few
  -- hours the airtime cap is doing the work anyway.
  if v_mins is null or v_mins < 2   then v_mins := 2;   end if;
  if v_mins > 240                    then v_mins := 240; end if;
  v_grace := make_interval(mins => v_mins);

  -- 1. Past the airtime cap — bill the full capped duration.
  for r in
    select id from public.live_sessions
     where status = 'live' and auto_end_at <= now()
  loop
    perform public.settle_session(r.id, 'auto', null);
    v_count := v_count + 1;
  end loop;

  -- 2. Heartbeat gone quiet — bill only up to the last one we heard, so the DJ
  --    never pays for time they weren't broadcasting.
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


-- The performer's browser needs to know the window so it can warn them before
-- they lose the session — "keep InCynq open while you're live".
create or replace function public.get_live_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'grace_minutes',
      coalesce((select nullif(value, '')::integer
                  from public.app_content
                 where key = 'live_heartbeat_grace_minutes'), 10)
  );
$$;


grant execute on function public.sweep_live_sessions() to anon, authenticated, service_role;
grant execute on function public.get_live_settings()   to anon, authenticated, service_role;

notify pgrst, 'reload schema';

select key, value from public.app_content where key = 'live_heartbeat_grace_minutes';
