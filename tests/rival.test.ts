import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { ZONES } from '../src/data/materials'
import { BUREAU_IDS, DESIGNER } from '../src/data/opponents'
import { TENDER_RULES, TENDERS } from '../src/data/tenders'
import { draftRival, reviseRival, LESSONS } from '../src/sim/ai/designer'
import { lessonsOf, rivalBid } from '../src/sim/career/rival'
import { scoreBid, trialBid } from '../src/sim/career/score'

const T = TENDERS.improvedType1
// The first tender holds the rivals to their first drawings, for the newcomer's sake. This is the same tender with the usual rule.
const OPEN = { ...T, rivalRevisions: TENDER_RULES.revisions }
const SEEDS = [101, 102, 103, 104, 105, 106, 107, 108]
// These run dozens of whole tenders; give a slow machine room.
const SLOW = 30_000

describe('what a trial teaches', () => {
  it('reads the Type 1 report as one lesson: the night shoot', () => {
    expect(lessonsOf(trialBid(BASELINE_SPEC, T, 101).range)).toEqual(['night'])
  })

  it('names each plate that failed, and nothing when all is passed', () => {
    const better = structuredClone(BASELINE_SPEC)
    better.fireControl.night = 'imageIntensifier'
    expect(lessonsOf(trialBid(better, T, 101).range)).toEqual([])
    const thin = structuredClone(BASELINE_SPEC)
    thin.armour.upperGlacis = thin.armour.upperGlacis.map((layer) => ({ ...layer, mm: 20 }))
    expect(lessonsOf(trialBid(thin, T, 101).range)).toContainEqual({ zone: 'upperGlacis' })
  })
})

describe('a bureau revising its tank', () => {
  const draft = draftRival('light', T.limits, 101)

  it('leaves the draft it was given alone', () => {
    const before = JSON.stringify(draft)
    reviseRival(draft, 'light', T.limits, [...LESSONS, { zone: 'upperGlacis' }])
    expect(JSON.stringify(draft)).toBe(before)
  })

  it('changes nothing when there is nothing to learn', () => {
    expect(reviseRival(draft, 'light', T.limits, [])).toBeNull()
  })

  it('fits the next better part for the test it failed', () => {
    const night = reviseRival(draft, 'light', T.limits, ['night'])
    expect(night).not.toBeNull()
    expect(night!.spec.fireControl.night).not.toBe(draft.spec.fireControl.night)
    const moving = reviseRival(draft, 'light', T.limits, ['onTheMove'])
    expect(JSON.stringify(moving!.spec.fireControl)).not.toBe(JSON.stringify(draft.spec.fireControl))
    const power = reviseRival(draft, 'light', T.limits, ['power'])
    expect(power!.spec.powerpack.engine).not.toBe(draft.spec.powerpack.engine)
    const trench = reviseRival(draft, 'light', T.limits, ['trench'])
    if (draft.spec.hull.size === 'light') expect(trench!.spec.hull.size).toBe('medium')
  })

  it('runs out of better parts in the end', () => {
    let now = draft
    let turns = 0
    for (; turns < 10; turns++) {
      const next = reviseRival(now, 'light', T.limits, ['night'])
      if (!next) break
      now = next
    }
    expect(turns).toBeLessThan(10)
    expect(now.spec.fireControl.night).toBe('imageIntensifier')
  })

  it('moves armour to a plate that let a round through, inside the same weight', () => {
    const next = reviseRival(draft, 'light', T.limits, [{ zone: 'hullSideFront' }])
    expect(next).not.toBeNull()
    expect(next!.pattern.hullSideFront).toBeCloseTo(draft.pattern.hullSideFront * DESIGNER.lessonArmour, 9)
    const mm = (spec: typeof draft.spec, zone: (typeof ZONES)[number]): number => spec.armour[zone].reduce((sum, layer) => sum + layer.mm, 0)
    expect(mm(next!.spec, 'hullSideFront')).toBeGreaterThan(mm(draft.spec, 'hullSideFront'))
    expect(trialBid(next!.spec, T, 101).sheet.massT).toBeLessThanOrEqual(T.limits.maxMassT)
    expect(trialBid(next!.spec, T, 101).sheet.issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })
})

describe('a rival bid', () => {
  it('is the same for the same bureau, tender and seed', () => {
    const a = rivalBid('heavy', T, 101)
    const b = rivalBid('heavy', T, 101)
    expect(JSON.stringify(a.bid.spec)).toBe(JSON.stringify(b.bid.spec))
    expect(a.score).toEqual(b.score)
    expect(a.revisions).toBe(b.revisions)
  })

  it('is legal, keeps to the rule on revisions and never does worse than the first draft', () => {
    let revised = 0
    for (const seed of SEEDS) {
      for (const bureau of BUREAU_IDS) {
        const entry = rivalBid(bureau, OPEN, seed)
        const first = scoreBid(trialBid(draftRival(bureau, T.limits, seed).spec, T, seed), T)
        expect(entry.score.legal).toBe(true)
        expect(entry.revisions).toBeLessThanOrEqual(TENDER_RULES.revisions)
        expect(entry.score.total).toBeGreaterThanOrEqual(first.total)
        if (entry.revisions > 0) {
          revised++
          expect(entry.score.total).toBeGreaterThan(first.total)
        } else {
          expect(entry.score.total).toBe(first.total)
        }
      }
    }
    expect(revised).toBeGreaterThan(SEEDS.length)
  }, SLOW)

  it('makes a tender a contest once the rivals may revise: the Type 1 as issued does not win it', () => {
    let wins = 0
    for (const seed of SEEDS) {
      const mine = scoreBid(trialBid(BASELINE_SPEC, T, seed), T).total
      const best = Math.max(...BUREAU_IDS.map((bureau) => rivalBid(bureau, OPEN, seed).score.total))
      if (mine > best) wins++
    }
    expect(wins).toBeLessThan(SEEDS.length / 2)
  }, SLOW)
})
