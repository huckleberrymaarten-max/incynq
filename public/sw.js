// ── InCynq Service Worker ─────────────────────────────────────────
// Handles push notifications and notification clicks.

self.addEventListener('push', event => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'InCynq', body: event.data.text() };
  }

  const options = {
    body:               data.body  || '',
    icon:               data.icon  || '/icons/icon-192x192.png',
    badge:              data.badge || '/icons/badge-icon.png',
    data:               { url: data.url || 'https://incynq.app' },
    vibrate:            [200, 100, 200],
    requireInteraction: false,
    silent:             false,
    tag:                'incynq-notification',
    renotify:           true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'InCynq', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://incynq.app';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith('https://incynq.app') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
