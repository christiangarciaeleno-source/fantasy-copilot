// Subir CACHE al cambiar cualquier asset para invalidar la caché anterior.
const CACHE = 'fantasy-pro-v23';
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

// Archivos propios: red primero (revalidando, para ver siempre la última versión) y caché si no hay red o tarda más de 4 s.
// Resto de GET (fuentes, fotos): caché primero y se refresca por detrás. Las APIs de IA son POST: no pasan por aquí.
self.addEventListener('fetch', (e) => {
  const { origin, hostname } = new URL(e.request.url);
  if (e.request.method !== 'GET' || (origin !== location.origin && (hostname.endsWith('googleapis.com') || hostname === 'openrouter.ai'))) return; // listas de modelos: siempre frescas
  const own = origin === location.origin;
  const net = () => fetch(e.request, own ? { cache: 'no-cache' } : {});
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const save = (res) => { if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone()); return res; };
      if (own) {
        const timeout = new Promise((_, no) => setTimeout(no, 4000));
        return Promise.race([net().then(save), timeout]).catch(async () => (await cache.match(e.request)) ?? net());
      }
      const hit = await cache.match(e.request);
      return hit ?? net().then(save);
    })
  );
});
