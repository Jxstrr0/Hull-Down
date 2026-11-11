import { describe, expect, it } from 'vitest'
import { STRINGS } from '../src/data/strings'
import { holdAll, onHold } from '../src/ui/hold'
import { readRepoFile } from './helpers'

describe('the page menu', () => {
  it('holds everything that asked to be held, and stops once let go', () => {
    let a = 0
    let b = 0
    const stopA = onHold(() => { a += 1 })
    const stopB = onHold(() => { b += 1 })
    holdAll()
    expect([a, b]).toEqual([1, 1])
    stopA()
    holdAll()
    expect([a, b]).toEqual([1, 2])
    stopB()
    holdAll()
    expect([a, b]).toEqual([1, 2])
  })

  it('has words for everything it shows', () => {
    for (const [key, text] of Object.entries(STRINGS.menu)) expect(text, key).not.toBe('')
  })

  it('holds a trial run and a battle while it is open', () => {
    for (const file of ['src/ui/rangeScreen.ts', 'src/ui/battleWatch.ts']) {
      const source = readRepoFile(file)
      expect(source, file).toContain('onHold(')
      expect(source, file).toContain('unhold()')
    }
    expect(readRepoFile('src/ui/menu.ts')).toContain('holdAll()')
  })

  it('moves sound and look into the menu, leaving the bar with the menu button', () => {
    const main = readRepoFile('src/main.ts')
    expect(main).toContain('createMenu(')
    expect(main).not.toContain('switchSound')
    expect(main).not.toContain('otherTheme')
  })
})
