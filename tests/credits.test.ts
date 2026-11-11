import { describe, expect, it } from 'vitest'
import { CREDIT_GROUPS, CREDITS } from '../src/data/credits'
import { creditLine } from '../src/ui/credits'
import { listFilesDeep, readRepoFile } from './helpers'

// The in-game credits (plan section 13.0): everything shipped that somebody
// else made is shown to the player, and matches the record in CREDITS.md.

const all = CREDIT_GROUPS.flatMap((group) => CREDITS[group])

describe('in-game credits', () => {
  const record = readRepoFile('CREDITS.md')

  it('show every runtime package', () => {
    const pkg = JSON.parse(readRepoFile('package.json')) as { dependencies?: Record<string, string> }
    const shown = new Set(all.map((credit) => credit.id))
    expect(Object.keys(pkg.dependencies ?? {}).filter((name) => !shown.has(name))).toEqual([])
  })

  it('show every sound the game plays', () => {
    const shown = new Set(all.map((credit) => credit.id))
    expect(listFilesDeep('public/audio').filter((file) => !shown.has(file))).toEqual([])
  })

  it('agree with CREDITS.md, line for line', () => {
    for (const credit of all) {
      const row = record.split('\n').find((line) => line.startsWith(`| \`${credit.id}\``))
      expect(row, credit.id).toBeDefined()
      expect(row, credit.id).toContain(credit.by)
      expect(row, credit.id).toContain(credit.licence)
      expect(row, credit.id).toContain(credit.source)
    }
  })

  it('name the maker and the licence on each line', () => {
    expect(creditLine(CREDITS.sounds[0]!)).toBe('Cannon fire, by Thimras. CC0 1.0.')
    for (const credit of all) expect(credit.source.startsWith('https://')).toBe(true)
  })

  it('list nothing twice', () => {
    expect(new Set(all.map((credit) => credit.id)).size).toBe(all.length)
  })
})
