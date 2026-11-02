/* Service Worker — نظام الحضور
   الاستراتيجية: الشبكة أولاً دائماً (حتى لا تظهر نسخة قديمة بعد التحديث)،
   والكاش فقط كاحتياط عند انقطاع الإنترنت. لا يتم كاش أي طلبات لـ Supabase أو لأي موقع خارجي.
   + استقبال إشعارات الجوال (Web Push). */
const CACHE = 'attendance-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase والخطوط وغيرها: مباشرة من الشبكة

  e.respondWith(
    fetch(req, { cache: 'no-cache' }) // يتجاوز كاش المتصفح حتى يصل التحديث فوراً
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});

/* ===== إشعارات الجوال ===== */
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { data = { title: 'عالسريع', body: e.data ? e.data.text() : '' }; }
  const opts = {
    body: data.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    requireInteraction: !!data.urgent,
    vibrate: data.urgent ? [300, 150, 300, 150, 300] : [200],
    data: { tab: data.tab || '', url: data.url || './' }
  };
  e.waitUntil(self.registration.showNotification(data.title || 'عالسريع', opts));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = e.notification.data || {};
  const target = new URL(d.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if ('focus' in c) {
        await c.focus();
        try { c.postMessage({ type: 'open-tab', tab: d.tab || '' }); } catch (_) {}
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target + (d.tab ? '#' + d.tab : ''));
  })());
});
