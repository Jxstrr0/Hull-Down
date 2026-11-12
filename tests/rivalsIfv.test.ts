// The rival bureaus asked for an infantry fighting vehicle: each builds a carrier for a squad its own way.
import { describe, expect, it } from 'vitest'
import { BUREAU_IDS } from '../src/data/opponents'
import { TENDER_IDS, TENDERS } from '../src/data/tenders'
import { designRival, wantsCannon } from '../src/sim/ai/designer'
import { rivalBid } from '../src/sim/career/rival'
import { buildStatSheet } from '../src/sim/vehicle'

const SLOW = 60_000
const T = TENDERS.ifv1996
const SEEDS = [1, 5, 9]

describe('the rival bureaus asked for an infantry fighting vehicle', () => {
  it('know the tenders of 1996 and 2004 want the cannon, and no other', () => {
    for (const id of TENDER_IDS) expect(wantsCannon(TENDERS[id].limits), id).toBe(id === 'ifv1996' || id === 'scout2004')
  })

  it('each draw up a legal carrier: the cannon, the engine in front, six soldiers and no tiles', () => {
    for (const seed of SEEDS) {
      for (const bureau of BUREAU_IDS) {
        const spec = designRival(bureau, T.limits, seed)
        const sheet = buildStatSheet(spec, T.limits)
        const label = `${bureau} ${seed}`
        expect(sheet.issues.filter((issue) => issue.severity === 'error'), label).toEqual([])
        expect(spec.gun, label).toBe('autocannon30')
        expect(spec.hull.engineAt, label).toBe('front')
        expect(spec.crew.troops, label).toBeGreaterThanOrEqual(T.marks.squad!.troops)
        expect(Object.values(spec.era).every((tiles) => tiles === 0), label).toBe(true)
        expect(sheet.rollup.totalMassT, label).toBeLessThanOrEqual(T.limits.maxMassT)
      }
    }
  })

  it('build them their own ways: the heavy bureau heaviest, the light one cheapest, the firepower one with the best sights', () => {
    const heavy = buildStatSheet(designRival('heavy', T.limits, 1), T.limits)
    const light = buildStatSheet(designRival('light', T.limits, 1), T.limits)
    const firepower = designRival('firepower', T.limits, 1)
    expect(heavy.rollup.totalMassT).toBeGreaterThan(light.rollup.totalMassT)
    expect(light.unitCostKr).toBeLessThan(heavy.unitCostKr)
    expect(light.unitCostKr).toBeLessThan(buildStatSheet(firepower, T.limits).unitCostKr)
    expect(firepower.fireControl.rangefinder).toBe('laser')
    expect(firepower.fireControl.computer).toBe('electronic')
  })

  it('carry nobody and keep the engine at the back on every other tender', () => {
    for (const id of TENDER_IDS.filter((each) => each !== 'ifv1996')) {
      for (const bureau of BUREAU_IDS) {
        const spec = designRival(bureau, TENDERS[id].limits, 5)
        expect(spec.crew.troops, `${id} ${bureau}`).toBe(0)
        expect(spec.hull.engineAt, `${id} ${bureau}`).toBe('rear')
      }
    }
  })

  it('get their squads to the drop point, and mostly pass the trials, after revising', () => {
    let passed = 0
    let run = 0
    for (const seed of SEEDS) {
      for (const bureau of BUREAU_IDS) {
        const rival = rivalBid(bureau, T, seed)
        expect(rival.score.legal, `${bureau} ${seed}`).toBe(true)
        const squad = rival.bid.range.squad!
        expect(squad.troopsPassed && squad.dropPassed, `${bureau} ${seed}`).toBe(true)
        passed += rival.bid.range.passes
        run += rival.bid.range.tests
      }
    }
    expect(passed / run).toBeGreaterThan(0.8)
  }, SLOW)
})
