// supabase/functions/send-push/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;

    webpush.setVapidDetails(
      'mailto:noreply@incynq.net',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    const { userId, all, title, body, url } = await req.json();

    const payload = JSON.stringify({
      title: title || 'InCynq',
      body:  body  || '',
      icon:  '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      url:   url   || 'https://incynq.app',
    });

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

    let sent = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
        console.log('Sent to:', sub.endpoint.substring(0, 50));
      } catch (e: any) {
        console.error('Send failed:', e.statusCode, e.message);
        if (e.statusCode === 410 || e.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        }
      }
    }

    if (expiredEndpoints.length) {
      await supabase
        .from('push_subscriptions')
        .update({ active: false })
        .in('endpoint', expiredEndpoints);
    }

    return new Response(
      JSON.stringify({ ok: true, sent, total: subs.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    console.error('send-push error:', e.message);
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
