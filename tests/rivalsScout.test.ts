// The rival bureaus asked for a scout car: each builds a car on wheels its own way, and learns from spot and report.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BUREAUS, BUREAU_IDS } from '../src/data/opponents'
import { TENDER_IDS, TENDERS } from '../src/data/tenders'
import { designRival, draftRival, reviseRival, wantsScout } from '../src/sim/ai/designer'
import { lessonsOf, rivalBid } from '../src/sim/career/rival'
import { trialBid } from '../src/sim/career/score'
import type { RangeReport } from '../src/sim/trials'
import { buildStatSheet } from '../src/sim/vehicle'

const SLOW = 60_000
const T = TENDERS.scout2004
const SEEDS = [1, 5, 9]

describe('the rival bureaus asked for a scout car', () => {
  it('know only the tender of 2004 wants one', () => {
    for (const id of TENDER_IDS) expect(wantsScout(TENDERS[id].limits), id).toBe(id === 'scout2004')
  })

  it('each draw up a legal car on its own wheels: the cannon, nobody in the back and no tiles', () => {
    for (const seed of SEEDS) {
      for (const bureau of BUREAU_IDS) {
        const spec = designRival(bureau, T.limits, seed)
        const sheet = buildStatSheet(spec, T.limits)
        const label = `${bureau} ${seed}`
        expect(sheet.issues.filter((issue) => issue.severity === 'error'), label).toEqual([])
        expect(spec.gun, label).toBe('autocannon30')
        expect(spec.runningGear.layout, label).toBe(BUREAUS[bureau].scout.layout)
        expect(spec.hull.size, label).toBe(BUREAUS[bureau].scout.hull)
        expect(spec.hull.engineAt, label).toBe('rear')
        expect(spec.crew.troops, label).toBe(0)
        expect(Object.values(spec.era).every((tiles) => tiles === 0), label).toBe(true)
        expect(sheet.rollup.totalMassT, label).toBeLessThanOrEqual(T.limits.maxMassT)
      }
    }
  })

  it('build them their own ways: the heavy bureau heaviest, the light one cheapest, the firepower one with a thermal sight', () => {
    const heavy = buildStatSheet(designRival('heavy', T.limits, 1), T.limits)
    const light = buildStatSheet(designRival('light', T.limits, 1), T.limits)
    const firepower = designRival('firepower', T.limits, 1)
    expect(heavy.rollup.totalMassT).toBeGreaterThan(light.rollup.totalMassT)
    expect(light.unitCostKr).toBeLessThan(heavy.unitCostKr)
    expect(light.unitCostKr).toBeLessThan(buildStatSheet(firepower, T.limits).unitCostKr)
    expect(firepower.fireControl.night).toBe('thermal')
    expect(new Set(BUREAU_IDS.map((bureau) => designRival(bureau, T.limits, 1).runningGear.layout)).size).toBeGreaterThan(1)
  })

  it('put in legal bids that get round spot and report', () => {
    for (const bureau of BUREAU_IDS) {
      const rival = rivalBid(bureau, T, 5)
      expect(rival.score.legal, bureau).toBe(true)
      expect(rival.bid.spec.runningGear.layout, bureau).not.toBe('tracks')
      expect(rival.bid.range.scout?.totalS, bureau).not.toBeNull()
    }
  }, SLOW)

  it('learn a better sight to search with from vehicles missed, and more wheels from the mud', () => {
    const range = trialBid(designRival('light', T.limits, 1), T, 1).range
    const failed = (report: RangeReport): RangeReport => ({
      ...report,
      scout: { ...report.scout!, foundPassed: false, passed: false },
      obstacles: { ...report.obstacles, results: report.obstacles.results.map((result) => result.id === 'mud' ? { ...result, passed: false } : result) },
    })
    const lessons = lessonsOf(failed(range))
    expect(lessons).toContain('search')
    expect(lessons).toContain('mud')
    expect(lessons).not.toContain('night')
    // Mud on wheels asks for wheels, not power, unless something else wants power too.
    expect(lessons.filter((lesson) => lesson === 'power')).toHaveLength(range.acceleration.passed && range.scout!.timePassed ? 0 : 1)
  })

  it('fits the commander his own sight before a better night sight, and six wheels before eight', () => {
    const draft = draftRival('light', T.limits, 1)
    draft.spec.fireControl.commanderSight = false
    draft.spec.fireControl.night = 'none'
    draft.spec.runningGear.layout = 'wheels4'
    const once = reviseRival(draft, 'light', T.limits, ['search', 'mud'])!
    expect(once.spec.fireControl.commanderSight).toBe(true)
    expect(once.spec.fireControl.night).toBe('none')
    expect(once.spec.runningGear.layout).toBe('wheels6')
    const twice = reviseRival(once, 'light', T.limits, ['search', 'mud'])!
    expect(twice.spec.fireControl.night).not.toBe('none')
    expect(twice.spec.runningGear.layout).toBe('wheels8')
    // On eight wheels there are no more to fit: the mud asks for a stronger engine.
    const thrice = reviseRival(twice, 'light', T.limits, ['mud'])
    expect(thrice).not.toBeNull()
    expect(thrice!.spec.runningGear.layout).toBe('wheels8')
    expect(thrice!.spec.powerpack.engine).not.toBe(twice.spec.powerpack.engine)
  })

  it('still answers the mud with power on tracks', () => {
    const tank = trialBid(BASELINE_SPEC, TENDERS.tank2001, 1).range
    const bogged: RangeReport = { ...tank, obstacles: { ...tank.obstacles, results: tank.obstacles.results.map((result) => result.id === 'mud' ? { ...result, passed: false } : result) } }
    expect(lessonsOf(bogged)).toContain('power')
    expect(lessonsOf(bogged)).not.toContain('mud')
  })
})
