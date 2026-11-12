// The scout car tender of 2004: a car on wheels, judged on spot and report, not on tank shoots and duels.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BUREAU_IDS } from '../src/data/opponents'
import { SCORING, TENDER_IDS, TENDERS } from '../src/data/tenders'
import { STRINGS } from '../src/data/strings'
import { compareTrials } from '../src/office/compareTrials'
import { cleanCareer } from '../src/persist/careerCodec'
import { review } from '../src/sim/career/advisor'
import { CAREER_FORMAT, newCareer, tenderIdOf, trialSeed } from '../src/sim/career/career'
import { rivalBid } from '../src/sim/career/rival'
import { scoreBid, trialBid } from '../src/sim/career/score'
import { buildStatSheet, type VehicleSpec } from '../src/sim/vehicle'
import { remarkText } from '../src/ui/advisorWords'
import { failedTests } from '../src/ui/careerWords'

const SLOW = 60_000
const T = TENDERS.scout2004

/** A light car on eight wheels with the 30 mm cannon, the commander's own sight and thin plate. */
function car(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.hull.size = 'light'
  spec.gun = 'autocannon30'
  spec.loading = 'loader'
  spec.turret.ringMm = 1400
  spec.powerpack.engine = 'diesel580'
  spec.powerpack.transmission = 'manual38'
  spec.powerpack.fuelL = 600
  spec.fireControl.commanderSight = true
  for (const zone of Object.keys(spec.armour) as (keyof typeof spec.armour)[]) {
    spec.armour[zone] = [{ material: 'rolledSteel', mm: 15 }]
    spec.era[zone] = 0
  }
  spec.runningGear.layout = 'wheels8'
  change?.(spec)
  return spec
}

describe('the scout car tender of 2004', () => {
  it('comes between the tank of 2001 and the self-propelled gun of 2008, with generation two parts and only the cannon', () => {
    expect(TENDER_IDS.indexOf('scout2004')).toBe(TENDER_IDS.indexOf('tank2001') + 1)
    expect(TENDER_IDS.indexOf('spg2008')).toBe(TENDER_IDS.indexOf('scout2004') + 1)
    expect(T.year).toBe(2004)
    expect(T.limits.generation).toBe(2)
    expect(T.limits.allowedCalibresMm).toEqual([30])
    expect(T.threats).toEqual([])
    expect(STRINGS.tenders.scout2004.name).toBeTruthy()
  })

  it('refuses a design on tracks, and takes four, six or eight wheels', () => {
    const codes = (spec: VehicleSpec) => buildStatSheet(spec, T.limits).issues.map((issue) => issue.code)
    expect(codes(car((spec) => { spec.runningGear.layout = 'tracks' }))).toContain('tracksNotAllowed')
    expect(STRINGS.issues.tracksNotAllowed).toBeTruthy()
    for (const layout of ['wheels4', 'wheels6', 'wheels8'] as const) {
      expect(codes(car((spec) => { spec.runningGear.layout = layout }))).not.toContain('tracksNotAllowed')
    }
    // Other tenders still take tracks.
    expect(buildStatSheet(BASELINE_SPEC, TENDERS.tank2001.limits).issues.map((issue) => issue.code)).not.toContain('tracksNotAllowed')
  })

  it('counts the drive, the endurance run, the armour and spot and report, and no tank shoots', () => {
    const range = trialBid(car(), T, 3).range
    expect(range.scouting).toBe(true)
    expect(range.scout).not.toBeNull()
    expect(range.tests).toBe(5)
    const failed = failedTests({ ...range, passes: 0 })
    expect(failed.some((name) => /shoot|drill|berm/i.test(name))).toBe(false)
  })

  it('asks for the mud pit and waives the trench, the step and the slope', () => {
    const range = trialBid(car(), T, 3).range
    const asked = range.obstacles.results.filter((result) => !result.waived).map((result) => result.id)
    expect(asked).toEqual(['mud'])
    expect(range.obstacles.results.filter((result) => result.waived && result.passed)).toEqual([])
    expect(range.obstacles.passed).toBe(true)
    // A waived obstacle costs no mobility: a car through the mud scores all of it.
    expect(scoreBid(trialBid(car(), T, 3), T).failed).toBeLessThanOrEqual(1)
  })

  it('scores firepower from spot and report, so a better sight scores more', () => {
    const share = SCORING.firepower.scout.foundShare
    expect(share).toBeGreaterThan(0)
    expect(share).toBeLessThan(1)
    const firepower = (spec: VehicleSpec) => {
      let sum = 0
      for (const seed of [1, 2, 3, 4, 5, 6]) sum += scoreBid(trialBid(spec, T, seed), T).axes.firepower
      return sum
    }
    const plain = firepower(car((spec) => { spec.fireControl.commanderSight = false }))
    const thermal = firepower(car((spec) => { spec.fireControl.night = 'thermal' }))
    expect(thermal).toBeGreaterThan(plain)
  }, SLOW)

  it('can be met: a car built for it comes in under the weight and the price', () => {
    const sheet = buildStatSheet(car(), T.limits)
    expect(sheet.issues.filter((issue) => issue.severity === 'error')).toEqual([])
    expect(sheet.massT).toBeLessThanOrEqual(T.limits.maxMassT)
    expect(sheet.unitCostKr).toBeLessThanOrEqual(T.limits.maxUnitCostKr)
    expect(scoreBid(trialBid(car(), T, 1), T).legal).toBe(true)
  })

  it('leaves the tank-only rows out when two of its builds are compared', () => {
    const a = trialBid(car(), T, 7).range
    const b = trialBid(car((spec) => { spec.fireControl.night = 'thermal' }), T, 7).range
    const keys = compareTrials(a, b).map((move) => move.key)
    for (const key of ['drill', 'berm', 'firstShot', 'hits:halted']) expect(keys).not.toContain(key)
  })

  it('lets every rival bureau put in a legal bid on wheels with the cannon', () => {
    for (const bureau of BUREAU_IDS) {
      const rival = rivalBid(bureau, T, 5)
      expect(rival.score.legal, bureau).toBe(true)
      expect(rival.bid.spec.gun, bureau).toBe('autocannon30')
      expect(rival.bid.spec.runningGear.layout, bureau).not.toBe('tracks')
    }
  }, SLOW)

  it("gets the chief engineer's word on spot and report, and none on the tank shoots or waived obstacles", () => {
    const kinds = (spec: VehicleSpec) => review(spec, T).map((remark) => remark.kind)
    for (const kind of kinds(car())) expect(['shoot', 'slowShot', 'drill', 'berm']).not.toContain(kind)
    // Tracks are refused, but he still says how long they would take.
    const slow = review(car((spec) => { spec.runningGear.layout = 'tracks' }), T).find((remark) => remark.kind === 'scoutTime')
    expect(slow).toMatchObject({ part: 'powerpack.engine', limit: Math.round(T.marks.scout!.timeS / 60) })
    expect(remarkText(slow!)).not.toContain('{')
    // Asked to find more than it can, he points at the commander's own sight, or once that is fitted the night sight.
    const strict = { ...T, marks: { ...T.marks, scout: { ...T.marks.scout!, found: 7 } } }
    const blind = review(car((spec) => { spec.fireControl.commanderSight = false }), strict).find((remark) => remark.kind === 'scoutFound')
    expect(blind).toMatchObject({ part: 'fireControl.commanderSight', limit: 7 })
    expect(blind!.value).toBeLessThan(7)
    expect(remarkText(blind!)).not.toContain('{')
    expect(review(car(), strict).find((remark) => remark.kind === 'scoutFound')?.part).toBe('fireControl.night')
    // Nothing about the step or the slope a car on wheels is never asked to climb.
    const parts = review(car(), T).filter((remark) => remark.kind === 'obstacle')
    expect(parts.every((remark) => remark.part === 'runningGear.layout' || remark.part === 'powerpack.engine' || remark.part === 'runningGear.suspension')).toBe(true)
  })
})

describe('a career saved before the scout car tender came in', () => {
  const old = (tenderNo: number) => cleanCareer({ ...JSON.parse(JSON.stringify(newCareer(11))), format: 4, tenderNo })!

  it('stays where it was up to 2001, and moves on one place from 2008', () => {
    expect(tenderIdOf(old(0))).toBe('improvedType1')
    expect(tenderIdOf(old(2))).toBe('ifv1996')
    expect(tenderIdOf(old(3))).toBe('tank2001')
    expect(tenderIdOf(old(4))).toBe('spg2008')
    expect(tenderIdOf(old(5))).toBe('tank2016')
    expect(old(4).format).toBe(CAREER_FORMAT)
    expect(CAREER_FORMAT).toBe(5)
  })

  it('is moved only once', () => {
    expect(tenderIdOf(cleanCareer(JSON.parse(JSON.stringify(old(4))))!)).toBe('spg2008')
  })

  it('keeps the trial luck of the tender it was on', () => {
    // Where each was in format four's list.
    for (const [id, was] of [['tank2001', 3], ['spg2008', 4], ['tank2016', 5]] as const) {
      expect(trialSeed(old(was))).toBe(trialSeed({ ...newCareer(11), tenderNo: TENDER_IDS.indexOf(id) }))
    }
  })
})
