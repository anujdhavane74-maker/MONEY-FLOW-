// Money Flow PWA Service Worker (v2.0.0)
const CACHE_NAME = 'money-flow-v2';
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico'
];

// Install: precache critical assets and skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache non-critical error:', err);
      });
    })
  );
});

// Activate: cleanup stale caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Message: allow clients to trigger skip waiting
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting')) {
    self.skipWaiting();
  }
});

// Fetch: Stale-While-Revalidate for static assets, Network-First for navigation
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Skip non-GET requests and cross-origin requests
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return;
  }

  // API calls: Network only or bypass SW cache to prevent stale transactions
  if (request.url.includes('/api/')) {
    return;
  }

  // HTML Navigation: Network first, fall back to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request);
          return cached || new Response('Offline: Money Flow is ready offline.', {
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // Next.js hashed static assets (/_next/static/...)
  if (request.url.includes('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Other static assets (images, fonts, manifest): Cache-first with background revalidation
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Push Notifications: Real-Time Transaction Categorization Prompts
self.addEventListener('push', (event) => {
  let data = {
    title: 'New Transaction Ingested',
    body: 'Tap to categorize your recent spend.',
    url: '/',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'transaction-prompt'
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (err) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'categorize', title: 'Categorize Now' },
      { action: 'dismiss', title: 'Later' }
    ],
    tag: data.tag || 'transaction-prompt',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click: Focus existing window or open new
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
