# `claude/` — working notes

Session handovers, specs and monitoring logs for SLCompare. Written for whoever picks the work
up next, including a fresh Claude session with no memory of any of it.

**Start with the newest handover.** Each one continues from the last rather than repeating it,
so the stack, conventions and older decisions live further back in the chain.

---

## Current

| File | What it is |
|---|---|
| `session-handover-2026-08-28.md` | **Newest.** Stale-hover incident, support reply routing, device position tracking, counter status, Update Terminal fix |
| `spec-resident-accounts.md` | Resident accounts + IM-code verification. **Specced, not built** |
| `security-remediation-2026-08.md` | Supabase linter sweep — what was closed, what is intentional, what is left |
| `dmarc-monitoring-log.md` | DMARC aggregate reports for slcompare.com. Policy still `p=none` |

## Handover chain

Newest first. Earlier ones are still worth reading for the reasoning behind decisions that are
now just "how it works".

| File | Covers |
|---|---|
| `session-handover-2026-08-28.md` | Support reply routing, `pos` on every check-in, counter offline state, terminal box lookup |
| `session-handover-2026-08-27b.md` | Creator menu access, liveness windows, migration verified on ACM, notecards replaced |
| `session-handover-2026-08-27.md` | Bridge v1.9 → v3.1, three-script split, non-destructive migration, crowd counter v1.3 → v1.5 |
| `session-handover-2026-08-14.md` | Bridge v1.9 two-script release, markets/land separation, market detail pages |
| `session-handover-2026-08-08.md` | **Conventions live here** — file delivery flow, deploy paths, scraper fleet, ghost bridges, gift feature |

---

## Where things are deployed from

Worth knowing before editing anything, because these do not all go the same way:

- **Frontend** — git push → Cloudflare Pages, automatic
- **Edge Functions** — `supabase functions deploy <name> --no-verify-jwt`, **and** commit the
  file, or a later repo deploy silently reverts it (this has happened, to `LATEST_VERSION`)
- **SQL** — pasted into the Supabase SQL editor, never git
- **LSL** — pasted into the object in-world, cannot be compile-tested outside SL. Committed
  under `inworld/` so the repo matches what is running

---

## Reading these notes

They record what broke and why, not just what was built. That is deliberate — most of the
serious bugs in this project have been second instances of an earlier mistake, and the pattern
is easier to spot written down than remembered.

The recurring one, stated once here so it does not have to be rediscovered:

> **Anything never exercised is broken.** The traffic snapshot, every HTTP cron job, both
> purchase flows, the ledger, bridge migration, the counter LOCKED state and seven copy buttons
> all failed on their first real run while reading as correct.

So "fixed" and "verified" are different words in these files, and where something has only been
fixed, it says so.
