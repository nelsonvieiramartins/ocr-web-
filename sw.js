const CACHE_NAME = 'ocrleitor-cache-v1'; // Mude a versão se atualizar os arquivos cacheados
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css', // Adicione o CSS ao cache
    '/manifest.json',
    '/js/main.js', // Cache dos scripts principais
    '/js/ui.js',
    '/js/ocr.js',
    '/js/firestore.js',
    '/js/auth.js',
    '/js/pwa.js',
    '/js/utils.js',
    '/js/firebaseConfig.js', // Mesmo que tenha placeholders, cacheia a estrutura
    '/tessdata/por.traineddata', // Essencial
    '/icon-192.png',
    '/icon-512.png',
    // URLs externas (verifique se a política de cache delas permite)
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

self.addEventListener('install', event => {
    console.log('[Service Worker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Cache aberto:', CACHE_NAME);
                // addAll falha se UMA URL não puder ser buscada/cacheada
                // Use um loop com cache.add() e .catch() para mais robustez se necessário
                return cache.addAll(urlsToCache)
                           .catch(err => {
                                console.error('[Service Worker] Falha ao adicionar URLs ao cache durante install:', err);
                                // Tentar adicionar individualmente?
                                urlsToCache.forEach(url => {
                                    cache.add(url).catch(e => console.warn(`[SW Install] Falha ao cachear ${url}: ${e.message}`));
                                });
                                // Não rejeita a promessa principal para permitir que o SW instale mesmo com falhas parciais
                           });
            })
            .catch(err => {
                console.error('[Service Worker] Erro ao abrir cache durante install:', err);
            })
    );
});

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // Não interceptar requisições para APIs externas (Firestore, LanguageTool, Google Auth)
    if (requestUrl.hostname.includes('googleapis.com') ||
        requestUrl.hostname.includes('languagetool.org') ||
        requestUrl.hostname.includes('google.com') || // Para Google Sign-In
        requestUrl.hostname.includes('firebaseapp.com')) { // Para Auth Domain
        // console.log('[Service Worker] Bypass fetch (API externa):', requestUrl.href);
        event.respondWith(fetch(event.request));
        return;
    }

    // Estratégia: Cache first, then network para recursos locais/app shell
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    // console.log('[Service Worker] Servindo do cache:', event.request.url);
                    return response;
                }
                // console.log('[Service Worker] Buscando da rede:', event.request.url);
                return fetch(event.request).then(
                    networkResponse => {
                        // Verifica se a resposta é válida para cache
                        if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && !urlsToCache.includes(requestUrl.pathname)) {
                            // Não cacheia respostas de erro, opacas (cross-origin sem CORS), ou não listadas explicitamente (exceto arquivos do app)
                             // console.log('[Service Worker] Resposta não cacheável:', event.request.url, networkResponse.status, networkResponse.type);
                             return networkResponse;
                         }

                        // Clona a resposta para poder retornar ao browser e guardar no cache
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                // console.log('[Service Worker] Armazenando no cache:', event.request.url);
                                cache.put(event.request, responseToCache);
                            });
                        return networkResponse;
                    }
                ).catch(err => {
                    console.error('[Service Worker] Erro na busca da rede:', err);
                    // Opcional: Retornar uma página offline padrão do cache aqui
                    // return caches.match('/offline.html');
                    throw err; // Propaga o erro se não houver fallback
                });
            })
    );
});

self.addEventListener('activate', event => {
    console.log('[Service Worker] Ativando...');
    const cacheWhitelist = [CACHE_NAME]; // Apenas o cache atual é permitido
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
        }).then(() => {
             console.log('[Service Worker] Caches antigos limpos.');
             // Força o SW ativado a tomar controle imediatamente das abas abertas
             // Isso é útil para garantir que a versão mais recente do SW seja usada
             return self.clients.claim();
        })
    );
});