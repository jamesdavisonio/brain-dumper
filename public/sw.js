const CACHE_NAME = 'brain-dump-v2'
const urlsToCache = [
  '/',
  '/index.html',
  '/icon-transparent.svg',
  '/manifest.json'
]

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache).catch(() => {
        // Ignore cache errors during development
        console.log('Cache initialization skipped (likely in dev mode)')
      }))
      .then(() => self.skipWaiting())
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch event - network first, fall back to cache for navigation requests only
self.addEventListener('fetch', (event) => {
  // Only handle navigation requests and same-origin requests
  if (event.request.mode === 'navigate' || (event.request.url.startsWith(self.location.origin))) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
        .then(response => response || fetch(event.request))
    )
  }
})
