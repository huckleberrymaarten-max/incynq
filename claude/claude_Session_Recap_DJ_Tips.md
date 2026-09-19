# InCynq — DJ Live Sets & Tip Jar — Session Recap

_19 September 2026. Phase 3 and Phase 4 built, tested and deployed._

---

## What a DJ can now do

Create a gig with their own stream URL → go live → be metered by the minute →
see who's listening → get tipped → be paid weekly to their avatar, minus 5%.

That's the whole proposition ready to pitch. Nothing in it is mocked.

---

## The decisions that shaped it

These are the ones that won't be obvious from the code.

### Airtime is a balance, not a booking
The DJ buys hours; broadcasting spends the minutes actually used. No set length
is chosen in advance. The session is **capped** at whatever hours they hold — a
safety limit, not a purchase.

### Settled at the end, not drawn down continuously
A continuous draw-down needs a cron and keeps billing a DJ whose connection
dropped. Settling on end means a crashed session gets closed by the sweep and
charged only its capped duration. Billed in **whole minutes, rounded up**.

### Followers in the feed, discovery in Events
The feed strip shows only DJs you follow — it's your feed, so it surfaces who
you chose. Everyone else finds live gigs in **Events**, listens, and can follow
from there. That's what graduates a DJ into someone's feed.

Deliberately NOT built: an "others live" count in the feed. Discovery has a home
already, and a second one is how the feed becomes noise.

### Tips: 5%, and it's a handling fee
Lowered from 10% because it covers admin and handling, not commission. Ticket
sales (future) are a different thing — InCynq acting as box office — so don't
copy this rate there without thinking.

### Multiple tips per gig, not one
The original spec said one tip per avatar per gig. That caps generosity at
exactly the moment it matters — someone who tips 25 early and hears a track they
love an hour later can't tip again. In SL a tip jar gets hit several times a
night. A 30-second cooldown stops double-taps, which is the only real problem.

### Weekly payout runs, not per gig
The 7-day hold is per tip — that's the window to stop a disputed gig while a
refund is still possible. But **payment** is weekly, one transfer per DJ. Paying
per tip would mean a DJ playing Mon/Tue/Wed gets three transfers the following
Mon/Tue/Wed.

### Payouts are manual, on purpose
`llGiveMoney` needs a rezzed object with debit permission owned by the avatar
holding the L$, so a webhook **cannot** send Linden dollars. At five DJs a human
does it: an email on Monday says what's owed, Maarten pays inworld and marks it
paid in admin → Payouts.

A Payout Terminal owned by IncynqPayments could automate this later. The data
model already supports it. After the webhook sat dead for three weeks unnoticed,
starting with "a person looks at every payment" is the right call.

### Paid to the avatar, by UUID
**A DJ IS the avatar** — the performer identity is a stage name on a resident's
account. So the payout target is the OWNER's `sl_uuid`, captured at Terminal
activation with the avatar physically present. Paying by UUID removes any "which
DJ Max did I mean", and display names change.

---

## Two money holes found and closed

### 1. Welcome credit was tippable
The 100 L$ welcome credit is promotional — nobody paid it in. If it could be
tipped it would become withdrawable earnings and leave as real L$ at payout, so
InCynq would be funding the tips. It was also farmable with alts at ~€0.35 each.

**Fix:** `profiles.promo_balance` tracks how much of a wallet InCynq gave away.
Tips must come from the part someone actually paid for. Promotional credit still
buys airtime, ads and boosts — that's what it's for.

Refusals are honest about which problem it is: someone holding 100 L$ of welcome
credit is told *"your welcome credit is for exploring InCynq"*, not "not enough",
which would be a lie.

### 2. Self-tipping was a cash-out route ⚠️
**Found by Mathijs asking a casual question about his own test setup.**

`submit_tip` checked `performer_id = auth.uid()`, which NEVER matches — a
performer is a separate `profiles` row owned by the resident via
`brand_owner_id`. So a resident could tip their own DJ identity:

```
top up 1,000 L$ at an ATM → tip your own DJ → withdraw 950
```

That makes non-refundable wallet credit refundable at a 5% fee, against the rule
that it never is. **Fix:** use `owns_performer()`, the same check that gates Go
Live and End set.

Worth looking for this shape elsewhere: any check comparing `auth.uid()` to a
brand or performer id reads correctly and matches nothing.

---

## Where the money actually is

A tip moves credit that is **already in the treasury**. The tipper topped up at
an ATM, those L$ went to IncynqPayments, and they've been sitting as float since.
Tipping reassigns float between pots; nothing moves inworld until payout, and by
then the money has been there at least a week.

The solvency invariant is unchanged: IncynqPayments must hold at least
member float + brand float + tips reserved for payout. Tips don't change that
total — they move it between columns. **Only credit nobody paid in breaks it**,
which is why `promo_balance` exists.

---

## Internal accounts

`profiles.is_internal` marks InCynq's own accounts — `maarten.huckleberry`
(= SLCompare), `djtest_msuwxo5v` (= TEST DJ INCYNQ), `incynqofficial`,
`incynqpayments`. Excluded from revenue, float and member counts.

Maarten tops up SLCompare to advertise on his own platform; that's InCynq paying
itself, not income. Without the flag, the Financial Overview would count
1,008,699 L$ of test credit as money owed to members and the solvency figure
would be meaningless.

`get_financial_overview()` shows internal holdings on their own line rather than
hiding them, so a wrong total can always be reconciled.

---

## Built this session

**SQL** (all in `supabase/sql/`)
| File | What |
|---|---|
| `dj_phase3_05_live_sessions.sql` | go_live / end_set / sweep, stream URL protection |
| `dj_phase3_06_live_now.sql` | follow-aware live queries |
| `dj_phase3_07_listener_count.sql` | presence heartbeat, peak + total on the session |
| `dj_phase3_08_performer_heartbeat.sql` | dropped connections billed to last heartbeat |
| `dj_phase3_09_grace_setting.sql` | grace period admin-set |
| `dj_phase3_10_golive_notify.sql` | notify RSVP'd residents on go live |
| `dj_phase3_11_event_expiry.sql` | ended state + 24h expiry |
| `dj_phase3_12_gig_history.sql` | past sets on the performer profile |
| `dj_phase4_01_tips.sql` | tips, promo_balance, submit_tip |
| `dj_phase4_02_internal_accounts.sql` | is_internal + financial overview |
| `dj_phase4_03_tip_txn_type.sql` | allow 'tip' in wallet_transactions |
| `dj_phase4_04_self_tip.sql` | close the cash-out route |
| `dj_phase4_05_atm_slurl.sql` | where to top up, browser-safe map link |
| `dj_phase4_06_payouts.sql` | payout listing + mark paid |
| `dj_phase4_07_payout_alert.sql` | Monday 09:00 UTC email |
| `dj_phase4_08_payout_history.sql` | individual payments for the DJ |

**App** — `EventsScreen`, `FeedScreen`, `MainApp`, `PerformerProfileView`,
`TipSheet` (new), `db.js`
**Admin** — `PayoutsSection` (new), `AdminScreen`
**Edge function** — `send-payout-alert` (in the repo this time)

---

## Bugs worth remembering

**Three separate check-constraint collisions in one day.** `'completed'` used in
four places where `payment_intents.status` allows only
`pending | paid | expired | cancelled`, and `'tip'` where `wallet_transactions`
had no such type. Each was a value invented in code without reading the
constraint. **Read the constraint before writing to a status or type column.**

The `'completed'` one was quietly serious: `adminGetStats` filtered revenue on a
status no row ever has, so **Dashboard revenue read zero permanently**, and two
"cancel the pending intent" safeguards failed inside silent `try/catch` blocks —
meaning a manually activated brand could still pay at an ATM and be credited
twice.

**SLT conversion was inverted, then subtly wrong.** First version built the wall
time in the viewer's zone and asked what instant it was in LA — backwards. The
fix re-parsed a localised string, which JS interprets in the viewer's zone, so it
passed in UTC and was an hour out from Dublin. Final version never parses a
localised string. Verified from Dublin, UTC and Sydney, plus a winter date.

**Player kept going after the set ended.** The heartbeat already knew — the
response was being discarded. Now stops playback within 30 seconds.

**A hook referenced `currentUser` before its `useApp()` destructure.** Temporal
dead zone; black screen. Mathijs caught it from the line numbers.

---

## Still open

- **Referral and survey rewards don't set `promo_balance`** — currently tippable.
  Same for `adminCreditWallet` (admin gifts to a personal wallet).
- **Payout history recomputes the fee at read time** rather than storing the rate
  per batch. Fine at a stable 5%; historic payouts would show the wrong rate if
  it ever changes.
- **No payout automation.** Fine at five DJs, tedious at fifty.
- **Terminal activation still untested** since the webhook rebuild.
- Everything in `claude_Pre_Launch_Checklist.md`.

---

## Next

Marketing, and getting up to five DJs on board to test. Maarten covers their
1,750 activation, which is really 10 hours of airtime rather than cash out the
door.

Worth doing before they arrive: test Terminal activation with a throwaway avatar,
so the first real DJ signing up isn't the test.
