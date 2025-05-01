const CACHE_NAME = 'ocr-app-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/tessdata/por.traineddata',
    '/icon-192.png',
    '/icon-512.png',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
];

self.addEventListener('install', event => {
    console.log('Service Worker: Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Service Worker: Cacheando arquivos');
            return cache.addAll(urlsToCache);
        }).catch(err => {
            console.error('Service Worker: Erro ao cachear:', err);
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});