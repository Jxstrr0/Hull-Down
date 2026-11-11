import { describe, expect, it } from 'vitest'
import { STRINGS } from '../src/data/strings'
import { DAILY_KEY, loadDaily, parseDaily, saveDaily, type DailyState } from '../src/persist/dailyStore'
import { WISH_IDS } from '../src/data/daily'
import { dailyChallenge, dayNumber } from '../src/sim/career/daily'
import { bestLine, briefLine, dateLine, resultLine, shareText, triesWords, weightsLine } from '../src/ui/dailyWords'

const DAY = dayNumber({ year: 2026, month: 11, day: 11 })

function memory(): { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem: (key: string) => void } {
  const kept = new Map<string, string>()
  return { getItem: (key) => kept.get(key) ?? null, setItem: (key, value) => void kept.set(key, value), removeItem: (key) => void kept.delete(key) }
}

describe('the challenge kept on this device', () => {
  const state: DailyState = { on: true, day: DAY, tries: 3, best: { place: 2, of: 4, total: 57.25, legal: true } }

  it('uses a Hull Down key', () => {
    expect(DAILY_KEY.startsWith('hulldown.')).toBe(true)
  })

  it('comes back as it was saved, on the same day', () => {
    const storage = memory()
    expect(saveDaily(storage, state)).toBe(true)
    expect(loadDaily(storage, DAY)).toEqual(state)
  })

  it('starts a clean sheet on a new day, but stays switched on', () => {
    const storage = memory()
    saveDaily(storage, state)
    expect(loadDaily(storage, DAY + 1)).toEqual({ on: true, day: DAY + 1, tries: 0, best: null })
  })

  it('reads nonsense as a clean sheet', () => {
    const clean = { on: false, day: DAY, tries: 0, best: null }
    for (const stored of [null, '', 'on', '[]', '{"day":"x"}', '7']) expect(parseDaily(stored, DAY)).toEqual(clean)
    expect(parseDaily(JSON.stringify({ ...state, tries: -1 }), DAY)).toEqual({ ...clean, on: true })
    expect(parseDaily(JSON.stringify({ ...state, best: { place: 5, of: 4, total: 1, legal: true } }), DAY).best).toBeNull()
    expect(parseDaily(JSON.stringify({ ...state, best: { place: 1, of: 4, total: 'lots', legal: true } }), DAY).best).toBeNull()
  })

  it('never throws when storage is blocked', () => {
    const blocked = {
      getItem: (): string | null => { throw new Error('blocked') },
      setItem: (): void => { throw new Error('blocked') },
      removeItem: (): void => undefined,
    }
    expect(loadDaily(blocked, DAY)).toEqual({ on: false, day: DAY, tries: 0, best: null })
    expect(saveDaily(blocked, state)).toBe(false)
  })
})

describe('words for the challenge', () => {
  const challenge = dailyChallenge(DAY)

  it('names the date', () => {
    expect(dateLine(DAY)).toBe('11 November 2026')
    expect(dateLine(dayNumber({ year: 2027, month: 1, day: 1 }))).toBe('1 January 2027')
    expect(STRINGS.daily.months).toHaveLength(12)
  })

  it('states the brief with the day\'s own numbers', () => {
    const line = briefLine(challenge)
    expect(line).toContain(String(challenge.tender.year))
    expect(line).toContain(`${challenge.tender.limits.maxMassT} t`)
    expect(line).not.toContain('{')
    expect(weightsLine(challenge)).toContain(`cost ${challenge.tender.weights.cost}`)
  })

  it('has a sentence for everything the army can want', () => {
    for (const wish of WISH_IDS) expect(STRINGS.daily.wishes[wish].length).toBeGreaterThan(10)
  })

  it('counts tries in plain words', () => {
    expect(triesWords(1)).toBe('1 try')
    expect(triesWords(4)).toBe('4 tries')
  })

  it('says how a try came out', () => {
    expect(resultLine({ place: 2, of: 4, total: 57.25, legal: true })).toBe('Placed 2 of 4 with 57.3 marks.')
    expect(resultLine({ place: 4, of: 4, total: 60, legal: false })).toBe(STRINGS.daily.thrownOut)
    expect(bestLine(null, 0)).toBe(STRINGS.daily.noBest)
    expect(bestLine({ place: 1, of: 4, total: 61, legal: true }, 2)).toBe('Best today, after 2 tries: Placed 1 of 4 with 61.0 marks.')
  })

  it('makes a short text to share, with no name in it', () => {
    const text = shareText(challenge, { place: 2, of: 4, total: 57.25, legal: true }, 3)
    const lines = text.split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe('Hull Down challenge, 11 November 2026')
    expect(lines[1]).toContain(STRINGS.daily.wishes[challenge.wish])
    expect(lines[2]).toBe('Placed 2 of 4 with 57.3 marks. (3 tries)')
    expect(lines[3]).toBe('https://hulldown.longlight.games/')
    expect(text).not.toContain('{')
  })
})
