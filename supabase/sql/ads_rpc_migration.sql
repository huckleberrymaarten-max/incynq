-- ============================================================================
-- InCynq — Ad RPCs (ad-blocker safe + atomic wallet)
-- ============================================================================
-- WHY: every client call to the ads table hits /rest/v1/ads, and "/ads" is one
-- of the most heavily filtered URL fragments on the web (uBlock, AdGuard, Brave
-- shields, Firefox strict). Writes get killed. Worst case today: placeAd
-- deducts the wallet and inserts the ad as TWO separate client calls, so a
-- blocked insert can leave a brand charged with no ad.
--
-- These functions resolve to /rest/v1/rpc/place_promo etc — neutral names that
-- match no filter list. They also make the deduction + insert atomic: one
-- transaction, so a failed insert rolls the wallet back automatically. No
-- manual refund path needed.
--
-- Safe to re-run.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Shared ownership check — mirrors the existing "Brand owners and managers can
-- insert ads" RLS policy. These functions are SECURITY DEFINER and therefore
-- bypass RLS, so the check MUST live here.
-- ----------------------------------------------------------------------------
create or replace function public.can_manage_brand(p_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = p_brand_id
    or exists (
      select 1 from public.brand_managers
       where brand_owner_id = p_brand_id
         and manager_id     = auth.uid()
         and status         = 'accepted'
    );
$$;


-- Drop any earlier jsonb-signature version before recreating
drop function if exists public.place_promo(uuid, text, jsonb, boolean, text, integer, integer, integer, text, text, text, text, text);
drop function if exists public.place_promo(uuid, text, text[], boolean, text, integer, integer, integer, text, text, text, text, text);
drop function if exists public.list_promos(uuid);
drop function if exists public.feed_promos();

-- ----------------------------------------------------------------------------
-- place_promo — deduct wallet + create ad, atomically
-- ----------------------------------------------------------------------------
-- NOTE: p_price still comes from the client, same as before. Recomputing it
-- server-side would need the whole pricing-tier model in SQL (pricing_tiers,
-- launch promo, group multipliers, random discount, duration discount) — worth
-- doing later, but out of scope here. This change is about the transport and
-- the atomicity, not the pricing.
create or replace function public.place_promo(
  p_brand_id        uuid,
  p_tier            text,
  p_groups          text[]  default '{}'::text[],
  p_is_random       boolean default false,
  p_ad_maturity     text    default 'general',
  p_price           integer default 0,
  p_duration_weeks  integer default 1,
  p_location_id     uuid    default null,
  p_location_name   text    default null,
  p_slurl           text    default null,
  p_marketplace_url text    default null,
  p_ad_caption      text    default null,
  p_ad_image_url    text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_weeks     integer;
  v_remaining integer;
  v_ad_id     uuid;
begin
  if not public.can_manage_brand(p_brand_id) then
    raise exception 'Not authorised to place ads for this brand.';
  end if;

  if p_price < 0 then
    raise exception 'Invalid price.';
  end if;

  v_weeks := case
    when p_duration_weeks between 1 and 4 then p_duration_weeks
    else 1
  end;

  -- Atomic deduction: the balance guard is in the WHERE clause, so two
  -- concurrent ads can never both pass on the same funds. (The old code read
  -- the balance, then wrote it back — a race.)
  update public.profiles
     set brand_wallet = brand_wallet - p_price
   where id = p_brand_id
     and coalesce(brand_wallet, 0) >= p_price
  returning brand_wallet into v_remaining;

  if not found then
    return jsonb_build_object('status','error','reason','Insufficient brand wallet balance');
  end if;

  -- Same transaction: if this raises, the deduction above rolls back too.
  insert into public.ads (
    brand_id, tier, groups, is_random, ad_maturity, price, duration_weeks,
    location_id, location_name, slurl, marketplace_url,
    ad_caption, ad_image_url, status, expires_at
  ) values (
    p_brand_id, p_tier, coalesce(p_groups, '{}'::text[]), coalesce(p_is_random,false),
    coalesce(p_ad_maturity,'general'), p_price, v_weeks,
    p_location_id, p_location_name, p_slurl, p_marketplace_url,
    p_ad_caption, p_ad_image_url, 'active',
    now() + (v_weeks * interval '7 days')
  )
  returning id into v_ad_id;

  return jsonb_build_object(
    'status','ok',
    'ad_id', v_ad_id,
    'wallet_remaining', v_remaining,
    'expires_at', (now() + (v_weeks * interval '7 days'))
  );
end;
$$;


-- ----------------------------------------------------------------------------
-- list_promos — a brand's own ads, active and expired, newest first
-- ----------------------------------------------------------------------------
-- Returns jsonb rather than a typed record set: the ads table's column types
-- can change without this function needing to be kept in lockstep.
create or replace function public.list_promos(p_brand_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_out jsonb;
begin
  if not public.can_manage_brand(p_brand_id) then
    raise exception 'Not authorised to view ads for this brand.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb)
    into v_out
    from public.ads a
   where a.brand_id = p_brand_id;

  return v_out;
end;
$$;


-- ----------------------------------------------------------------------------
-- remove_promo — delete one of your own ads
-- ----------------------------------------------------------------------------
create or replace function public.remove_promo(p_ad_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_brand_id uuid;
begin
  select brand_id into v_brand_id from public.ads where id = p_ad_id;

  if not found then
    return jsonb_build_object('status','error','reason','Ad not found');
  end if;

  if not public.can_manage_brand(v_brand_id) then
    raise exception 'Not authorised to delete this ad.';
  end if;

  delete from public.ads where id = p_ad_id;
  return jsonb_build_object('status','deleted');
end;
$$;


-- ----------------------------------------------------------------------------
-- feed_promos — active ads for feed injection (all brands)
-- ----------------------------------------------------------------------------
-- This one matters most for revenue: the old client query hit /rest/v1/ads, so
-- residents running an ad blocker never saw ANY ads. Brands paid for
-- impressions that never rendered.
create or replace function public.feed_promos()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)
    from (
      select a.*,
             p.username       as brand_username,
             p.brand_name     as brand_name,
             p.brand_logo_url as brand_logo_url,
             p.brand_handle   as brand_handle
        from public.ads a
        left join public.profiles p on p.id = a.brand_id
       where a.status = 'active'
         and a.expires_at > now()
    ) x;
$$;


grant execute on function public.can_manage_brand(uuid) to authenticated, service_role;
grant execute on function public.place_promo(uuid, text, text[], boolean, text, integer, integer, uuid, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.list_promos(uuid)  to authenticated, service_role;
grant execute on function public.remove_promo(uuid) to authenticated, service_role;
grant execute on function public.feed_promos() to anon, authenticated, service_role;

-- PostgREST won't see new functions until the schema cache reloads.
notify pgrst, 'reload schema';

-- Confirm
select routine_name
  from information_schema.routines
 where routine_schema = 'public'
   and routine_name in ('place_promo','list_promos','remove_promo','feed_promos','can_manage_brand')
 order by routine_name;
