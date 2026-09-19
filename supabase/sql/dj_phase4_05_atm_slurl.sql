-- ============================================================================
-- InCynq — where to top up
-- ============================================================================
-- A tip button that does nothing because the wallet is empty is useless. Better
-- to say what's wrong and where to fix it — with a SLURL, so it's one click
-- rather than "go find an ATM somewhere".
--
-- Picks an active ATM. Wall-mounted ones are preferred: there are more of them,
-- they're at the InCynq HQ wall, and they're easier to walk up to than a
-- free-standing unit tucked in a corner.
--
-- Safe to re-run.
-- ============================================================================

-- Returns BOTH link forms on purpose:
--   slurl   → secondlife://…  opens the viewer directly. Does nothing at all in
--             a phone browser, which is the worst kind of broken: it looks
--             clickable and silently fails.
--   map_url → maps.secondlife.com/…  degrades properly everywhere. Viewer
--             running: offers a teleport. Not running: shows the place and
--             offers the install. On a phone: shows where it is on the map, so
--             they know where to go later.
--
-- Anything rendered in a browser should use map_url.
create or replace function public.get_atm_slurl()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
              'slurl',  d.slurl,
              'map_url',
                case when d.slurl like 'secondlife://%'
                  then 'https://maps.secondlife.com/secondlife/' ||
                       replace(substring(d.slurl from 14), ' ', '%20')
                  else null
                end,
              'region', d.region,
              'name',   d.device_name)
       from public.inworld_devices d
      where d.device_type = 'atm'
        and d.active = true
        and d.slurl is not null
        -- Prefer a device that's actually checking in: pointing someone at a
        -- dead ATM is worse than not pointing them anywhere.
      order by (d.last_seen_at > now() - interval '10 minutes') desc,
               d.device_name
      limit 1),
    '{}'::jsonb
  );
$$;

grant execute on function public.get_atm_slurl() to anon, authenticated, service_role;

notify pgrst, 'reload schema';

select jsonb_pretty(public.get_atm_slurl());

-- Check the map URL comes out right
select (public.get_atm_slurl())->>'slurl'   as slurl,
       (public.get_atm_slurl())->>'map_url' as map_url;
