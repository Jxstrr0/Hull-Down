// First-load budget (plan section 11): everything the page needs before the
// title must stay under 3 MB. Until trials add lazy 3D chunks, that is the
// whole of dist/. Runs after every build; a failure fails CI.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LIMIT_BYTES = 3 * 1024 * 1024
const DIST = new URL('../dist/', import.meta.url).pathname

function sizeOf(dir) {
  let total = 0
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    total += stat.isDirectory() ? sizeOf(path) : stat.size
  }
  return total
}

const total = sizeOf(DIST)
const kb = (total / 1024).toFixed(0)
if (total > LIMIT_BYTES) {
  console.error(`First load is ${kb} KB, over the ${LIMIT_BYTES / 1024} KB budget.`)
  process.exit(1)
}
console.log(`First load: ${kb} KB of ${LIMIT_BYTES / 1024} KB.`)
