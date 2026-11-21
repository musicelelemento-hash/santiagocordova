/* Service worker mínimo de SC PRO.
 *
 * Objetivo: que la app sea instalable y abra al instante en el celular.
 * Estrategia conservadora:
 *   - navegación: red primero (para no servir una versión vieja) y caché de respaldo,
 *   - estáticos con hash: caché primero (el nombre cambia con cada build).
 * Nada de cachear llamadas a Supabase/API: los datos siempre frescos.
 */
const VERSION = 'scpro-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(VERSION)
            .then((cache) => cache.addAll(SHELL))
            .catch(() => undefined)
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    // Sólo mismo origen; la API y Supabase van directo a la red.
    if (url.origin !== self.location.origin) return;
    if (/\/(rest|auth|storage|functions)\/v1\//.test(url.pathname)) return;

    // Navegación: red primero, caché de respaldo si no hay señal.
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copia = res.clone();
                    caches.open(VERSION).then((c) => c.put('/index.html', copia)).catch(() => undefined);
                    return res;
                })
                .catch(() => caches.match('/index.html').then((r) => r || Response.error())),
        );
        return;
    }

    // Estáticos con hash (js/css/img): caché primero.
    if (/\.(js|css|png|jpg|jpeg|webp|svg|woff2?|ttf)$/.test(url.pathname)) {
        event.respondWith(
            caches.match(req).then((hit) => {
                if (hit) return hit;
                return fetch(req).then((res) => {
                    if (res.ok) {
                        const copia = res.clone();
                        caches.open(VERSION).then((c) => c.put(req, copia)).catch(() => undefined);
                    }
                    return res;
                });
            }),
        );
    }
});
