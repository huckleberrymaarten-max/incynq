# InCynq — project docs index

_What's in this folder, what's current, and where to start._
_Last updated: August 2026 (after the tag system + ads session)._

---

## Start here

**`Session_Recap_Tag_System.md`** — the most recent session (Aug 21–22, 2026) and the
best snapshot of current state. Covers the brand tag system, the interest-tag dedupe,
the composer fix, and the whole ads investigation. Its "open items" and section 9 are
effectively the live TODO for anything ad- or tag-related.

**Top of the list next:** ad impressions. Nothing records an ad being seen, which
blocks delivery proof for brands, the paid analytics tier, and any frequency-based
tier model.

---

## DJ / Live Performer

The largest in-progress feature. Read in this order:

| File | What it is | Status |
|---|---|---|
| `claude_DJ_Live_Performer_Spec_v1.md` | The main spec — identity model, airtime, tipping, payouts, phased build plan. **File is named v1 but its contents are v2.** | Phases 0–3 partly built |
| `claude_DJ_Performer_Slot_Rule.md` | Addendum: a performer counts against `max_brands`. Raising it is admin-only, on request. | Locked decision |
| `claude_InCynq_Treasury_and_Fund_Separation.md` | Money rules — single treasury avatar, float vs revenue, the one-way crossing rule, rebrand fees, deletion economics, manual owner draw. | Locked decisions |
| `claude_DJ_Deploy_Steps_EditProfile_and_Rename.md` | Deploy runbook for in-app Edit Profile + admin paid rename. | Shipped |
| `claude_DJ_Performer_incynq_net_and_FAQ_content.md` | User-facing copy brief for the .net tab and FAQ. | Not built |
| `claude_dj_coming_soon_ad_mockup.html` | Coming-soon creative. | Reference only |

**Next DJ item:** DJ creates an event including their stream (Phase 3, needs
`EventsScreen.jsx`).

⚠️ **Known gap:** the deploy steps doc says to push `PerformersSection.jsx` but never
says to register it in `AdminScreen.jsx`. That was missed and the DJ tab didn't exist
in the running admin for months. Now fixed — but check nav registration whenever a new
admin section ships.

---

## Pricing

| File | What it is | Status |
|---|---|---|
| `claude_InCynq_Pricing_Audit_and_Plan.md` | The original audit — five sources of truth, contradictions, orphaned admin controls. | Superseded, useful for reasoning |
| `claude_InCynq_Pricing_Centralisation_Status.md` | What actually shipped. **Read this one for current state.** | Complete bar the DJ .net tab |

Single source of truth is `app_content` in Supabase, edited in admin → Content, read by
the app via `ContentContext` and by .net via `js/prices.js`.

⚠️ Still open per that doc: brand activation fee is live at 2,500 and needs setting to
3,500 in admin when ready.

---

## Email

**`claude_InCynq_Email_Audit_and_Fix.md`** — every automated sender, the FROM/reply-to
standard, and the two disclaimers. **Closed, nothing outstanding.** Keep for the
standard: automated mail always from `noreply@incynq.net` with the do-not-reply footer;
never a human alias as FROM.

---

## Conventions worth knowing

- **File delivery:** complete replacement files, never snippets. Delivered as `.txt`,
  renamed on copy, line count verified before pushing.
- **Git:** always `git -C "<full path>"` — three repos, easy to be in the wrong one.
- **Supabase SQL editor:** swallows `RAISE NOTICE`. End migrations with a `select` or
  you can't tell success from failure. `auth.uid()` is null there, so admin-gated RPCs
  must be tested from the admin panel.
- **PostgREST schema cache:** run `notify pgrst, 'reload schema';` after adding
  functions or the API won't see them. Symptom is a screen hanging on "Loading…".
- **Triggers:** "recap" = session summary · "go" = proceed · "check inbox" = Gmail.

---

## Do not drop

`interest_groups` — **not legacy.** Ad targeting stores its slugs in `ads.groups`. The
composer stopped reading it, nothing more. A commit message (`72be08f`) says otherwise
and is wrong. `interest_subs` still needs a grep before dropping.
