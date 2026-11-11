// Prints the release notes for one version: its entry in the log of
// docs/STATUS.md. `publish-release.yml` runs it for the version in VERSION.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FOUR_NUMBERS = /^\d+\.\d+\.\d+\.\d+$/

/** The tag a version is released under. */
export function releaseTag(version) {
  if (!FOUR_NUMBERS.test(version)) throw new Error(`"${version}" is not four numbers.`)
  return `v${version}`
}

/** The log entry for a version, without its leading dash. Null when the log has none. */
export function releaseNotes(status, version) {
  const log = status.split(/^## Log$/m)[1]
  if (log === undefined) return null
  const lines = log.split('\n')
  const start = lines.findIndex((line) => line.startsWith(`- **${version},`) || line.startsWith(`- **${version}:`))
  if (start < 0) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith('- ') || line.startsWith('## '))
  const entry = [lines[start].slice(2), ...(end < 0 ? rest : rest.slice(0, end)).map((line) => line.trim())]
  return entry.join('\n').trim()
}

function main() {
  const version = (process.argv[2] ?? readFileSync(new URL('../VERSION', import.meta.url), 'utf8')).trim()
  releaseTag(version)
  const status = readFileSync(new URL('../docs/STATUS.md', import.meta.url), 'utf8')
  const notes = releaseNotes(status, version)
  if (notes === null) throw new Error(`docs/STATUS.md has no log line for ${version}.`)
  console.log(`${notes}\n\nPlay it: https://hulldown.longlight.games/`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
