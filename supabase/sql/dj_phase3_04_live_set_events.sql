-- ============================================================================
-- InCynq — DJ / Performer: live set events (Phase 3, step 1)
-- ============================================================================
-- Lets a performer identity attach their stream to an event and flag it as a
-- live set.
--
-- Ownership model (deliberate):
--   user_id      = the human who created it, unchanged. Still accountable,
--                  still the one who can edit/delete.
--   performer_id = the identity it appears AS (DJMAX). Null for normal events.
-- Same split brands already use with posts.brand_id.
--
-- This step does NOT include go-live, hours draw-down, or the tip jar — those
-- are later phases. It's "list the gig with your stream attached".
--
-- Safe to re-run.
-- ============================================================================

alter table public.events
  add column if not exists performer_id uuid,
  add column if not exists is_live_set  boolean not null default false,
  add column if not exists stream_url   text;

-- Named explicitly: getEvents needs to disambiguate now that events has TWO
-- foreign keys pointing at profiles.
do $$
begin
  alter table public.events
    add constraint events_performer_id_fkey
    foreign key (performer_id) references public.profiles(id) on delete set null;
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_events_performer on public.events(performer_id)
  where performer_id is not null;

create index if not exists idx_events_live_set on public.events(is_live_set)
  where is_live_set = true;


-- A live set must carry a stream, and must be attributed to a performer.
do $$
begin
  alter table public.events
    add constraint events_live_set_needs_stream
    check (
      not is_live_set
      or (stream_url is not null and performer_id is not null)
    );
exception when duplicate_object then
  null;
end $$;


-- ----------------------------------------------------------------------------
-- Confirm — I need BOTH constraint names to write the getEvents join
-- ----------------------------------------------------------------------------
select conname as constraint_name,
       pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.events'::regclass
   and contype = 'f'
 order by conname;
