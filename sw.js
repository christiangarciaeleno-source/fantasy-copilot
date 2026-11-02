// Subir CACHE al cambiar cualquier asset para invalidar la caché anterior.
const CACHE = 'fantasy-pro-v2';
const PRECACHE = [
  './', 'index.html', 'styles.css', 'tw-config.js', 'app.js', 'manifest.json', 'icon.svg',
  'js/util.js', 'js/state.js', 'js/ai.js', 'js/render.js', 'js/demo.js', 'js/export.js', 'js/image.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate para GET (assets propios + Tailwind/fuentes CDN). Las llamadas a las APIs de IA son POST: no pasan por aquí.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(e.request);
      const net = fetch(e.request)
        .then((res) => {
          if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
