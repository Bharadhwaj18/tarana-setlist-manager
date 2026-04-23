const CACHE_NAME = 'tarana-offline-v1'
const OFFLINE_PAGE = '/offline.html'

self.addEventListener('install', event => {
  // Pre-cache the offline hub page so it works immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.add(OFFLINE_PAGE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => event.waitUntil(clients.claim()))

self.addEventListener('message', event => {
  const data = event.data
  if (!data) return

  if (data.type === 'CACHE_SETLIST') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        const res = new Response(data.html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
        return cache.put(data.url, res)
      })
    )
  }

  if (data.type === 'REMOVE_SETLIST') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => cache.delete(data.url))
    )
  }
})

self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return

  const url = new URL(event.request.url)

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE_NAME)

      // For a specific setlist page, try the pre-cached setlist HTML first
      if (/^\/setlists\/[^/]+$/.test(url.pathname)) {
        const cached = await cache.match(event.request.url)
        if (cached) return cached
      }

      // For everything else (setlists list, songs, login, home), serve offline hub
      // The URL stays the same — offline.html reads window.location.pathname
      const offlinePage = await cache.match(OFFLINE_PAGE)
      return offlinePage || new Response('Offline', { status: 503 })
    })
  )
})
