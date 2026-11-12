// The rival bureaus asked for an anti-aircraft gun vehicle: each builds one its own way, and learns from the air defence trial.
import { describe, expect, it } from 'vitest'
import { BUREAUS, BUREAU_IDS, DESIGNER } from '../src/data/opponents'
import { TENDERS } from '../src/data/tenders'
import { TUNING } from '../src/data/tuning'
import { designRival, draftRival, reviseRival } from '../src/sim/ai/designer'
import { lessonsOf, rivalBid } from '../src/sim/career/rival'
import { trialBid } from '../src/sim/career/score'
import type { RangeReport } from '../src/sim/trials'
import { buildStatSheet } from '../src/sim/vehicle'

const SLOW = 60_000
const T = TENDERS.aa2012
const SEEDS = [1, 5, 9]

/** A report whose air defence trial failed, with or without the radar, and with or without the belts running dry. */
function failedAir(report: RangeReport, radar: boolean, ranOut = false): RangeReport {
  return { ...report, air: { ...report.air!, radar, ranOut, downedPassed: false, passed: false } }
}

describe('the rival bureaus asked for an anti-aircraft gun vehicle', () => {
  it('each draw up a legal one on its own tracks or wheels: the twin cannon, nobody in the back and no tiles', () => {
    for (const seed of SEEDS) {
      for (const bureau of BUREAU_IDS) {
        const spec = designRival(bureau, T.limits, seed)
        const sheet = buildStatSheet(spec, T.limits)
        const label = `${bureau} ${seed}`
        expect(sheet.issues.filter((issue) => issue.severity === 'error'), label).toEqual([])
        expect(spec.gun, label).toBe('twin35')
        expect(spec.runningGear.layout, label).toBe(BUREAUS[bureau].aa.layout)
        expect(spec.hull.size, label).toBe(BUREAUS[bureau].aa.hull)
        expect(spec.fireControl.searchRadar, label).toBe(BUREAUS[bureau].aa.searchRadar)
        expect(spec.ammo.rounds, label).toBeLessThanOrEqual(TUNING.limits.rounds.max)
        expect(spec.crew.troops, label).toBe(0)
        expect(Object.values(spec.era).every((tiles) => tiles === 0), label).toBe(true)
        expect(sheet.rollup.totalMassT, label).toBeLessThanOrEqual(T.limits.maxMassT)
      }
    }
  })

  it('build them their own ways: the heavy bureau on tracks and heaviest, the light one cheapest and without the radar at first', () => {
    const heavy = designRival('heavy', T.limits, 1)
    const light = designRival('light', T.limits, 1)
    const firepower = designRival('firepower', T.limits, 1)
    const sheet = (spec: typeof heavy) => buildStatSheet(spec, T.limits)
    expect(heavy.runningGear.layout).toBe('tracks')
    expect(light.runningGear.layout).not.toBe('tracks')
    expect(sheet(heavy).rollup.totalMassT).toBeGreaterThan(sheet(light).rollup.totalMassT)
    expect(sheet(light).unitCostKr).toBeLessThan(sheet(heavy).unitCostKr)
    expect(sheet(light).unitCostKr).toBeLessThan(sheet(firepower).unitCostKr)
    expect(light.fireControl.searchRadar).toBe(false)
    expect(firepower.fireControl.computer).toBe('digital')
  })

  it('put in legal bids that fire at the raiders, every one with the radar by the end', () => {
    for (const bureau of BUREAU_IDS) {
      const rival = rivalBid(bureau, T, 5)
      expect(rival.score.legal, bureau).toBe(true)
      expect(rival.bid.spec.gun, bureau).toBe('twin35')
      expect(rival.bid.spec.fireControl.searchRadar, bureau).toBe(true)
      expect(rival.bid.range.air?.reactionS, bureau).not.toBeNull()
      expect(rival.bid.range.air!.downed, bureau).toBeGreaterThanOrEqual(T.marks.air!.downed)
    }
  }, SLOW)

  it('learn the radar from raiders found too late by eye, and a better computer once it is fitted', () => {
    const range = trialBid(designRival('light', T.limits, 1), T, 1).range
    expect(lessonsOf(failedAir(range, false))).toContain('radar')
    expect(lessonsOf(failedAir(range, false))).not.toContain('fireData')
    expect(lessonsOf(failedAir(range, true))).toContain('fireData')
    expect(lessonsOf(failedAir(range, true))).not.toContain('radar')
    expect(lessonsOf(failedAir(range, true, true))).toContain('belts')
    // None of the tank shoots' lessons.
    for (const lesson of ['night', 'onTheMove', 'halted', 'drill'] as const) expect(lessonsOf(failedAir(range, true, true))).not.toContain(lesson)
  })

  it('fits the radar first, then a better computer; and more rounds for belts that ran dry, up to what the office allows', () => {
    const draft = draftRival('light', T.limits, 1)
    expect(draft.spec.fireControl.searchRadar).toBe(false)
    const once = reviseRival(draft, 'light', T.limits, ['radar'])!
    expect(once.spec.fireControl.searchRadar).toBe(true)
    expect(once.spec.fireControl.computer).toBe(draft.spec.fireControl.computer)
    const twice = reviseRival(once, 'light', T.limits, ['radar'])!
    expect(twice.spec.fireControl.computer).not.toBe(once.spec.fireControl.computer)
    const fuller = reviseRival(draft, 'light', T.limits, ['belts'])!
    expect(fuller.spec.ammo.rounds).toBe(Math.min(TUNING.limits.rounds.max, draft.spec.ammo.rounds + DESIGNER.lessonRounds))
    const full = { ...draft, spec: { ...draft.spec, ammo: { ...draft.spec.ammo, rounds: TUNING.limits.rounds.max } } }
    expect(reviseRival(full, 'light', T.limits, ['belts'])).toBeNull()
  })

  it('answers the mud with more wheels on this tender too', () => {
    const range = trialBid(designRival('light', T.limits, 1), T, 1).range
    const bogged: RangeReport = { ...range, obstacles: { ...range.obstacles, results: range.obstacles.results.map((result) => result.id === 'mud' ? { ...result, passed: false } : result) } }
    expect(lessonsOf(bogged)).toContain('mud')
  })
})
