// Service Worker pour Salles ESIEE PWA
const CACHE_NAME = 'salles-esiee-v1';
const API_CACHE_NAME = 'salles-esiee-api-v1';

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
  console.log('[SW] Installation');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Mise en cache des fichiers statiques');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('[SW] Installation terminée');
        // Force l'activation immédiate
        return self.skipWaiting();
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', event => {
  console.log('[SW] Activation');

  event.waitUntil(
    // Nettoyer les anciens caches
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('[SW] Suppression du cache obsolète:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation terminée');
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

  // Ignorer les requêtes HTTPS vers des domaines externes (certificats auto-signés)
  if (url.protocol === 'https:' && url.hostname !== location.hostname) {
    console.log('[SW] Requête HTTPS externe ignorée:', event.request.url);
    return;
  }

  // Stratégie différente selon le type de ressource
  if (url.pathname.startsWith('/api/')) {
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
      console.log('[SW] Ressource servie depuis le cache:', request.url);
      return cachedResponse;
    }

    // Si pas en cache, récupérer depuis le réseau
    console.log('[SW] Récupération depuis le réseau:', request.url);
    const networkResponse = await fetch(request);

    // Mettre en cache la réponse si elle est valide
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Erreur cache first:', error);

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
    console.log('[SW] Requête API réseau:', request.url);
    const networkResponse = await fetch(request);

    // Mettre en cache si succès
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Réseau indisponible, essai cache API:', request.url);

    // Si réseau indisponible, essayer le cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Données API servies depuis le cache');
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
  console.log('[SW] Mise à jour disponible');
});