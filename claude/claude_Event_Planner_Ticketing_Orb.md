# InCynq — Event Planner, Ticketing & the Event Orb

_Captured 19 Sep 2026, mid-DJ-build. **Future — nothing here is started.**_
_Context: came out of "what's the tip cut for" → ticket sales → who enforces entry._

---

## 1. Event Planner — a third identity type

Alongside **brand** and **performer**, an **event planner** identity.

Same machinery as the others: a separate `profiles` row, own handle, own
followers, own wallet, `brand_owner_id` back to the resident, activated by paying
an ATM code. Nothing new is invented.

**What a planner has that nobody else does:**
- A **staff roster**, held as SL avatar UUIDs, managed in the portal. Reusable
  across every event they run rather than re-entered per gig.
- Events attributed to them, the way live sets are attributed to performers
  (`events.performer_id` already does this; a `planner_id` would mirror it).
- Eventually: the Event Orb reads that roster.

The staff roster is useful well beyond ticketing — it's how a planner's crew can
work an event without being handed the login.

**Open questions (decide before building):**
- **Paid activation?** Brand 3,500, performer 1,750. A planner charges other
  people for tickets, so there's a revenue case — but it's also a gate on
  exactly the people who'd bring events to InCynq.
- **Does it count against `max_brands`?** Following the slot rule it would,
  meaning a resident picks *one* of brand / DJ / planner by default. That may be
  too restrictive for someone who is genuinely both a venue and a promoter.
- **Is a venue the same thing as a planner?** They overlap heavily in SL. Might
  be one identity type, not two. Worth resisting the urge to model both.

---

## 2. Ticketing

Not built. Referenced in MASTER_TODO FUTURE v6 as "Ticket Sales" with a 10%
platform cut — that figure was the precedent quoted for the tip cut, but tickets
themselves were never built.

**Note the rates are now deliberately different:**
- **Tips → 5%** (lowered from 10% on 19 Sep). It is an *admin handling fee* on
  money passing through, not a commission. `tip_platform_cut_pct`.
- **Tickets → TBD.** Selling entry is InCynq acting as box office, which is a
  different service from handling a tip, so a commission is defensible. Don't
  copy the tip rate without thinking.

Tickets need to be tied to **SL avatar UUIDs**, not just InCynq accounts — the
orb checks avatars standing on a parcel, and it has no idea who is logged into
the app.

---

## 3. The InCynq Event Orb

**It belongs to the planner, not the venue.** They carry it, rez it wherever
tonight's event is, and take it away afterwards. Registers to the planner's
identity via an install token, same as ATMs and Terminals — so their roster and
events travel with it to any sim.

### What it does
- Scans avatars on the parcel
- Checks each against the ticket list for the event it's guarding
- Blocks / ejects / reports those without one
- Staff, the planner, and the performer are exempt automatically

### Design points worth getting right first time

**Which event is it guarding?** A planner may have several. The orb can't guess.
A menu on rez — "which of your events is this for?" — is more reliable than
matching on region name, since SL region names and event locations won't always
line up.

**Ejection rights are the hard constraint.** An object can only eject from a
parcel if its owner has rights there. At someone else's venue the planner
usually won't. So either the venue deeds temporarily, or — more realistically —
**the orb's honest job is detection and notification**: "3 people here without
tickets", reported to the planner, and someone with rights acts. Design for that
first and treat ejection as the privileged-case bonus.

**Staff list: in InCynq, not in the orb.** A list held in the object dies when
the object does, so a planner running weekly events re-adds their crew every
time. Held on the planner profile, it survives re-rezzing and works across
several orbs at once. Cache it locally so a brief outage doesn't lock the door.

**Group support.** "Anyone in this group is staff" is one setting instead of a
maintained list, and it's how venue owners already think. Worth having alongside
the UUID roster.

**Fail open, and log it.** If the webhook is unreachable the orb must NOT start
ejecting paying guests. After the 16 Aug–14 Sep outage this is not hypothetical:
a device that fails closed would have ejected everyone at every event for three
weeks. Fail open, report the failure to the planner.

**Free events need no gate.** The ticket check only activates when the event has
paid entry, which means the orb is harmless to leave rezzed.

### Possibly more than a gate
The name suggests something broader than enforcement — announcing the DJ going
live in local chat, hovertext showing what's on, greeting arrivals with a link to
the gig. Ticket enforcement may be one job rather than the whole purpose. Worth
deciding scope before writing LSL.

---

## Dependencies

Ticketing needs the planner identity, or at least somewhere for tickets to hang.
The orb needs ticketing. Both need the webhook, which now lives in the repo at
`supabase/functions/sl-webhook/index.ts` — any new action goes in there, and
**the LSL contract rules in `claude_Session_Recap_Webhook_Rebuild.md` apply**
(the maintenance substring quirk, fail-safe responses, secrets read inside the
handler).

Build order, if it happens: planner identity → tickets → orb.
