# PASTE THIS TO START THE NEXT SESSION

_Sep 8, 2026 — sl-webhook rebuild handover._

---

## Situation

**The InCynq `sl-webhook` Edge Function is dead and its source is lost.** Every ATM, ATM
Wall and Activation Terminal in Redlion has been offline since **16 Aug 2026 22:06 UTC**.

**Cause:** the *patch instruction document* (`sl-webhook_performer_rename_patch.txt`) was
deployed as `index.ts` instead of its three code chunks being pasted into the real
webhook. That file opens with a bare `return` at top level, so every request fails:

```
worker boot error: Uncaught SyntaxError: Illegal return statement at index.ts:20:3
→ HTTP 503 {"code":"BOOT_ERROR"}
```

**Nothing was lost financially.** The devices fail safe — they refuse payments and
auto-refund rather than taking money. There are no paying brands yet.

**Recovery attempts already exhausted:**
- Not in any repo — `sl-webhook` was only ever edited in the Supabase dashboard
- `npx supabase functions download sl-webhook` returns the broken 112-line patch file
- Dashboard lists 41 deployments but exposes no source or rollback for earlier ones
- No local copy anywhere under `C:\Projects` or the user profile
- **Supabase support ticket filed 8 Sep** asking them to retrieve the deployment
  immediately before 16 Aug 22:06 UTC — check for a reply before rebuilding

---

## What to do this session

**1. Check the Supabase ticket first.** If they returned the source, it's paste-and-deploy
and everything below is unnecessary.

**2. If not, rebuild.** Read `claude/claude_sl_webhook_rebuild_brief.md` in the project —
it has the complete contract: five actions, the exact JSON each LSL script parses, all six
database function signatures, the texture-set mapping, and where the maintenance flag
lives. It was written from the live schema and the three LSL scripts, so it's accurate.

**3. Ask Mathijs to upload, in this order:**
- `C:\Projects\slcompare\supabase\functions\sl-webhook\index.ts` — **the strongest lead.**
  SLCompare uses a similar ATM system and this file is intact (67KB, recently modified).
  It should provide HMAC verification, the device-registration upsert, request routing and
  response scaffolding. Not a drop-in — different tables, no brand/performer logic — but it
  turns "write from spec" into "adapt something working".
- The three LSL scripts (ATM v2.2, ATM Wall v2.2, Terminal v5.2) if not already in context
- Anything Supabase support sends back

---

## Hard-won details that are easy to get wrong

**The maintenance check is a substring hack, not JSON parsing.** All three scripts do:
```lsl
integer maint = (llSubStringIndex(body,"maintenance") != -1 && llSubStringIndex(body,"false") == -1);
```
So the response must contain the word `false` whenever maintenance is OFF, and must not
contain `false` anywhere when it's ON. `{"maintenance": false}` works. Be careful no other
field emits `false` while maintenance is true.

**`success:false` on a payment triggers an automatic refund** in the ATM — as does any
non-200. So only return that when the wallet genuinely was NOT credited.

**Read `RESEND_API_KEY` inside the handler, never at module scope.** A missing secret read
at module level kills the function on boot — a second way to cause this exact outage.

**`buildBody()` in LSL emits unquoted numbers** for numeric-looking values, so `amount_paid`
arrives as a JSON number, not a string.

**There is no `register_inworld_device` function.** Registration is an inline upsert on
`inworld_devices.device_uuid`, with `friendly_id` from `next_device_friendly_id()`.

---

## After it works — do these, they caused this

**1. Commit the function to the repo.** This is the whole lesson:
```
C:\Projects\incynq\incynq\supabase\functions\sl-webhook\index.ts
```
The other four edge functions are already local. `sl-webhook` — the one handling real money
— was the only one that wasn't, which is why a single bad paste was unrecoverable.

**2. Never paste a patch instruction file into a function editor.** Patches should be
delivered as complete replacement files, matching the established workflow for every other
file in this project.

**3. Make the LSL error messages distinguishable.** Every failure currently reads
"Connection error", whether it's a boot error, an expired install token, or a genuine
network problem. That cost hours of misdiagnosis tonight.

---

## Also fixed tonight (unrelated but worth knowing)

**Install token expiry removed.** Every `install_tokens` row had a 30-day expiry and all had
expired on 22 June, so any device rezzed after that failed with an unexplained "Connection
error". Default is now +100 years; `used` is the real protection. Three unused tokens are
live: `ICQ-XMH4FEYX`, `ICQ-FJXFAXU5`, `ICQ-D4VC9HMX`.

**Open question:** `ICQ-D4VC9HMX` was reset to unused, but it originally belonged to a
device that registered and renamed itself `[ICQ-BE34DBF0]` at Redlion/213/7/42. **Check
whether that object still exists inworld before deactivating its `inworld_devices` row.**

**Note:** the bracketed code in a device name is the *install token* before registration and
the *assigned device code* after. Easy to confuse — it cost time tonight.

**`last_seen_at` is not a heartbeat.** All 11 devices share an identical timestamp to the
second, so it updates on a sweep and can't currently be used to spot a dead device.

---

## ⚠️ TWO BUGS FOUND IN THE PATCH ITSELF (fix during rebuild)

The `performer_rename` patch had a second bug beyond being deployed as `index.ts`.
**Even pasted correctly it would have failed**, so that branch has likely never worked.

**1. Wrong status value.** The patch sets `status: 'completed'` on the payment intent.
The table's check constraint only allows:
```
'pending' | 'paid' | 'expired' | 'cancelled'
```
So the final update would throw. Use `'paid'`. **Check every other intent branch uses a
valid value too** — brand activation, sub-brand, performer activation, wallet top-up.

**2. The rename doesn't regenerate the identity tag.** `ensure_brand_identity_tag(performer_id)`
must be called after a successful rename, or the old `#djtest`-style tag survives on a
performer that no longer has that name. Verified working when called manually. Same hook
is needed in the **brand-activation** branch so new brands get an identity tag on
activation. (Already on the tag-system open items list.)

**Also noted:** `payment_intents.expires_at` on the live rename intent was **7 days**, not
the 30 minutes the DJ spec describes. Worth reconciling spec and reality.

---

## Manual fix applied 8 Sep (for reference — this is what the branch should do)

DJTEST's rename was stuck pending because the webhook was dead. Applied by hand, no fee
charged (the ATM never took payment):

```sql
update profiles
   set brand_name = 'TEST DJ INCYNQ', display_name = 'TEST DJ INCYNQ',
       brand_handle = 'testdjincynq'
 where id = 'e59b7b24-da88-4f68-be78-eb2b7a28f985' and account_type = 'performer';

update payment_intents set status = 'paid' where code = 'ICQ-4UQ87X';

select ensure_brand_identity_tag('e59b7b24-da88-4f68-be78-eb2b7a28f985');
```

Note the Supabase SQL editor runs a multi-statement block as ONE transaction — the
constraint failure rolled back the profile update too, which looked like a partial success
but wasn't.

---

## SLCompare webhook — what actually transfers

`C:\Projects\slcompare\supabase\functions\sl-webhook\index.ts` is intact and is the
best scaffold. Roughly **40% structural reuse**:

**Reusable:** the `json()` helper, action routing, the whole `register_device` block
(existing-vs-new split, install-token lookup + marking used, SLURL built from `pos_x` +
region, friendly-id assignment, texture return), the payment amount guard, and both Resend
email functions as templates.

**Needs rewriting:** table names (`inworld_terminals` → `inworld_devices`, `payment_codes`
→ `payment_intents`), texture mapping (SLCompare stores one `textures` jsonb; InCynq has
separate `idle_uuid` / `screen_uuid` / `paid_uuid` / `maintenance_uuid` columns),
maintenance flag (SLCompare hardcodes `false`; InCynq reads `system_status.maintenance_mode`),
the entire `activate` action, and all four intent types.

**Security difference worth a decision:** SLCompare verifies a shared secret header on every
request. InCynq's scripts send **no secret at all** — just `X-InCynq-Source: lsl` — so
anyone with the URL can call the webhook. Adding one means editing and re-rezzing all 11
devices, so it has a real cost, but the rebuild is the natural time to do it.

---

## Where the DJ work was left

Phase 3 step 1 shipped this session: performers can create live-set events with a stream
attached (`events.performer_id`, `is_live_set`, `stream_url`; `dj_phase3_04_live_set_events.sql`).
Airtime purchasing already works. **Not built:** go-live sessions, hours draw-down, the tip
jar, payouts. Resume there once the webhook is back.
