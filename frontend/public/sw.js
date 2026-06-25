const CACHE_NAME = 'meuresto-cache-v1'
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
]

// Install Service Worker and cache essential shells
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE)
    }).then(() => self.skipWaiting())
  )
})

// Activate Service Worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch strategy: Cache-First for assets, Network-First for API/HTML
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url)

  // Skip non-GET requests or browser extension requests
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return
  }

  // API calls or documents: Network First, fallback to cache
  if (requestUrl.pathname.startsWith('/api') || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone the response to store it in cache
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone)
          })
          return response
        })
        .catch(() => {
          // If network fails, return from cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
            }
            // Fallback for document navigation if offline
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html')
            }
          })
        })
    )
  } else {
    // Static assets (JS, CSS, images): Cache First, fallback to network
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }
        return fetch(event.request).then((response) => {
          // Only cache successful requests
          if (response.status === 200) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone)
            })
          }
          return response
        })
      })
    )
  }
})
