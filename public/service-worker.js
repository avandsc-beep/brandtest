// service-worker.js
// Estrategia: red primero, con reserva en caché si no hay conexión.
// Nunca cachea /api/* ni supabase.co — esos SIEMPRE deben ir a la red
// real (créditos, sesión, análisis), o podríamos servir datos viejos
// sin que nadie se dé cuenta.

const CACHE_NAME = 'brandex-v3';
const APP_SHELL = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    if (req.url.includes('/api/')) return;
    // Solo interceptar requests del PROPIO dominio. Las cross-origin
    // (avatar de Google, fuentes, Paddle) deben pasar de largo: dentro
    // del worker quedan bajo el connect-src del CSP (que no las permite)
    // y morían acá — en el navegador rigen img-src/font-src y cargan bien.
    if (new URL(req.url).origin !== self.location.origin) return;

    event.respondWith(
        fetch(req)
            .then((res) => {
                const resClone = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                return res;
            })
            .catch(() => caches.match(req))
    );
});
