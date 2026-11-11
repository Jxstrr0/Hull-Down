import { describe, expect, it } from 'vitest'
import { fill } from '../src/data/strings'
import { THEME_KEY, otherTheme, parseTheme } from '../src/ui/theme'

describe('theme', () => {
  it('defaults to paper and only accepts known looks', () => {
    expect(parseTheme(null)).toBe('paper')
    expect(parseTheme('nonsense')).toBe('paper')
    expect(parseTheme('blueprint')).toBe('blueprint')
  })

  it('toggles between the two looks', () => {
    expect(otherTheme('paper')).toBe('blueprint')
    expect(otherTheme('blueprint')).toBe('paper')
  })

  it('keeps its storage key on the hulldown prefix', () => {
    expect(THEME_KEY.startsWith('hulldown.')).toBe(true)
  })
})

describe('fill', () => {
  it('fills slots and leaves unknown ones alone', () => {
    expect(fill('Switch to {name}', { name: 'Paper' })).toBe('Switch to Paper')
    expect(fill('{missing}', {})).toBe('{missing}')
  })
})
