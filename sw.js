// Subir CACHE al cambiar cualquier asset para invalidar la caché anterior.
const CACHE = 'fantasy-pro-v22';
const PRECACHE = [
  './', 'index.html', 'app.css', 'app.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'js/util.js', 'js/state.js', 'js/ai.js', 'js/render.js', 'js/demo.js', 'js/export.js', 'js/image.js', 'js/openrouter.js', 'js/team.js', 'data/laliga.json', 'skills/fantasy-analista/SKILL.md'
];

// reload: salta la caché HTTP de Pages (max-age 600) al precachear.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
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
  const { origin, hostname } = new URL(e.request.url);
  if (e.request.method !== 'GET' || (origin !== location.origin && (hostname.endsWith('googleapis.com') || hostname === 'openrouter.ai'))) return; // listas de modelos: siempre frescas
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
