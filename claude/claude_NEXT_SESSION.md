# PASTE THIS TO START THE NEXT SESSION

_End of 20 September 2026. Everything below is deployed and verified unless it
says otherwise._

---

## Ready and waiting: two files to push

The resident Cynqified tier is **parked**, so it's been taken out of the
published rules. Both files are done — copy and push, nothing to think about:

```powershell
$repo = "C:\Projects\incynq-net"

Copy-Item "$env:USERPROFILE\Downloads\tcData.txt" "$repo\data\tcData.js" -Force   # 107
Copy-Item "$env:USERPROFILE\Downloads\qaData.txt" "$repo\data\qaData.js" -Force   # 331

git -C $repo add -A
git -C $repo commit -m "Cynqified: brands and performers only; park the resident tier"
git -C $repo push
```

T&C section 10 and the FAQ now describe brands and performers only.
`cynqified_fee_resident` (750) stays in `app_content` and in `js/prices.js` —
harmless, and there if the tier ever comes back.

---

## The one open decision

**Does the resident Cynqified tier come back?** Left undecided on purpose.

The case against, from last session: a resident tick verifies "this account is
this account", which the `@handle` already answers — SL guarantees usernames
are unique. There's no store, no Marketplace shop, no trading history to check
against, so there's nothing to actually investigate.

The case for: a well-known DJ or blogger who isn't a brand has no way to
protect their name.

**Don't decide it cold.** Wait until someone actually asks — a real case will
settle it faster than more reasoning. The data model can already express it:
`profiles.cynqified_brand` and `profiles.cynqified_resident` are separate
columns, so turning it on is a decision, not a rebuild.

Full reasoning in `claude/claude_Cynqified_Request_Flow_Design.md`, including
the criteria, the two-Pinks problem, and what the fee actually pays for.

---

## What shipped on 20 September

**Finances tab** — Overview (treasury, profit, safe-to-draw), Transactions,
Payouts under one nav item. `get_treasury()` and `get_financial_overview()`
were security definer and granted to `authenticated` with no admin check: any
signed-in member could read the books. Both gated now.

**The books only count real money.** Internal accounts out of the Dashboard,
gifted credit tracked (`promo_balance`, `brand_promo_balance`) so it can't be
counted as float or tipped out as real L$. Referral and survey rewards now set
`promo_balance` — and `submit_survey` had never paid anyone, because it checked
`reward_paid` after setting it.

**Ads** — status expires on a cron, injection spreads across a thin feed
instead of a fixed 2/5/8, impressions recorded on feed and search
(`promo_views`, neutral RPC names so ad blockers don't kill it), delivery
figures on the ad cards, pause/resume banking days, delete with a plain
warning. `place_promo` no longer trusts a client-supplied price — verified
against the app at 1,700 on the hardest combination.

**Brand links** — SLurl and Marketplace self-serve with format checks, website
reviewed by a person before it appears, admin queue, notification to the brand
on approve or reject. Ads pick from saved links rather than typing URLs.

**Admin** — the auth client deadlocked inside `onAuthStateChange` (it's not
async any more), pending-work badges on the nav, a NEEDS YOU tile, and a daily
09:00 UTC email that sends nothing when nothing's waiting.

**Cynqified split** into `cynqified_brand` and `cynqified_resident`, because a
brand account is a resident row with brand fields on it — one boolean lit both.

**The DJ side is published** on incynq.net: `performers.html`, FAQ Part Three,
T&C 11b–11d, and "Performer Wallet" as the single name for a balance that had
four.

---

## Still open, none urgent

- **Five edge functions exist only in the Supabase dashboard** — `admin-blast`,
  `moderate-post`, `push-notify`, `schedule-post`,
  `send-performer-rename-code`. Same exposure that took the inworld fleet down
  for three weeks in August. Download each and commit to
  `supabase/functions/<name>/index.ts`.
- **Duplicate `@incynqofficial` posts** about invite codes — scheduled twice,
  or `publish-scheduled-posts` ran twice on one row.
- **Two ad-expiry crons** doing the same job: `expire-old-ads` (pre-existing)
  and `expire-finished-ads` (added last session). Harmless, worth tidying.
- **`UserProfileScreen` doesn't render the Cynqified badge** — it shows
  Founding Brand and Official but not this one, so tapping through to a
  verified brand shows no tick there.
- **`profiles.maturity` is stored inconsistently** — string, array, or
  double-encoded JSON. Displayed defensively now, but `adMatchesUser` parses
  around the same mess on the adult-content gate.
- **Ad taxonomy split** — ads target `interest_groups` slugs, the composer uses
  `interest_categories` uuids. Two sources of truth for the same twelve
  interests.
- Everything in `claude/claude_Pre_Launch_Checklist.md`.

---

## Then: marketing

The DJ ad copy is written and ready to post — full and short versions, in the
session history. Five DJs, with Maarten covering their 1,750 activation, which
is really ten hours of airtime rather than cash out the door.

Worth saying to each of them directly, not just in the ad: **bring your own
crowd.** Get their regulars onto InCynq and following them before the first
set. It's the one thing InCynq can't do for them, and it's the difference
between five DJs who think it works and five who think it's empty.
