// ── send-admin-alert ─────────────────────────────────────────────────────
// Tells whoever handles a queue that something is sitting in it.
//
// A review queue nobody is told about is a queue that sits there for a week.
// The nav badge and the Dashboard tile only work if you're already looking at
// the panel; this is the one that reaches you when you aren't.
//
// WHEN IT SENDS
//   Only when there is something waiting. A daily "nothing to do" email is how
//   an alert becomes noise you stop opening — and then the one that mattered
//   gets skimmed too.
//
// WHO IT GOES TO
//   app_content.admin_alert_routing maps each work type to an address. Today
//   that's one person; when there's a moderator, it's an edit rather than a
//   rewrite. Grouped per recipient so nobody gets three emails.
//
// FROM noreply@incynq.net with the do-not-reply footer, per the email audit:
// never a human alias as FROM on automated mail.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_KEY    = Deno.env.get('RESEND_API_KEY')!

const FROM = 'InCynq <noreply@incynq.net>'

type Item = {
  key: string
  count: number
  one: string
  many: string
  link: string
}

function row(i: Item) {
  const what = i.count === 1 ? i.one : i.many
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #eeeeee;">
        <span style="display:inline-block;min-width:34px;font-size:22px;font-weight:900;color:#00b4c8;">${i.count}</span>
        <span style="font-size:15px;color:#333333;">${what}</span>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #eeeeee;text-align:right;">
        <a href="${i.link}" style="font-size:13px;color:#00b4c8;text-decoration:none;font-weight:700;">Open &rarr;</a>
      </td>
    </tr>`
}

function html(items: Item[]) {
  const total = items.reduce((n, i) => n + i.count, 0)
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Waiting for you</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif;background:#f0f0f0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0f0f0;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:20px;box-shadow:0 8px 32px rgba(0,0,0,0.12);overflow:hidden;">

        <tr>
          <td style="background-color:#00b4c8;padding:40px;text-align:center;">
            <img src="https://incynq.app/Q_Logo_.png" alt="InCynq" width="64" height="64" style="display:block;margin:0 auto 16px;" />
            <h1 style="margin:0;color:#ffffff;font-size:30px;font-weight:900;letter-spacing:-1px;">InCynq Admin</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:24px;font-weight:800;">
              ${total === 1 ? 'One thing is waiting for you' : `${total} things are waiting for you`}
            </h2>
            <p style="margin:0 0 24px;color:#666666;font-size:15px;line-height:1.6;">
              Nothing urgent &mdash; but it won't clear itself.
            </p>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${items.map(row).join('')}
            </table>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 0;">
              <tr><td align="center">
                <a href="https://admin.incynq.app" style="display:inline-block;background-color:#00b4c8;color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:50px;font-weight:900;font-size:16px;">
                  Open the panel &rarr;
                </a>
              </td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#fafafa;padding:28px 40px;text-align:center;">
            <p style="margin:0;color:#999999;font-size:12px;line-height:1.6;">
              This is an automated message from an unmonitored address &mdash; please don't reply, as replies aren't seen.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

Deno.serve(async (req) => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pending_work_digest`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })

    if (!res.ok) {
      const body = await res.text()
      return new Response(JSON.stringify({ ok: false, step: 'digest', body }), { status: 500 })
    }

    const digest = await res.json()

    if (digest.enabled === false) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'alerts disabled' }))
    }

    const waiting: Item[] = (digest.items || []).filter((i: Item) => i.count > 0)

    // Nothing waiting, nothing sent. A daily "all clear" is how an alert turns
    // into noise, and then the one that matters gets skimmed too.
    if (waiting.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'nothing waiting' }))
    }

    // Group by recipient so one person handling three queues gets one email.
    const routing = digest.routing || {}
    const byRecipient: Record<string, Item[]> = {}
    for (const item of waiting) {
      const to = routing[item.key] || routing.default
      if (!to) continue
      ;(byRecipient[to] ||= []).push(item)
    }

    if (Object.keys(byRecipient).length === 0) {
      return new Response(JSON.stringify({ ok: false, sent: 0, reason: 'no routing configured' }), { status: 500 })
    }

    let sent = 0
    const failures: string[] = []

    for (const [to, items] of Object.entries(byRecipient)) {
      const total = items.reduce((n, i) => n + i.count, 0)
      const subject = total === 1
        ? `InCynq: ${items[0].count === 1 ? items[0].one : items[0].many}`
        : `InCynq: ${total} things waiting`

      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: FROM, to, subject, html: html(items) }),
      })

      if (r.ok) sent++
      else failures.push(`${to}: ${await r.text()}`)
    }

    return new Response(JSON.stringify({ ok: failures.length === 0, sent, failures }))
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 })
  }
})
