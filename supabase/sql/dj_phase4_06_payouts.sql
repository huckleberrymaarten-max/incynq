-- ============================================================================
-- InCynq — tip payouts (Phase 4, part 2)
-- ============================================================================
-- HOW PAYOUT ACTUALLY WORKS, AND WHY IT'S MANUAL
--
--   llGiveMoney needs an inworld object with money-transfer permission, owned
--   by an avatar that is logged in. A webhook cannot send L$ on its own. So
--   either something inworld polls for approved payouts and sends them, or a
--   human does it.
--
--   With five DJs, a human does it. Maarten gets an email saying what's due,
--   pays each avatar inworld, and marks it paid in admin. No new device, no
--   automated sending of real money, and every payout is seen by someone before
--   it happens — which matters when it's the first money to leave InCynq.
--
--   If this ever gets big enough to hurt, a Payout Terminal owned by
--   IncynqPayments could poll `get_payouts_due()` and do it automatically. The
--   data model below already supports that; nothing here would need changing.
--
-- THE 7-DAY HOLD
--   A tip is 'held' for 7 days before it can be paid. That window exists so a
--   disputed or fraudulent gig can be stopped before the money is gone —
--   refunds are possible while it's held and impossible afterwards.
--
-- Safe to re-run.
-- ============================================================================

insert into public.app_content (key, value)
values ('tip_hold_days', '7')
on conflict (key) do nothing;


-- Where the L$ actually go. The InCynq account is irrelevant to a payout —
-- llGiveMoney needs an SL avatar UUID, which is captured at Terminal activation.
alter table public.tips
  add column if not exists payout_batch_id uuid,
  add column if not exists paid_by_admin   uuid references public.profiles(id);

create index if not exists idx_tips_payout_due
  on public.tips(status, created_at) where status = 'held';


-- ----------------------------------------------------------------------------
-- What's due — grouped by performer, because you pay a person, not a tip
-- ----------------------------------------------------------------------------
create or replace function public.get_payouts_due()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cut  numeric;
  v_days integer;
  v_out  jsonb;
begin
  select coalesce(nullif(value,'')::numeric, 5) into v_cut
    from public.app_content where key = 'tip_platform_cut_pct';
  v_cut := coalesce(v_cut, 5);

  select coalesce(nullif(value,'')::integer, 7) into v_days
    from public.app_content where key = 'tip_hold_days';
  v_days := coalesce(v_days, 7);

  select coalesce(jsonb_agg(x order by x.gross desc), '[]'::jsonb) into v_out
    from (
      select t.to_performer_id           as performer_id,
             p.brand_name,
             p.brand_handle,
             -- The bit that matters for paying: an SL avatar UUID. Without it
             -- there is nobody to send L$ to, however much is owed.
             p.sl_uuid,
             owner.username              as owner_username,
             owner.sl_uuid               as owner_sl_uuid,
             count(*)                    as tip_count,
             sum(t.amount_l)::integer    as gross,
             floor(sum(t.amount_l) * (100 - v_cut) / 100.0)::integer as net,
             (sum(t.amount_l) - floor(sum(t.amount_l) * (100 - v_cut) / 100.0))::integer as fee,
             min(t.created_at)           as oldest_tip,
             jsonb_agg(t.id)             as tip_ids
        from public.tips t
        join public.profiles p     on p.id = t.to_performer_id
        left join public.profiles owner on owner.id = p.brand_owner_id
       where t.status = 'held'
         and t.created_at <= now() - make_interval(days => v_days)
       group by t.to_performer_id, p.brand_name, p.brand_handle, p.sl_uuid,
                owner.username, owner.sl_uuid
    ) x;

  return jsonb_build_object(
    'cut_pct',   v_cut,
    'hold_days', v_days,
    'payouts',   v_out
  );
end;
$$;


-- Everything still inside its hold window — not payable yet, but worth seeing
-- so the total isn't a surprise next week.
create or replace function public.get_payouts_pending()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_days integer; v_out jsonb;
begin
  select coalesce(nullif(value,'')::integer, 7) into v_days
    from public.app_content where key = 'tip_hold_days';
  v_days := coalesce(v_days, 7);

  select coalesce(jsonb_agg(x order by x.releases_at), '[]'::jsonb) into v_out
    from (
      select p.brand_name,
             count(*)                 as tip_count,
             sum(t.amount_l)::integer as gross,
             min(t.created_at) + make_interval(days => v_days) as releases_at
        from public.tips t
        join public.profiles p on p.id = t.to_performer_id
       where t.status = 'held'
         and t.created_at > now() - make_interval(days => v_days)
       group by p.brand_name
    ) x;

  return v_out;
end;
$$;


-- ----------------------------------------------------------------------------
-- Marking a payout done
-- ----------------------------------------------------------------------------
-- Called AFTER the L$ have actually been sent inworld. Deliberately separate
-- from the listing: nothing here moves money, it records that money moved.
create or replace function public.mark_payout_paid(
  p_performer_id uuid,
  p_admin_id     uuid,
  p_note         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days   integer;
  v_cut    numeric;
  v_batch  uuid := gen_random_uuid();
  v_gross  integer;
  v_net    integer;
  v_count  integer;
begin
  select coalesce(nullif(value,'')::integer, 7) into v_days
    from public.app_content where key = 'tip_hold_days';
  select coalesce(nullif(value,'')::numeric, 5) into v_cut
    from public.app_content where key = 'tip_platform_cut_pct';
  v_days := coalesce(v_days, 7);
  v_cut  := coalesce(v_cut, 5);

  -- Only tips past their hold window, so a payout can never accidentally
  -- include something still disputable.
  select coalesce(sum(amount_l), 0), count(*)
    into v_gross, v_count
    from public.tips
   where to_performer_id = p_performer_id
     and status = 'held'
     and created_at <= now() - make_interval(days => v_days);

  if v_count = 0 then
    return jsonb_build_object('ok', false, 'error', 'Nothing due for that performer');
  end if;

  v_net := floor(v_gross * (100 - v_cut) / 100.0);

  update public.tips
     set status = 'paid_out',
         paid_out_at = now(),
         payout_batch_id = v_batch,
         paid_by_admin = p_admin_id
   where to_performer_id = p_performer_id
     and status = 'held'
     and created_at <= now() - make_interval(days => v_days);

  -- The fee becomes revenue at this moment, not before. Until payout the whole
  -- gross is still float — the money is in the treasury either way, but only
  -- now is any of it InCynq's.
  insert into public.audit_log (admin_id, action, target_type, target_id, details)
  values (p_admin_id, 'tip_payout', 'performer', p_performer_id,
          jsonb_build_object('batch', v_batch, 'tips', v_count,
                             'gross', v_gross, 'net', v_net,
                             'fee', v_gross - v_net, 'note', p_note));

  -- Tell the performer their money is on the way.
  begin
    insert into public.notifications (user_id, type, actor_id, text)
    select coalesce(p.brand_owner_id, p.id), 'system', p.id,
           '💸 ' || v_net || ' L$ of tips paid to your avatar'
      from public.profiles p where p.id = p_performer_id;
  exception when others then null;
  end;

  return jsonb_build_object('ok', true, 'batch', v_batch,
    'tips', v_count, 'gross', v_gross, 'net', v_net, 'fee', v_gross - v_net);
end;
$$;


-- ----------------------------------------------------------------------------
-- Withholding a tip
-- ----------------------------------------------------------------------------
-- The reason the 7-day hold exists. A flagged gig, a disputed tip, a chargeback
-- — refundable while held, impossible after.
create or replace function public.refund_tip(p_tip_id uuid, p_admin_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_tip record; v_after integer;
begin
  select * into v_tip from public.tips where id = p_tip_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Tip not found');
  end if;
  if v_tip.status <> 'held' then
    return jsonb_build_object('ok', false, 'error', 'Only a held tip can be refunded');
  end if;

  update public.profiles set wallet = coalesce(wallet, 0) + v_tip.amount_l
   where id = v_tip.from_user_id
  returning wallet into v_after;

  update public.tips set status = 'refunded' where id = p_tip_id;

  insert into public.wallet_transactions (user_id, amount, type, reference_id, description, balance_before, balance_after)
  values (v_tip.from_user_id, v_tip.amount_l, 'admin_adjust', p_tip_id,
          'Tip refunded: ' || coalesce(p_reason, 'no reason given'),
          v_after - v_tip.amount_l, v_after);

  insert into public.audit_log (admin_id, action, target_type, target_id, details)
  values (p_admin_id, 'tip_refund', 'tip', p_tip_id,
          jsonb_build_object('amount', v_tip.amount_l, 'reason', p_reason));

  return jsonb_build_object('ok', true, 'refunded', v_tip.amount_l);
end;
$$;


grant execute on function public.get_payouts_due()                      to authenticated, service_role;
grant execute on function public.get_payouts_pending()                  to authenticated, service_role;
grant execute on function public.mark_payout_paid(uuid, uuid, text)     to authenticated, service_role;
grant execute on function public.refund_tip(uuid, uuid, text)           to authenticated, service_role;

notify pgrst, 'reload schema';

select jsonb_pretty(public.get_payouts_due());
