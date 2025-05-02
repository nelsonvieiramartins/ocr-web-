// js/pwa.js
import { setStatus } from './ui.js';

export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        const isHttps = protocol === 'https:';

        if (!isHttps && !isLocalhost) {
            console.error(`Service Worker requer HTTPS ou localhost. Atual: ${protocol}//${hostname}`);
            setStatus('Erro: Funcionalidades offline requerem HTTPS ou localhost.');
            return;
        }

        // Usa window.onload para garantir que a página carregou antes de registrar
        window.addEventListener('load', () => {
             navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(registration => {
                    console.log('Service Worker registrado com sucesso! Escopo:', registration.scope);
                    // Não define o status aqui, deixa o status inicial de Auth cuidar disso
                    // setStatus('Pronto para uso online/offline.');
                })
                .catch(err => {
                    console.error('Erro ao registrar Service Worker:', err);
                    setStatus(`Erro no Service Worker: ${err.message}. Funcionalidades offline podem não funcionar.`);
                });
        });

    } else {
        console.warn('Service Worker não suportado neste navegador.');
        setStatus('Navegador não suporta funcionalidades offline (Service Worker).');
    }
}