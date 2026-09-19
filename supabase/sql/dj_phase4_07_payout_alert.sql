-- ============================================================================
-- InCynq — weekly payout alert
-- ============================================================================
-- Run dj_phase4_06_payouts.sql first — this builds on get_payouts_due().
--
-- Nothing here sends L$ or creates anything. It emails Maarten on a Monday
-- morning saying what's waiting, so the payout run isn't something he has to
-- remember. He pays each avatar inworld and marks it paid in admin.
--
-- WHY WEEKLY AND NOT PER GIG
--   A tip is held 7 days before it can be paid — that window is there so a
--   disputed or fraudulent gig can be stopped while a refund is still possible.
--   But paying per tip would mean a DJ playing Mon/Tue/Wed gets three separate
--   transfers the following Mon/Tue/Wed. Eligibility stays per tip; PAYMENT is
--   weekly, one transfer per DJ covering everything that has cleared.
--
-- Safe to re-run.
-- ============================================================================

-- Uses pg_net (already installed) to call the edge function that sends the mail.
create or replace function public.notify_payouts_due()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due      jsonb;
  v_payouts  jsonb;
  v_count    integer;
  v_net      integer := 0;
  v_gross    integer := 0;
  v_blocked  integer := 0;
  i          jsonb;
begin
  v_due     := public.get_payouts_due();
  v_payouts := coalesce(v_due->'payouts', '[]'::jsonb);
  v_count   := jsonb_array_length(v_payouts);

  if v_count = 0 then
    return jsonb_build_object('ok', true, 'due', 0, 'emailed', false);
  end if;

  for i in select * from jsonb_array_elements(v_payouts) loop
    v_net   := v_net   + coalesce((i->>'net')::integer, 0);
    v_gross := v_gross + coalesce((i->>'gross')::integer, 0);
    -- No avatar UUID on file means there is nobody to send L$ to, however much
    -- is owed. Worth counting separately so the email can say so.
    if coalesce(i->>'owner_sl_uuid', i->>'sl_uuid') is null then
      v_blocked := v_blocked + 1;
    end if;
  end loop;

  -- Best-effort: a failed email must never stop payouts being made by hand.
  begin
    perform net.http_post(
      url     := 'https://muzzjvegynsemlsbwggf.supabase.co/functions/v1/send-payout-alert',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object(
                   'performers', v_count,
                   'gross_l',    v_gross,
                   'net_l',      v_net,
                   'fee_l',      v_gross - v_net,
                   'blocked',    v_blocked,
                   'cut_pct',    v_due->'cut_pct',
                   'detail',     v_payouts
                 )
    );
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'ok', true, 'due', v_count, 'gross_l', v_gross, 'net_l', v_net,
    'blocked', v_blocked, 'emailed', true
  );
end;
$$;


-- Monday 09:00 UTC. Alert only — nothing is paid automatically.
select cron.unschedule('incynq-payout-alert')
 where exists (select 1 from cron.job where jobname = 'incynq-payout-alert');

select cron.schedule(
  'incynq-payout-alert',
  '0 9 * * 1',
  $$select public.notify_payouts_due();$$
);


grant execute on function public.notify_payouts_due() to service_role;

notify pgrst, 'reload schema';

-- What's due right now, and whether the job is scheduled
select jsonb_pretty(public.get_payouts_due()) as due_now;
select jobname, schedule, active from cron.job where jobname = 'incynq-payout-alert';
