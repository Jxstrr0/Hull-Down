// Writes dist/sw.js after a build: the service worker template with this
// build's file list and cache name filled in. The cache name carries the
// version and a fingerprint of every file, so any change makes a new cache.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const PREFIX = 'hulldown-'
const WORKER = 'sw.js'

/** What the worker keeps: the page as `./`, and every file but build notes, old-format fonts and itself. */
export function precacheList(files) {
  return files
    .filter((file) => !file.startsWith('.vite/') && file !== WORKER && !file.endsWith('.woff'))
    .map((file) => (file === 'index.html' ? './' : file))
    .sort()
}

export function cacheName(version, fingerprint) {
  return `${PREFIX}${version}-${fingerprint}`
}

export function workerSource(template, cache, files) {
  return template.replace("'__CACHE__'", JSON.stringify(cache)).replace("['__FILES__']", JSON.stringify(files))
}

function filesIn(root, dir = root) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...filesIn(root, path))
    else out.push(relative(root, path).split('\\').join('/'))
  }
  return out
}

function main() {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url))
  const version = readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim()
  const template = readFileSync(new URL('./sw.template.js', import.meta.url), 'utf8')
  const files = precacheList(filesIn(dist))
  const hash = createHash('sha256')
  // The worker's own code counts too: a change to it is a new version.
  hash.update(template)
  for (const file of files) {
    hash.update(file)
    hash.update(readFileSync(join(dist, file === './' ? 'index.html' : file)))
  }
  const cache = cacheName(version, hash.digest('hex').slice(0, 8))
  writeFileSync(join(dist, WORKER), workerSource(template, cache, files))
  console.log(`Service worker: ${files.length} files in cache ${cache}.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
