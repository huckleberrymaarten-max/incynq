# InCynq — DJ & Live Performer Feature Spec

_v2 · July 20, 2026 · supersedes v1_
_Maps to: MASTER_TODO_FUTURE v6 → "Live Streaming" + Post-Launch **Update 2** (Live streaming + tip jar + payouts)_

> **Headline (locked from FUTURE v6):** _"Your audience is bigger than your venue."_

---

## 0. Locked decisions (this round)

1. **A DJ / Live Performer is a brand-style separate identity.** DJMAX is its own thing — own handle (`@djmax`), own followers, own wallet, own profile — not a flag on the resident's personal profile. It's built by **reusing the existing sub-brand activation machinery**, not new plumbing.
2. **Added exactly like a brand.** A resident opens an "Add DJ / Live Performer" flow, same shape as Add Brand: fill details → pay → SL webhook confirms → identity goes live.
3. **Activation fee: 1,750 L$**, and it **credits the performer's wallet** (spendable), same model as brand activation. Not a sunk fee — it's pre-loaded broadcast credit.
4. **Wallet credit buys "hours"** of live broadcast time at an **admin-set per-hour rate**. Going live draws down hours.
5. **Brands revert to 3,500 L$** — set in admin (see §12). ⚠ Note: the brand activation *charge* is currently hard-coded and does NOT read admin, so this needs a code fix too, not just an admin edit.
6. **Anyone can create an event** (confirmed from code). The live + tip-jar layer hangs off any event; the **performer owns their own gig** and notifies their own followers, regardless of who booked them.
7. **Reuse the existing `boost_tier`** on events for optional gig promotion (Basic / Boosted / Premium = promotion, not airtime).
8. **Performer wallet has TWO segregated balances** — non-refundable *spend credit* (deposits + activation, spend-only inside InCynq) and withdrawable *earnings* (tips only, paid out to the SL avatar). They never mix; credit only ever flows earnings → spend, never the reverse. See §7A.
9. **Airtime = L$175/hour** (admin-set, `app_content.broadcast_hour_price`). Chosen so the 1,750 activation credit = exactly **10 hours** — a clean "first 10 hours on air" bundle.
10. **Platform tip cut = 10%** (admin-set). Matches the Ticket Sales cut in FUTURE v6. Justification + performer-facing copy in §11A.

**Still open (need your call):**
- **Tip ladder amounts** (working assumption 25 / 50 / 100 / custom).
- **Are hours sold in blocks** (buy a 4-hour pack) or **any amount** (buy 1.5 hours)? Assumption: buy any whole number of hours.
- **Refund/withhold policy** if a gig is flagged mid tip-window (assumption: admin can withhold + refund).

---

## 1. What this feature is

A way for **performer identities** — DJs and Live Artists — to broadcast their set **inside InCynq**, go live against an event, and collect tips in L$ that pay out automatically. A resident spins up a performer identity (DJMAX) the same way they'd add a brand; that identity has its own handle, followers, wallet, and tip jar.

It sits on top of what InCynq already has — **Events**, the **Wallet**, the **Brand / sub-brand activation flow**, `payment_intents`, the **SL webhook**, and **push** — plus **IncynqPayments LSL** for real L$ movement inworld. Very little is built from zero; it's mostly the brand machinery pointed at a new identity type, plus the "go live," "hours," and "tip" layers.

### The three jobs it does
1. **Be a performer identity** — a resident adds a DJ / Live Artist (DJMAX), paid like a brand.
2. **Go live** — the performer opens a live session on their own event; the stream embeds in the feed, followers get a push, a "🔴 LIVE" state shows across the app. Airtime draws down purchased hours.
3. **Get tipped & paid** — the audience tips once per gig; tips are held 7 days then auto-paid out via IncynqPayments, minus InCynq's cut.

---

## 2. Identity model — how a performer is added

This mirrors **`initSubBrandActivation`** almost exactly (see `db.js` ~line 2210).

**Add DJ / Live Performer flow (new screen, patterned on `AddBrandScreen`):**
1. Resident taps **Add DJ / Live Performer**.
2. Fills in: stage name (→ `@handle`), type (DJ / Live Artist / Both), genres, default stream link, home venue SLURL (optional), bio, one sample link (optional), logo/avatar.
3. System computes a unique handle via **`ensureUniqueBrandHandle(generateBrandHandle(name))`** — so `DJMAX` → `@djmax`, collisions get a suffix, exactly like brand handles.
4. Creates a **new profile row** for the performer identity:
   - `account_type: 'performer'` _(new type; see note)_
   - `performer_type: 'dj' | 'live' | 'both'`
   - `brand_owner_id: <resident id>` (ties DJMAX back to Maarten's login)
   - own `username`, `display_name`, `handle`, logo
5. Creates a **`payment_intents`** row: `intent_type: 'performer_activation'`, **`amount` read from `appContent.performer_activation_price` (default 1750)** — admin-driven, never hard-coded (unlike brand activation today — see §12). 30-min expiry, `ICQ-XXXXXX` code.
6. Resident pays inworld (Terminal/ATM) → **SL webhook** confirms → identity flips to active **and the 1,750 L$ is credited to the performer's wallet** (`brand_wallet` on that profile row, reused).
7. Poll for activation the same way `checkBrandActivated` does (every 3s while waiting).

**`account_type` note:** performers reuse the brand codepaths (wallet, handle, followers, analytics), so the simplest implementation is a new `account_type = 'performer'` that the UI treats as a brand variant, plus `performer_type` to distinguish DJ vs Live Artist. Wherever the code checks `account_type === 'brand' || 'founding_brand'` for brand behaviour (search visibility, own-brand-shows-in-results, etc.), add `'performer'`.

**What the performer inherits for free from the brand system:** wallet (`brand_wallet`), handle, followers/following, appears as its own search result, posts as itself, `Brand since`-style "Performing since" date, analytics scaffolding.

---

## 3. Buying hours (airtime)

New concept — nothing like it exists in the code yet, so defined here.

- The performer's **wallet credit** (seeded by the 1,750 activation, toppable like any wallet) is spent to **buy broadcast hours**.
- **Per-hour rate is admin-set** via `appContent.broadcast_hour_price` (**launch default L$175/hour**), read through **ContentContext** (same pattern as `boost_price_basic` etc.). One admin change updates the app *and* the .net pricing text — no hard-coding.
- At L$175/hour the **1,750 activation credit = exactly 10 hours** — market it as the "first 10 hours on air."
- Buying hours: performer chooses an amount → L$ deducted from wallet → `hours_balance` increases. (Block sizes vs. any-amount is an open decision.)
- **Going live consumes hours**: while a session is `live`, hours draw down against `hours_balance`; if it hits zero the stream ends (with a warning first).
- InCynq realises the activation credit as revenue as hours are consumed — airtime is the product.

_Copy (warm, jargon-free):_ **"Top up your hours, then hit the decks."** _"Your airtime comes out of your wallet — buy the hours you need, go live, and only what you use gets spent."_

---

## 4. Events integration & permissions

Confirmed from `EventsScreen.jsx` + `db.js`: **any signed-in user can create an event** — the **+ Create** button is ungated and the UI says "free for everyone." `createEvent` just inserts `user_id` with a title. So:

- **Anyone** creates events, and can flag one as a **live event** (adds stream + tip jar) — or later, other types like an **auction**.
- To open a **tip jar** on a live event you must be a **performer identity** — that's the gate.
- The **performer owns and announces their own gig** to their own followers, independent of any booking. They create it, they go live, tips come to them.
- **Go live + open tip jar = performer only.** A venue can run its own event to tell its followers, but the stream + tip jar live on the performer's event.
- **Promotion tiers reuse `boost_tier`.** The events table already has a `boost_tier` column and `ContentContext.eventBoostTiers`, rendering a "⚡ FEATURED EVENT" style. Basic / Boosted / Premium promotion for a gig rides on that — no parallel mechanism.

---

## 5. Going live (session lifecycle)

1. Performer creates their **event** and flags it **This is a live set** (requires `hours_balance > 0`).
2. At showtime, performer taps **Go Live**:
   - A `live_session` opens (`status: 'live'`), starts drawing down hours.
   - Stream embeds and plays in the feed (audio player card).
   - **🔴 LIVE** badge on the event + performer profile; "On Air now" strip near top of feed for boosted/premium promotion.
   - **Push to the performer's followers**: _"🔴 DJMAX is live now — [event title]."_ (extends existing `send-push`).
3. Audience opens it, stream plays inline, **Tip** button active while `live`.
4. Performer taps **End set** → `status: 'ended'`, hours draw-down stops, tip window opens.

---

## 6. Tipping

- **One tip per avatar per gig** (FUTURE v6). Tip button disables after a resident tips that session.
- Amount from a preset ladder (assumption 25 / 50 / 100 / custom), deducted from the **tipper's wallet** immediately.
- Tips recorded against the session + performer, held (not spendable) until payout.
- Optional short message, moderated via the existing `moderate-post` path.

_Copy:_ **"Loved the set? Drop a tip."** _"One tip per gig. Straight from your wallet, straight to the artist."_

---

## 7. Payout

- **7-day window then auto-payout** (FUTURE v6).
- Day 7: a cron/edge function sweeps the session's held tips, deducts **InCynq's platform cut** (admin %), pays the remainder to the performer's SL avatar via **IncynqPayments LSL + `llGiveMoney`**. (Same avatar as the owning login.)
- Before payout the total shows in admin **Financial Overview → "Reserved for performer payouts."**
- Performer sees an **Earnings** view: pending (in window) / paid out / lifetime.

_Copy:_ **"Your tips, paid out automatically."** _"Everything from a gig lands in your account 7 days later. No invoices, no chasing."_

---

## 7A. Wallet vs Earnings — two segregated balances

A performer identity carries **two separate pots**, and keeping them apart is a financial-integrity requirement, not a preference.

**1. Spend wallet** (`brand_wallet`, reused)
- Funded by: top-ups + the 1,750 activation credit.
- Rules: **non-refundable, spend-only inside InCynq** (hours, promotion, ads) — identical to every other InCynq wallet.
- **Never withdrawable.** This is what stops deposits being cashed back out (a refund loophole / laundering vector).

**2. Earnings** (settled from the `tips` ledger, tracked as `earnings_balance`)
- Funded by: **tips only**, net of the platform cut.
- Rules: held 7 days, then **paid out to the performer's SL avatar** via IncynqPayments `llGiveMoney`. This is the only money that leaves InCynq.
- Sourced exclusively from real tip income — a deposit can never land here.

**The one-way rule:** credit may move **earnings → spend** (a DJ reinvests tips into more hours — safe, since it only *reduces* withdrawable money), but **never spend → earnings** (deposited credit can never become a payout). Any "convert" or "reinvest" action enforces this direction only.

**Where auto-payout fits:** the 7-day window is the hold; after it, earnings auto-pay out. If a DJ has toggled "reinvest," settled earnings move to spend wallet instead of paying out. Default is pay out.

_Copy:_ **"Two pots, kept clean."** _"What you top up is for spending on InCynq — hours, promotion. What you earn in tips is yours to withdraw. We never mix the two."_

---

## 8. Data model (Supabase)

> ⚠ Every new table ships the **post-May-30 GRANTs** (FUTURE v6) + RLS enabled.

### 8.1 Performer identity — reuse `profiles`
No new identity table. A performer is a `profiles` row:
```
account_type    'performer'            -- new; treated as a brand variant
performer_type  'dj' | 'live' | 'both'
brand_owner_id  uuid  → profiles(id)   -- the owning resident login
brand_handle    text                   -- @djmax, via ensureUniqueBrandHandle
brand_wallet    integer                -- SPEND credit only (seeded 1750). Non-refundable, never withdrawable.
brand_logo_url  text
-- + the performer-specific fields below
```

### 8.2 `performer_profiles` — performer-specific fields
```
profile_id      uuid PK/FK → profiles(id)     -- the performer identity row
genres          jsonb
stream_url      text
home_slurl      text  null
sample_url      text  null
hours_balance   numeric default 0             -- airtime bought from SPEND wallet
earnings_balance integer default 0            -- settled tip earnings, WITHDRAWABLE (tips only, never deposits)
reinvest_tips   bool default false            -- if true, settled earnings top up spend wallet instead of paying out
is_available    bool  default true
created_at      timestamptz default now()
updated_at      timestamptz default now()
```

### 8.3 `live_sessions`
```
id                 uuid PK default gen_random_uuid()
performer_id       uuid FK → profiles(id)      -- the DJMAX identity
event_id           uuid FK → events(id)        -- performer's own event
stream_url         text
status             text check in ('scheduled','live','ended','cancelled') default 'scheduled'
started_at         timestamptz null
ended_at           timestamptz null
hours_consumed     numeric default 0
tip_window_ends_at timestamptz null            -- ended_at + 7 days
payout_status      text check in ('pending','reserved','paid','failed') default 'pending'
created_at         timestamptz default now()
```

### 8.4 `tips`
```
id              uuid PK default gen_random_uuid()
session_id      uuid FK → live_sessions(id)
from_user_id    uuid FK → profiles(id)
to_performer_id uuid FK → profiles(id)
amount_l        integer
message         text null
status          text check in ('held','paid_out','refunded') default 'held'
created_at      timestamptz default now()
unique (session_id, from_user_id)              -- one tip per avatar per gig
```

### 8.5 `payouts`
```
id                uuid PK default gen_random_uuid()
session_id        uuid FK → live_sessions(id)
performer_id      uuid FK → profiles(id)
gross_l           integer
platform_cut_pct  numeric
platform_cut_l    integer
net_l             integer
sl_txn_ref        text null
status            text check in ('reserved','paid','failed') default 'reserved'
paid_at           timestamptz null
created_at        timestamptz default now()
```

### 8.6 `hour_purchases` (audit of airtime bought)
```
id            uuid PK default gen_random_uuid()
performer_id  uuid FK → profiles(id)
hours         numeric
rate_l        integer          -- snapshot of admin per-hour rate
cost_l        integer          -- deducted from wallet
created_at    timestamptz default now()
```

### 8.7 GRANT + RLS boilerplate (per new table)
```sql
grant select on public.performer_profiles to anon;
grant select, insert, update, delete on public.performer_profiles to authenticated;
grant select, insert, update, delete on public.performer_profiles to service_role;
alter table public.performer_profiles enable row level security;
-- repeat per table; tips / payouts / hour_purchases writes locked to service_role via edge functions
```
RLS intent: performer_profiles public read, owner writes; live_sessions public read, performer writes own, status via edge fn; tips + hour_purchases + payouts go through edge functions (atomic wallet moves), never raw client inserts; payouts service_role only.

---

## 9. Edge functions & crons
- **`performer-activation`** — mirror of the brand-activation webhook branch: on paid `performer_activation` intent, flip identity active + credit 1,750 to wallet. (Extend existing SL webhook.)
- **`buy-hours`** — atomic: deduct L$ from the **spend wallet** (`brand_wallet`) at admin rate, add to `hours_balance`, log `hour_purchases`. Rejects if spend balance too low. (Never touches earnings.)
- **`live-session`** — start/end session, check `hours_balance > 0`, draw down hours while live, fire push on go-live.
- **`submit-tip`** — atomic: session `live`, no existing tip from this avatar, deduct wallet, insert `tips` held.
- **`payout-gigs`** (cron, daily) — 7-day sweep, snapshot cut %, settle net into **earnings**, then either **pay out** to the SL avatar via IncynqPayments `llGiveMoney` (default) or, if `reinvest_tips`, move to **spend wallet**. Write `payouts`, mark tips `paid_out`; fail safe → `failed` + surface in admin. Never pays out from `brand_wallet`.
- **`send-push`** (extend existing) — new go-live trigger.

---

## 10. Admin panel
- **Financial Overview** _(hard dependency — build first)_ — L$ received, L$ paid out, reserved for performer payouts, platform profit.
- **Performers section** — identities, sessions, hours used, tip volume, payout status; withhold/refund.
- **Pricing** — per-hour broadcast rate + `platform_tip_cut_pct` + promotion tier prices, in the existing pricing config (→ ContentContext).
- **Launch comms** — reuse `admin-blast` (in-app + push) + email.

---

## 11. incynq.net (marketing)
- Residents page — "Perform live" section, headline **"Your audience is bigger than your venue."**
- FAQ (`qaData.js`) + T&C (`tcData.js`) — adding a performer, buying hours, one-tip-per-gig, 7-day payout, platform cut, non-refundable L$, Adult-set maturity rules. Single source of truth — edit the JS, pages auto-update.
- **Prices in copy:** where possible reference the admin values (`app_content`) rather than typing "1,750 L$" into the JS — otherwise a price change in admin won't match the .net text. Confirm whether the .net pricing strings are already Supabase-driven or static in `qaData.js`/`tcData.js` (needs a look at the incynq-net repo).

---

## 11A. Pricing justification — why 10% on tips (for copy + internal)

The 10% is a **marketplace commission, not a payment fee** — it buys two things a DJ can't get streaming solo:

- **Reach.** Going live pushes to followers, lands in the feed + LIVE-now section, and surfaces in Discover by genre. The tips exist *because* InCynq put a crowd in the room — the cut is a slice of value InCynq helped create, not a toll on money that would've been there anyway.
- **Automation + trust.** Tip jar, 7-day settlement, and automatic payout to the SL avatar run hands-free — no invoices, no chasing a venue owner. InCynq also carries the reserve during the hold, message moderation, one-tip-per-gig enforcement, and flagged/refunded-gig handling.

**Why 10% specifically:** consistent with the Ticket Sales cut (one fair rule across the platform); low vs. every comparison (creator platforms take far more; inworld a venue/host often splits tips more steeply than 10%). InCynq is venue + promoter + cashier for 10%.

**Two honesty points to keep in the copy (avoid feeling nickel-and-dimed):** the cut is taken **only on tips coming in** — never on airtime hours, never on the spend wallet (no double-dip) — and **only ever from money earned**, never from anything deposited.

**Performer-facing FAQ line (`qaData.js`), InCynq voice:**
> _"You keep 90% of every tip. The 10% is how we get your set in front of the whole InCynq community — the nudge to your followers, your spot in the feed and Discover — and pay your tips straight to your avatar, automatically, every time. No chasing, no invoices. We only ever take it from tips you earn, never from your airtime or anything you top up."_

---

## 12. Brand price revert + hard-coded-price fix (separate change)
You set prices in admin (`app_content`) and both the app and .net read them via `ContentContext`. **But brand activation ignores that** — `initBrandActivation` (`db.js` ~1737) and `initSubBrandActivation` (~2247) hard-code `amount: 2500` in the payment intent (the comment even says "3500" — already drifted). So an admin change updates the *displayed* price but not the *actual charge*.

Two options:
- **Quick:** change the two hard-coded `2500` → `3500` so charge matches admin. Fixes the number, not the pattern.
- **Proper (recommended):** read the amount from `appContent.brand_activation_price` (default 3500), exactly like `boost_price_*`. Then admin truly controls it and it can never drift again.

Either way, do the same for the performer flow from day one (read from `appContent.performer_activation_price`). _(Standalone from the feature — bundle in or ship on its own.)_

---

## 13. Phased build plan (MASTER_TODO style)

### Phase 0 — Financial groundwork _(dependency, first)_
- [ ] Admin **Financial Overview** — received / paid out / reserved for payouts / profit
- [ ] Add `platform_tip_cut_pct` + per-hour broadcast rate + promotion tier prices to admin config → ContentContext

### Phase 1 — Performer identity (reuse brand flow)
- [ ] Add `account_type = 'performer'` + `performer_type`; extend brand-behaviour checks to include it
- [ ] `performer_profiles` table + GRANTs + RLS
- [ ] **Add DJ / Live Performer** screen (patterned on `AddBrandScreen`) — details + handle
- [ ] `initPerformerActivation` (clone of `initSubBrandActivation`, `amount: 1750`, `intent_type: 'performer_activation'`)
- [ ] Extend SL webhook — activate identity + credit 1,750 to wallet
- [ ] Performer public profile + Discover filter (DJ / Live Artist + genre)

### Phase 2 — Hours
- [ ] `hour_purchases` table + `buy-hours` edge function
- [ ] Buy-hours UI (spend wallet → `hours_balance`)
- [ ] Hours balance shown on performer dashboard

### Phase 3 — Live sessions
- [ ] `live_sessions` table + GRANTs + RLS
- [ ] "This is a live set" flag on event create (gate on `hours_balance > 0`)
- [ ] `live-session` edge function (start/end, hours draw-down)
- [ ] Embedded audio stream card + 🔴 LIVE badges + "On Air now" strip
- [ ] Go-live push to followers (extend `send-push`)
- [ ] LIVE-now section pinned in Events + reuse `boost_tier` promotion

### Phase 4 — Tip jar
- [ ] `tips` table + GRANTs + RLS (unique session_id + from_user_id)
- [ ] `submit-tip` edge function (atomic, one-per-gig)
- [ ] Tip button + ladder + optional moderated message
- [ ] Performer **Earnings** view

### Phase 5 — Payouts
- [ ] `payouts` table + GRANTs + RLS (service_role only)
- [ ] `payout-gigs` cron (7-day sweep, cut snapshot, IncynqPayments `llGiveMoney`)
- [ ] Reserved-for-payouts wired into Financial Overview
- [ ] Admin Performers section (withhold / refund / inspect)

### Phase 6 — Launch
- [ ] FAQ + T&C entries
- [ ] incynq.net "Perform live" section
- [ ] Brand price → 3,500 (if not already shipped)
- [ ] Launch blast (in-app + push + email)
- [ ] End-to-end test: add DJMAX → buy hours → go live → tip (one-per-gig) → 7-day sweep → `llGiveMoney` payout → Financial Overview reconciles

---

## 14. Open decisions (for you)

_Decided:_ ~~per-hour rate~~ **L$175/hr** · ~~tip cut~~ **10%** · ~~performer activation~~ **L$1,750** · ~~identity model~~ **brand-style (DJMAX / @djmax)** · ~~wallet~~ **two segregated balances**

_Still open:_
1. **Hours sold in blocks or any amount?**
2. **Tip ladder amounts?** (assumption 25 / 50 / 100 / custom)
3. **Refund/withhold policy** on flagged gigs mid-window?
4. **Bundle the brand→3,500 change** into this work, or ship separately?
