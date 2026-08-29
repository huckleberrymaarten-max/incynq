# InCynq — Transactional Email Audit & Fix ✅ COMPLETE

_July 22, 2026 — audit of every automated/system email. SMTP verified July 27. admin-blast cleared + FAQ side-flag resolved + all templates applied + sl-webhook deployed Aug 7 → **fully closed.**_

## Mail setup
- **Receiving:** Migadu. **Sending:** Resend. Domain: incynq.net.
- **One mailbox:** `maarten@incynq.net` (Maarten Huckleberry). ALL other addresses are active aliases forwarding into it: `hello@`, `incynq@`, `admin@`, `contact@`, `support@`, `info@`, `privacy@`, `legal@`, `postmaster@`. So every one of these is a monitored, reply-friendly address (all land in the maarten@ inbox).
- **`noreply@incynq.net`:** NOT a mailbox/alias — replies bounce, never reach a person.
- **Migadu / Thunderbird / DNS (SPF, DKIM for both Migadu + Resend):** nailed (confirmed).

## Standard for every automated/system email
1. **FROM:** `noreply@incynq.net`
2. **REPLY-TO:** removed (defaults to FROM = noreply → bounces).
3. **Do-not-reply disclaimer** in the footer of every automated email.
- Never use a human alias (`support@`, `contact@`, etc.) as FROM or REPLY-TO on automated mail.

## The two disclaimers (settled)
- **Do-not-reply footer → automated mail only** (everything from `noreply@`). Done in all Auth templates + both sl-webhook emails.
- **Human signature → monitored aliases** (in Thunderbird). Invites replies — NOT a no-reply. When replying, pick the matching "From" identity (reply to a `legal@` message as `legal@`, etc.). Drafted:
  ```
  —
  InCynq Support
  support@incynq.net · incynq.net
  We read every message and aim to reply within one business day.
  ```

---

## ✅ DONE — everything complete

**Every email sender identified and accounted for.** Confirmed NOT sending email: `send-push` (VAPID `mailto:` only), `sl-profile`, `moderate-post`, `publish-scheduled-posts`, and **`admin-blast`** (reviewed Aug 7 — inserts rows into the `notifications` table only; in-app notifications, no Resend/email send, so no FROM/reply-to/footer applies). Human-reachable paths intentionally left as-is (correct): .net Formspree contact form → monitored inbox; in-app `mailto:support@incynq.net` links.

**Supabase Auth sender — confirmed (screenshot 27 Jul).** Custom SMTP via Resend, sender = `noreply@incynq.net` (name "no-reply"), enabled. No separate reply-to field → replies bounce, compliant. App login and admin OTP login share ONE Supabase project (`muzzjvegynsemlsbwggf`) → same sender; no separate admin config, no `@incynq.app` sender anywhere. Security-notification emails (password changed, email changed, MFA, etc.) all OFF.

**FAQ side-flag — RESOLVED (Aug 7).** `qaData.js` references `hello@ / privacy@ / legal@`. Migadu check confirms all three are active aliases forwarding to the monitored `maarten@` mailbox, so the copy is accurate. **No FAQ change needed.**

**Content updated (do-not-reply footer added):**

| Email | Change | Typo fixed | Applied |
|---|---|---|---|
| Confirm sign up (Auth template) | footer added | `support@incynq.app` → `.net` | ✅ pasted Aug 7 |
| Magic link / OTP (Auth template) | footer added | `.app` → `.net` | ✅ pasted Aug 7 |
| Change email (Auth template) | footer added | `.app` → `.net` | ✅ pasted Aug 7 |
| Reset password (Auth template) | footer added | (none) | ✅ pasted Aug 7 |
| Invite user (Auth template) | footer added | (none) — unused/optional | ✅ pasted Aug 7 |
| Reauthentication (Auth template) | footer added | (none) — unused/optional | ✅ pasted Aug 7 |
| Brand activation (sl-webhook) | footer added | (already .net) | ✅ deployed Aug 7 |
| Wallet receipt (sl-webhook) | already had footer | (already .net) | ✅ deployed Aug 7 |

**sl-webhook edge function — DEPLOYED Aug 7.** Do-not-reply footer now live on the brand-activation email; payment/signature/device logic untouched.

---

**Nothing left. Email project closed.**

---

## Reference — footer used (Auth templates)
```html
<p style="margin-top:24px;font-size:12px;color:#8a97a3;line-height:1.6;">
  This is an automated message from an unmonitored address — please don't reply, as replies aren't seen.
  Need a hand? Email <a href="mailto:support@incynq.net" style="color:#00b4c8;">support@incynq.net</a> and a real person will help.
</p>
```
(sl-webhook dark emails use the "Do not reply to this email." styled variant.)
