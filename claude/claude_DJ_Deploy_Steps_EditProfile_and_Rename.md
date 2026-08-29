# DJ / Performer — deploy steps: Edit Profile + Admin Rename

_Two features are built and ready to deploy. Do them in order. All app files are
delivered as `.txt` (rename to `.jsx` on copy) to avoid the browser `.jsx` download
issue. Verify each file's line count before pushing._

Repos:
- App: `C:\Projects\incynq\incynq` (files → `src/screens/`)
- Admin: `C:\Projects\incynq-admin\incynq-admin` (files → `src/components/`)
- SQL → Supabase SQL editor. Edge functions → Supabase.

---

## FEATURE 1 — In-app Edit Profile (DJ edits their own registration fields, except stage name)

**1a. SQL — ALREADY RUN** (`dj_phase3_02_edit_performer.sql`, the `update_performer_profile` RPC). If unsure, re-run it (safe to re-run).

**1b. App files — push these two** (`EditPerformerScreen.jsx` is NEW):
```powershell
# EditPerformerScreen (new) — expect 198
(Get-Content "$env:USERPROFILE\Downloads\EditPerformerScreen.txt").Count
Copy-Item "$env:USERPROFILE\Downloads\EditPerformerScreen.txt" "C:\Projects\incynq\incynq\src\screens\EditPerformerScreen.jsx" -Force

# PerformerProfileView (updated: adds the Edit Profile button) — expect 261
(Get-Content "$env:USERPROFILE\Downloads\PerformerProfileView.txt").Count
Copy-Item "$env:USERPROFILE\Downloads\PerformerProfileView.txt" "C:\Projects\incynq\incynq\src\screens\PerformerProfileView.jsx" -Force

git -C "C:\Projects\incynq\incynq" add src/screens/EditPerformerScreen.jsx src/screens/PerformerProfileView.jsx
git -C "C:\Projects\incynq\incynq" commit -m "Performer: in-app Edit Profile (registration fields minus stage name)"
git -C "C:\Projects\incynq\incynq" push
```
**Test:** DJTEST dashboard → **Edit Profile** → change bio/genres → **Save changes** → toast "Profile updated".

---

## FEATURE 2 — Admin paid rename (DJ can rebrand; admin issues an ATM code; name + @handle change on payment)

Do all four parts. The name/handle only change after the DJ pays; the **code email** can be tested after parts 2a + 2b + 2d (webhook not required for the email).

**2a. SQL** — run `dj_phase3_03_performer_rename.sql` (creates `admin_init_performer_rename`, now also generates the new @handle).

**2b. Edge function (NEW)** — `send-performer-rename-code` (emails the code + ATM instructions to the owner):
- Rename `send-performer-rename-code_index.txt` → `index.ts`
- Put at `supabase/functions/send-performer-rename-code/index.ts`
- Deploy: `supabase functions deploy send-performer-rename-code`
- (or Supabase dashboard → Edge Functions → create `send-performer-rename-code` → paste). Uses env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (same as the webhook).

**2c. SL webhook patch** — apply `sl-webhook_performer_rename_patch.txt` to the existing `sl-webhook` function, then redeploy:
- ADDITION 1: paste the `performer_rename` branch in `handlePayment()` right after the `performer_activation` branch.
- ADDITION 2: paste `handlePerformerRenamePayment()` next to `handlePerformerActivationPayment()`.
- ADDITION 3: paste `sendPerformerRenameEmail()` next to `sendPerformerActivationEmail()`.
- Redeploy the webhook.

**2d. Admin UI** — push `PerformersSection.jsx` (expect 331):
```powershell
(Get-Content "$env:USERPROFILE\Downloads\PerformersSection.txt").Count
Copy-Item "$env:USERPROFILE\Downloads\PerformersSection.txt" "C:\Projects\incynq-admin\incynq-admin\src\components\PerformersSection.jsx" -Force
git -C "C:\Projects\incynq-admin\incynq-admin" add src/components/PerformersSection.jsx
git -C "C:\Projects\incynq-admin\incynq-admin" commit -m "Admin: paid DJ rename (ATM code + auto-email + handle change)"
git -C "C:\Projects\incynq-admin\incynq-admin" push
```

**Test the email (after 2a + 2b + 2d):** admin → DJ/Performer → DJTEST → **View** → **STAGE NAME** → type a new name → **Create code**. This creates the pending rename and emails the code to your inbox (you own DJTEST). Toast should say "Rename code created and emailed to the DJ".

**Test the full flow (after 2c too):** pay the code at an ATM → the webhook applies the new name + new @handle → confirmation email arrives.

---

## How the rename works (recap)
- Fee = performer activation price (1,750 L$), read from `app_content`. Booked as **revenue** — NOT credited to any wallet.
- On payment: `brand_name`, `display_name` AND `brand_handle` all change to the new name (fresh unique handle, e.g. DJMAX → @djmax). Followers, posts and airtime credit are untouched.
- Old @handle links stop resolving (decision: clean rebrand chosen over keeping old handle).

## Notes / optional
- Set `app_content.atm_slurl` to a real ATM SLurl and the code email will include a clickable link; otherwise it says "any InCynq ATM inworld".
- Next DJ item (saved for later): **DJ creates an event including their stream** (Phase 3, needs `EventsScreen.jsx`).
