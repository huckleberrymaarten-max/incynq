# InCynq — Brand Tags + Interest Tag Dedupe + Ads Fix — Session Recap

_August 21–22, 2026. All work deployed to production._

---

## What this session was

Started as "custom hashtags for businesses." Turned into three things: a brand tag
system, a structural fix to the existing interest taxonomy, and a composer bug fix.
All three shipped.

---

## 1. Interest tag deduplication (the big one)

**The problem.** `interest_tags.subcategory_id` was a single FK, so a tag belonged to
exactly ONE subcategory. `#NewRelease` existed as 32 separate rows (Hair, Furniture,
Footwear, Menswear…). 61 words were duplicated across 332 rows out of 491 total.

**Why it mattered beyond display.** `user_interests.tag_id` points at a specific row —
so a resident picking `#NewRelease` under Hair and one picking it under Furniture were
stored as two unrelated interests. Interest matching was fragmenting.

**Why now was the only safe moment.** `user_interests` was empty (0 rows) and
`posts.tags` is `text[]` (stores tag strings, not ids). Nothing pointed at the ids being
merged, so no repointing was needed. Post-launch this would have been a nasty job.

**The fix** (`brand_tags_02_dedupe_interest_tags.sql`):
- Merged duplicate subcategories by (category_id, normalised slug) — the "Rentals,
  Rentals" case. 119 remain.
- Deduped tags to one row per word: **491 → 221**.
- New `interest_tag_links` join table — **491 links** preserve every original
  tag→subcategory pair.
- `subcategory_id` left populated as the tag's "home" so existing admin code kept
  working during transition. The link table is the real source of truth.
- Unique index on `normalize_tag(name)` makes recurrence structurally impossible.
- Backups taken (`interest_tags_backup`, `interest_subcategories_backup`), verified,
  then dropped.

---

## 2. Brand tag system

**Two classes of tag:**

| Class | Source | Exclusive? | Cost |
|---|---|---|---|
| **identity** | auto-generated from brand name (SLCompare → `#slcompare`) | yes — it IS their name | free |
| **descriptive** | admin-created on request | no — shared across any brand that fits | TBD |

**Why shared, not exclusive.** If one brand owns `#vintage`, every other vintage seller
needs `#vintages` / `#vintagestore` — six near-identical tags each owned by one brand,
which is exactly the bloat the admin-only gate was meant to prevent. Shared keeps tags
meaningful. Note this does NOT stop specific tags: `#vintageclothes` is a genuinely
narrower thing and coexists fine with `#vintage`.

**Identity tags follow renames** — `ensure_brand_identity_tag()` retires the old one and
regenerates. Not yet wired into the webhook (see open items).

**Validation** — `validate_brand_tag()` returns ok / warn / block:
- **block:** explicit terms (substring), platform words (`incynq`, `official`), exact
  duplicates, and words that already exist as a standard interest tag ("free for every
  brand, no purchase needed")
- **warn (overridable):** plural/singular variants, one-character typos, broad category
  words, collision with another brand's name
- Three word lists live in `app_content` — editable in admin, no deploy needed.

---

## 3. Composer fix

**The real bug, found late.** `ComposeScreen.jsx` was reading `interest_groups` — the
LEGACY table — not `interest_tags` at all. Its `tags` text-array column had the
duplication baked directly in. So the dedupe migration alone would NOT have fixed the
wall of repeated chips; the component had to change too.

Now reads `interest_categories` for chips (already has `icon` + `color`) and
`get_composer_tags(brand_id, category_ids)` for tags. Result: Fashion ~30 relevant tags,
Vehicles ~23, instead of hundreds.

Brand tags pinned above the category row, always visible. **Identity tag pre-selected** —
a brand post defaults to being findable under its own name.

---

## 4. Orphaned PerformersSection — resolved

`PerformersSection.jsx` had been in the repo since the DJ rename work but was **imported
nowhere**. The deploy notes said to push the file but never to register it in
`AdminScreen.jsx`, so the DJ/Performer tab never existed in the running admin. Combined
with commit `0762f50` ("hide performers from Brands"), performers had nowhere to show.
Now registered.

---

## Files shipped

**SQL (Supabase, run in order):**
- `brand_tags_01_schema.sql` (646) — tables, RLS, validation, identity tags, admin RPCs
- `brand_tags_02_dedupe_interest_tags.sql` (359) — the dedupe migration

**App** (`huckleberrymaarten-max/incynq`, commit `72be08f`):
- `src/components/ComposeScreen.jsx` (486)

**Admin** (`huckleberrymaarten-max/incynq-admin`, commits `0129e9d`, `c3ca582`):
- `src/components/TagsSection.jsx` (334) — new
- `src/screens/AdminScreen.jsx` (290) — registers Tags + DJ/Performer, fixes success
  toast showing ✗ instead of ✓

---

## Gotchas learned

- **PostgREST schema cache.** New RPCs aren't visible to the API until
  `notify pgrst, 'reload schema';`. Tags section hung on "Loading…" until this was run.
  Worth doing after every batch of new functions.
- **`profiles.admin_role`** is the admin flag (values: `owner`). Not `is_admin`.
  `is_tag_admin()` uses `admin_role in ('owner','admin')`.
- **`auth.uid()` is null in the SQL editor**, so `is_tag_admin()`-gated RPCs can't be
  called from there — insert directly instead. Works fine from the admin panel.
- **Supabase SQL editor doesn't surface `RAISE NOTICE`.** A `do` block reports "Success.
  No rows returned" whether it worked or not. End migrations with a `select` to see results.
- **ORDER BY over a UNION** can't take expressions in Postgres — wrap in a subquery.

---

## Open items

**Immediate:**
- [ ] Call `ensure_brand_identity_tag()` in the sl-webhook brand-activation branch and in
      the performer-rename branch, so identity tags generate on activation and follow renames
- [ ] Point the admin Interests screen at `admin_link_interest_tag` — until then it can
      still create duplicate tags (adding `#Community` to a new subcategory makes a 4th copy
      instead of linking)
- [ ] `TagsSection.load()` has no `.catch` — a failed RPC hangs on "Loading…" instead of
      surfacing the error

**Decisions parked:**
- **What is the paid tier actually?** With 221 curated tags already covering most SL
  vocabulary, the obvious words are taken, so custom tags end up being brand-flavoured
  phrases (`#SLCompareAuctions`) — which overlaps heavily with the free identity tag.
  Three options: charge for extra descriptive tags anyway; charge for **linking a tag into
  a category** so it appears in everyone's composer (real distribution, not just a label);
  or drop the paid angle and treat custom tags as a free admin courtesy.
  `custom_tag_fee` (350) sits unused in `app_content` until decided.
- **Tags aren't tappable.** Without "tap a tag → see every post carrying it," these are
  labels rather than navigation, which limits what a brand is actually buying.

**Cleanup:**
- [ ] ⚠️ **DO NOT DROP `interest_groups`.** It is NOT legacy — ad targeting stores its
      slugs in `ads.groups` (`["social","fashion","home",…]`). The composer stopped reading
      it, nothing more. The commit message on `72be08f` says "drop legacy interest_groups"
      and is **wrong**. `interest_subs` (43 rows) still needs a grep before dropping.
- [ ] Long tag labels (`#SLCompareBreedableMarkets`, 25 chars) make big chips. Consider
      capping the pinned row or shortening labels if it eats vertical space.

---

## 5. Ads — two bugs found and fixed (Aug 22)

Placed a real ad; the Advertise screen said "No active ads" while the wallet had been
charged and the row existed in Supabase.

**Bug 1 — ads were never loaded from the database.** `AppContext` initialised
`ads` from `INIT_ADS`, a hardcoded mock array in `src/data`, and never fetched. The
Advertise screen has therefore *never* shown a real ad. Mock scaffolding that was
never replaced when the ad flow went live.

Fix: new `getBrandAds(brandId)` in `db.js` (maps snake_case → the camelCase the UI
expects, returns active + expired newest-first), loaded into a new `brandAds` state on
login and refreshed after purchase. `INIT_ADS` left alone for feed injection;
`getActiveAds` untouched.

**Bug 2 — `durationWeeks` was silently dropped, and it cost money.**
`AdvertiseScreen` passed `durationWeeks: selDuration` into `purchaseAd`, but
`purchaseAd` in `AppContext` never destructured it, so `placeAd` always fell back to
its 1-week default. Duration pricing is 1×, 2×, 3×0.75 (−25%), 4×0.5 (−50%) — so a
brand buying 4 weeks paid **twice the weekly rate and got 7 days**.

Fix: forward `durationWeeks` through `purchaseAd`. The one live ad
(`d88bfeb7…`) was corrected by hand to `duration_weeks = 4`, `expires_at =
created_at + 28 days`. **Check whether any other brand bought a 2/3/4-week ad before
Aug 22** — they were all under-delivered.

Ad cards now show tier, days remaining, location, image thumbnail, caption and target
groups, with a dimmed "Past ads" section beneath.

**App commits:** `cec0927` (loading + duration fix), plus the image/caption follow-up.

---

## 6. Taxonomy split — flagged, not fixed

Ad targeting and post tagging now run on **different taxonomies**:
- **Ads** → `interest_groups` slugs, stored as text in `ads.groups`
- **Composer** → `interest_categories` uuids via `get_composer_tags`

Same twelve interests, two separate sources of truth. They will drift the moment either
is edited — rename a category in admin and ad targeting keeps the old slug. Much cheaper
to unify before launch than after. Not urgent, but it belongs on the list.

---

## 7. Ad blockers break the ad flow — FIXED

**Found:** deleting a past ad failed with `TypeError: NetworkError`. Worked in a
Firefox private window. Cause: an ad blocker on the normal browser profile.

**Why it matters beyond delete.** Every client call to the ads table hits
`/rest/v1/ads` — and `/ads` is one of the most heavily filtered URL fragments on the
web (uBlock, AdGuard, Brave shields, Firefox strict mode). Reads mostly survive; writes
get killed.

**The dangerous path is `placeAd`, not delete.** It deducts the brand wallet FIRST,
then inserts the ad row, as two separate client calls. There is refund logic if the
insert *errors*, but not if the request never lands. A blocked insert can leave a brand
**charged with no ad**.

**Status:** FIXED. Platform was live but Maarten was the only one placing ads, so
nobody was affected.

**The fix** (`ads_rpc_migration.sql`): all ad calls now go through RPCs with neutral
names — `place_promo`, `list_promos`, `remove_promo`, `feed_promos` — resolving to
`/rest/v1/rpc/...`, which matches no filter list. Nothing in the client touches
`/rest/v1/ads` any more.

`place_promo` is also now **atomic**: wallet deduction and ad insert in one
transaction, so a failure rolls both back. The deduction uses
`update ... where brand_wallet >= price`, closing a race where two concurrent ads
could both pass on the same funds. Ownership check (`can_manage_brand`) mirrors the
old RLS policy — owner or accepted manager from `brand_managers` — and must live in
the function because SECURITY DEFINER bypasses RLS.

**`feed_promos` was the biggest find:** feed injection also hit `/rest/v1/ads`, so
residents with a blocker saw **no ads at all**. Brands would have paid for impressions
that never rendered.

**Gotcha:** the read functions return `jsonb` via `to_jsonb(a)` rather than typed
record sets — two rounds of `42P13 return type mismatch` errors (groups, location_id)
before giving up on declaring column types that must stay in lockstep with the table.

**Verified with the blocker ON:** place, delete, list and feed injection all work.

---

## 8. Ad tiers were not delivering what they're sold as — FIXED

Checked the code against the published tier design (found via project chat search —
`qaData.js` and incynq.net). The tiers differ by **placement**, not priority:

| Tier | Sold as | Was actually delivering |
|---|---|---|
| **Basic** | highlighted in search + explore | **nothing — no surface loaded ads** |
| **Featured** | featured card injected in feed | ✓ working |
| **Premium** | top story + feed + explore banner | feed only — identical to Featured at ~2x the price |

`FeedScreen.jsx` was the ONLY file in the app calling `getActiveAds`. So two of three
tiers under-delivered, with pricing published on incynq.net and in the FAQ.

**Nearly made it worse:** initially "fixed" Basic by injecting it into the feed,
assuming its absence was a bug. It wasn't — that would have devalued Featured, which
brands pay ~2.7x more for precisely to get feed placement. Reverted after checking
the documented intent. **Lesson: check the design docs before treating missing
behaviour as a bug.**

**The fix:**
- New `src/lib/adMatch.js` — `adMatchesUser` / `matchAdsForUser` / `shuffleAds`,
  shared by feed and search. This gates ADULT content, so two drifting copies was a
  real risk.
- `SearchScreen.jsx` — Basic renders as SPONSORED rows pinned above organic results
  AND on the empty state under "Based on your interests" (turns a dead end into
  discovery). Premium gets a full-width banner at the top with image + SLurl /
  Marketplace links.
- `FeedScreen.jsx` — Basic deliberately excluded, with a comment documenting why so
  it doesn't get "fixed" again.
- Ads shuffled **within** tier, so placement rotates instead of the earliest buyer
  permanently owning the top slot.

**Timing:** platform live, zero paying brands, so nothing was mis-sold.

---

## 9. Ad issues still open

- **No impressions on ads.** `trackImpressionsBatch` covers brand POSTS only. Nothing
  records an ad being seen — so no delivery proof for brands, no data for the paid
  analytics tier, and no way to build frequency-based tiers. **Biggest remaining gap.**
- **Ads never auto-expire.** `status` stays `'active'` forever; only
  `expires_at > now()` hides them. No cron flips it. Admin "active ad" counts will be wrong.
- **Price is client-supplied.** `place_promo` trusts `p_price` — a crafted request
  could buy Premium for 1 L$. Fixing needs the pricing model (tiers, launch promo,
  group multipliers, duration discount) ported into SQL.
- **Injection stops when posts run out.** Ads land at feed positions 2, 5, 8… so on a
  quiet day later ads never render. Real answer is impression-based delivery.
- **Duration drift.** FAQ says "ads run for 7 days"; the app sells 1–4 weeks.
- **`profiles.maturity` is inconsistent** — `adMatchesUser` defensively parses strings,
  arrays AND double-encoded JSON. Works, but it's papering over bad data, on the
  adult-content gate.

---

## Current state

SLCompare carries `#slcompare` (identity) plus `#slcompareauctions`,
`#slcomparebreedablemarkets`, `#slcomparelandparcels`. Gonzaga Valley and DJTEST have
identity tags. Create, assign and delete all verified working through the admin UI.

SLCompare has one live Featured ad (4 weeks, expires 19 Sep 2026) rendering correctly on
the Advertise screen with image and caption, plus the expired May test ad under Past ads.
Past ads now have a Delete button (RLS delete policy added, `ads_delete_policy.sql`).

**Top of the list next session: the ad-blocker issue in section 7.** It is live, it
affects the paid path, and it fails silently.
