import { describe, expect, it } from 'vitest'
import { OFFICE } from '../src/data/office'
import { STRINGS } from '../src/data/strings'
import { readRepoFile } from './helpers'

describe('the build screen layout', () => {
  it('folds the drawing after a short scroll, not at the first touch', () => {
    expect(OFFICE.foldAfterPx).toBeGreaterThan(0)
    expect(OFFICE.foldAfterPx).toBeLessThan(200)
  })

  it('has words for the button that brings the drawing back', () => {
    for (const [key, text] of Object.entries(STRINGS.office.fold)) expect(text, key).not.toBe('')
  })

  it('folds only upright: held sideways the drawing keeps its own column', () => {
    const css = readRepoFile('src/style.css')
    expect(css).toContain('@media not all and (orientation: landscape) and (min-width: 640px)')
    expect(css).toContain('.office-folded .bp')
    expect(readRepoFile('src/office/designScreen.ts')).toContain("'office-folded'")
  })

  it('keeps option notes to the fitted option, and to switches', () => {
    const source = readRepoFile('src/office/designScreen.ts')
    expect(source).toContain('withNote = on')
    expect(source).toContain("optionButton(control.id, on, control.text, change, true)")
  })
})

describe('the part rows', () => {
  it('has words for a row and its fault mark', () => {
    for (const [key, text] of Object.entries(STRINGS.office.row)) expect(text, key).not.toBe('')
    expect(STRINGS.office.row.label).toContain('{now}')
    expect(STRINGS.office.row.faultLabel).toContain('{now}')
  })

  it('opens one row at a time, and a jump to a part opens its row', () => {
    const source = readRepoFile('src/office/designScreen.ts')
    expect(source).toContain('openControl = open ? undefined : key')
    expect(source).toContain('openControl = target.id')
  })

  it('folds the readouts under the parts too', () => {
    const source = readRepoFile('src/office/designScreen.ts')
    for (const key of ['read:ammo', 'read:gunnery', 'read:stations']) expect(source, key).toContain(`'${key}'`)
  })

  it('keeps every row a full tap target', () => {
    const css = readRepoFile('src/style.css')
    expect(css).toMatch(/\.ctl-head \{[^}]*min-height: 48px/)
  })
})
