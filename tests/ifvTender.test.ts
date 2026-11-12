// The infantry fighting vehicle tender of 1996: judged on the squad drop, not on tank shoots and duels.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BUREAU_IDS } from '../src/data/opponents'
import { SERVICE } from '../src/data/service'
import { STRINGS } from '../src/data/strings'
import { TENDER_IDS, TENDERS } from '../src/data/tenders'
import { TUNING } from '../src/data/tuning'
import { compareTrials } from '../src/office/compareTrials'
import { cleanCareer } from '../src/persist/careerCodec'
import { review } from '../src/sim/career/advisor'
import { CAREER_FORMAT, newCareer, tenderIdOf, trialSeed } from '../src/sim/career/career'
import { recordYear } from '../src/sim/career/record'
import { rivalBid } from '../src/sim/career/rival'
import { scoreBid, trialBid } from '../src/sim/career/score'
import { fieldReport } from '../src/sim/career/service'
import type { VehicleSpec } from '../src/sim/vehicle'
import { remarkLink, remarkText } from '../src/ui/advisorWords'
import { failedTests } from '../src/ui/careerWords'
import { exerciseLine, lessonLines } from '../src/ui/serviceWords'

const SLOW = 60_000
const T = TENDERS.ifv1996

/**
 * An infantry fighting vehicle built for the tender: the medium hull with the
 * engine in front, six soldiers, the 30 mm cannon with a laser rangefinder
 * and an electronic computer, and armour cut down to keep out cannon.
 */
function ifv(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.gun = 'autocannon30'
  spec.hull.engineAt = 'front'
  spec.loading = 'loader'
  spec.crew.troops = 6
  spec.fireControl.rangefinder = 'laser'
  spec.fireControl.computer = 'electronic'
  spec.turret.ringMm = TUNING.limits.ringMm.min
  spec.armour.upperGlacis = [{ material: 'rolledSteel', mm: 45 }]
  spec.armour.lowerGlacis = [{ material: 'rolledSteel', mm: 30 }]
  spec.armour.hullSideFront = [{ material: 'rolledSteel', mm: 55 }]
  spec.armour.hullSideRear = [{ material: 'rolledSteel', mm: 65 }]
  spec.armour.hullRear = [{ material: 'rolledSteel', mm: 25 }]
  spec.armour.turretFrontLeft = [{ material: 'castSteel', mm: 60 }]
  spec.armour.turretFrontRight = [{ material: 'castSteel', mm: 60 }]
  spec.armour.mantlet = [{ material: 'castSteel', mm: 40 }]
  spec.armour.turretSides = [{ material: 'castSteel', mm: 60 }]
  spec.armour.turretRear = [{ material: 'castSteel', mm: 25 }]
  change?.(spec)
  return spec
}

describe('the infantry fighting vehicle tender of 1996', () => {
  it('comes between the tank destroyer of 1991 and the tank of 2001, with generation one parts and only the cannon', () => {
    const at = TENDER_IDS.indexOf('ifv1996')
    expect(TENDER_IDS[at - 1]).toBe('destroyer1991')
    expect(TENDER_IDS[at + 1]).toBe('tank2001')
    expect(T.year).toBe(1996)
    expect(T.limits.generation ?? 1).toBe(1)
    expect(T.limits.allowedCalibresMm).toEqual([30])
    expect(T.limits.casemate).toBeFalsy()
    expect(T.threats).toEqual([])
    expect(T.marks.squad).toBeDefined()
    expect(Object.values(T.weights).reduce((sum, each) => sum + each, 0)).toBe(100)
    expect(T.weights.firepower).toBe(Math.max(...Object.values(T.weights)))
    expect(T.weights.mobility).toBe(T.weights.firepower)
    expect(STRINGS.tenders.ifv1996.name).not.toBe('')
    expect(STRINGS.tenders.ifv1996.brief).toContain(`${T.limits.maxMassT} t`)
  })

  it('counts the drive, the endurance run, the armour and the squad drop, and nothing else', () => {
    const bid = trialBid(ifv(), T, 7)
    expect(bid.sheet.issues.filter((issue) => issue.severity === 'error')).toEqual([])
    expect(bid.range.carrier).toBe(true)
    expect(bid.range.selfPropelled).toBe(false)
    expect(bid.range.tests).toBe(5)
    expect(bid.range.squad?.marks).toEqual(T.marks.squad)
    expect(bid.duels).toEqual([])
    // The tank shoots are still run, but a miss there is not a test failed.
    for (const name of failedTests(bid.range)) {
      expect([STRINGS.range.drill.title, STRINGS.range.berm.title, ...Object.values(STRINGS.range.gunnery.titles)]).not.toContain(name)
    }
  })

  it('can be met: a carrier built for it passes every test and comes in under the weight and the price', () => {
    const bid = trialBid(ifv(), T, 7)
    expect(bid.range.passes).toBe(bid.range.tests)
    expect(bid.sheet.rollup.totalMassT).toBeLessThanOrEqual(T.limits.maxMassT)
    expect(bid.sheet.unitCostKr).toBeLessThanOrEqual(T.limits.maxUnitCostKr)
    expect(scoreBid(bid, T).legal).toBe(true)
  })

  it('fails a carrier with too few soldiers aboard on the squad drop', () => {
    const bid = trialBid(ifv((spec) => { spec.crew.troops = 4 }), T, 7)
    expect(bid.range.squad?.troopsPassed).toBe(false)
    expect(failedTests(bid.range)).toContain(STRINGS.range.squad.title)
  })

  it('scores firepower from the squad drop, so better fire control scores more', () => {
    const basic = scoreBid(trialBid(ifv((spec) => {
      spec.fireControl.rangefinder = BASELINE_SPEC.fireControl.rangefinder
      spec.fireControl.computer = BASELINE_SPEC.fireControl.computer
    }), T, 7), T)
    const good = scoreBid(trialBid(ifv(), T, 7), T)
    expect(basic.legal && good.legal).toBe(true)
    expect(good.axes.firepower).toBeGreaterThan(basic.axes.firepower)
    for (const axis of Object.values(good.axes)) {
      expect(axis).toBeGreaterThanOrEqual(0)
      expect(axis).toBeLessThanOrEqual(100)
    }
  })

  it('leaves the tank-only rows out when two of its builds are compared', () => {
    const a = trialBid(ifv(), T, 7).range
    const b = trialBid(ifv((spec) => { spec.crew.troops = 8 }), T, 7).range
    const keys = compareTrials(a, b).map((move) => move.key)
    for (const key of ['drill', 'berm', 'firstShot', 'hits:halted']) expect(keys).not.toContain(key)
  })

  it('lets every rival bureau put in a legal bid with the cannon', () => {
    for (const bureau of BUREAU_IDS) {
      const rival = rivalBid(bureau, T, 5)
      expect(rival.score.legal, bureau).toBe(true)
      expect(rival.bid.spec.gun, bureau).toBe('autocannon30')
    }
  }, SLOW)

  it('gets the chief engineer\'s word on the squad drop, and none on the tank shoots', () => {
    expect(review(ifv(), T).map((remark) => remark.kind)).not.toContain('squadTroops')
    const kinds = (spec: VehicleSpec) => review(spec, T).map((remark) => remark.kind)
    for (const kind of kinds(ifv())) expect(['shoot', 'slowShot', 'drill', 'berm']).not.toContain(kind)
    const few = review(ifv((spec) => { spec.crew.troops = 4 }), T).find((remark) => remark.kind === 'squadTroops')
    expect(few).toMatchObject({ part: 'crew.troops', value: 4, limit: 6 })
    expect(remarkText(few!)).toContain('4 soldiers')
    expect(remarkLink(few!)).not.toBeNull()
    // With the plainest fire control, targets are sometimes left standing.
    const slow = review(ifv((spec) => {
      spec.fireControl.rangefinder = 'stadiametric'
      spec.fireControl.computer = 'none'
    }), T)
    const cover = slow.find((remark) => remark.kind === 'squadCover')
    expect(cover).toMatchObject({ part: 'fireControl.rangefinder', limit: 4 })
    expect(cover!.value).toBeLessThan(4)
    expect(remarkText(cover!)).not.toContain('{')
  })

  it('goes into service with no exercise against tanks', () => {
    const report = fieldReport(ifv(), T, SERVICE.defaultProduction, 1, 9)
    expect(report.exercise).toBeNull()
    expect(exerciseLine(report)).toBe(STRINGS.service.report.noExercise)
    expect(lessonLines(report)).toEqual([])
    const year = recordYear(report)
    expect(year.won + year.lost + year.drawn).toBe(0)
  })
})

describe('a career saved before the infantry fighting vehicle tender came in', () => {
  const old = (tenderNo: number) => cleanCareer({ ...JSON.parse(JSON.stringify(newCareer(11))), format: 3, tenderNo })!

  it('stays where it was up to 1991, and moves on one place from 2001', () => {
    expect(tenderIdOf(old(0))).toBe('improvedType1')
    expect(tenderIdOf(old(1))).toBe('destroyer1991')
    expect(tenderIdOf(old(2))).toBe('tank2001')
    expect(tenderIdOf(old(3))).toBe('spg2008')
    expect(tenderIdOf(old(4))).toBe('tank2016')
    expect(old(2).format).toBe(CAREER_FORMAT)
  })

  it('is moved only once', () => {
    expect(tenderIdOf(cleanCareer(JSON.parse(JSON.stringify(old(2))))!)).toBe('tank2001')
  })

  it('keeps the trial luck of the tender it was on', () => {
    // Where each was in format three's list.
    for (const [id, was] of [['tank2001', 2], ['spg2008', 3], ['tank2016', 4]] as const) {
      expect(trialSeed(old(was))).toBe(trialSeed({ ...newCareer(11), tenderNo: TENDER_IDS.indexOf(id) }))
    }
  })
})
