-- ============================================================================
-- InCynq — allow a brand to delete its own ads
-- ============================================================================
-- The ads table has SELECT and INSERT policies but no DELETE policy, so a
-- delete from the client fails silently (0 rows affected, no error raised).
-- This adds the missing one.
--
-- Scope: a brand can only ever delete a row where brand_id = its own id.
-- The UI only offers Delete on past/expired ads; the policy allows own ads
-- generally so an ad can still be removed by an owner if needed.
-- Safe to re-run.
-- ============================================================================

drop policy if exists "Brands can delete own ads" on public.ads;

create policy "Brands can delete own ads" on public.ads
  for delete
  using (auth.uid() = brand_id);

-- Confirm — should list one DELETE policy
select policyname, cmd, qual
  from pg_policies
 where schemaname = 'public' and tablename = 'ads' and cmd = 'DELETE';
