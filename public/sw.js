/* ─────────────────────────────────────────────────────────────────────────────
   NutriPlan Pro — Service Worker
   Handles:
     1. Offline asset caching (PWA shell)
     2. Push notifications from the server
     3. Local scheduled reminders (postMessage from the page)
   ───────────────────────────────────────────────────────────────────────────── */

const CACHE_NAME = 'nutriplan-v2';
const SHELL_ASSETS = ['/', '/index.html', '/manifest.json'];

// ── Install: pre-cache shell ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for shell ───────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// ── Push: show notification from server payload ───────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'NutriPlan', body: 'Tienes un recordatorio nutricional.', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch { /* ignore parse errors */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'nutriplan-push',
      data: { url: data.url },
    })
  );
});

// ── Notification click: focus or open the app ─────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});

// ── postMessage: local scheduled reminders from the page ─────────────────────
// Expected message shape: { type: 'SCHEDULE_REMINDER', title, body, delayMs }
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SCHEDULE_REMINDER') return;
  const { title, body, delayMs } = event.data;

  setTimeout(() => {
    self.registration.showNotification(title ?? 'NutriPlan', {
      body: body ?? 'Hora de tu comida.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `nutriplan-reminder-${Date.now()}`,
    });
  }, Math.max(0, delayMs ?? 0));
});
