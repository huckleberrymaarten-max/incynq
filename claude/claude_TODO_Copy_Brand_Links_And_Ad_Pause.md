# InCynq — copy still to write: brand links, ad pause & delete

_20 September 2026. The code shipped; the published rules haven't caught up.
Until these land, the T&C says something different from what the platform
actually does._

---

## Why this matters more than usual

**Section 7 currently forbids what the platform now allows.** It says
"No SLurls or direct links in posts. Brands can include teleport links in paid
advertisements only." Brands can now save a SLurl, a Marketplace link and a
reviewed website on their profile, and use them as buttons on ads. That's a
contradiction in a document people agree to, not just a gap.

---

## T&C — what needs changing

### Section 7 (Advertising)
Replace the links sentence. New rules:
- Links live on the **brand profile**, not typed per ad. An ad picks up to two.
- **SLurl and Marketplace links are self-serve.** Their format proves where
  they lead, and it's enforced — a SLurl must be a real
  `maps.secondlife.com/secondlife/Region/x/y/z` (or `secondlife://`), a
  Marketplace link must be on `marketplace.secondlife.com`.
- **Website links are reviewed by InCynq before they go live.** Held pending,
  shown nowhere until approved. Editing an approved one sends it back for
  review.
- InCynq may **reject or withdraw** a website at any time, and doing so removes
  it from ads already running.
- **https only. Link shorteners are not accepted** — the destination can be
  changed after approval, which would make the review meaningless.
- A website must belong to the brand and relate to Second Life; the content
  rules in sections 5, 5a and 6 apply to it as they do on the platform.

### New: pausing and deleting an ad
Not covered anywhere today.
- A running ad can be **paused**. Delivery stops and the remaining days are
  held, not refunded.
- Resuming extends the end date by the time it spent paused, up to a cap
  (`max_pause_days`, currently 30). Past the cap an ad resumes but stops
  banking time.
- **Deleting an ad is permanent and not refunded.** Any remaining days are
  lost. This follows from "all L$ deposited are non-refundable" but should be
  said plainly where people will act on it.
- Why pause rather than a pro-rata refund: a 4-week buy costs 2x the weekly
  rate, so refunding unused weeks would make cancelling cheaper than buying a
  single week honestly. Time back, not money back — no loophole.

### New: where brand links appear
- The three links show on the brand's public profile as well as on ads, so
  they're worth filling in even for a brand that never advertises.

---

## Q&A (`qaData.js`) — Part Two, For brands

Suggested entries. InCynq voice: warm, plain, no jargon.

**Q: Can I link to my website from an ad?**
A: Yes — add it in Edit Brand Profile and we'll check it before it goes live.
It only takes us a day or two. Once it's approved you can use it as a button on
any ad you run.

**Q: Why do you check website links?**
A: A SLurl or a Marketplace link can only ever take someone to Second Life —
we can see that from the address itself. A website could go anywhere, so a real
person has a look first. It's the only way we can promise residents that a
button on InCynq is safe to tap.

**Q: Do I have to type my links in every time I make an ad?**
A: No. Save them once in Edit Brand Profile and pick which ones to use each
time — up to two per ad. One clear destination usually works better than two.

**Q: I changed my website and now it's pending again — why?**
A: Every website gets checked, including a new one replacing an old one.
Your previous website keeps working on your ads while we look at the new one,
so nothing goes dark in the meantime.

**Q: Can I pause an ad?**
A: Yes. Pausing stops it being shown and keeps the days you've paid for — start
it again whenever you like and it picks up where it left off. You can bank up
to 30 days this way.

**Q: What happens if I delete a running ad?**
A: It stops immediately and the days left on it are gone — there's no refund.
If you only want to stop it for a while, pause it instead and you keep
everything.

**Q: Why don't you refund the unused days instead?**
A: Because longer bookings are discounted — four weeks costs about half the
weekly rate. Refunding unused weeks would make cancelling cheaper than booking
one week properly. Pausing gives you the time back instead, which is fairer all
round.

---

## incynq.net

`brands.html` — the advertising section should mention that a brand can link to
their store, their Marketplace and (once checked) their website. It's a genuine
selling point for SL services whose presence is mostly on the web, which is
exactly the segment that turned this up.

---

## Status

**Not written.** Do it in one pass with the `{{tokens}}` approach already used
throughout — `max_pause_days` isn't in `js/prices.js` KEYS, so either add it or
write "30 days" as text and accept it won't follow an admin change.
