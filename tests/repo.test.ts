import { describe, expect, it } from 'vitest'
import { listFilesDeep, readRepoFile } from './helpers'

describe('version', () => {
  it('is four numbers', () => {
    expect(readRepoFile('VERSION').trim()).toMatch(/^\d+\.\d+\.\d+\.\d+$/)
  })
})

describe('credits', () => {
  const credits = readRepoFile('CREDITS.md')

  it('lists every shipped or third-party asset file', () => {
    const files = [...listFilesDeep('public'), ...listFilesDeep('art/third-party'), ...listFilesDeep('src/assets')].filter(
      (f) => !f.endsWith('.gitkeep'),
    )
    expect(files.filter((f) => !credits.includes(f))).toEqual([])
  })

  it('lists every runtime package', () => {
    const pkg = JSON.parse(readRepoFile('package.json')) as { dependencies?: Record<string, string> }
    const missing = Object.keys(pkg.dependencies ?? {}).filter((name) => !credits.includes(name))
    expect(missing).toEqual([])
  })
})

describe('names', () => {
  // The public repo uses the name Kelbo only (plan section 1, rule 5).
  it('keeps the studio credit line', () => {
    expect(readRepoFile('index.html')).toContain('2026 Kelbo / Longlight Interactive')
  })
})
