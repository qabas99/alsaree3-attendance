/* Service Worker — نظام الحضور
   الاستراتيجية: الشبكة أولاً دائماً (حتى لا تظهر نسخة قديمة بعد التحديث)،
   والكاش فقط كاحتياط عند انقطاع الإنترنت. لا يتم كاش أي طلبات لـ Supabase أو لأي موقع خارجي. */
const CACHE = 'attendance-v2';
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
