# InCynq — sl-webhook Rebuild & Fleet Recovery — Session Recap

_September 14, 2026. Outage closed. All work deployed and version-controlled._

**Supersedes `claude_NEXT_SESSION_webhook_rebuild.md`** — that was the handover written
while the function was still dead. This is what actually happened.

---

## The outage, in one paragraph

On **16 Aug 2026 22:06 UTC** the `sl-webhook` Edge Function was deployed with the
*patch instruction document* (`sl-webhook_performer_rename_patch.txt`) as `index.ts`,
instead of its three code chunks being pasted into the real webhook. That file opens with
a bare `return` at top level, so the worker died on boot with
`SyntaxError: Illegal return statement at index.ts:20:3` and returned **HTTP 503** to
everything. Every ATM, ATM Wall and Terminal in Redlion was dead for **three weeks**. The
source was unrecoverable — dashboard-only, no repo copy, no deployment rollback, and
`supabase functions download` returns only the current broken version. Supabase support
was asked to retrieve deployment 40; no reply by the time we rebuilt.

**Nothing was lost financially.** The devices fail safe: they refuse payments and
auto-refund rather than taking money. No paying brands existed yet.

---

## Why it went unnoticed for three weeks

Three separate things had to line up:

1. **No monitoring.** Nothing alerts on a dead edge function.
2. **`last_seen_at` was not a heartbeat.** Every device shared one identical timestamp
   from 16 Aug, so the column looked plausible while meaning nothing. (Now genuinely a
   heartbeat — see below.)
3. **Every LSL failure read "Connection error."** A boot error, an expired install token
   and a real network blip were indistinguishable. The outage was finally found only
   because a DJ rename wouldn't go through.

---

## What was rebuilt

`supabase/functions/sl-webhook/index.ts` — **670 lines**, written from the live schema,
the three LSL master scripts, and SLCompare's intact webhook as a structural scaffold.

**Five actions:** `register_device`, `validate_code`, `payment`, `activate`, `check_status`.

**The database does most of the work.** `confirm_payment` and `confirm_activation` are
SECURITY DEFINER functions that handle validation, wallet credit, transaction logging,
receipts, notifications and referral rewards. The webhook is thin glue: verify, route,
call the RPC, format the response, send the email.

### The one decision that matters

**`confirm_payment` credits the PERSONAL wallet for ANY intent — it does not branch on
`intent_type`.** So it is called **only** for `topup`. Activation and rename intents are
validated and marked paid inline instead. Calling the RPC for a brand activation would
both activate the brand *and* put 3,500 L$ in the resident's personal wallet — money
created from nothing. This is the single easiest thing to get wrong in a future edit.

### Intent types handled

| intent_type | metadata | effect |
|---|---|---|
| `topup` (default) | — | `confirm_payment` RPC → personal wallet + receipt email |
| `brand_activation` | none | `complete_brand_activation` → account_type brand, fee becomes brand_wallet |
| `brand_activation` | `sub_brand_id` | activates that sub-brand profile row |
| `performer_activation` | `performer_id` | activates performer, fee becomes airtime credit |
| `performer_rename` | `performer_id`, `new_name`, `new_handle` | renames; **fee is revenue, NOT credited** |

All four call `ensure_brand_identity_tag()` so the `#brandname` tag is created or follows
a rename.

---

## Bugs found in the original patch (both now fixed)

**1. `status: 'completed'` is not a valid value.** The check constraint allows only
`pending | paid | expired | cancelled`. The rename branch would have thrown on every
attempt **even if the file had been pasted correctly** — so that feature likely never
worked end to end. Uses `'paid'` now.

**2. The rename never regenerated the identity tag**, so `#djtest` would survive on a
performer renamed to something else.

**Also noted, not fixed:** `create_payment_intent` cancels *all* pending intents for a
user before creating a new one. Start a brand activation, then top up your wallet before
paying, and the activation intent is silently cancelled — you'd pay at the ATM and get
"Code not active".

---

## LSL fleet fixes (all 12 devices updated in place)

Scripts edited **inside the existing objects**, not re-rezzed — so device rows, friendly
IDs, position history and install-token links all survive. Consumed tokens cannot be
reused for a fresh rez; re-registration of a known `device_uuid` ignores the token
entirely.

**1. Registration now retries on the 2-minute tick.** Previously `selfRegister()` ran only
on `state_entry`, so a failed registration was terminal until a human reset the script —
which is exactly why all 12 devices needed manual resets after the outage. Retries stop
only if the *server* rejects the token (bad / used / wrong type), since retrying that
cannot help. A new `gTokenRejected` flag distinguishes the two.

**2. Failures name themselves.** New `httpReason()` maps 503 → "Service unavailable",
504 → "Server timed out", 401 → "Not authorised", and so on. A rejected token shows the
server's own message ("Install token already used"). Floating text shows the reason plus
"Retrying every 2 min..." in amber rather than a red dead-end.

**3. Master copies carry `ICQ-XXXXXXXX`** and the placeholder guard now sets
`gTokenRejected` so an unconfigured master doesn't retry forever.

---

## Also done this session

**Receipt numbering moved to a sequence** (`receipt_number_sequence.sql`). The old
`next_receipt_number()` did `COUNT(*) + 1`, which meant deleting any receipt caused the
next one to **reuse its number**, and two simultaneous payments would collide. Now a real
sequence, restarting each January via a `receipt_seq_year` marker in `app_content`, plus a
unique constraint on `receipt_number` so the database refuses duplicates regardless of
what generates them.

**Install token expiry removed** (8 Sep). All tokens had a 30-day window and had expired
on 22 June, so any device rezzed after that failed with an unexplained "Connection error".
Default is now +100 years; `used` is the real protection.

**Test transaction reversed.** A real 100 L$ top-up was used to prove the money path, then
removed from the books (receipt, wallet_transaction, payment_intent, and the wallet credit
itself). The 100 L$ is still with IncynqPayments inworld.

**Everything is now in the repo** — the webhook at `supabase/functions/sl-webhook/`, and
five LSL scripts at `lsl/` (ATM, ATM Wall, Terminal, Greeter, follow-us sign). This is the
actual lesson: the one function handling real money was the only one that lived solely in
a dashboard.

---

## Test results — all passed

| Step | Result |
|---|---|
| Boot / `check_status` | 200, no more 503 |
| `register_device` | ICQ/ATM#007, rez_count 2, textures loaded from `texture_sets` |
| `validate_code` | amount + username returned, ATM showed pay prompt |
| **Real payment, 100 L$** | wallet 100 → 200, receipt `INCYNQ-2026-000001`, email delivered, `send_status: sent` |
| Maintenance ON | all 12 devices switched to maintenance texture within 2 min, unprompted |
| Maintenance OFF | all 12 recovered within 2 min, no reset needed |
| Fleet heartbeat | all 12 checking in within the same 2 seconds |

**Untested:** Terminal `activate` — needs a fresh unactivated account.

---

## Gotchas worth keeping

- **The maintenance flag is read by substring, not JSON.** All three scripts do
  `contains("maintenance") && !contains("false")`. So a response must contain the literal
  word `false` when maintenance is OFF, and must not contain `false` **anywhere** when it
  is ON. Adding any field that serialises to `false` will silently break the whole fleet.
- **`success:false` on `payment` makes the ATM refund the user** — as does any non-200. So
  return that only when nothing was credited. Everything after a successful
  `confirm_payment` (email, receipt update) must be best-effort.
- **Read env vars inside the handler, never at module scope.** A missing secret read at
  module level kills the worker on boot — the same class of failure as this outage.
- **`buildBody()` in LSL emits unquoted numbers** for numeric-looking values, so
  `amount_paid` arrives as a JSON number.
- **The bracketed code in a device name** is the install token *before* registration and
  the assigned device code *after*. Easy to confuse.
- **The Supabase SQL editor runs a multi-statement block as one transaction** — a later
  failure rolls back earlier statements that appeared to succeed.

---

## Still open

- **No monitoring on the webhook.** A dead function is still invisible until someone
  notices inworld. `last_seen_at` is now a real heartbeat, so a simple "any device not
  seen in 10 minutes" check would catch it.
- **The webhook has no authentication.** The LSL scripts send only
  `X-InCynq-Source: lsl` — no secret — so anyone with the URL can call it. SLCompare
  verifies a shared secret header. Adding one to InCynq means editing all 12 devices
  again, so it was deliberately left out of this rebuild, but it should be done.
- **Terminal `activate` untested** since the rebuild.
- `create_payment_intent` cancelling unrelated pending intents (see above).
- **DJ work resumes here:** live-set events shipped 13 Sep (`events.performer_id`,
  `is_live_set`, `stream_url`). Airtime purchasing already works. Not built: go-live
  sessions, hours draw-down, tip jar, payouts.
