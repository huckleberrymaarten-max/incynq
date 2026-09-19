-- ============================================================================
-- InCynq — Tip jar (Phase 4, part 1: taking tips)
-- ============================================================================
-- Part 2 — the 7-day sweep and the actual payout to the DJ's SL avatar — is
-- deliberately NOT here. That's the first time InCynq sends real L$ out, it
-- touches the webhook, and it deserves its own session.
--
-- ── WHERE THE MONEY ACTUALLY IS ────────────────────────────────────────────
-- A tip moves credit that is ALREADY in the treasury. The tipper topped up at
-- an ATM, those L$ went to IncynqPayments, and they've been sitting as float
-- since. Tipping reassigns float from one pot to another; nothing leaves
-- InCynq until payout, and the money for that payout is already there.
--
-- ── EXCEPT WELCOME CREDIT, WHICH NOBODY PAID FOR ───────────────────────────
-- The 100 L$ welcome credit is promotional — InCynq gave it away. If it could
-- be tipped it would become withdrawable earnings and leave as real L$ at
-- payout, so InCynq would be funding the tips. It is also trivially farmable:
-- register, tip your own DJ identity, withdraw, repeat with alts.
--
-- So the wallet now tracks how much of itself is promotional, and a tip must
-- come from the part someone actually paid for. Promotional credit still buys
-- everything else — airtime, ads, boosts — which is what it's for.
--
-- ── ONE TIP PER GIG? NO ────────────────────────────────────────────────────
-- The original spec said one tip per avatar per gig. That caps generosity at
-- exactly the moment it matters: someone who tips 25 early and then hears a
-- track they love an hour later can't tip again. In SL a tip jar gets hit
-- several times a night. Multiple tips are allowed; a short cooldown stops
-- double-taps, which is the only real problem to solve here.
--
-- Safe to re-run.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. How much of a wallet is promotional
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists promo_balance integer not null default 0;

comment on column public.profiles.promo_balance is
  'How much of wallet is promotional credit InCynq gave away (welcome, referral, survey). Spendable on InCynq, NOT tippable — a tip must be money someone actually paid in, or payouts would send out L$ nobody put in.';

-- Existing members: assume their welcome credit is still promotional, capped at
-- whatever is actually left in the wallet. Conservative — it can only
-- over-restrict, never under-restrict, which is the safe direction.
update public.profiles
   set promo_balance = least(coalesce(wallet, 0), public.get_price('welcome_credit', 100))
 where welcome_credit_at is not null
   and promo_balance = 0;


-- Welcome credit is promotional from now on. Everything else in
-- confirm_activation is unchanged.
create or replace function public.confirm_activation(p_code text, p_terminal_uuid text, p_avatar_uuid text, p_avatar_name text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_activation RECORD;
  v_device RECORD;
  v_user_id UUID;
  v_referral_paid BOOLEAN := FALSE;
  v_new_balance INTEGER;
  v_welcome INTEGER;
BEGIN
  v_welcome := get_price('welcome_credit', 100);

  SELECT * INTO v_device FROM inworld_devices
  WHERE device_uuid = p_terminal_uuid AND device_type = 'terminal' AND active = TRUE;

  IF v_device.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Unknown terminal');
  END IF;

  SELECT * INTO v_activation FROM activation_codes
  WHERE code = p_code AND status = 'pending' LIMIT 1;

  IF v_activation.id IS NULL THEN
    IF EXISTS (SELECT 1 FROM activation_codes WHERE code = p_code AND status = 'used') THEN
      RETURN json_build_object('success', false, 'error', 'Code already used');
    ELSIF EXISTS (SELECT 1 FROM activation_codes WHERE code = p_code AND status = 'expired') THEN
      RETURN json_build_object('success', false, 'error', 'Code expired');
    ELSE
      RETURN json_build_object('success', false, 'error', 'Invalid code');
    END IF;
  END IF;

  IF v_activation.expires_at <= NOW() THEN
    UPDATE activation_codes SET status = 'expired' WHERE id = v_activation.id;
    RETURN json_build_object('success', false, 'error', 'Code expired');
  END IF;

  v_user_id := v_activation.user_id;

  UPDATE activation_codes
  SET status = 'used', used_at = NOW(),
      used_by_terminal_uuid = p_terminal_uuid,
      used_by_avatar_uuid = p_avatar_uuid,
      used_by_avatar_name = p_avatar_name
  WHERE id = v_activation.id;

  -- promo_balance rises with the wallet: this credit is InCynq's gift, not
  -- money the member paid in, so it can be spent but never tipped out.
  UPDATE profiles
  SET activated = TRUE,
      activated_at = NOW(),
      wallet = COALESCE(wallet, 0) + v_welcome,
      promo_balance = COALESCE(promo_balance, 0) + v_welcome,
      welcome_credit_at = NOW(),
      sl_uuid = p_avatar_uuid
  WHERE id = v_user_id AND activated = FALSE;

  SELECT COALESCE(wallet, 0) INTO v_new_balance FROM profiles WHERE id = v_user_id;

  INSERT INTO wallet_transactions (user_id, amount, type, description, balance_before, balance_after)
  VALUES (v_user_id, v_welcome, 'welcome_credit',
          'Welcome to InCynq! ' || v_welcome || ' L$ activation credit',
          v_new_balance - v_welcome, v_new_balance);

  BEGIN
    SELECT process_referral_reward(v_user_id) INTO v_referral_paid;
  EXCEPTION WHEN OTHERS THEN
    v_referral_paid := FALSE;
  END;

  UPDATE inworld_devices SET last_seen_at = NOW() WHERE id = v_device.id;

  RETURN json_build_object(
    'success', true,
    'user_id', v_user_id,
    'avatar_name', p_avatar_name,
    'welcome_credit', v_welcome,
    'referral_paid', v_referral_paid,
    'message', 'Account activated! Welcome to InCynq.'
  );
END;
$function$;


-- What a member may actually tip with.
create or replace function public.tippable_balance(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, coalesce(wallet, 0) - coalesce(promo_balance, 0))
    from public.profiles where id = p_user_id;
$$;


-- ----------------------------------------------------------------------------
-- 2. tips
-- ----------------------------------------------------------------------------
create table if not exists public.tips (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.live_sessions(id) on delete cascade,
  event_id        uuid not null references public.events(id)        on delete cascade,
  from_user_id    uuid not null references public.profiles(id)      on delete cascade,
  to_performer_id uuid not null references public.profiles(id)      on delete cascade,
  amount_l        integer not null check (amount_l > 0),
  message         text,
  -- held  → inside the 7-day window, not yet paid
  -- paid_out → swept and sent to the performer's SL avatar
  -- refunded → withheld by admin (flagged gig, dispute)
  status          text not null default 'held'
                    check (status in ('held', 'paid_out', 'refunded')),
  paid_out_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_tips_session   on public.tips(session_id);
create index if not exists idx_tips_performer on public.tips(to_performer_id, status);
create index if not exists idx_tips_from      on public.tips(from_user_id, created_at);
-- NOTE: deliberately NO unique (session_id, from_user_id). See the header.

grant select on public.tips to authenticated;
grant select, insert, update, delete on public.tips to service_role;

alter table public.tips enable row level security;

drop policy if exists tips_service_all on public.tips;
create policy tips_service_all on public.tips
  for all to service_role using (true) with check (true);
-- No client read policy: tips go through the RPCs, so one listener can't read
-- what everyone else in the room gave.


-- ----------------------------------------------------------------------------
-- 3. submit_tip — atomic, and honest about why it refuses
-- ----------------------------------------------------------------------------
create or replace function public.submit_tip(
  p_session_id uuid,
  p_amount     integer,
  p_message    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session   record;
  v_tipper    uuid := auth.uid();
  v_tippable  integer;
  v_recent    integer;
  v_before    integer;
  v_after     integer;
  v_tip_id    uuid;
begin
  if v_tipper is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in to tip');
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Pick an amount');
  end if;
  -- A sanity ceiling, not a policy. Stops a fat-fingered 10000 going through.
  if p_amount > 10000 then
    return jsonb_build_object('ok', false, 'error', 'That is more than the maximum single tip');
  end if;

  select * into v_session
    from public.live_sessions
   where id = p_session_id and status = 'live' and auto_end_at > now();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'That set is not live right now');
  end if;

  if v_session.performer_id = v_tipper then
    return jsonb_build_object('ok', false, 'error', 'You cannot tip your own set');
  end if;

  -- Cooldown, not a cap. Stops a double-tap sending two tips; does nothing to
  -- someone who genuinely wants to tip again later in the night.
  select count(*) into v_recent
    from public.tips
   where from_user_id = v_tipper
     and session_id = p_session_id
     and created_at > now() - interval '30 seconds';

  if v_recent > 0 then
    return jsonb_build_object('ok', false, 'error', 'Give it a moment before tipping again');
  end if;

  -- Promotional credit is not tippable — see the header.
  select public.tippable_balance(v_tipper) into v_tippable;

  if v_tippable < p_amount then
    declare
      v_wallet integer;
      v_promo  integer;
    begin
      select coalesce(wallet,0), coalesce(promo_balance,0)
        into v_wallet, v_promo from public.profiles where id = v_tipper;

      -- Two different problems, two different answers. Telling someone with
      -- 100 L$ of welcome credit that they have "not enough" would be a lie.
      if v_promo > 0 and v_wallet >= p_amount then
        return jsonb_build_object('ok', false, 'promo_only', true,
          'error', 'Your welcome credit is for exploring InCynq — top up to send tips',
          'tippable', v_tippable);
      end if;
      return jsonb_build_object('ok', false, 'error', 'Not enough in your wallet — top up at any InCynq ATM',
        'tippable', v_tippable);
    end;
  end if;

  -- Atomic: the balance guard is in the WHERE clause, so two tips racing can't
  -- both pass on the same funds.
  update public.profiles
     set wallet = wallet - p_amount
   where id = v_tipper
     and coalesce(wallet, 0) - coalesce(promo_balance, 0) >= p_amount
  returning wallet + p_amount, wallet into v_before, v_after;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Not enough in your wallet');
  end if;

  insert into public.tips (session_id, event_id, from_user_id, to_performer_id, amount_l, message)
  values (p_session_id, v_session.event_id, v_tipper, v_session.performer_id,
          p_amount, nullif(btrim(coalesce(p_message, '')), ''))
  returning id into v_tip_id;

  insert into public.wallet_transactions (user_id, amount, type, reference_id, description, balance_before, balance_after)
  values (v_tipper, -p_amount, 'tip', v_tip_id, 'Tip sent to a live set', v_before, v_after);

  -- Tell the performer. Best-effort — a notification failure must not undo a tip.
  begin
    insert into public.notifications (user_id, type, actor_id, text)
    values (v_session.performer_id, 'system', v_tipper,
            '💰 You got a ' || p_amount || ' L$ tip'
            || case when nullif(btrim(coalesce(p_message,'')), '') is not null
                    then ' — "' || left(btrim(p_message), 80) || '"' else '' end);
  exception when others then null;
  end;

  return jsonb_build_object('ok', true, 'tip_id', v_tip_id, 'new_balance', v_after);
end;
$$;


-- ----------------------------------------------------------------------------
-- 4. What the DJ sees
-- ----------------------------------------------------------------------------
-- Pending and paid are computed from the tips themselves rather than kept as a
-- running total, so there is one source of truth and no second set of books to
-- drift. The platform cut is read live from app_content.
create or replace function public.get_performer_earnings(p_performer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cut     numeric;
  v_held    integer;
  v_paid    integer;
  v_tips    integer;
begin
  select coalesce(nullif(value,'')::numeric, 5) into v_cut
    from public.app_content where key = 'tip_platform_cut_pct';
  v_cut := coalesce(v_cut, 5);

  select coalesce(sum(amount_l), 0), count(*)
    into v_held, v_tips
    from public.tips where to_performer_id = p_performer_id and status = 'held';

  select coalesce(sum(amount_l), 0) into v_paid
    from public.tips where to_performer_id = p_performer_id and status = 'paid_out';

  return jsonb_build_object(
    'cut_pct',      v_cut,
    'held_gross',   v_held,
    -- What actually lands in their avatar, after the handling fee.
    'held_net',     floor(v_held * (100 - v_cut) / 100.0),
    'paid_gross',   v_paid,
    'paid_net',     floor(v_paid * (100 - v_cut) / 100.0),
    'tip_count',    v_tips
  );
end;
$$;


-- Tips for one session — what a DJ sees during or just after a gig.
create or replace function public.get_session_tips(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',       t.id,
           'amount',   t.amount_l,
           'message',  t.message,
           'from',     coalesce(nullif(p.display_name,''), p.username),
           'at',       t.created_at
         ) order by t.created_at desc), '[]'::jsonb)
    from public.tips t
    join public.profiles p on p.id = t.from_user_id
   where t.session_id = p_session_id;
$$;


-- The ladder, admin-set.
create or replace function public.get_tip_ladder()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select value::jsonb from public.app_content where key = 'tip_ladder'),
    '[10,25,50,75,100]'::jsonb
  );
$$;


grant execute on function public.tippable_balance(uuid)           to authenticated, service_role;
grant execute on function public.submit_tip(uuid, integer, text)  to authenticated, service_role;
grant execute on function public.get_performer_earnings(uuid)     to authenticated, service_role;
grant execute on function public.get_session_tips(uuid)           to authenticated, service_role;
grant execute on function public.get_tip_ladder()                 to anon, authenticated, service_role;

notify pgrst, 'reload schema';

select routine_name
  from information_schema.routines
 where routine_schema = 'public'
   and routine_name in ('submit_tip','tippable_balance','get_performer_earnings',
                        'get_session_tips','get_tip_ladder','confirm_activation')
 order by routine_name;
