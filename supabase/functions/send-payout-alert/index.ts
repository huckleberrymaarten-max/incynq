/**
 * send-payout-alert — Supabase Edge Function (InCynq)
 *
 * Called by pg_cron every Monday at 09:00 UTC via notify_payouts_due().
 * Emails Maarten what's waiting to be paid out to DJs.
 *
 * It does NOT move money and cannot. llGiveMoney needs a rezzed object with
 * debit permission owned by the avatar holding the L$, so payouts are made by
 * hand inworld and marked paid in admin. This is the reminder, not the payment.
 *
 * The avatar UUID is in the email on purpose: paying by UUID rather than by
 * name removes any "which DJ Max did I mean", and SL display names change.
 *
 * KEEP THIS FILE IN THE REPO — supabase/functions/send-payout-alert/index.ts
 * sl-webhook was dashboard-only, and one bad paste took the whole inworld
 * estate down for three weeks with nothing to restore from.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  // Read secrets INSIDE the handler, never at module scope — a missing env var
  // read at module level kills the worker on boot.
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const ALERT_TO = Deno.env.get('PAYOUT_ALERT_TO') ?? 'huckleberrymaarten@gmail.com'

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — payout alert skipped')
    return json({ ok: false, error: 'No mail key' })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ ok: false, error: 'Bad JSON' }, 400) }

  const performers = Number(body.performers ?? 0)
  const grossL     = Number(body.gross_l ?? 0)
  const netL       = Number(body.net_l ?? 0)
  const feeL       = Number(body.fee_l ?? 0)
  const blocked    = Number(body.blocked ?? 0)
  const detail     = Array.isArray(body.detail) ? body.detail : []

  if (!performers) return json({ ok: true, skipped: 'nothing due' })

  const rows = detail.map((d: Record<string, unknown>) => {
    const uuid = (d.owner_sl_uuid ?? d.sl_uuid ?? null) as string | null
    const name = (d.brand_name ?? d.brand_handle ?? 'Unknown') as string
    const net  = Number(d.net ?? 0)
    const cnt  = Number(d.tip_count ?? 0)
    return `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #1f3441;">
          <div style="color:#e6f0f5;font-weight:700;">${name}</div>
          <div style="color:#5a7a8a;font-size:11px;">${cnt} tip${cnt === 1 ? '' : 's'}</div>
          ${uuid
            ? `<div style="color:#5a7a8a;font-size:11px;font-family:monospace;">${uuid}</div>`
            : `<div style="color:#ffa550;font-size:11px;">⚠️ No avatar on file — cannot pay</div>`}
        </td>
        <td style="padding:9px 0;border-bottom:1px solid #1f3441;text-align:right;color:#F4B942;font-weight:800;white-space:nowrap;">
          ${net.toLocaleString()} L$
        </td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0A1A24;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e6f0f5;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="text-align:center;padding:28px 0 20px;">
      <div style="font-size:30px;font-weight:900;color:#00B4C8;">InCynq</div>
    </div>

    <div style="background:rgba(0,180,200,0.08);border:1px solid rgba(0,180,200,0.3);border-radius:18px;padding:26px;text-align:center;margin-bottom:18px;">
      <div style="font-size:40px;font-weight:900;color:#F4B942;">${netL.toLocaleString()} L$</div>
      <div style="font-size:14px;color:#9fb6c2;margin-top:6px;">
        to pay out to ${performers} performer${performers === 1 ? '' : 's'}
      </div>
    </div>

    <div style="background:#10222e;border:1px solid #1f3441;border-radius:14px;padding:18px;margin-bottom:18px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
    </div>

    <div style="background:#10222e;border:1px solid #1f3441;border-radius:14px;padding:16px;font-size:13px;color:#9fb6c2;line-height:1.7;margin-bottom:18px;">
      Tips collected: <strong style="color:#e6f0f5;">${grossL.toLocaleString()} L$</strong><br>
      InCynq handling fee: <strong style="color:#e6f0f5;">${feeL.toLocaleString()} L$</strong><br>
      To pay: <strong style="color:#F4B942;">${netL.toLocaleString()} L$</strong>
      ${blocked ? `<br><span style="color:#ffa550;">${blocked} performer${blocked === 1 ? '' : 's'} cannot be paid — no SL avatar on file.</span>` : ''}
    </div>

    <div style="font-size:13px;color:#9fb6c2;line-height:1.7;">
      Pay each avatar from <strong style="color:#e6f0f5;">IncynqPayments</strong> inworld,
      then mark them paid in admin → Transactions. Nothing is sent automatically.
    </div>

    <div style="text-align:center;padding:22px 0;color:#5a7a8a;font-size:12px;">
      <div style="margin-top:14px;">© 2026 InCynq · Connect with what matters</div>
    </div>
  </div>
</body></html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'InCynq <noreply@incynq.net>',
      to: [ALERT_TO],
      subject: `${netL.toLocaleString()} L$ of DJ tips ready to pay out`,
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', res.status, err)
    return json({ ok: false, error: err }, 500)
  }

  console.log(`payout alert sent: ${performers} performers, ${netL} L$`)
  return json({ ok: true, performers, net_l: netL })
})
