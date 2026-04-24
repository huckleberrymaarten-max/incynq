# InCynq — TODO List

**Last updated:** 24 April 2026

---

## ✅ DONE (this session)

1. ✅ Referral system (registration + activation + rewards)
2. ✅ Dynamic pricing system
3. ✅ Founding brands program
4. ✅ Clickable user profiles
5. ✅ Official verification badges
6. ✅ Member-since dates
7. ✅ Discoverable defaults
8. ✅ **Analytics tracking (brand-only)** — silent data collection live

---

## 🔥 ACTIVE TODO

### 🎯 Next session priorities

1. ⏳ **Brand signup flow** — depends on SL terminals (tied to #5)
   - "Add Brand Account" row in Settings
   - Modal: brand name, logo, description
   - Payment step: 3,500 L$ via SL terminal (ICQ- code)
   - Create brand account + fund 3,500 L$ opening wallet
   - Linked accounts switcher in top nav

2. ⏳ **Audit: prototype vs live features**
   - Walk through live app, check what's actually wired
   - Compare against prototype spec
   - Flag anything still in demo mode
   - Tackle in future session when time permits

3. ⏳ **Analytics dashboard** (~2 hours)
   - Brand-facing dashboard showing post views, impressions, profile visits
   - Last 30 days charts
   - Top performing posts
   - Uses data already flowing from today's tracking

4. ⏳ **Website incynq.net** (~2-3 hours)
   - Public marketing site
   - Signup funnel
   - Feature overview

5. ⏳ **SL Integration** (~3-4 hours)
   - Inworld terminals for activation
   - ATM / wallet top-up
   - LSL script → Supabase webhook
   - Unlocks: brand signup, wallet payments, activation flow

---

## 📝 KNOWN GAPS (from quick check)

These are prototype features that may or may not be live — to confirm in audit:

- Brand signup flow (confirmed missing)
- SL inworld terminals (not built yet)
- Wallet top-up (depends on SL terminals)
- Brand Team / manager invites
- Cynqified verification application screen
- Ad wizard — full targeting model
- Event boosting payment
- Real SL maturity verification redirect
- Ping (messaging) — if separate from notifications

---

## 🎯 Recommended order for next sessions

```
Session A: SL Integration (terminals + ATMs)
Session B: Brand signup flow (now possible with terminals)
Session C: Analytics dashboard (show brands their data)
Session D: Website incynq.net (public-facing)
Session E: Feature audit + fill gaps
```

Rationale: SL terminals unblock multiple features. Build once, use everywhere.

---

## 📊 Data Collection Status

Analytics tracking is **live and silent** as of 24 April 2026.

- `post_impressions` — brand posts in feed (batch logged)
- `post_views` — comments opened on brand posts
- `profile_views` — brand profiles visited by others

All excluded from tracking (privacy-first):
- Resident posts
- Self-views
- Welcome posts
- Sponsored ads (separate system, Phase 2+)
