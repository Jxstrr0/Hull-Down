import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { DUEL, DUEL_GROUND_IDS } from '../src/data/duel'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { combatantOf } from '../src/sim/duel/duel'
import { DUEL_FINDING_KINDS, runCard } from '../src/sim/duel/series'
import {
  duelLines, duelResultWord, endText, findingText, fixText, groundText, opponentsFor, overallOf, roundName, seriesLines,
  seriesScore,
} from '../src/ui/duelWords'

const LIMITS = PACT_LIMITS_GEN1
const me = combatantOf(BASELINE_SPEC, LIMITS)
const opponents = opponentsFor(LIMITS, 101)
const cards = opponents.map((opponent) => ({ opponent, card: runCard(me, opponent.tank, 101) }))
const NAMES = ['Your tank', 'The other'] as const

describe('the opponents a design meets', () => {
  it('are three rivals and two threat tanks, each with a name and a line', () => {
    expect(opponents.map((each) => each.kind)).toEqual(['rival', 'rival', 'rival', 'threat', 'threat'])
    for (const opponent of opponents) {
      expect(opponent.name).not.toBe('')
      expect(opponent.line).not.toBe('')
    }
    expect(new Set(opponents.map((each) => each.id)).size).toBe(5)
  })

  it('are the same for the same project and differ between projects', () => {
    const again = opponentsFor(LIMITS, 101)
    const other = opponentsFor(LIMITS, 102)
    const specs = (list: typeof opponents): string => JSON.stringify(list.map((each) => each.tank.sheet.target.spec))
    expect(specs(again)).toBe(specs(opponents))
    expect(specs(other)).not.toBe(specs(opponents))
  })

  it('build the rivals to the limits given', () => {
    for (const opponent of opponents.filter((each) => each.kind === 'rival')) {
      expect(opponent.tank.sheet.massT).toBeLessThanOrEqual(LIMITS.maxMassT)
      expect(opponent.tank.sheet.issues).toEqual([])
    }
  })
})

describe('the words of a duel report', () => {
  it('has a sentence for every kind of finding, with nothing left unfilled', () => {
    for (const kind of DUEL_FINDING_KINDS) expect(STRINGS.duel.findings[kind]).not.toBe('')
    for (const { card } of cards) {
      for (const series of card) {
        for (const finding of series.findings) {
          const text = findingText(finding)
          expect(text).not.toMatch(/[{}]/)
          expect(text).toContain(String(finding.count))
          const fix = fixText(finding)
          if (finding.good) expect(fix).toBeNull()
          else expect(fix).toMatch(/^Fix: \S/)
          if (fix) expect(fix).not.toMatch(/[{}]|undefined/)
        }
      }
    }
  })

  it('names every ground', () => {
    for (const ground of DUEL_GROUND_IDS) {
      expect(groundText(ground).name).not.toBe('')
      expect(groundText(ground).line).not.toBe('')
    }
  })

  it('writes the score and adds the grounds up', () => {
    for (const { card } of cards) {
      for (const series of card) {
        expect(seriesScore(series)).toBe(`Won ${series.won} · Lost ${series.lost} · Drawn ${series.drawn}`)
      }
      const all = overallOf(card)
      expect(all.n).toBe(DUEL.runs * DUEL_GROUND_IDS.length)
      expect(all.won + all.lost + all.drawn).toBe(all.n)
      expect(all.text).toContain(`${all.won} won`)
      const V = STRINGS.duel.verdicts
      expect(all.verdict).toBe(all.won > all.lost ? V.ahead : all.lost > all.won ? V.behind : V.even)
    }
  })

  it('says how much shows over the ridge only where there is one', () => {
    const card = cards[0]!.card
    const linesOf = (ground: string): string => seriesLines(card.find((each) => each.ground === ground)!, NAMES).join(' ')
    expect(linesOf('meeting')).not.toMatch(/over the ridge|into the ridge/)
    expect(linesOf('defend')).toMatch(/of your tank shows over the ridge/)
    expect(linesOf('attack')).toMatch(/of the other tank shows over the ridge/)
    for (const series of card) for (const line of seriesLines(series, NAMES)) expect(line).not.toMatch(/[{}]|NaN|undefined/)
  })

  it('tells every duel from its first round to its end, in order', () => {
    for (const { card } of cards) {
      for (const series of card) {
        for (const duel of series.duels) {
          const lines = duelLines(duel, NAMES)
          expect(lines.length).toBeGreaterThanOrEqual(duel.shots.length + 1)
          for (let i = 1; i < lines.length; i++) expect(lines[i]!.atS).toBeGreaterThanOrEqual(lines[i - 1]!.atS)
          const last = lines[lines.length - 1]!
          expect(last.by).toBeNull()
          expect(last.text).toBe(endText(duel, NAMES))
          for (const line of lines) expect(line.text).not.toMatch(/[{}]|undefined|NaN/)
          if (duel.winner !== null) expect(last.text).toContain(NAMES[duel.winner === 0 ? 1 : 0])
          expect(['Won', 'Lost', 'Drawn']).toContain(duelResultWord(duel))
          expect(duelResultWord(duel)).toBe(duel.winner === 0 ? 'Won' : duel.winner === 1 ? 'Lost' : 'Drawn')
        }
      }
    }
  })

  it('names a round whoever fires it', () => {
    expect(roundName('sabot125')).toBe('125 mm sabot')
    expect(roundName('accord105Sabot')).toBe('Accord 105 mm sabot')
    for (const { card } of cards) {
      for (const shot of card.flatMap((series) => series.duels.flatMap((duel) => duel.shots))) {
        expect(roundName(shot.roundId)).not.toBe(shot.roundId)
      }
    }
  })

  it('says a low round struck the ridge only when the target was behind one', () => {
    const card = cards[0]!.card
    const texts = (ground: string, by: 0 | 1): string =>
      card.find((each) => each.ground === ground)!.duels.flatMap((duel) => duelLines(duel, NAMES).filter((line) => line.by === by)).map((line) => line.text).join(' ')
    expect(texts('meeting', 0)).not.toContain('Struck the ridge')
    expect(texts('attack', 0)).toContain('Struck the ridge')
    expect(texts('attack', 1)).not.toContain('Struck the ridge')
  })
})
