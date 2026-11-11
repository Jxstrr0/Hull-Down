// First-load budget (plan section 11): everything the page needs before the
// title must stay under 3 MB. Code that is only fetched later (the 3D range,
// loaded when a trial is first watched) does not count. The build manifest
// says which is which. The proving ground's worker is small and is counted
// with the first load, though it too is fetched later. Runs after every build;
// a failure fails CI.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const LIMIT_BYTES = 3 * 1024 * 1024
const DIST = new URL('../dist/', import.meta.url).pathname
const MANIFEST = '.vite/manifest.json'

function filesIn(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...filesIn(path))
    else out.push(relative(DIST, path).split('\\').join('/'))
  }
  return out
}

const manifest = JSON.parse(readFileSync(join(DIST, MANIFEST), 'utf8'))

/** Every file a chunk brings with it, following the imports it needs straight away. */
function reach(keys) {
  const seen = new Set()
  const files = new Set()
  const walk = (key) => {
    if (seen.has(key)) return
    seen.add(key)
    const chunk = manifest[key]
    if (!chunk) return
    files.add(chunk.file)
    for (const file of [...(chunk.css ?? []), ...(chunk.assets ?? [])]) files.add(file)
    for (const next of chunk.imports ?? []) walk(next)
  }
  keys.forEach(walk)
  return { seen, files }
}

const keys = Object.keys(manifest)
const first = reach(keys.filter((key) => manifest[key].isEntry))
// Anything else the manifest knows about is fetched later, unless the first load already has it.
const later = [...reach(keys.filter((key) => !first.seen.has(key) && manifest[key].isDynamicEntry)).files]
  .filter((file) => !first.files.has(file))

const size = (file) => statSync(join(DIST, file)).size
const laterBytes = later.reduce((sum, file) => sum + size(file), 0)
// Files the manifest has never heard of (the page itself, icons, the logo) count as first load.
const firstBytes = filesIn(DIST)
  .filter((file) => file !== MANIFEST && !later.includes(file))
  .reduce((sum, file) => sum + size(file), 0)

const kb = (bytes) => (bytes / 1024).toFixed(0)
if (firstBytes > LIMIT_BYTES) {
  console.error(`First load is ${kb(firstBytes)} KB, over the ${LIMIT_BYTES / 1024} KB budget.`)
  process.exit(1)
}
console.log(`First load: ${kb(firstBytes)} KB of ${LIMIT_BYTES / 1024} KB. Fetched later: ${kb(laterBytes)} KB.`)
