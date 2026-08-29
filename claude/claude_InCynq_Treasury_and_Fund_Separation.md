# InCynq — Treasury & Fund Separation (decision)

_Captured during DJ/Performer build. Governs Phase 0 (Financial Overview) and Phase 5 (payouts)._

## Single treasury avatar
**IncynqPayments** is the one dedicated payments/treasury avatar.
- All inbound L$ go to it: activation/slot fees, wallet top-ups, tips.
- All outbound L$ leave from it: performer payouts and refunds, via IncynqPayments LSL `llGiveMoney`.
- It is **never** Maarten's personal avatar.

## Two streams, kept separate (never commingled)
**1. Float — money owed to users (stays in the treasury):**
- Unspent wallet / spend credit (`profiles.brand_wallet`, incl. the 1,750 activation credit).
- Tips collected but not yet paid out (`earnings_balance`, held during the window).
- This is a liability. It only ever moves OUT as a payout or a refund.

**2. Revenue — the platform's own income (drawn by Maarten):**
- The 10% tip cut.
- Airtime actually consumed (broadcast credit becomes revenue only as hours are used).
- Activation + slot fees.
- **Rebranding (name-change) fees** — see below.
- **Forfeited spend credit** from deleted profiles — see below.
- This is real profit; the owner draws it manually (see below).

## The one crossing rule
Realized revenue moves **float → personal only**. Never personal → float, and never
spend the float for personal use. This mirrors the per-performer "two pots" rule
(non-refundable spend credit vs withdrawable tip earnings) at the platform level:
if every `earnings_balance` is funded only by real tips, the treasury float always has
real L$ behind it.

## Rebranding / name-change fee (future feature — decision captured)
A **name change** (rebrand) will be a **paid** action, for brands AND DJs/performers.
- **Price = the original registration/activation fee** for that identity type
  (brand 3,500 L$, performer 1,750 L$ — read from `app_content`, never hardcoded).
- **KEY DIFFERENCE from activation:** the rebranding fee is a **pure service charge**.
  It does **NOT** credit the spend wallet. Activation pays a fee and the same amount
  lands in the wallet as spend credit (so it is float until spent); a rebrand fee has
  **no wallet credit** — it is booked straight to **revenue** at IncynqPayments.
- So: activation fee → float (user-owed credit); rebrand fee → revenue (platform income).
- Identity nuance: a **brand is a brand** (brands are effectively fixed), but a
  **DJ/performer can rebrand** (real DJs change stage names). So renaming is expected to
  be more common on the performer side; both are supported at the same fee model.
- Handle-on-rename: default is to keep the existing `@handle` **stable** (changing it
  breaks existing links/mentions); optionally offer "also update handle" later.
- Status: **future** — not built yet. When built, the fee must be booked as revenue,
  not added to `brand_wallet`.

## Rebrand vs. delete-and-recreate — economics (decision captured)
Two ways a user could get a differently-named identity; the incentives are deliberately
tilted toward rebranding:
- **Rebrand (pay the fee):** keeps the profile's **followers, posts, history AND its
  spend-wallet credit**. Financially the smarter move — you keep everything and only pay
  the fee. This is the expected/encouraged path.
- **Delete + make a new profile:** requesting an extra slot and activating a fresh
  identity is allowed, but deleting the old profile means **no refund of its spend
  wallet** — the non-refundable credit is forfeited (booked to revenue). You also lose
  the old profile's followers/history. So this only makes sense if you truly want a clean
  break.

**Deletion & the two pots (resolved):**
- **Spend credit** (non-refundable) → **forfeited** on deletion (becomes platform revenue).
- **Withdrawable tip earnings** → **never forfeited, always paid.** Account deletion
  always carries a **cool-off longer than 7 days** (brands already have a 30-day grace).
  Because per-gig payout runs on a 7-day window, every gig's window closes *during* the
  cool-off, so all earned tips are auto-paid before deletion finalizes. Payout is
  guaranteed by the cool-off ≥ payout-window relationship — no special "pay out before
  delete" logic needed, as long as cool-off stays > 7 days.

## Solvency invariant (Financial Overview must show)
Treasury (IncynqPayments) balance >= reserved-for-payouts + outstanding wallet float.
Phase 0 Financial Overview reconciles: received / paid out / reserved for payouts /
platform profit. Reserved-for-payouts = NET owed (gross tips minus the 10% cut) for
gigs still inside their 7-day window; the cut portion counts as profit, not reserve.

## Payout cadence (performers)
**7-day auto-payout per gig** (LOCKED). Not monthly. A daily cron sweeps gigs whose
7-day window has closed, deducts the 10% cut, pays net to the performer's SL avatar
from IncynqPayments. (An earlier "end of month" idea was a mix-up from another project — disregarded.)

## Owner draw (Maarten) — MANUAL (no automation)
Decided: **no automated month-end transfer.** Maarten draws revenue by hand, whenever
he wants, from IncynqPayments to his personal avatar. No cron, no fixed percentage —
his discretion.

Requirement this puts on the build (Phase 0 Financial Overview):
- Show **revenue by month** — at least current month + previous month — so at month-end
  the owner can see what last month earned.
- Show **"safely drawable now"** = platform profit currently held that is NOT part of the
  float (i.e. treasury balance minus reserved-for-payouts minus outstanding wallet float).
- With those two numbers visible, the owner transfers by hand and can never accidentally
  dip into money owed to users.

(Earlier idea of an automated 25%-of-revenue month-end sweep was considered and dropped
in favour of this manual approach.)

## Interim (current build)
The performer in-app "Edit Profile" edits everything set up at registration **except the
stage name** (bio, email, performer type, genres, stream URL, home SLurl, sample URL,
photo) — these are free edits, no fee. The stage name is changed by an **admin** on
request (until the paid self-serve rebrand exists).

## Flag for later (not blocking)
Cashing L$ out to real currency (LindeX / Process Credit), tax, and holding+paying user
balances (effectively a small money service) carry legal/tax/compliance implications.
Review with an accountant/lawyer familiar with virtual-economy businesses as volume grows.
Not a code concern; a business one.
