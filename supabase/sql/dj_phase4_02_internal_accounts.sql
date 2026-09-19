-- ============================================================================
-- InCynq — internal accounts, excluded from the books
-- ============================================================================
-- Maarten runs SLCompare on his own platform and tops it up to buy ads. That
-- credit is not revenue and not money owed to a member — it's InCynq paying
-- itself. Counted in the books it would be wrong in both directions: a million
-- L$ of float that isn't owed to anyone, and ad "revenue" that never came from
-- outside.
--
-- Clearing the balances before launch would work once, and then break again the
-- next time he tops up to advertise. Marking the accounts fixes it permanently.
--
-- Everything still WORKS normally for these accounts — they buy ads, activate
-- brands, run gigs, top up. They're simply left out of the totals.
--
-- Safe to re-run.
-- ============================================================================

alter table public.profiles
  add column if not exists is_internal boolean not null default false;

comment on column public.profiles.is_internal is
  'InCynq''s own accounts. Excluded from revenue, float and member counts — money moving through them is InCynq paying itself, not income or a liability.';

create index if not exists idx_profiles_internal on public.profiles(is_internal)
  where is_internal = true;


-- ----------------------------------------------------------------------------
-- Mark them
-- ----------------------------------------------------------------------------
-- Note SLCompare and TEST DJ INCYNQ are not separate rows — SLCompare IS
-- maarten.huckleberry's profile, and TEST DJ INCYNQ is djtest_msuwxo5v's.
update public.profiles
   set is_internal = true
 where username in (
   'maarten.huckleberry',   -- + SLCompare, same row
   'djtest_msuwxo5v',       -- + TEST DJ INCYNQ, same row
   'incynqofficial',
   'incynqpayments'
 );


-- ----------------------------------------------------------------------------
-- The numbers, with internal accounts left out
-- ----------------------------------------------------------------------------
-- What the Financial Overview should read from. Splitting real from internal
-- rather than hiding internal entirely, so the difference is visible if a total
-- ever looks wrong.
create or replace function public.get_financial_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member_float  bigint;
  v_brand_float   bigint;
  v_promo         bigint;
  v_internal      bigint;
  v_paid_in       bigint;
  v_tips_held     bigint;
  v_cut           numeric;
begin
  select coalesce(nullif(value,'')::numeric, 5) into v_cut
    from public.app_content where key = 'tip_platform_cut_pct';
  v_cut := coalesce(v_cut, 5);

  -- Owed to real members: personal wallets, minus the part InCynq gave away.
  select coalesce(sum(greatest(0, coalesce(wallet,0) - coalesce(promo_balance,0))), 0)
    into v_member_float
    from public.profiles where not is_internal;

  -- Brand / performer spend credit. Non-refundable, but still a liability until
  -- it's spent — it buys something.
  select coalesce(sum(coalesce(brand_wallet,0)), 0)
    into v_brand_float
    from public.profiles where not is_internal;

  -- Credit InCynq gave away: spendable, but no L$ ever came in behind it.
  select coalesce(sum(coalesce(promo_balance,0)), 0)
    into v_promo
    from public.profiles where not is_internal;

  -- Everything InCynq's own accounts hold. Not revenue, not a liability.
  select coalesce(sum(coalesce(wallet,0) + coalesce(brand_wallet,0)), 0)
    into v_internal
    from public.profiles where is_internal;

  -- Real money that actually arrived, from members who aren't InCynq.
  select coalesce(sum(pi.amount), 0) into v_paid_in
    from public.payment_intents pi
    join public.profiles p on p.id = pi.user_id
   where pi.status = 'paid' and not p.is_internal;

  -- Tips inside their window — owed to performers, minus the handling fee.
  select coalesce(sum(t.amount_l), 0) into v_tips_held
    from public.tips t
    join public.profiles p on p.id = t.to_performer_id
   where t.status = 'held' and not p.is_internal;

  return jsonb_build_object(
    'paid_in_total',      v_paid_in,
    'member_float',       v_member_float,
    'brand_float',        v_brand_float,
    'promo_outstanding',  v_promo,
    'tips_held_gross',    v_tips_held,
    'tips_held_net',      floor(v_tips_held * (100 - v_cut) / 100.0),
    'reserved_for_payout', floor(v_tips_held * (100 - v_cut) / 100.0),
    'internal_holdings',  v_internal,
    'cut_pct',            v_cut
  );
end;
$$;


grant execute on function public.get_financial_overview() to authenticated, service_role;

notify pgrst, 'reload schema';

-- Who's marked, and what they're holding
select username, brand_name, account_type, wallet, brand_wallet, is_internal
  from public.profiles
 where is_internal
 order by username;
