# InCynq — Pricing Centralisation — Status (COMPLETE bar DJ tab)

_Updated: July 21, 2026_

**Goal:** no price hardcoded anywhere; every price reads from admin (`app_content`) and flows to app charge + app display + .net (incl. T&C/FAQ prose).

## Single source of truth
`app_content` (Supabase key/value), edited in the admin **Content** tab. Read by:
- **App** via `ContentContext` + `getLaunchPromo()` + `get_price()` (DB).
- **.net** via `js/prices.js` (`data-price` attrs, `{{tokens}}`, `tiers()`/`tierTableText()`/`tierInlineText()`).

## Delivered batches (all price-neutral until a value is changed in admin)
1. **App db.js** — brand + sub-brand activation fee ← `brand_activation_fee` / `sub_brand_slot_fee` (were hardcoded 2500).
2. **App data/index.js + AdvertiseScreen.jsx** — launch promo ← `launch_promo_active/discount/threshold` + optional `launch_promo_start/end` (were hardcoded constants). `calcAdPrice` takes a promo multiplier.
3. **DB SQL** `db_functions_admin_pricing.sql` — `get_price()` helper + `confirm_activation` (welcome), `process_referral_reward` (referral + limit), `submit_survey` (survey), `upgrade_dashboard` (250/2500) all read admin. Validated on Postgres 16.
4. **.net brands.html** — ad tiers + promo render from `pricing_tiers` + `launch_promo_*`.
5. **.net residents.html + devices.html** — welcome/referral/survey/activation via `js/prices.js` `data-price`.
6. **.net terms.html + faq.html + tcData.js + qaData.js** — prose prices tokenised; ad-tier tables generated from `pricing_tiers`. Fixed contradictions: welcome credit → "never expires"; brand fee → admin (was 2,500 vs 3,500 split).

## Apply order
1. Supabase: `add_new_price_keys_SAFE.sql` then `db_functions_admin_pricing.sql`.
2. App: `apply-app-prices.ps1` (→ main).
3. .net: batch 3/4/5 PowerShell scripts (preview branches).

## app_content keys (canonical)
brand_activation_fee=3500(target; live 2500 until changed), sub_brand_slot_fee=3500, performer_activation_price=1750, broadcast_hour_price=175, tip_platform_cut_pct=10, welcome_credit=100, welcome_credit_expiry_days=0, referral_reward=10, referral_monthly_limit=10, survey_reward=10, cynqified_fee=1500, dashboard_upgrade_monthly=250, dashboard_upgrade_annual=2500, boost_price_basic/featured/premium=100/250/500, pricing_tiers=[Launch 150/400/800, Growth 250/750/1500, Established 400/1200/2500, Premium 600/1800/3500], launch_promo_active/discount/threshold=true/50/1000 (+ optional launch_promo_start/end ISO).

## Still open
- **DJ & Live Performer .net tab** — not built; awaiting coming-soon-vs-hold decision. Would add nav + footer + T&C section across all pages.
- **Pricing rules** (group multipliers 1.8/2.5/3×, 25% random, 25%/50% run-length) still static in both app + .net (consistent). Optional future admin move.
- Brand fee still 2,500 live — set to 3,500 in admin when ready (display + charge follow).
