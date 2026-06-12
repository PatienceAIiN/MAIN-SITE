const CACHE_NAME = 'patience-ai-v5';
const OFFLINE_SHELL = ['/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(new Request(event.request, { cache: 'no-store' })).catch(async () => {
      const cachedPage = await caches.match('/index.html');
      return cachedPage || Response.error();
    })
  );
});

// ── Team portal web-push: incoming chat messages & video calls ───────────────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* plain text push */ }
  event.waitUntil(self.registration.showNotification(data.title || 'Patience AI', {
    body: data.body || '',
    tag: data.tag || 'pa-team',
    icon: '/favicon-32.png',
    badge: '/favicon-32.png',
    data: { url: data.url || '/team' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/team';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.includes('/team') && 'focus' in c) return c.focus();
    }
    return self.clients.openWindow(url);
  }));
});
