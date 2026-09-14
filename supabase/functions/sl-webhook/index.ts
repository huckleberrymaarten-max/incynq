/**
 * sl-webhook — Supabase Edge Function (InCynq)
 *
 * REBUILT 9 Sep 2026. The previous deployment was destroyed on 16 Aug when a
 * patch instruction document was deployed as index.ts; the original source was
 * unrecoverable. This is a rebuild from the live schema, the three LSL master
 * scripts, and the database functions it calls.
 *
 * KEEP THIS FILE IN THE REPO:
 *   C:\Projects\incynq\incynq\supabase\functions\sl-webhook\index.ts
 * It was dashboard-only before, which is why one bad paste took the whole
 * inworld estate down for three weeks with nothing to restore from.
 *
 * Actions (all POST, JSON body, {"action": "..."}):
 *   register_device  — ATM / ATM Wall / Terminal self-registration
 *   validate_code    — ATM, before payment
 *   payment          — ATM, after money() fires
 *   activate         — Terminal, account activation
 *   check_status     — all devices, every 2 minutes
 *
 * ── THINGS THAT WILL BITE YOU IF CHANGED ──────────────────────────────────
 *
 * 1. MAINTENANCE IS DETECTED BY SUBSTRING, NOT JSON.
 *    All three scripts do:
 *      maint = (body contains "maintenance") && !(body contains "false")
 *    So when maintenance is OFF the body must contain the literal word `false`,
 *    and when it is ON the body must not contain `false` ANYWHERE. Every
 *    response here is built with that in mind — see maintenanceBody().
 *
 * 2. A `success:false` ON `payment` MAKES THE ATM REFUND THE USER.
 *    So do that only when the wallet genuinely was NOT credited. Once
 *    confirm_payment has returned success, every later step (email, receipt) is
 *    best-effort and must never turn into a failure response.
 *
 * 3. confirm_payment CREDITS THE PERSONAL WALLET FOR ANY INTENT.
 *    It does not look at intent_type. So it is ONLY called for `topup`.
 *    Activation and rename intents are handled here instead — otherwise a brand
 *    activation would both activate the brand AND put 3,500 L$ in the
 *    resident's personal wallet, creating money from nothing.
 *
 * 4. READ SECRETS INSIDE THE HANDLER, NEVER AT MODULE SCOPE.
 *    A missing env var read at module level kills the worker on boot — the same
 *    class of failure as the outage this file replaces.
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

/**
 * Builds a response carrying the maintenance flag for the LSL substring test.
 * OFF -> includes `"maintenance":false` (contains "false" — scripts read OFF).
 * ON  -> includes `"maintenance":true` and NOTHING else may say "false".
 */
const maintenanceBody = (on: boolean, extra: Record<string, unknown> = {}) =>
  on ? { success: true, maintenance: true, ...extra }
     : { success: true, maintenance: false, ...extra }

async function isMaintenanceMode(): Promise<boolean> {
  const { data } = await supabase
    .from('system_status').select('value').eq('key', 'maintenance_mode').maybeSingle()
  return String(data?.value ?? 'false').toLowerCase() === 'true'
}

/** texture_sets -> the shape the LSL scripts read: textures.idle/screen/paid/maintenance */
async function getTextures(deviceType: string): Promise<Record<string, string> | null> {
  const { data } = await supabase
    .from('texture_sets')
    .select('idle_uuid, screen_uuid, paid_uuid, maintenance_uuid')
    .eq('device_type', deviceType)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return {
    idle:        data.idle_uuid        ?? '',
    screen:      data.screen_uuid      ?? '',
    paid:        data.paid_uuid        ?? '',
    maintenance: data.maintenance_uuid ?? '',
  }
}

/** "<221.4, 16.2, 41.0>" + region -> a maps.secondlife.com URL */
function buildSlurl(posRaw: string, region: string): string | null {
  if (!posRaw || !region) return null
  const parts = posRaw.replace(/[<>]/g, '').split(',').map((s) => parseFloat(s.trim()))
  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null
  const [x, y, z] = parts
  return `secondlife://${encodeURIComponent(region)}/${Math.round(x)}/${Math.round(y)}/${Math.round(z)}`
}

async function logDeviceHistory(params: {
  deviceId: string | null; deviceCode: string | null; eventType: string
  deviceUuid: string; ownerName?: string; region?: string; pos?: string; notes?: string
}) {
  try {
    await supabase.from('device_history').insert({
      device_id:         params.deviceId,
      device_code:       params.deviceCode,
      event_type:        params.eventType,
      device_uuid:       params.deviceUuid,
      owner_avatar_name: params.ownerName ?? null,
      region:            params.region ?? null,
      region_position:   params.pos ?? null,
      notes:             params.notes ?? null,
    })
  } catch (e) {
    console.error('device_history insert failed (non-blocking):', e)
  }
}

// ═══════════════════════════════════════════════════════════════
serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405)

  let body: Record<string, string | number>
  try { body = await req.json() }
  catch { return json({ success: false, error: 'Invalid JSON body' }, 400) }

  const action     = String(body.action ?? '')
  const objectUUID = req.headers.get('X-InCynq-Object-UUID') ?? ''
  const region     = String(req.headers.get('X-InCynq-Region') ?? body.region ?? '')
                       .replace(/[\u0000-\u001f]/g, '').trim()

  console.log(`sl-webhook: action=${action} object=${objectUUID} region=${region}`)

  // ── check_status ─────────────────────────────────────────────
  // Every device polls this every 2 minutes. Doubles as the heartbeat.
  if (action === 'check_status') {
    const deviceUUID = String(body.device_uuid ?? objectUUID)
    if (deviceUUID) {
      await supabase.from('inworld_devices')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('device_uuid', deviceUUID)
    }
    return json(maintenanceBody(await isMaintenanceMode()))
  }

  // ── register_device ──────────────────────────────────────────
  if (action === 'register_device') {
    const deviceUUID   = String(body.device_uuid ?? objectUUID)
    const deviceType   = String(body.device_type ?? 'terminal').toLowerCase()
    const deviceName   = String(body.device_name ?? '')
    const installToken = String(body.install_token ?? '').trim()
    const version      = String(body.version ?? '')
    const ownerName    = String(body.owner_name ?? '')
    const posRaw       = String(body.pos_x ?? '')
    const nowIso       = new Date().toISOString()

    if (!deviceUUID) return json({ success: false, error: 'Missing device_uuid' }, 400)

    const slurl      = buildSlurl(posRaw, region)
    const textures   = await getTextures(deviceType)
    const maintOn    = await isMaintenanceMode()

    // Already known? Re-registration on rez, move, owner change or region change.
    const { data: existing } = await supabase
      .from('inworld_devices')
      .select('id, friendly_id, active, region, owner_avatar_name, rez_count')
      .eq('device_uuid', deviceUUID)
      .maybeSingle()

    if (existing) {
      const regionChanged = existing.region && region && existing.region !== region
      const ownerChanged  = existing.owner_avatar_name && ownerName &&
                            existing.owner_avatar_name !== ownerName

      await supabase.from('inworld_devices').update({
        device_name:       deviceName || undefined,
        region:            region || existing.region,
        region_position:   posRaw || null,
        slurl,
        script_version:    version,
        owner_avatar_name: ownerName || existing.owner_avatar_name,
        active:            true,
        last_rez_at:       nowIso,
        last_seen_at:      nowIso,
        rez_count:         (existing.rez_count ?? 0) + 1,
        ...(regionChanged ? { last_region_change_at: nowIso } : {}),
        ...(ownerChanged  ? { last_owner_change_at:  nowIso } : {}),
      }).eq('id', existing.id)

      await logDeviceHistory({
        deviceId: existing.id, deviceCode: existing.friendly_id,
        eventType: regionChanged ? 'region_change' : ownerChanged ? 'owner_change' : 're_register',
        deviceUuid: deviceUUID, ownerName, region, pos: posRaw,
      })

      console.log(`register_device: ${existing.friendly_id} re-registered (${deviceType})`)
      return json(maintenanceBody(maintOn, {
        device_id:   existing.id,
        friendly_id: existing.friendly_id,
        message:     'Device re-registered',
        textures,
      }))
    }

    // New device — an install token is required.
    if (!installToken) {
      return json({ success: false, error: 'Install token required. Set INSTALL_TOKEN before rezzing.' })
    }

    const { data: tokenRow } = await supabase
      .from('install_tokens')
      .select('id, token, device_type, used, expires_at')
      .eq('token', installToken)
      .maybeSingle()

    // Distinct messages on purpose. Every failure used to read "Connection
    // error", which cost hours of misdiagnosis during the Aug/Sep outage.
    if (!tokenRow) {
      return json({ success: false, error: 'Install token not recognised. Contact InCynq support.' })
    }
    if (tokenRow.device_type !== deviceType) {
      return json({ success: false, error: `Token is for a ${tokenRow.device_type}, not a ${deviceType}.` })
    }
    if (tokenRow.used) {
      return json({ success: false, error: 'Install token already used. Request a new one.' })
    }
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return json({ success: false, error: 'Install token expired. Request a new one.' })
    }

    const { data: fid } = await supabase.rpc('next_device_friendly_id', { p_device_type: deviceType })
    const friendlyId = fid ?? null

    const { data: created, error: writeErr } = await supabase.from('inworld_devices').insert({
      device_uuid:       deviceUUID,
      device_type:       deviceType,
      device_name:       deviceName || `InCynq ${deviceType}`,
      region:            region || null,
      region_position:   posRaw || null,
      slurl,
      script_version:    version,
      owner_avatar_name: ownerName || null,
      active:            true,
      rez_count:         1,
      first_rezzed_at:   nowIso,
      last_rez_at:       nowIso,
      last_seen_at:      nowIso,
      friendly_id:       friendlyId,
      install_token_id:  tokenRow.id,
    }).select('id, friendly_id').single()

    if (writeErr) {
      console.error('register_device write error:', writeErr)
      return json({ success: false, error: 'Could not register device. Contact InCynq support.' }, 500)
    }

    await supabase.from('install_tokens').update({
      used: true, used_at: nowIso, used_by_device_uuid: deviceUUID,
    }).eq('id', tokenRow.id)

    await logDeviceHistory({
      deviceId: created.id, deviceCode: created.friendly_id, eventType: 'register',
      deviceUuid: deviceUUID, ownerName, region, pos: posRaw,
      notes: `token ${installToken}`,
    })

    console.log(`register_device: ${created.friendly_id} (${deviceType}) registered — ${deviceUUID}`)
    return json(maintenanceBody(maintOn, {
      device_id:   created.id,
      friendly_id: created.friendly_id,
      message:     'Device registered',
      textures,
    }))
  }

  // ── validate_code ────────────────────────────────────────────
  // ATM only. Returns {valid, amount, username} — the script reads all three.
  if (action === 'validate_code') {
    const code = String(body.code ?? '').toUpperCase().trim()
    if (!code) return json({ valid: false, error: 'Missing code' })

    const { data, error } = await supabase.rpc('validate_payment_intent', { p_code: code })
    if (error) {
      console.error('validate_payment_intent error:', error)
      return json({ valid: false, error: 'Could not check that code. Try again.' })
    }
    return json(data)
  }

  // ── payment ──────────────────────────────────────────────────
  // The ATM has ALREADY taken the L$ when this fires. Returning success:false
  // (or any non-200) makes it refund — so only do that when nothing was credited.
  if (action === 'payment') {
    const code       = String(body.code ?? '').toUpperCase().trim()
    const atmUUID    = String(body.atm_uuid ?? objectUUID)
    const avatarUUID = String(body.avatar_uuid ?? '')
    const avatarName = String(body.avatar_name ?? '')
    const amountPaid = parseInt(String(body.amount_paid ?? '0'), 10) || 0

    if (!code || !amountPaid) return json({ success: false, error: 'Missing code or amount' })

    // What kind of intent is this? confirm_payment credits the PERSONAL wallet
    // regardless of type, so anything that isn't a top-up is handled below.
    const { data: intent } = await supabase
      .from('payment_intents')
      .select('id, user_id, amount, status, intent_type, metadata, expires_at')
      .eq('code', code)
      .maybeSingle()

    if (!intent) return json({ success: false, error: 'Invalid code' })

    const intentType = intent.intent_type ?? 'topup'

    // ── Wallet top-up: the RPC does everything ──
    if (intentType === 'topup') {
      const { data: result, error } = await supabase.rpc('confirm_payment', {
        p_code:        code,
        p_atm_uuid:    atmUUID,
        p_avatar_uuid: avatarUUID,
        p_avatar_name: avatarName,
        p_amount_paid: amountPaid,
      })

      if (error) {
        console.error('confirm_payment error:', error)
        return json({ success: false, error: 'Payment could not be processed. Contact support@incynq.net.' })
      }
      if (!result?.success) return json({ success: false, error: result?.error ?? 'Payment rejected' })

      // Everything past here is best-effort. The wallet IS credited; a failing
      // email must never produce success:false or the ATM refunds a paid top-up.
      if (result.receipt_id && result.user_email) {
        sendReceiptEmail({
          receiptId:     result.receipt_id,
          receiptNumber: result.receipt_number,
          toEmail:       result.user_email,
          avatarName:    result.avatar_name ?? avatarName,
          amount:        result.amount_paid ?? amountPaid,
          newBalance:    result.new_balance,
          atmName:       result.atm_name ?? 'InCynq ATM',
          atmRegion:     result.atm_region ?? region,
        }).catch((e) => console.error('receipt email failed (non-blocking):', e))
      }

      console.log(`payment: ${code} — ${amountPaid} L$ credited, new balance ${result.new_balance}`)
      return json({ success: true, new_balance: result.new_balance })
    }

    // ── Everything else: activation / rename ──
    // Validated here rather than by confirm_payment, which would also credit
    // the personal wallet.
    if (intent.status !== 'pending') {
      return json({ success: false, error: intent.status === 'paid' ? 'Code already used' : `Code ${intent.status}` })
    }
    if (new Date(intent.expires_at) <= new Date()) {
      await supabase.from('payment_intents').update({ status: 'expired' }).eq('id', intent.id)
      return json({ success: false, error: 'Code expired — please generate a new one' })
    }
    if (amountPaid < intent.amount) {
      return json({ success: false, error: `Incorrect amount. Expected ${intent.amount} L$, received ${amountPaid} L$.` })
    }

    const meta = (intent.metadata ?? {}) as Record<string, string>

    // ── brand_activation ──
    // Two shapes: no metadata = upgrade the resident's own profile;
    // metadata.sub_brand_id = activate that already-created sub-brand row.
    if (intentType === 'brand_activation') {
      const subBrandId = meta.sub_brand_id ?? null

      if (subBrandId) {
        const { error: subErr } = await supabase.from('profiles').update({
          account_type:       'brand',
          brand_pending:      false,
          brand_wallet:       intent.amount,
          brand_activated_at: new Date().toISOString(),
        }).eq('id', subBrandId)

        if (subErr) {
          console.error('sub-brand activation failed:', subErr)
          return json({ success: false, error: 'Activation failed. Contact support@incynq.net.' })
        }
        await markIntentPaid(intent.id, amountPaid, atmUUID, avatarUUID, avatarName)
        await ensureIdentityTag(subBrandId)
        await sendBrandActivationEmail(intent.user_id, intent.amount).catch(
          (e) => console.error('brand activation email failed (non-blocking):', e))

        console.log(`payment: ${code} — sub-brand ${subBrandId} activated`)
        return json({ success: true, new_balance: intent.amount, message: 'Brand activated' })
      }

      const { data: result, error: brandErr } = await supabase.rpc('complete_brand_activation', {
        p_user_id: intent.user_id,
        p_amount:  intent.amount,
      })
      if (brandErr || !result?.success) {
        console.error('complete_brand_activation failed:', brandErr ?? result?.error)
        return json({ success: false, error: result?.error ?? 'Activation failed. Contact support@incynq.net.' })
      }
      await markIntentPaid(intent.id, amountPaid, atmUUID, avatarUUID, avatarName)
      await ensureIdentityTag(intent.user_id)
      await sendBrandActivationEmail(intent.user_id, intent.amount).catch(
        (e) => console.error('brand activation email failed (non-blocking):', e))

      console.log(`payment: ${code} — brand activated for ${intent.user_id}`)
      return json({ success: true, new_balance: result.brand_wallet, message: 'Brand activated' })
    }

    // ── performer_activation ──
    // The fee becomes the performer's spend credit (airtime), same as brands.
    if (intentType === 'performer_activation') {
      const performerId = meta.performer_id
      if (!performerId) {
        console.error('performer_activation intent missing performer_id:', code)
        return json({ success: false, error: 'Activation failed (missing details). Contact support@incynq.net.' })
      }

      const { error: perfErr } = await supabase.from('profiles').update({
        brand_pending:      false,
        brand_wallet:       intent.amount,
        brand_activated_at: new Date().toISOString(),
      }).eq('id', performerId).eq('account_type', 'performer')

      if (perfErr) {
        console.error('performer activation failed:', perfErr)
        return json({ success: false, error: 'Activation failed. Contact support@incynq.net.' })
      }
      await markIntentPaid(intent.id, amountPaid, atmUUID, avatarUUID, avatarName)
      await ensureIdentityTag(performerId)

      console.log(`payment: ${code} — performer ${performerId} activated`)
      return json({ success: true, new_balance: intent.amount, message: 'Performer activated' })
    }

    // ── performer_rename ──
    // The fee is REVENUE — deliberately NOT credited to any wallet, unlike
    // activation. Followers, posts and airtime credit are untouched.
    if (intentType === 'performer_rename') {
      const performerId = meta.performer_id
      const newName     = (meta.new_name ?? '').trim()
      const newHandle   = (meta.new_handle ?? '').trim()

      if (!performerId || !newName) {
        console.error('performer_rename intent missing performer_id / new_name:', code)
        return json({ success: false, error: 'Rename failed (missing details). Contact support@incynq.net.' })
      }

      const updates: Record<string, unknown> = { brand_name: newName, display_name: newName }
      if (newHandle) updates.brand_handle = newHandle

      const { data: performer, error: renameErr } = await supabase
        .from('profiles').update(updates)
        .eq('id', performerId).eq('account_type', 'performer')
        .select('brand_name, brand_handle').single()

      if (renameErr) {
        console.error('performer rename failed:', renameErr)
        return json({ success: false, error: 'Rename failed. Contact support@incynq.net.' })
      }

      // NOTE: 'paid', not 'completed'. The original patch used 'completed',
      // which the payment_intents status check constraint rejects — that branch
      // would have thrown on every rename even before the file was clobbered.
      await markIntentPaid(intent.id, amountPaid, atmUUID, avatarUUID, avatarName)

      // The identity tag follows the name, or #oldname survives on a performer
      // who no longer has it.
      await ensureIdentityTag(performerId)

      await sendPerformerRenameEmail(intent.user_id, newName, performer.brand_handle ?? '')
        .catch((e) => console.error('rename email failed (non-blocking):', e))

      console.log(`payment: ${code} — performer ${performerId} renamed to ${newName}`)
      return json({ success: true, message: 'Performer renamed', new_balance: 0 })
    }

    console.warn(`payment: unhandled intent_type "${intentType}" for code ${code}`)
    return json({ success: false, error: 'Unsupported payment type. Contact support@incynq.net.' })
  }

  // ── activate ─────────────────────────────────────────────────
  // Terminal only. confirm_activation does the whole job: welcome credit,
  // referral reward, sl_uuid, transaction log.
  if (action === 'activate') {
    const code         = String(body.code ?? '').toUpperCase().trim()
    const terminalUUID = String(body.terminal_uuid ?? objectUUID)
    const avatarUUID   = String(body.avatar_uuid ?? '')
    const avatarName   = String(body.avatar_name ?? '')

    if (!code) return json({ success: false, error: 'Missing code' })

    const { data: result, error } = await supabase.rpc('confirm_activation', {
      p_code:          code,
      p_terminal_uuid: terminalUUID,
      p_avatar_uuid:   avatarUUID,
      p_avatar_name:   avatarName,
    })

    if (error) {
      console.error('confirm_activation error:', error)
      return json({ success: false, error: 'Activation could not be processed. Contact support@incynq.net.' })
    }
    if (!result?.success) return json({ success: false, error: result?.error ?? 'Activation failed' })

    console.log(`activate: ${code} — user ${result.user_id} activated`)
    return json({
      success:        true,
      welcome_credit: String(result.welcome_credit ?? 0),
      referral_paid:  result.referral_paid ? 'true' : 'false',
      message:        result.message ?? 'Account activated',
    })
  }

  console.warn(`sl-webhook: unknown action "${action}"`)
  return json({ success: false, error: `Unknown action: ${action}` }, 400)
})

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/** 'paid' is the only valid completed status — see payment_intents_status_check. */
async function markIntentPaid(
  intentId: string, amountPaid: number,
  atmUUID: string, avatarUUID: string, avatarName: string,
) {
  const { error } = await supabase.from('payment_intents').update({
    status:              'paid',
    paid_at:             new Date().toISOString(),
    paid_amount:         amountPaid,
    paid_by_atm_uuid:    atmUUID,
    paid_by_avatar_uuid: avatarUUID,
    paid_by_avatar_name: avatarName,
  }).eq('id', intentId)
  if (error) console.error('markIntentPaid failed:', error)
}

/** Brand/performer identity tag (#slcompare). Best-effort — never blocks a payment. */
async function ensureIdentityTag(profileId: string) {
  try {
    await supabase.rpc('ensure_brand_identity_tag', { p_brand_id: profileId })
  } catch (e) {
    console.error('ensure_brand_identity_tag failed (non-blocking):', e)
  }
}

async function ownerEmail(userId: string): Promise<string | null> {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId)
    return data?.user?.email ?? null
  } catch (e) {
    console.error('ownerEmail lookup failed:', e)
    return null
  }
}

const EMAIL_FOOTER = `
  <div style="margin-top:24px;font-size:12px;color:#8a97a3;line-height:1.6;">
    <strong style="color:#ffa550;">Do not reply to this email.</strong>
    This is an automated message from an unmonitored address. Need a hand? Email
    <a href="mailto:support@incynq.net" style="color:#00b4c8;">support@incynq.net</a>
    and a real person will help.
  </div>`

const emailShell = (inner: string) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0A1A24;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e6f0f5;">
<div style="max-width:560px;margin:0 auto;padding:24px;">
  <div style="text-align:center;padding:32px 0 24px;">
    <div style="font-size:32px;font-weight:900;color:#00B4C8;">InCynq</div>
  </div>
  ${inner}
  <div style="text-align:center;padding:20px 0;color:#5a7a8a;font-size:12px;">
    ${EMAIL_FOOTER}
    <div style="margin-top:16px;">© 2026 InCynq · Connect with what matters</div>
  </div>
</div></body></html>`

async function sendEmail(to: string, subject: string, html: string): Promise<Response | null> {
  // Read inside the function, never at module scope — see header note 4.
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — email skipped')
    return null
  }
  return await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'InCynq <noreply@incynq.net>', to: [to], subject, html }),
  })
}

async function sendReceiptEmail(p: {
  receiptId: string; receiptNumber: string; toEmail: string; avatarName: string
  amount: number; newBalance: number; atmName: string; atmRegion: string
}) {
  const now     = new Date()
  const dateStr = now.toLocaleDateString('en-IE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', hour12: false })

  const row = (label: string, value: string) =>
    `<tr><td style="padding:7px 0;color:#9fb6c2;border-bottom:1px solid #1f3441;">${label}</td>
         <td style="padding:7px 0;color:#e6f0f5;text-align:right;border-bottom:1px solid #1f3441;">${value}</td></tr>`

  const html = emailShell(`
    <div style="background:rgba(0,180,200,0.08);border:1px solid rgba(0,180,200,0.3);border-radius:18px;padding:28px;text-align:center;margin-bottom:20px;">
      <div style="font-size:44px;font-weight:900;color:#F4B942;">+${p.amount.toLocaleString()} L$</div>
      <div style="font-size:14px;color:#9fb6c2;margin-top:8px;">New balance: <strong style="color:#00B4C8;">${p.newBalance.toLocaleString()} L$</strong></div>
    </div>
    <div style="background:#10222e;border:1px solid #1f3441;border-radius:14px;padding:20px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${row('Receipt', p.receiptNumber)}
        ${row('Date', dateStr)}
        ${row('Time', timeStr)}
        ${row('Avatar', p.avatarName)}
        ${row('ATM', p.atmName)}
        ${row('Location', p.atmRegion)}
      </table>
    </div>
    <div style="font-size:12px;color:#ffa550;text-align:center;">Wallet top-ups are non-refundable.</div>`)

  const res = await sendEmail(p.toEmail, `Receipt for your ${p.amount.toLocaleString()} L$ top-up — ${p.receiptNumber}`, html)
  if (!res) {
    await supabase.from('receipts').update({ send_status: 'skipped', send_error: 'RESEND_API_KEY not set' }).eq('id', p.receiptId)
    return
  }
  if (!res.ok) {
    const errBody = await res.text()
    await supabase.from('receipts').update({ send_status: 'failed', send_error: errBody }).eq('id', p.receiptId)
    throw new Error(`Resend error ${res.status}: ${errBody}`)
  }
  await supabase.from('receipts').update({ send_status: 'sent', sent_at: new Date().toISOString() }).eq('id', p.receiptId)
  console.log(`receipt: ${p.receiptNumber} sent to ${p.toEmail}`)
}

async function sendBrandActivationEmail(userId: string, walletAmount: number) {
  const to = await ownerEmail(userId)
  if (!to) return
  const html = emailShell(`
    <div style="background:rgba(0,180,200,0.08);border:1px solid rgba(0,180,200,0.3);border-radius:18px;padding:28px;text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;margin-bottom:12px;">🏷️</div>
      <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:8px;">Your brand is live</div>
      <div style="font-size:14px;color:#9fb6c2;">
        We've credited <strong style="color:#F4B942;">${walletAmount.toLocaleString()} L$</strong> to your brand wallet to get you started.
      </div>
    </div>
    <div style="background:#10222e;border:1px solid #1f3441;border-radius:14px;padding:20px;color:#9fb6c2;font-size:14px;line-height:1.6;">
      Open the app to set up your profile, post as your brand, and reach residents by interest.
    </div>`)
  await sendEmail(to, '🏷️ Your InCynq brand is live', html)
}

async function sendPerformerRenameEmail(userId: string, newName: string, handle: string) {
  const to = await ownerEmail(userId)
  if (!to) return
  const handleLine = handle
    ? `Your new handle is <strong style="color:#00B4C8;">@${handle}</strong>.` : ''
  const html = emailShell(`
    <div style="background:rgba(0,180,200,0.08);border:1px solid rgba(0,180,200,0.3);border-radius:18px;padding:28px;text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;margin-bottom:12px;">🎧</div>
      <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:8px;">Your new stage name is live</div>
      <div style="font-size:14px;color:#9fb6c2;">
        You're now performing as <strong style="color:#F4B942;">${newName}</strong>. ${handleLine}
      </div>
    </div>
    <div style="background:#10222e;border:1px solid #1f3441;border-radius:14px;padding:20px;color:#9fb6c2;font-size:14px;line-height:1.6;">
      Your followers, posts and airtime credit are all unchanged — thanks for the rebrand!
    </div>`)
  await sendEmail(to, `🎧 You're now ${newName} on InCynq`, html)
}
