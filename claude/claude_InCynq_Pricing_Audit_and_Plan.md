# InCynq — Pricing Audit & Centralisation Plan

_July 20, 2026 · goal: one source of truth (admin `app_content`) → app + .net, nothing hardcoded_

---

## Bottom line

Prices currently live in **five** different places, several of them **contradict each other**, and — most importantly — **the admin "Ad Prices" editor isn't wired to what the app actually charges.** So "change it in admin and it updates everywhere" is only partly true today. Fixing this cleanly is the right thing to do before the DJ feature adds four more prices to the pile.

### The three systemic problems

1. **Orphaned admin controls.** The admin **AD PRICES** tab writes keys `ad_price_basic / featured / premium`. **Nothing in the app reads those keys.** The app computes ad prices from a *different* key (`pricing_tiers`, a member-based JSON table). So editing ad prices in admin has no effect on what's charged. (Confirmed: `ad_price_*` has no consumer outside the admin screen.)

2. **Hardcoded charges that ignore admin.** Brand activation *displays* `brand_activation_fee` (default 3,500) but the actual payment intent is hardcoded `amount: 2500` in `db.js` (lines 1737 and 2247). Set 3,500 in admin → the app still charges 2,500. Display and charge silently diverge.

3. **.net is mostly static.** Only the dashboard monthly/annual price on `brands.html` is fetched live from Supabase. Every other price on .net — ad tiers, activation fee, welcome credit, referral, survey — is **typed into the HTML and into `qaData.js` / `tcData.js`**. Admin changes never reach them.

---

## Contradictions to resolve (pick one value each)

These already disagree *inside the current product* — worth settling before centralising:

| Price | Where it says X | Where it says Y | Notes |
|---|---|---|---|
| **Brand activation** | Charge (code) **2,500**; qaData **2,500** | Display + tcData **3,500** | You said revert to **3,500** |
| **Welcome credit expiry** | qaData: _"expires after 90 days"_ (line 21) | qaData: _"never expires"_ (line 67) + tcData + MASTER_TODO | MASTER_TODO says **never expires** |
| **Dashboard monthly** | Code default **250**; brands.html **250** | qaData + tcData **500** | Pick one |
| **Ad Growth-tier Featured** | qaData/tcData **650** | AdminScreen default **750** | Pick one |
| **Ad tier fallback (Launch)** | Code fallback 150/400/800 | .net static 250/750/1500 (pre-discount) | Reconcile |

---

## Full price inventory

| Price | App source (now) | .net source (now) | Correct single source |
|---|---|---|---|
| Ad tiers (4×3) | `pricing_tiers` JSON in app_content (+ hardcoded `PRICING_TIERS` fallback in db.js) | Static HTML in `brands.html` + `qaData`/`tcData` | `pricing_tiers` (app_content) |
| Admin "Ad Prices" (`ad_price_*`) | **orphaned — unused** | — | Delete, or repoint to `pricing_tiers` |
| Event boosts | `boost_price_basic/featured/premium` ✓ | Static in `qaData` | `boost_price_*` |
| Brand activation | **hardcoded 2500** (display reads `brand_activation_fee`) | Static 3,500 (`tcData`, `devices.html`) | `brand_activation_fee` |
| Sub-brand activation | **hardcoded 2500** | — | `brand_activation_fee` (or own key) |
| Dashboard monthly/annual | `dashboard_upgrade_monthly/annual` ✓ | Live fetch on brands.html ✓ | `dashboard_upgrade_*` |
| Welcome credit | applied server-side (webhook) | Static 100 (`residents`, `qaData`, `tcData`) | new `welcome_credit` key |
| Referral reward | server-side | Static 10 | new `referral_reward` key |
| Survey reward | server-side | Static 10 | new `survey_reward` key |
| Cynqified fee | (verify) | Static 1,500 | new `cynqified_fee` key |
| **DJ: performer activation** | _new_ | _new_ | `performer_activation_price` = 1,750 |
| **DJ: broadcast hour** | _new_ | _new_ | `broadcast_hour_price` = 175 |
| **DJ: tip cut %** | _new_ | _new_ | `tip_platform_cut_pct` = 10 |

---

## Target architecture

**`app_content` (key/value table in Supabase) is the single source of truth.** Everything reads from it:

- **App** already has the right mechanism — `ContentContext` loads `getAppContent()` once and exposes it. Extend it to cover *every* price, and make every **charge** (payment intents, boosts, subscriptions) read the context value, never a literal.
- **.net** already proves the pattern — `brands.html` fetches `app_content` over the Supabase REST API for the dashboard price. Generalise that: one small script fetches *all* price keys and injects them into `<span id="…">` placeholders across the pages.
- **`qaData.js` / `tcData.js`** are the hard part (long sentences with prices baked into prose). Two options — see decision D below.

---

## Fix plan (phased)

### Phase A — Consolidate the keys (admin + DB)
- [ ] Decide canonical keys (table above). Kill or repoint orphaned `ad_price_*`.
- [ ] Seed every key in `app_content` with the agreed values.
- [ ] Make the admin **Content** tab edit the *canonical* keys (so the Ad Prices editor drives `pricing_tiers`, not dead keys), and add rows for welcome/referral/survey/cynqified + the 3 DJ keys.
- [ ] Remove the legacy hardcoded `PRICING_TIERS` table in `db.js` (or have it read app_content) so there's no shadow copy.

### Phase B — App reads admin everywhere (no hardcoded charges)
- [ ] `initBrandActivation` / `initSubBrandActivation`: `amount` ← `appContent.brand_activation_fee` (not 2500). This fixes display + charge + wallet credit in one go (the webhook credits whatever the intent says).
- [ ] Welcome/referral/survey credit values ← app_content (in the webhook/edge functions that apply them).
- [ ] Audit every remaining numeric price literal → replace with a context value + a single shared fallback that matches the admin default.

### Phase C — .net reads admin
- [ ] Add price-placeholder `id`s to the static prices in `brands.html`, `devices.html`, `residents.html`.
- [ ] Extend the existing Supabase fetch script to pull *all* price keys and populate them.
- [ ] Decide `qaData`/`tcData` approach (decision D).

### Phase D — Reconcile the numbers
- [ ] Lock one value per contradiction (table above) and propagate.

---

## Decisions I need from you

- **A. Canonical values:** confirm the launch set — brand 3,500; welcome credit **never expires**; dashboard **250 or 500**/month; ad Growth-Featured **650 or 750**; plus the DJ set (1,750 / 175 / 10%). Give me the numbers and I'll seed them.
- **B. Orphaned `ad_price_*`:** delete them and make the admin Ad-Prices editor drive `pricing_tiers` (recommended), or wire `ad_price_*` into the app?
- **C. Ad-tier complexity:** the member-based 4-tier model (`pricing_tiers`) is more complex than a flat 3-price editor. Keep the auto-scaling tiers, or simplify to one editable set of 3 ad prices?
- **D. .net T&C / FAQ prices:** either (1) inject live values into `qaData`/`tcData` prose via placeholders (fully dynamic, more work), or (2) keep them as text but add a **"prices last verified"** sync checklist so they're updated deliberately when admin changes. Which do you want?

---

## Suggested order
Phase A + B first (the app is where money actually moves — get charges reading admin and kill the 2,500/3,500 divergence). Then Phase C/D for .net. Then build the DJ feature *into* the now-clean system, so its four prices are admin-driven from day one and never join this list.
