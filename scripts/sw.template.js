// Hull Down service worker (plan section 11, Offline): the game opens with no
// signal. scripts/make-sw.mjs fills in the two marked values after each build
// and writes the result to dist/sw.js.
//
// - Install: download every file of this version into its own cache.
// - A new version waits. It takes over only when the game is next opened
//   (src/ui/offline.ts sends the message below), never in the middle of a visit.
// - Activate: delete older Hull Down caches. Only names starting `hulldown-`
//   are ever touched; other games on the same site keep theirs.
// - Fetch: answer from the cache first, and from the network for anything else.
const PREFIX = 'hulldown-'
const CACHE = '__CACHE__'
const FILES = ['__FILES__']
const PAGE = './'
const SKIP = 'hulldown-skip-waiting'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' })))),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name.startsWith(PREFIX) && name !== CACHE).map((name) => caches.delete(name))),
      ),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === SKIP) self.skipWaiting()
})

async function answer(request) {
  const cache = await caches.open(CACHE)
  // The cache is keyed by address alone: a query string or a server's Vary header must not cause a miss.
  const kept = await cache.match(request.mode === 'navigate' ? PAGE : request, { ignoreSearch: true, ignoreVary: true })
  return kept ?? fetch(request)
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return
  event.respondWith(answer(request))
})
