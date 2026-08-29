# DJ / Live Performer — Slot Rule (addendum to DJ_Live_Performer_Spec_v2)

_Captured July 22, 2026 — important build constraint._

## Rule
A DJ / Live Performer identity **counts against the resident's brand-slot limit** (`max_brands` on `profiles`, default **1**).

- A resident gets **one brand-type identity by default**. That slot can be used for **either** a brand **or** a DJ/performer — not both.
- A resident who **already has a brand** has used their slot. To add a DJ they need a **2nd slot** (`max_brands` = 2).
- **Raising `max_brands` is manual, admin-only, on request.** The resident contacts InCynq; an owner/admin bumps `max_brands` in admin. **Not self-service.**

## How it maps to existing code
- `getUserBrandCount(userId)` already returns `{ total, max: profile.max_brands || 1 }`. Reuse it as the gate.
- A performer is a **separate profile row** (like a sub-brand: `brand_owner_id` = resident, own handle), so it increments `total`.
- The **Add DJ / Live Performer** flow must, before starting activation:
  1. Call `getUserBrandCount`.
  2. If `total >= max`, **block** and show a message like _"You're at your limit for brand/performer accounts. Contact us and we'll add another slot for you."_ (with a contact link) — do **not** let them pay.
  3. If under the limit, proceed with `initPerformerActivation` (1,750 L$).

## Fees vs slots (keep distinct)
- **Slots** (how many identities you may own) = governed by `max_brands`.
- **Fee** (what each costs) = per type: brand **3,500**, sub-brand slot **3,500**, performer **1,750** — all admin-driven keys.

So: slot availability is checked first (and gated by admin-granted `max_brands`); the activation fee is charged only once a slot is available.
