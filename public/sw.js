/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

// Offline cache for the home-screen app, so a kiosk survives flaky conference
// Wi-Fi. Only registered in standalone display mode (see main.tsx). The build
// (precachePlugin in vite.config.ts) fills in the version and the full list of
// built files, so every model, video and chunk is cached on install — not just
// the ones a visitor happened to open. Each deploy changes the version, which
// installs a fresh cache and drops the old one.

const VERSION = '__PRECACHE_VERSION__'
/** Same-origin build output, plus cross-origin fonts. */
const PRECACHE = /* __PRECACHE_FILES__ */ []
const CACHE = `rack-explorer-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      await Promise.all(
        PRECACHE.map(async (url) => {
          const sameOrigin = new URL(url, self.location.href).origin === self.location.origin
          try {
            const res = await fetch(url, { cache: 'reload', mode: 'cors' })
            if (!res.ok) throw new Error(`${res.status} ${url}`)
            await cache.put(url, res)
          } catch (err) {
            // A missing build file means a broken offline copy: fail the install
            // and keep the previous worker. Fonts are optional — the fallback
            // stack still renders.
            if (sameOrigin) throw err
          }
        }),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('rack-explorer-') && key !== CACHE) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // SPA navigations (`/`, `/?tour=…`) all get the cached shell, which matches
  // the cached hashed chunks exactly.
  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, '/index.html'))
    return
  }

  if (!PRECACHE.includes(url.origin === self.location.origin ? url.pathname : url.href)) {
    return
  }
  event.respondWith(cacheFirst(request))
})

async function cacheFirst(request, key = request) {
  const cached = await caches.match(key, { cacheName: CACHE })
  if (!cached) return fetch(request)
  const range = request.headers.get('range')
  return range ? rangeResponse(cached, range) : cached
}

/** Safari fetches video in byte ranges and won't play a full 200 response, so
 *  slice the cached body into the 206 it asked for. */
async function rangeResponse(response, range) {
  const body = await response.arrayBuffer()
  const size = body.byteLength
  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  if (!match) return new Response(null, { status: 416 })
  let start
  let end
  if (match[1] === '') {
    // Suffix range: the last N bytes.
    start = Math.max(0, size - Number(match[2]))
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)
  }
  if (start > end || start >= size) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}` },
    })
  }
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  })
}
