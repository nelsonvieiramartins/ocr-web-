const CACHE_NAME = 'ocrleitor-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/tessdata/por.traineddata',
    '/icon-192.png',
    '/icon-512.png',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
];

self.addEventListener('install', event => {
    console.log('[Service Worker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Cache aberto:', CACHE_NAME);
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.error('[Service Worker] Erro ao abrir cache:', err);
            })
    );
});

self.addEventListener('fetch', event => {
    console.log('[Service Worker] Fetch:', event.request.url);
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    console.log('[Service Worker] Servindo do cache:', event.request.url);
                    return response;
                }
                console.log('[Service Worker] Buscando da rede:', event.request.url);
                return fetch(event.request)
                    .then(networkResponse => {
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                console.log('[Service Worker] Armazenando no cache:', event.request.url);
                                cache.put(event.request, responseToCache);
                            });
                        return networkResponse;
                    })
                    .catch(err => {
                        console.error('[Service Worker] Erro na busca:', err);
                        throw err;
                    });
            })
    );
});

self.addEventListener('activate', event => {
    console.log('[Service Worker] Ativando...');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        console.log('[Service Worker] Deletando cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});