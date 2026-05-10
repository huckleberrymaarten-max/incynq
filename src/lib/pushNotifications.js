/**
 * src/lib/pushNotifications.js
 * ─────────────────────────────
 * Manages Web Push subscription lifecycle.
 * Called from Settings when user toggles push notifications on/off.
 */

import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = 'BAFUY9rrTwtN_vKpI0Ekzwlvljmh8fvijO831ERhCt-Y2GUAuSl_OxW0JHVOquuW4YvYRag0trGCrVh27NxW87E';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/**
 * Register the service worker and subscribe to push notifications.
 * Saves the subscription to Supabase.
 * Returns true on success, false if the user denied permission.
 */
export async function subscribeToPush(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  // Register service worker
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  // Subscribe
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const json   = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth   = json.keys?.auth;

  if (!p256dh || !auth) throw new Error('Could not get subscription keys.');

  // Save to Supabase
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id:    userId,
      endpoint:   subscription.endpoint,
      p256dh,
      auth,
      active:     true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) throw error;

  // Update profile push_enabled flag
  await supabase
    .from('profiles')
    .update({ push_enabled: true })
    .eq('id', userId);

  return true;
}

/**
 * Unsubscribe from push notifications and deactivate in Supabase.
 */
export async function unsubscribeFromPush(userId) {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch (e) {
      console.warn('Could not unsubscribe from push manager:', e.message);
    }
  }

  // Deactivate in Supabase
  const { error: subError } = await supabase
    .from('push_subscriptions')
    .update({ active: false })
    .eq('user_id', userId);
  if (subError) console.error('push_subscriptions update failed:', subError.message);

  // Update profile flag
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ push_enabled: false })
    .eq('id', userId);
  if (profileError) console.error('push_enabled update failed:', profileError.message);
}

/**
 * Check if the user currently has an active push subscription.
 */
export async function getPushStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/**
 * Send a push notification to a specific user via the edge function.
 * Called server-side or from admin — not from client directly.
 */
export async function sendPushToUser({ userId, title, body, url = 'https://incynq.app' }) {
  const { error } = await supabase.functions.invoke('send-push', {
    body: { userId, title, body, url }
  });
  if (error) throw error;
}

/**
 * Send a push notification to ALL users (InCynq Official broadcasts).
 * Admin only.
 */
export async function sendPushToAll({ title, body, url = 'https://incynq.app' }) {
  const { error } = await supabase.functions.invoke('send-push', {
    body: { all: true, title, body, url }
  });
  if (error) throw error;
}
