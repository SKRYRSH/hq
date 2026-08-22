const CACHE = 'weebji-hq-v7';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './favicon.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  // The supabase library comes from a CDN. If that CDN is blocked (Russia) the
  // whole app dies at the login screen, so cache it on first success and serve
  // it from cache forever after. API/auth traffic is still never touched.
  if (/(^|\.)(unpkg\.com|jsdelivr\.net|cloudflare\.com)$/.test(u.hostname)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); }
      return res;
    })));
    return;
  }
  if (u.origin !== location.origin) return; // never touch Supabase/API traffic
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('./index.html'))); // fresh app, offline fallback
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});

self.addEventListener('push', (e) => {
  let d = { title: 'Weebji HQ', body: 'New activity', url: './index.html' };
  try { if (e.data) d = Object.assign(d, e.data.json()); } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body, icon: './icon-192.png', badge: './icon-192.png',
    data: { url: d.url }, vibrate: [80, 40, 80], tag: 'hq-lead', renotify: true,
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    for (const w of ws) { if ('focus' in w) return w.focus(); }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
