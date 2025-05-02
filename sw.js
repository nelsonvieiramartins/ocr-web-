const CACHE_NAME = 'ocr-app-cache-v2';
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
    console.log('[Service Worker] Instalando Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Cache aberto:', CACHE_NAME);
                return cache.addAll(urlsToCache)
                    .then(() => console.log('[Service Worker] Recursos armazenados em cache.'))
                    .catch(error => console.error('[Service Worker] Erro ao armazenar recursos:', error));
            })
            .catch(error => console.error('[Service Worker] Erro ao abrir cache:', error))
    );
});

self.addEventListener('activate', event => {
    console.log('[Service Worker] Ativando Service Worker...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).catch(error => console.error('[Service Worker] Erro ao ativar:', error))
    );
});

self.addEventListener('fetch', event => {
    console.log('[Service Worker] Fetch interceptado:', event.request.url);
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    console.log('[Service Worker] Servindo do cache:', event.request.url);
                    return response;
                }
                console.log('[Service Worker] Buscando na rede:', event.request.url);
                return fetch(event.request)
                    .then(networkResponse => {
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                                console.log('[Service Worker] Armazenado na cache:', event.request.url);
                            })
                            .catch(error => console.error('[Service Worker] Erro ao armazenar na cache:', error));
                        return networkResponse;
                    })
                    .catch(error => {
                        console.error('[Service Worker] Erro na busca:', error);
                        throw error;
                    });
            })
            .catch(error => console.error('[Service Worker] Erro ao buscar do cache:', error))
    );
});