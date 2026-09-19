-- ============================================================================
-- InCynq — receipt numbering: row count -> sequence
-- ============================================================================
-- The old next_receipt_number() did:
--     SELECT COUNT(*) + 1 FROM receipts WHERE receipt_number LIKE 'INCYNQ-<year>-%'
--
-- Two problems with that:
--   1. DELETING a receipt makes the next one REUSE its number. Refund a payment,
--      remove the row, and the following customer gets a duplicate receipt
--      number — which is exactly the thing a receipt number must never do.
--   2. NOT concurrency-safe. Two payments landing in the same moment both count
--      the same rows and produce the same number.
--
-- A sequence fixes both: it never reuses, never collides, and is unaffected by
-- deletions.
--
-- Numbers restart at 000001 each calendar year. The sequence is reset by the
-- function itself the first time it is called in a new year, so there is no
-- cron to forget.
--
-- Safe to re-run.
-- ============================================================================

create sequence if not exists public.receipt_number_seq as bigint start with 1;

-- Remembers which year the sequence is currently counting, so the first call in
-- a new year knows to restart it.
insert into public.app_content (key, value)
values ('receipt_seq_year', extract(year from now())::text)
on conflict (key) do nothing;


create or replace function public.next_receipt_number()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_year      integer;
  v_seq_year  integer;
  v_n         bigint;
begin
  v_year := extract(year from now());

  select value::integer into v_seq_year
    from app_content where key = 'receipt_seq_year';

  -- New calendar year: restart numbering at 1.
  if v_seq_year is null or v_seq_year <> v_year then
    perform setval('public.receipt_number_seq', 1, false);
    update app_content set value = v_year::text where key = 'receipt_seq_year';
    if not found then
      insert into app_content (key, value) values ('receipt_seq_year', v_year::text);
    end if;
  end if;

  v_n := nextval('public.receipt_number_seq');

  return 'INCYNQ-' || v_year || '-' || lpad(v_n::text, 6, '0');
end;
$function$;


-- ----------------------------------------------------------------------------
-- Align the sequence with whatever is already in the table
-- ----------------------------------------------------------------------------
-- Picks up after the highest existing number for THIS year, so re-running this
-- file never causes a collision with receipts already issued.
do $$
declare
  v_year integer := extract(year from now());
  v_max  bigint;
begin
  select coalesce(max(substring(receipt_number from '(\d{6})$')::bigint), 0)
    into v_max
    from public.receipts
   where receipt_number like 'INCYNQ-' || v_year || '-%';

  -- is_called = false means the NEXT nextval() returns exactly v_max + 1
  perform setval('public.receipt_number_seq', v_max + 1, false);
end $$;


-- ----------------------------------------------------------------------------
-- Stop duplicates at the database level, whatever generates them
-- ----------------------------------------------------------------------------
do $$
begin
  alter table public.receipts add constraint receipts_receipt_number_key unique (receipt_number);
exception when duplicate_table or duplicate_object then
  null;
end $$;


-- ----------------------------------------------------------------------------
-- Confirm — next number, and what's already issued
-- ----------------------------------------------------------------------------
select
  (select count(*) from public.receipts)                        as receipts_on_file,
  last_value                                                    as sequence_at,
  is_called                                                     as sequence_used,
  'INCYNQ-' || extract(year from now())::integer || '-' ||
    lpad((case when is_called then last_value + 1 else last_value end)::text, 6, '0')
                                                                as next_receipt_number
from public.receipt_number_seq;
