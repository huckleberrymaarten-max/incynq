# InCynq — Session verification checklist

_20 September 2026. Written because a lot shipped in one sitting and the
state needs confirming rather than remembering._

Work through it top to bottom. Each item says what was done, and how to
prove it. Anything marked **UNCONFIRMED** is something I gave you but never
saw you complete — not necessarily missing, just unverified.

---

## 1. Database — SQL files

All run in the Supabase SQL editor. The first seven are **confirmed** by the
output you pasted back.

| File | What it did | State |
|---|---|---|
| `dj_phase4_10_treasury_checks.sql` | `treasury_checks` table, `is_finance_admin()`, admin gate on `get_treasury()` | ✅ confirmed |
| `dj_phase4_11_internal_only.sql` | internal money out of `get_financial_overview()`, admin gate, flag performer rows owned by internal accounts | ✅ confirmed |
| `dj_phase4_12_treasury_profit.sql` | float + profit + monthly figures added to `get_treasury()` | ✅ confirmed |
| `dj_phase4_13_brand_promo.sql` | `brand_promo_balance`, backfilled the 3,500 gift | ✅ confirmed |
| `dj_phase4_14_promo_rewards.sql` | referral + survey rewards set `promo_balance`; fixed survey reward never paying | ✅ confirmed |
| `ads_01_expire_status.sql` | `expire_finished_ads()` + daily cron | ✅ confirmed |
| `ads_02_impressions.sql` | `promo_views` table, `record_promo_views()`, `promo_stats()` | ✅ confirmed |
| `ads_03_server_pricing.sql` | `is_test` flag, `get_member_count()`, `get_promo_price()`, hardened `place_promo` | ❌ **NOT RUN YET** |

**Check everything above landed:**

```sql
select
  to_regclass('public.treasury_checks') is not null as treasury_checks,
  to_regclass('public.promo_views')     is not null as promo_views,
  exists (select 1 from information_schema.columns
           where table_name='profiles' and column_name='brand_promo_balance') as brand_promo_col,
  exists (select 1 from information_schema.columns
           where table_name='profiles' and column_name='is_test')             as is_test_col,
  exists (select 1 from pg_proc where proname='get_promo_price')              as server_pricing;
```

First four `true` = files 10–14 and ads_01/02 are in.
Last two `false` = `ads_03` still to run.

---

## 2. Repos — what's pushed

### incynq-admin
| Commit | Contents | State |
|---|---|---|
| `c89c5b6` | Finances tab — `AdminScreen`, `FinancesSection`, `TreasuryOverview` v1.0 | ✅ confirmed |
| — | `TreasuryOverview` v1.1 (profit figures) + `db.js` (internal accounts out of Dashboard, wallet gifts flagged promotional) | ⚠️ **UNCONFIRMED** |

### incynq (app)
| Commit | Contents | State |
|---|---|---|
| `84c8fb2` | ad impressions + feed injection spread | ✅ confirmed |
| `3075b73` | search impressions + stop reshuffling on keystroke | ✅ confirmed |
| — | `AdvertiseScreen.jsx` — delivery figures on ad cards | ⚠️ **UNCONFIRMED** |

### incynq-net
| Commit | Contents | State |
|---|---|---|
| `7b73d25` | `performers.html`, nav/footer links on 12 pages, `qaData.js`, `tcData.js` | ✅ confirmed |
| — | nav relabel to "DJs & Performers" (12 files) + `devices.html` HQ SLURL fix | ⚠️ **UNCONFIRMED** |

**Check each repo:**

```powershell
git -C "C:\Projects\incynq-admin\incynq-admin" log --oneline -3
git -C "C:\Projects\incynq\incynq" log --oneline -3
git -C "C:\Projects\incynq-net" log --oneline -3

git -C "C:\Projects\incynq-admin\incynq-admin" status --short
git -C "C:\Projects\incynq\incynq" status --short
git -C "C:\Projects\incynq-net" status --short
```

`status --short` returning nothing = everything committed. Any `M` lines are
files copied in but never pushed.

---

## 3. Supabase email templates

Not in any repo — dashboard only.

- **Magic link / OTP** — removed "Tap the code to select it all at once" ⚠️ **UNCONFIRMED**
- **Confirm sign up** — privacy link changed to `incynq.net/privacy` ⚠️ **UNCONFIRMED**

Check by opening each template and searching for "Tap the code" and
`incynq.app/privacy`. Neither should appear.

⚠️ Before saving the Confirm sign up change, open `https://incynq.net/privacy`
in a tab. If the page doesn't exist yet, that swaps one dead link for another.

---

## 4. Live behaviour worth eyeballing

Quick passes, no tooling needed.

- **Admin → Finances → Overview** loads, shows Earned so far, Came in this
  month, Safe to draw. Should read L$ 0 earned, L$ 4,000 promotional.
- **Admin → Dashboard** member count dropped (internal accounts excluded) and
  doesn't contradict Finances.
- **incynq.net/performers.html** — prices read 1,750 / 175 / 5%, not fallbacks.
- **incynq.net/faq.html** — a third section "For DJs & performers" at the
  bottom, with the right heading rather than "Part Three — …".
- **incynq.net/devices.html** — teleport link goes to Redlion 219/13/41.

---

## 5. The one real open question

`ads_03_server_pricing.sql` hasn't run, and when it does, its closing select
prints four prices. Those need comparing against what the Advertise screen
quotes for the same choices:

| Tier | Groups | Random | Weeks |
|---|---|---|---|
| Basic | 1 (fashion) | no | 1 |
| Featured | 1 (fashion) | no | 1 |
| Featured | 2 (fashion + home) | no | 4 |
| Premium | 3 (fashion + home + shopping) | yes | 3 |

If they match, server-side pricing is safe to leave on. If any differ, the
price maths in SQL doesn't match the app's and a real purchase would be
rejected — fixable, but it must be found before a brand hits it.

**This is the only thing in the session whose correctness isn't yet proven.**

---

## 6. Known open items (not tonight's work)

- **Five edge functions exist only in the Supabase dashboard** — `admin-blast`,
  `moderate-post`, `push-notify`, `schedule-post`, `send-performer-rename-code`.
  Same exposure that took the inworld fleet down for three weeks in August.
- **Duplicate `@incynqofficial` posts** about invite codes — scheduled twice,
  or `publish-scheduled-posts` ran twice on one row.
- **Contact form** — the DJ / Live Performer category already exists and is
  wired. Nothing to do; the old note was stale.
- **Ad taxonomy split** — ads target `interest_groups` slugs, the composer uses
  `interest_categories` uuids. Two sources of truth for the same twelve
  interests. Cheaper to unify before launch than after.
- **`get_current_pricing_tier()`** hardcodes 1000/5000/15000 thresholds while
  `ContentContext` and the new `get_promo_price()` read `pricing_tiers` from
  admin. Second source of truth for the same bracket; currently unused by the
  pricing path, but it's a trap sitting there.
