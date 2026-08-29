# DJ / Performer — content brief for incynq.net tab + FAQ

_Purpose: what to communicate to users about the DJ/Performer identity, its money
rules, rebranding and deletion. Source of truth for the rules is
`InCynq_Treasury_and_Fund_Separation.md`; this doc turns them into user-facing points.
Final copy = InCynq tone: warm, Virgin Media style, no technical jargon._

## TODO — incynq.net contact form
Add a **"DJ / Live Performer"** category/option to the contact form at
`https://incynq.net/contact`. The in-app performer **Edit Profile** screen now links there
for stage-name changes ("Want a different stage name? Contact us …"), so people arriving
from that link need a matching category to file under. (incynq.net repo change — separate
from the app/admin.)

## How InCynq earns from performers (for internal clarity)
There are **three** separate streams — don't frame any single one as "what funds InCynq":
1. **Registration / activation fee** (1,750 L$ to start).
2. **Airtime** (broadcasting time consumed, 175 L$/hr).
3. **10% admin & platform fee on tips** (tips only — never airtime, activation or top-ups).

So the 10% is just the tips-side fee, not the whole platform's funding. Keep the copy
accurate: users already pay to register and to broadcast; the 10% is additional and only
applies to tips.

## For the new "DJ / Performer" tab on incynq.net
Explain, plainly:
- **What it is** — your own DJ / live-performer identity inside InCynq: post as yourself
  the artist, build a following, go live, and collect tips.
- **Getting started** — activate a performer identity for **1,750 L$**. That activation
  gives you **10 hours of airtime** to start (airtime is **175 L$/hour**).
- **Airtime** — you spend airtime to broadcast/go live. Top it up anytime in minutes
  (minimum 60, in 30-minute steps).
- **Two wallets, kept separate:**
  - **Airtime credit** — the spend-only balance (your activation credit + top-ups). Used
    for airtime and promotion. **Non-refundable.**
  - **Tip earnings** — real tips from your audience, withdrawable to your SL avatar. Paid
    out per gig on a 7-day cycle. InCynq keeps **10% of tips as an admin & platform fee**,
    and takes **nothing on airtime**.
- **Badges** — the first 25 performers get a **Founding DJ / Performer** badge; verified
  performers get the **Cynqified** tick (same as brands).

## The 10% — what it is
The 10% taken from tips is an **admin & platform fee on tips**: it covers handling and
paying out tips plus platform costs on that side. It's charged **on tips only** — never on
airtime, activation or top-ups. Frame it as a fair, small fee on tips, **not** as "the fee
that runs InCynq" (registration and airtime are separate charges that already contribute).

## Rebranding (name change) — FAQ + tab copy
- A DJ can change their stage name (a "rebrand"). It costs the **same as activating**
  (1,750 L$). In-app it's admin-assisted: the DJ requests it via the contact form, an admin
  issues an ATM code, and the name + @handle change once paid.
- **Important:** unlike activation, the rebrand fee is just a fee — it does **not** get
  added to your airtime credit. You keep your **followers, posts and airtime credit**;
  only the name changes.
- The **@handle updates to match** the new name (clean rebrand); old-handle links stop
  resolving.
- A **brand can't rebrand** — a brand is a brand. Rebranding is a DJ/performer thing.

## Deleting a profile + payout on deletion — FAQ + tab copy
**This is the reassurance point to make clearly: deleting your account does NOT make you
lose the tips you've earned.**
- You can delete a brand or DJ/performer profile. There's a **cool-off period** first
  (you can cancel during it).
- **You still get paid.** Tips are paid out per gig on a 7-day cycle. The deletion
  cool-off is longer than that window, so every tip you've earned is **paid out to your
  SL avatar during the cool-off, before the account actually closes.** You never forfeit
  money you earned by deleting.
- **Airtime credit is not refunded.** The spend credit (activation + top-ups) is
  non-refundable, so a deleted profile forfeits whatever airtime credit is left.
- **Tip, if you just want a new name:** rebranding is cheaper in practice — you keep your
  airtime credit and your following. Deleting and starting over loses both.

## Suggested FAQ Q&As (draft tone — refine later)
**Q: How much does it cost to become a DJ / performer on InCynq?**
A: 1,750 L$ to activate, and that gives you 10 hours of airtime to get started.

**Q: What's the difference between my airtime credit and my tip earnings?**
A: Airtime credit is what you spend to go live and promote — it's non-refundable. Tip
earnings are the tips your audience sends you, and those are yours to withdraw. InCynq
keeps 10% of tips as an admin & platform fee, and takes nothing on airtime.

**Q: What is the 10% for?**
A: It's an admin & platform fee on tips — it covers handling and paying out your tips.
We only ever charge it on tips, never on your airtime, activation or top-ups.

**Q: Can I change my DJ name later?**
A: Yes — you can rebrand for the same price as activating (1,750 L$). Get in touch via our
contact page and we'll set it up. You keep your followers, posts and airtime credit; the
name and your @handle change. (Brands can't rebrand — a brand stays a brand.)

**Q: If I delete my DJ / performer account, do I still get paid the tips I earned?**
A: Yes. Tips are paid out on a 7-day cycle, and deleting an account has a cool-off period
that's longer than that — so every tip you've earned is paid to your SL avatar during the
cool-off, before the account closes. You never lose earned tips by deleting. (Your airtime
credit isn't refundable, though — that's separate from your tips.)

**Q: What happens to my airtime credit if I delete my profile?**
A: Airtime credit (your activation credit and top-ups) is non-refundable, so it's not paid
back on deletion. Your earned tips still get paid out — only the spend credit is forfeited.
If you just want a fresh name, rebranding keeps your credit and following, so it's usually
the better move.

**Q: How do payouts work?**
A: Tips are paid to your SL avatar on a 7-day cycle per gig, minus the 10% admin &
platform fee.

## Status
Content brief only — the incynq.net DJ/Performer tab and these FAQ entries are **not
built yet**. Revisit once the rebrand + deletion flows are actually shipped so the copy
matches the live behaviour (esp. exact fees, which come from `app_content`).
