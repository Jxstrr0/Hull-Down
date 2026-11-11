import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SKIP_MESSAGE, installWay } from '../src/ui/offline'
import { ROOT, readRepoFile } from './helpers'

// Offline play (plan section 11): a service worker with caches starting
// `hulldown-` that deletes only its own. These tests run the real worker file
// against a pretend browser.

interface MakeSw {
  precacheList: (files: string[]) => string[]
  cacheName: (version: string, fingerprint: string) => string
  workerSource: (template: string, cache: string, files: string[]) => string
}

const SCRIPT = join(ROOT, 'scripts/make-sw.mjs')
const load = async (): Promise<MakeSw> => (await import(/* @vite-ignore */ SCRIPT)) as MakeSw

const ORIGIN = 'https://game.test'
const CACHE = 'hulldown-0.0.0.0-abc'
const FILES = ['./', 'assets/index-1.js', 'audio/gun.mp3']

interface FakeRequest {
  url: string
  method: string
  mode: string
}

type Listener = (event: Record<string, unknown>) => void

/** The worker, built and started in a pretend browser that already holds some caches. */
async function boot(existing: string[]) {
  const { workerSource } = await load()
  const source = workerSource(readRepoFile('scripts/sw.template.js'), CACHE, FILES)
  const stores = new Map<string, Map<string, string>>(existing.map((name) => [name, new Map()]))
  const listeners = new Map<string, Listener>()
  const fetched: string[] = []
  let skipped = 0
  const key = (request: FakeRequest | string): string =>
    new URL(typeof request === 'string' ? request : request.url, `${ORIGIN}/`).pathname

  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map())
      const store = stores.get(name)!
      return {
        addAll: async (requests: FakeRequest[]) => {
          for (const request of requests) store.set(key(request), `kept ${key(request)}`)
        },
        match: async (request: FakeRequest | string) => store.get(key(request)),
      }
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  }
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: () => {
      skipped += 1
    },
  }
  const fetch = async (request: FakeRequest) => {
    fetched.push(request.url)
    return `network ${request.url}`
  }
  class Request {
    url: string
    constructor(url: string) {
      this.url = new URL(url, `${ORIGIN}/`).href
    }
  }
  new Function('self', 'caches', 'fetch', 'Request', source)(self, caches, fetch, Request)

  /** Fire an event and wait for whatever the worker asked the browser to wait for. */
  const fire = async (type: string, extra: Record<string, unknown> = {}) => {
    let waited: Promise<unknown> | undefined
    let reply: Promise<unknown> | undefined
    listeners.get(type)?.({
      ...extra,
      waitUntil: (work: Promise<unknown>) => (waited = work),
      respondWith: (work: Promise<unknown>) => (reply = work),
    })
    await waited
    return reply === undefined ? undefined : await reply
  }
  const get = (path: string, mode = 'no-cors', method = 'GET') =>
    fire('fetch', { request: { url: new URL(path, `${ORIGIN}/`).href, method, mode } })

  return { stores, fetched, fire, get, skipped: () => skipped }
}

describe('service worker', () => {
  it('keeps every file of this version when it installs', async () => {
    const sw = await boot([])
    await sw.fire('install')
    expect([...sw.stores.get(CACHE)!.keys()]).toEqual(['/', '/assets/index-1.js', '/audio/gun.mp3'])
  })

  it('does not take over by itself: a new version waits', async () => {
    const sw = await boot([])
    await sw.fire('install')
    await sw.fire('activate')
    expect(sw.skipped()).toBe(0)
    await sw.fire('message', { data: 'something else' })
    expect(sw.skipped()).toBe(0)
    await sw.fire('message', { data: SKIP_MESSAGE })
    expect(sw.skipped()).toBe(1)
  })

  it('deletes only older Hull Down caches', async () => {
    const sw = await boot(['hulldown-0.0.0.0-old', 'lombard-v3', 'another-game', 'hull', CACHE])
    await sw.fire('activate')
    expect([...sw.stores.keys()].sort()).toEqual(['another-game', 'hull', CACHE, 'lombard-v3'])
  })

  it('answers from the cache without the network', async () => {
    const sw = await boot([])
    await sw.fire('install')
    expect(await sw.get('/audio/gun.mp3')).toBe('kept /audio/gun.mp3')
    expect(await sw.get('/assets/index-1.js?v=2')).toBe('kept /assets/index-1.js')
    expect(sw.fetched).toEqual([])
  })

  it('opens the page for any visit to the game', async () => {
    const sw = await boot([])
    await sw.fire('install')
    expect(await sw.get('/?from=home', 'navigate')).toBe('kept /')
  })

  it('goes to the network for a file it does not hold', async () => {
    const sw = await boot([])
    await sw.fire('install')
    expect(await sw.get('/assets/new-2.js')).toBe(`network ${ORIGIN}/assets/new-2.js`)
  })

  it('leaves other sites and anything but a plain read alone', async () => {
    const sw = await boot([])
    await sw.fire('install')
    expect(await sw.fire('fetch', { request: { url: 'https://elsewhere.test/a.js', method: 'GET', mode: 'cors' } })).toBeUndefined()
    expect(await sw.get('/audio/gun.mp3', 'cors', 'POST')).toBeUndefined()
  })
})

describe('service worker build', () => {
  it('lists what to keep: the page, and no build notes, old fonts or itself', async () => {
    const { precacheList } = await load()
    expect(
      precacheList(['index.html', 'sw.js', '.vite/manifest.json', 'assets/a.woff', 'assets/a.woff2', 'assets/index.js', 'audio/gun.mp3']),
    ).toEqual(['./', 'assets/a.woff2', 'assets/index.js', 'audio/gun.mp3'])
  })

  it('names its cache with the Hull Down prefix', async () => {
    const { cacheName } = await load()
    expect(cacheName('0.17.3.0', 'abcd1234')).toBe('hulldown-0.17.3.0-abcd1234')
  })

  it('fills in the template', async () => {
    const { workerSource } = await load()
    const source = workerSource(readRepoFile('scripts/sw.template.js'), CACHE, FILES)
    expect(source).toContain(`const CACHE = "${CACHE}"`)
    expect(source).toContain(`const FILES = ${JSON.stringify(FILES)}`)
    expect(source).not.toContain('__')
  })

  it('runs after every build', () => {
    const scripts = (JSON.parse(readRepoFile('package.json')) as { scripts: Record<string, string> }).scripts
    expect(scripts.postbuild).toContain('scripts/make-sw.mjs')
  })
})

describe('home screen', () => {
  const manifest = JSON.parse(readRepoFile('public/manifest.webmanifest')) as {
    name: string
    start_url: string
    scope: string
    display: string
    icons: { src: string; sizes: string; purpose: string }[]
  }

  it('has a manifest the page links to', () => {
    const page = readRepoFile('index.html')
    expect(page).toContain('rel="manifest" href="/manifest.webmanifest"')
    expect(page).toContain('rel="apple-touch-icon" href="/icons/apple-touch-icon.png"')
    expect(existsSync(join(ROOT, 'public/icons/apple-touch-icon.png'))).toBe(true)
  })

  it('opens the game on its own, from wherever it is hosted', () => {
    expect(manifest.name).toBe('Hull Down')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('./')
    expect(manifest.scope).toBe('./')
  })

  it('has the icons a phone asks for, and each is a real file', () => {
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
    for (const icon of manifest.icons) expect(existsSync(join(ROOT, 'public', icon.src))).toBe(true)
  })

  it('picks the way to add the game that the browser allows', () => {
    expect(installWay({ standalone: true, canPrompt: true, iphone: false })).toBe('installed')
    expect(installWay({ standalone: false, canPrompt: true, iphone: false })).toBe('prompt')
    expect(installWay({ standalone: false, canPrompt: false, iphone: true })).toBe('iphone')
    expect(installWay({ standalone: false, canPrompt: false, iphone: false })).toBe('menu')
  })
})
