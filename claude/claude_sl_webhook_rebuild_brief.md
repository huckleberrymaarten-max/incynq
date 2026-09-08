# InCynq — sl-webhook REBUILD BRIEF

_Sep 8, 2026. **URGENT — the entire inworld fleet is down.**_

---

## What happened

On **16 Aug 2026 22:06 Dublin**, the `sl-webhook` edge function was deployed with the
*patch instruction document* (`sl-webhook_performer_rename_patch.txt`) as `index.ts`,
instead of the three code chunks being pasted into the real webhook. The patch file
opens with a bare `return` at top level, so the worker throws:

```
worker boot error: Uncaught SyntaxError: Illegal return statement at index.ts:20:3
```

Every request returns **HTTP 503 BOOT_ERROR**. Every ATM, ATM Wall and Terminal in
Redlion has been dead since that moment — which matches `inworld_devices.last_seen_at`
being frozen at 16 Aug 21:06 UTC on all 11 devices, and `payment_intents` holding
almost nothing.

**The original source is lost.** Confirmed:
- Not in any repo (`sl-webhook` was only ever edited in the Supabase dashboard)
- `npx supabase functions download sl-webhook` returns the broken 112-line patch file
- The dashboard exposes no per-deployment source or rollback (41 deployments listed,
  none retrievable)
- No local copy anywhere under `$env:USERPROFILE` or `C:\Projects`

**Still worth trying before rebuilding:** a Supabase support ticket asking them to
retrieve the source of the deployment prior to 16 Aug.

---

## Lesson (do this regardless of outcome)

Edge functions must live in the repo, not only in the dashboard. After the rebuild:

```
C:\Projects\incynq\incynq\supabase\functions\sl-webhook\index.ts
```

committed and pushed. The other four functions (`publish-scheduled-posts`, `send-push`,
`schedule-post`, `admin-blast`) are already local — `sl-webhook`, the one handling real
money, was the only one that wasn't.

Also: **never paste a patch instruction file into a function editor.** Patch docs should
be delivered as unified diffs or as a complete replacement file, not as prose with code
blocks in it.

---

## The contract (derived from the three LSL scripts — authoritative)

### Request

`POST https://muzzjvegynsemlsbwggf.supabase.co/functions/v1/sl-webhook`

Headers sent by every device:
```
X-InCynq-Source:      lsl          ← presence of this SKIPS HMAC verification
X-InCynq-Object-UUID: <llGetKey()>
X-InCynq-Timestamp:   <unix>
X-InCynq-Region:      <region name>
Content-Type:         application/json
```

Non-LSL callers must pass `X-InCynq-Signature` (HMAC-SHA256 of the raw body +
timestamp, secret in `SL_WEBHOOK_SECRET`, 5-minute replay window).

Body is always `{"action": "...", ...}`. Note `buildBody()` emits **unquoted numbers**
for numeric-looking values, so `amount_paid` arrives as a number, not a string.

### Five actions

| action | sent by | payload |
|---|---|---|
| `register_device` | all, on rez / owner change / region change / position change | `install_token, device_uuid, device_type, device_name, region, version, owner_name, pos_x, rot_z` |
| `validate_code` | ATM, before payment | `code` |
| `payment` | ATM, after `money()` | `code, atm_uuid, avatar_uuid, avatar_name, amount_paid` |
| `activate` | Terminal | `code, terminal_uuid, avatar_uuid, avatar_name` |
| `check_status` | all, every 2 min | `device_uuid` |

### Responses the scripts actually parse

**register_device**
```json
{ "success": true, "device_id": "...", "friendly_id": "ICQ/ATM#007",
  "message": "...", "maintenance": false,
  "textures": { "idle": "<uuid>", "screen": "<uuid>",
                "paid": "<uuid>", "maintenance": "<uuid>" } }
```
Scripts read `textures.idle/screen/paid/maintenance` via `llJsonGetValue`. `screen` is
used for BOTH enter-code and processing. On failure: `{ "success": false, "error": "..." }`.

⚠️ Maintenance detection in LSL is a substring hack, not JSON parsing:
`llSubStringIndex(body,"maintenance") != -1 && llSubStringIndex(body,"false") == -1`.
So **the word `false` must appear in the body whenever maintenance is off**, and must
NOT appear anywhere when it is on. Emitting `"maintenance": false` satisfies this. Be
careful that no other field emits `false` while maintenance is true.

**validate_code**
```json
{ "valid": true, "amount": 500, "username": "maarten.huckleberry" }
```
Failure: `{ "valid": false, "error": "..." }` — error text is shown to the resident.

**payment**
```json
{ "success": true, "new_balance": "12345" }
```
Failure: `{ "success": false, "error": "..." }` → **the ATM refunds automatically**.
Any non-200 also triggers a refund. So the webhook must be careful to return 200 +
`success:false` only when it genuinely did NOT credit.

**activate**
```json
{ "success": true, "welcome_credit": "100", "referral_paid": "true" }
```
`referral_paid` is compared to the string `"true"`.

**check_status**
```json
{ "maintenance": false }
```
Same substring rule as above.

---

## Database it calls (all still exist — verified Sep 8)

```
confirm_activation(p_code text, p_terminal_uuid text, p_avatar_uuid text, p_avatar_name text)
confirm_payment(p_code text, p_atm_uuid text, p_avatar_uuid text, p_avatar_name text, p_amount_paid integer)
validate_payment_intent(p_code text)
complete_brand_activation(p_user_id uuid, p_amount integer)
process_referral_reward(referred_user_id uuid)
next_device_friendly_id(p_device_type text)
```

There is **no** `register_inworld_device` function — registration is an inline upsert on
`inworld_devices.device_uuid`.

### Tables
- `install_tokens` — `token, device_type, used, used_at, used_by_device_uuid, expires_at`.
  **Expiry removed Sep 8** (defaults to +100 years) after every token expired on 22 June
  and silently blocked new rezzes. `used` is the real protection.
- `inworld_devices` — upsert on `device_uuid`; `friendly_id` from `next_device_friendly_id()`
- `device_history` — `device_id, device_code, event_type, device_uuid, owner_avatar_uuid,
  owner_avatar_name, region, region_position, notes`
- `texture_sets` — `device_type, idle_uuid, screen_uuid, paid_uuid, maintenance_uuid, is_active`
  → maps to the `textures` object above; filter `is_active = true` + matching `device_type`
- `system_status` — key/value; `maintenance_mode` = `'false'`
- `app_content` — `maintenance_message`, `welcome_credit` (100), `brand_activation_fee`
  (**now 3500**), `performer_activation_price` (1750), `referral_reward` (10)
- `payment_intents` — `code, intent_type, amount, status, metadata, user_id, expires_at`
- `receipts` — sequential `INCYNQ-YYYY-XXXXXX` numbering

### Intent types handled in `payment`
- wallet top-up (default)
- `brand_activation` — also `metadata.sub_brand_id` for sub-brands
- `performer_activation` — credits the 1,750 to the performer's `brand_wallet`
- `performer_rename` — **fee is REVENUE, no wallet credit**; sets `brand_name`,
  `display_name` and `brand_handle` from `metadata.new_name` / `new_handle`

### Emails (Resend, `RESEND_API_KEY`)
Brand activation + wallet receipt. Both `from: noreply@incynq.net`, no reply-to, with
the do-not-reply footer (added 7 Aug). Plus `sendPerformerRenameEmail` from the patch.

⚠️ Read `RESEND_API_KEY` **inside** the handler, not at module scope — a missing secret
at module level kills the function on boot, which is a second way to cause exactly the
outage we just had.

---

## Env vars
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SL_WEBHOOK_SECRET`, `RESEND_API_KEY`

---

## Test plan (in order, after deploy)

1. **Boot** — hit the URL with `{"action":"check_status","device_uuid":"x"}`. Expect 200,
   not 503.
2. **Registration** — re-rez one ATM Wall. Expect it to register, pick up textures, and
   appear in `inworld_devices`.
3. **validate_code** — generate a top-up code in the app, enter at the ATM.
4. **payment** — pay a small amount. Confirm wallet credited, receipt emailed, and
   `wallet_transactions` row written.
5. **activate** — a Terminal activation with welcome credit + referral.
6. **check_status** — toggle `system_status.maintenance_mode` to `'true'` and confirm all
   devices go to the maintenance texture within 2 minutes, then back.

Do NOT trust it until step 4 passes with real L$.

---

## Loose ends found along the way

- `ICQ-D4VC9HMX` was reset to unused — it's an old token from a device that had already
  registered and renamed itself to `[ICQ-BE34DBF0]`. The object at Redlion/213/7/42 may
  still exist; **check before deactivating that `inworld_devices` row.**
- `last_seen_at` on all devices is identical to the second — it updates on a sweep, not a
  heartbeat, so it can't currently be used to spot a dead device.
- The bracketed code in a device name is the **install token before registration** and the
  **assigned device code after**. Easy to confuse.
