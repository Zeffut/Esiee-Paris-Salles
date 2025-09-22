// Service Worker pour Salles ESIEE PWA
const CACHE_NAME = 'salles-esiee-v10';
const API_CACHE_NAME = 'salles-esiee-api-v10';

// Fichiers à mettre en cache (ressources statiques)
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json'
];

// URLs de l'API à mettre en cache (avec stratégie Network First)
const API_URLS = [
  '/api/health',
  '/api/rooms',
  '/api/stats'
];

// Installation du Service Worker
self.addEventListener('install', event => {

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        // Force l'activation immédiate
        return self.skipWaiting();
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', event => {

  event.waitUntil(
    // Nettoyer les anciens caches
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Prendre le contrôle de tous les clients
      return self.clients.claim();
    })
  );
});

// Interception des requêtes
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorer les requêtes non-HTTP
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Ignorer les requêtes HTTPS vers des domaines externes sauf api.zeffut.fr et services Google
  if (url.protocol === 'https:' && url.hostname !== location.hostname &&
      url.hostname !== 'api.zeffut.fr' &&
      !url.hostname.includes('google') &&
      !url.hostname.includes('googleapis')) {
    return;
  }

  // Ne jamais mettre en cache les services Google Auth
  if (url.hostname.includes('google') || url.hostname.includes('googleapis')) {
    return fetch(event.request);
  }

  // Stratégie différente selon le type de ressource
  if (url.pathname.startsWith('/api/') || url.hostname === 'api.zeffut.fr') {
    // Stratégie Network First pour l'API
    event.respondWith(networkFirstStrategy(event.request));
  } else {
    // Stratégie Cache First pour les ressources statiques
    event.respondWith(cacheFirstStrategy(event.request));
  }
});

// Stratégie Cache First (pour les ressources statiques)
async function cacheFirstStrategy(request) {
  try {
    // Essayer de récupérer depuis le cache d'abord
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Si pas en cache, récupérer depuis le réseau
    const networkResponse = await fetch(request);

    // Mettre en cache la réponse si elle est valide et si la méthode le permet
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {

    // Si offline et ressource HTML, servir la page principale
    if (request.headers.get('accept').includes('text/html')) {
      const cachedPage = await caches.match('/index.html');
      if (cachedPage) {
        return cachedPage;
      }
    }

    // Page d'erreur offline basique
    return new Response('Application hors ligne', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Stratégie Network First (pour l'API)
async function networkFirstStrategy(request) {
  try {
    // Essayer le réseau d'abord
    const networkResponse = await fetch(request);

    // Mettre en cache si succès
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {

    // Si réseau indisponible, essayer le cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Réponse d'erreur si aucune donnée en cache
    return new Response(JSON.stringify({
      success: false,
      error: 'Application hors ligne - données indisponibles',
      cached: false
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Gestion des messages du client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    // Envoyer le statut du cache au client
    caches.keys().then(cacheNames => {
      event.ports[0].postMessage({
        caches: cacheNames,
        version: CACHE_NAME
      });
    });
  }
});

// Notification de mise à jour disponible
self.addEventListener('updatefound', () => {
});