// Network-First Service Worker for BGMI Strategy Board
const CACHE_NAME = 'bgmi-strategy-v3-fresh'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key)
        })
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const resClone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone))
        }
        return res
      })
      .catch(() => caches.match(e.request))
  )
})

