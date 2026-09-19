-- ============================================================================
-- InCynq — payout history for the performer
-- ============================================================================
-- The earnings card shows "already paid out: L$ 950" as a single total, with no
-- breakdown. So "did I get paid for the gig on the 12th?" had no answer without
-- digging in SQL — which is a bad position when it's someone else's money.
--
-- No new table needed. Every tip already carries its payout_batch_id and
-- paid_out_at, so a batch IS the payment: group by it and you have exactly what
-- was sent, when, and which tips it covered.
--
-- Safe to re-run.
-- ============================================================================

create or replace function public.get_payout_history(
  p_performer_id uuid,
  p_limit        integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with fee as (
    select coalesce((select nullif(value,'')::numeric from public.app_content
                      where key = 'tip_platform_cut_pct'), 5) as pct
  )
  select coalesce(jsonb_agg(x order by x.paid_at desc), '[]'::jsonb)
    from (
      select t.payout_batch_id                  as batch_id,
             max(t.paid_out_at)                 as paid_at,
             sum(t.amount_l)::integer           as gross_l,
             -- Recomputed from the rate at read time rather than stored. Fine
             -- while the rate is stable; if it ever changes, historic payouts
             -- would need the rate captured per batch to stay truthful.
             floor(sum(t.amount_l) * (100 - (select pct from fee)) / 100.0)::integer as net_l,
             count(*)::integer                  as tip_count,
             min(t.created_at)                  as earliest_tip,
             max(t.created_at)                  as latest_tip
        from public.tips t
       where t.to_performer_id = p_performer_id
         and t.status = 'paid_out'
         and t.payout_batch_id is not null
       group by t.payout_batch_id
       order by max(t.paid_out_at) desc
       limit greatest(1, least(coalesce(p_limit, 20), 100))
    ) x;
$$;


grant execute on function public.get_payout_history(uuid, integer) to authenticated, service_role;

notify pgrst, 'reload schema';

select jsonb_pretty(public.get_payout_history('e59b7b24-da88-4f68-be78-eb2b7a28f985'));
