import { describe, expect, it } from 'vitest'
import { STRINGS } from '../src/data/strings'
import { toggled } from '../src/ui/fold'
import { readRepoFile } from './helpers'

// Folding pages (Saves and the menu): rows that open one at a time, as on PEW's Build tab.

describe('folding rows', () => {
  it('opens the tapped row and shuts the one that was open', () => {
    expect(toggled({ open: null }, 'slots')).toBe('slots')
    expect(toggled({ open: 'design' }, 'slots')).toBe('slots')
  })

  it('shuts a row that is tapped while open', () => {
    expect(toggled({ open: 'slots' }, 'slots')).toBeNull()
  })

  it('draws only the open row', () => {
    const source = readRepoFile('src/ui/fold.ts')
    expect(source).toContain('if (open) {')
    expect(source).toContain('fold.draw()')
  })

  it('folds the menu, with Settings open first', () => {
    const menu = readRepoFile('src/ui/menu.ts')
    expect(menu).toContain('drawFolds(')
    expect(menu).toContain("const fold: FoldState = { open: 'settings' }")
  })

  it('has words for the shut rows', () => {
    expect(STRINGS.fold.flag).not.toBe('')
    expect(STRINGS.office.designs.thisDesign).not.toBe('')
    expect(STRINGS.saves.slots.summary).toContain('{n}')
    expect(STRINGS.saves.backup.due).not.toBe('')
    for (const text of Object.values(STRINGS.offline.short)) expect(text).not.toBe('')
  })
})
