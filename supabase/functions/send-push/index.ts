// supabase/functions/send-push/index.ts
// ─────────────────────────────────────
// Sends Web Push notifications to one user or all users.
// Secrets needed: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── VAPID helpers ─────────────────────────────────────────────────────

function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const b64 = pad ? padded + '='.repeat(4 - pad) : padded;
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function getVapidHeaders(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<{ Authorization: string; 'Crypto-Key': string }> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ aud: audience, exp: expiry, sub: subject })));
  const signingInput = `${header}.${payload}`;

  const privateKeyBytes = base64UrlDecode(vapidPrivateKey);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;

  return {
    Authorization: `vapid t=${jwt},k=${vapidPublicKey}`,
    'Crypto-Key': `p256ecdsa=${vapidPublicKey}`,
  };
}

// ── Encrypt payload ───────────────────────────────────────────────────

async function encryptPayload(
  payload: string,
  p256dh: string,
  auth: string
): Promise<{ encrypted: ArrayBuffer; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const clientPublicKey = await crypto.subtle.importKey(
    'raw', base64UrlDecode(p256dh),
    { name: 'ECDH', namedCurve: 'P-256' },
    false, []
  );

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, ['deriveBits']
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    serverKeyPair.privateKey, 256
  );

  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey);
  const serverPublicKey = new Uint8Array(serverPublicKeyRaw);

  const authDecoded = base64UrlDecode(auth);
  const prk = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveBits']);

  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
  const prk2Bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authDecoded, info: authInfo },
    prk, 256
  );

  const context = new Uint8Array([
    ...new TextEncoder().encode('P-256\0'),
    0, 65, ...base64UrlDecode(p256dh),
    0, 65, ...serverPublicKey
  ]);

  const prk2 = await crypto.subtle.importKey('raw', prk2Bits, { name: 'HKDF' }, false, ['deriveBits']);

  const cekInfo = new Uint8Array([...new TextEncoder().encode('Content-Encoding: aesgcm\0'), ...context]);
  const cekBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo }, prk2, 128);

  const nonceInfo = new Uint8Array([...new TextEncoder().encode('Content-Encoding: nonce\0'), ...context]);
  const nonceBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, prk2, 96);

  const cek = await crypto.subtle.importKey('raw', cekBits, { name: 'AES-GCM' }, false, ['encrypt']);

  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 2);
  paddedPayload.set(payloadBytes, 2);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonceBits },
    cek, paddedPayload
  );

  return { encrypted, salt, serverPublicKey };
}

// ── Send to one subscription ──────────────────────────────────────────

async function sendToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ ok: boolean; status?: number }> {
  try {
    const { encrypted, salt, serverPublicKey } = await encryptPayload(payload, sub.p256dh, sub.auth);

    const vapidHeaders = await getVapidHeaders(
      sub.endpoint, vapidPublicKey, vapidPrivateKey,
      'mailto:noreply@incynq.net'
    );

    const cryptoKeyHeader = `dh=${base64UrlEncode(serverPublicKey)};${vapidHeaders['Crypto-Key']}`;
    const saltHeader = base64UrlEncode(salt);

    const body = new Uint8Array(encrypted);

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        ...vapidHeaders,
        'Crypto-Key': cryptoKeyHeader,
        'Encryption': `salt=${saltHeader}`,
        'Content-Encoding': 'aesgcm',
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
      },
      body,
    });

    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error('sendToSubscription error:', e.message);
    return { ok: false };
  }
}

// ── Main handler ──────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;

    const { userId, all, title, body, url } = await req.json();

    const payload = JSON.stringify({
      title: title || 'InCynq',
      body:  body  || '',
      icon:  '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      url:   url   || 'https://incynq.app',
    });

    // Fetch subscriptions
    let query = supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .eq('active', true);

    if (!all && userId) {
      query = query.eq('user_id', userId);
    }

    const { data: subs, error } = await query;
    if (error) throw error;
    if (!subs?.length) return new Response(
      JSON.stringify({ ok: true, sent: 0, message: 'No active subscriptions' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subs.map(sub => sendToSubscription(sub, payload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY))
    );

    // Deactivate expired/invalid subscriptions (410 Gone)
    const expiredEndpoints: string[] = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value.status === 410) {
        expiredEndpoints.push(subs[i].endpoint);
      }
    });

    if (expiredEndpoints.length) {
      await supabase
        .from('push_subscriptions')
        .update({ active: false })
        .in('endpoint', expiredEndpoints);
    }

    const sent = results.filter(r => r.status === 'fulfilled' && (r as any).value.ok).length;

    return new Response(
      JSON.stringify({ ok: true, sent, total: subs.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    console.error('send-push error:', e.message);
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
