const CACHE_NAME = 'patience-ai-v6';
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

// ── Per-portal web-push: chat messages, calls, ticket updates ────────────────
// Each portal (/team, /admin, /support-executive, /my-ticket) is its own PWA,
// so the push payload carries the destination URL and we focus the matching
// portal window (by scope) before opening a new one.
const PORTAL_SCOPES = ['/team', '/admin', '/support-executive', '/my-ticket'];

const scopeOf = (url) => {
  try {
    const path = new URL(url, self.location.origin).pathname;
    return PORTAL_SCOPES.find((scope) => path === scope || path.startsWith(scope + '/')) || null;
  } catch { return null; }
};

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* plain text push */ }
  const url = data.url || '/team';
  event.waitUntil(self.registration.showNotification(data.title || 'Patience AI', {
    body: data.body || '',
    tag: data.tag || ('pa' + (scopeOf(url) || '')),
    icon: '/favicon-32.png',
    badge: '/favicon-32.png',
    data: { url }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/team';
  const scope = scopeOf(url);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      // Focus an already-open window of the SAME portal; fall back to any window
      // only when the notification has no recognizable portal scope.
      const match = scope ? scopeOf(c.url) === scope : true;
      if (match && 'focus' in c) return c.focus();
    }
    return self.clients.openWindow(url);
  }));
});
