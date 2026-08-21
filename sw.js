// ===== SERVICE WORKER — Estatuto Naucratita =====
// Faz o cache do "app shell" para que o app abra offline.
//
// IMPORTANTE: sempre que publicar uma atualização do site, mude este
// número de versão (ex: 'naucratis-v3'). Isso força os navegadores dos
// usuários a descartar o cache antigo e buscar os arquivos novos —
// sem isso, quem já visitou o site antes continua vendo a versão velha
// para sempre, mesmo depois de você publicar mudanças.
const CACHE_VERSION = 'naucratis-v2';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/favicon-96x96.png',
  '/apple-touch-icon.png'
];

// ===== INSTALL =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE =====
// Remove caches de versões antigas, para não servir conteúdo desatualizado.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ===== FETCH =====
// Estratégia:
// - Navegação (abrir/recarregar o app): tenta a rede primeiro, para sempre
//   pegar o conteúdo mais recente; só cai para o cache se estiver offline.
// - Demais arquivos do mesmo site (ícones, manifest): cache primeiro,
//   com atualização em segundo plano.
// - Recursos externos (ex: Google Fonts): tenta rede, com fallback
//   para cache quando disponível; nunca quebra o app se falhar.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (isSameOrigin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  } else {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
