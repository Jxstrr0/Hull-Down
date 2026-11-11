import { describe, expect, it } from 'vitest'
import { dropCareer, loadCareer, saveCareer } from '../src/persist/careerStore'
import { newCareer } from '../src/sim/career/career'
import { savedWhen, slotLine } from '../src/ui/saveWords'

describe('what the slot list says', () => {
  const at = '2026-11-11T14:20:00.000Z'

  it('gives the day and the time', () => {
    const when = savedWhen(at, 'en-GB')
    expect(when).toContain('2026')
    expect(when).toContain('Nov')
    expect(savedWhen('not a date')).toBe('')
  })

  it('says how the tender stands', () => {
    const base = { slot: 1, savedAt: at, designs: 3 }
    expect(slotLine({ ...base, year: 1981, won: null }, 'en-GB')).toContain('tender of 1981, open')
    expect(slotLine({ ...base, year: 1981, won: true }, 'en-GB')).toContain('tender of 1981, won')
    expect(slotLine({ ...base, year: 1981, won: false }, 'en-GB')).toContain('tender of 1981, lost')
    expect(slotLine({ ...base, year: null, won: null }, 'en-GB')).toContain('no career')
  })

  it('counts the designs', () => {
    const base = { slot: 1, savedAt: at, year: null, won: null }
    expect(slotLine({ ...base, designs: 1 }, 'en-GB')).toContain('1 design')
    expect(slotLine({ ...base, designs: 1 }, 'en-GB')).not.toContain('1 designs')
    expect(slotLine({ ...base, designs: 4 }, 'en-GB')).toContain('4 designs')
  })
})

describe('forgetting the career', () => {
  it('leaves none behind', () => {
    const map = new Map<string, string>()
    const storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key),
    }
    saveCareer(storage, newCareer(3))
    expect(dropCareer(storage)).toBe(true)
    expect(loadCareer(storage)).toBeNull()
  })

  it('says so when the browser will not', () => {
    const blocked = { getItem: () => null, setItem: () => undefined, removeItem: (): void => { throw new Error('blocked') } }
    expect(dropCareer(blocked)).toBe(false)
  })
})
