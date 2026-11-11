import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT, readRepoFile } from './helpers'

// Releases (plan PR 18): every version bump on main becomes a GitHub Release
// with that version's line from the status log as its notes.

interface ReleaseNotes {
  releaseTag: (version: string) => string
  releaseNotes: (status: string, version: string) => string | null
}

const SCRIPT = join(ROOT, 'scripts/release-notes.mjs')
const load = async (): Promise<ReleaseNotes> => (await import(/* @vite-ignore */ SCRIPT)) as ReleaseNotes

const STATUS = [
  '# Status',
  '',
  '## Waiting on Kelbo',
  '',
  '- **Thing (0.2.0.0).** Not a log line.',
  '',
  '## Log',
  '',
  '- **0.2.0.0, PR 2: second.** Two lines',
  '  of words.',
  '- **0.1.0.0, PR 1: first.** One line.',
  '',
].join('\n')

describe('release notes', () => {
  it('are the log entry for the version, whole', async () => {
    const { releaseNotes } = await load()
    expect(releaseNotes(STATUS, '0.2.0.0')).toBe('**0.2.0.0, PR 2: second.** Two lines\nof words.')
    expect(releaseNotes(STATUS, '0.1.0.0')).toBe('**0.1.0.0, PR 1: first.** One line.')
  })

  it('are missing for a version the log does not have', async () => {
    const { releaseNotes } = await load()
    expect(releaseNotes(STATUS, '0.3.0.0')).toBeNull()
    expect(releaseNotes('# No log here', '0.1.0.0')).toBeNull()
  })

  it('exist for the version in VERSION', async () => {
    const { releaseNotes } = await load()
    const version = readRepoFile('VERSION').trim()
    expect(releaseNotes(readRepoFile('docs/STATUS.md'), version), `docs/STATUS.md needs a log line for ${version}`).not.toBeNull()
  })

  it('are tagged with a v and four numbers', async () => {
    const { releaseTag } = await load()
    expect(releaseTag('1.0.0.0')).toBe('v1.0.0.0')
    expect(() => releaseTag('1.0.0')).toThrow()
    expect(() => releaseTag('v1.0.0.0')).toThrow()
  })
})

describe('publish-release workflow', () => {
  const workflow = readRepoFile('.github/workflows/publish-release.yml')

  it('runs when the version changes on main, and only there', () => {
    expect(workflow).toContain('branches: [main]')
    expect(workflow).toContain('paths: [VERSION]')
    expect(workflow).not.toContain('pull_request')
  })

  it('may write releases and nothing more', () => {
    expect(workflow.match(/^permissions:\n((?: {2}.*\n)+)/m)?.[1]).toBe('  contents: write\n')
  })

  it('never publishes a version twice', () => {
    expect(workflow.indexOf('gh release view')).toBeGreaterThan(-1)
    expect(workflow.indexOf('gh release view')).toBeLessThan(workflow.indexOf('gh release create'))
    expect(workflow).toContain('scripts/release-notes.mjs')
  })
})
