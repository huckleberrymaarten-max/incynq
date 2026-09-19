# InCynq — Pre-launch checklist

_Started 19 Sep 2026, during the DJ/performer build._
_Things that don't block development but must not be live when real members arrive._

---

## Money — test data to clear

Nobody outside InCynq has ever topped up at an ATM, and no brand has ever paid
an activation fee. Every balance in the system is either test money Maarten put
there, or credit InCynq gave away.

**Zero these — Maarten's own test accounts:**

| Account | Pot | Amount |
|---|---|---|
| `maarten.huckleberry` | `wallet` | 100 |
| SLCompare (same row) | `brand_wallet` | **1,008,699** |
| TEST DJ INCYNQ | `brand_wallet` | 11,312 |
| `incynqofficial` | both | already 0 |
| `incynqpayments` | both | already 0 |

⚠️ **The SLCompare million matters more than it looks.** When the Financial
Overview is built it will sum brand wallets as "money owed to users". A million
L$ of test credit in that total makes the solvency figure meaningless and could
look alarming to anyone reading it.

**LEAVE ALONE — these are gifts to real members, not test data:**

- **Gonzaga Valley** (`lisbeth.placebo`) — 3,500 brand wallet. Activated
  manually as one of the first on board, so the activation fee was waived. She
  got something worth 3,500 L$ she would otherwise have paid for; taking it
  back would mean retroactively charging someone who was told it was free.
  *(Checked 19 Sep: she is the ONLY non-internal brand. No other founding brand
  exists in the database.)*
- **Welcome credit** held by `lisbeth.placebo`, `sapphire.divine`,
  `aurelia.dragonheart`, `duckkula.resident` — 100 L$ each.

**Also clear:** the permanent test event (`Test Set — SLAM!`) and its
`live_sessions` / `live_listeners` rows. A test gig sitting in Events would look
odd to the first real DJs.

---

## The gifts are real, but no L$ are behind them

Worth keeping these two questions apart, because they have different answers:

**Is it a gift or test data?** → decides whether to clear it. Everything given
to a real member stays.

**Did real L$ enter the treasury?** → decides whether it can be tipped and
withdrawn. A waived fee means no money came in, so if that credit could become
tip earnings, InCynq would be paying real L$ out against a balance with nothing
behind it.

No tension between the two: a founding brand keeps their 3,500 AND it stays
spend-only, which brand wallets always are.

**What this requires:** `adminCreditWallet` and `adminCreditDebitBrandWallet`
should increment `promo_balance` alongside the balance, exactly as welcome
credit now does. Otherwise an admin gift to a personal wallet would be tippable.

Scale is small — 3,500 L$ to Gonzaga Valley plus 400 in welcome credit held by
real members. Around €14. It only becomes a loss once payouts exist.

---

## Audit trail — two real gaps

**1. Manual activation doesn't write a wallet transaction.**
`UsersSection.doActivate` credits `profiles.wallet` and writes to `audit_log`,
but not to `wallet_transactions`. Found it because six accounts have
`welcome_credit_at` set while only three have a `welcome_credit` transaction —
300 L$ given out with nothing in the ledger. The webhook path does it correctly;
the admin path should match.

**2. Brand wallet movements aren't logged at all.**
No `wallet_transactions` rows exist for anything touching `brand_wallet` —
activation credit, admin top-ups, ad purchases, airtime. So a brand has a
balance with no history behind it, and if one asks "where did my credit go"
there is no answer. Worth fixing before brands are paying.

---

## Security

**The webhook has no authentication.** The LSL scripts send only
`X-InCynq-Source: lsl` — no secret, no signature — so anyone with the URL can
call `sl-webhook` and register devices, validate codes, or trigger activations.
SLCompare's equivalent verifies a shared secret header.

Fixing it means editing and re-rezzing all 12 devices, which is why it was left
out of the 14 Sep rebuild. It should still be done.

**No monitoring.** A dead edge function is invisible until someone notices
inworld — that's what turned a bad paste into a three-week outage. Now that
`inworld_devices.last_seen_at` is a genuine heartbeat (every 2 min), a simple
"any active device not seen in 10 minutes" check would catch it on day one.

---

## Untested

**Terminal activation.** The only action of the rebuilt webhook never exercised
since 14 Sep — it needs a fresh unactivated account. The first real DJ signing
up would otherwise be the test, which is a bad place to find a bug. Worth doing
with a throwaway SL avatar and email first.

---

## Promotional credit

`profiles.promo_balance` now tracks how much of a wallet InCynq gave away, and
tips can't be paid from it — otherwise welcome credit would become withdrawable
earnings at payout and InCynq would be funding the tips (and it would be
farmable with alts, at ~€0.35 a head).

**Welcome credit is handled. These are not, and credit the wallet without
touching `promo_balance` — so they're currently tippable:**
- `process_referral_reward`
- `submit_survey`
- `adminCreditWallet` (admin gifts to a personal wallet)

Nothing leaks until payouts exist, but that's the next slice.

---

## Copy / content still to write

- The DJ / Performer tab on incynq.net — content brief exists
  (`claude_DJ_Performer_incynq_net_and_FAQ_content.md`) but says **10%** on tips
  throughout. **It is now 5%**, and it's an admin & handling fee, not a
  commission.
- A "DJ / Live Performer" category on the incynq.net contact form — the in-app
  Edit Profile screen already links there for stage-name changes.
- FAQ says ads run 7 days; the app sells 1–4 weeks.
