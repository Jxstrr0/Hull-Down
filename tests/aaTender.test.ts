// The anti-aircraft gun vehicle tender of 2012: the twin 35 mm cannon on tracks or wheels, judged on the
// air defence trial, not on tank shoots and duels.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BUREAU_IDS } from '../src/data/opponents'
import { SCORING, TENDER_IDS, TENDERS } from '../src/data/tenders'
import { STRINGS } from '../src/data/strings'
import { compareTrials } from '../src/office/compareTrials'
import { cleanCareer } from '../src/persist/careerCodec'
import { wantsAirDefence, wantsCannon } from '../src/sim/ai/designer'
import { review } from '../src/sim/career/advisor'
import { CAREER_FORMAT, newCareer, tenderIdOf, trialSeed } from '../src/sim/career/career'
import { rivalBid } from '../src/sim/career/rival'
import { scoreBid, trialBid } from '../src/sim/career/score'
import { buildStatSheet, gunRingMm, type VehicleSpec } from '../src/sim/vehicle'
import { remarkText } from '../src/ui/advisorWords'
import { failedTests } from '../src/ui/careerWords'

const SLOW = 60_000
const T = TENDERS.aa2012

/** A light tracked vehicle with the twin cannon, the search radar, the digital computer and 40 mm of plate all round. */
function flak(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.hull.size = 'light'
  spec.gun = 'twin35'
  spec.loading = 'loader'
  spec.ammo.rounds = 40
  spec.fireControl.searchRadar = true
  spec.fireControl.computer = 'digital'
  spec.fireControl.rangefinder = 'laser'
  for (const zone of Object.keys(spec.armour) as (keyof typeof spec.armour)[]) {
    spec.armour[zone] = [{ material: 'rolledSteel', mm: 40 }]
    spec.era[zone] = 0
  }
  change?.(spec)
  spec.turret.ringMm = gunRingMm(spec)
  return spec
}

/** The same on eight wheels: a smaller engine, 15 mm of plate on the hull and 30 mm on the turret front, light enough for the mud. */
const wheeled = (spec: VehicleSpec): void => {
  spec.runningGear.layout = 'wheels8'
  spec.powerpack.engine = 'diesel580'
  spec.powerpack.transmission = 'manual38'
  spec.powerpack.fuelL = 600
  for (const zone of Object.keys(spec.armour) as (keyof typeof spec.armour)[]) spec.armour[zone] = [{ material: 'rolledSteel', mm: 15 }]
  spec.armour.turretFrontLeft = [{ material: 'rolledSteel', mm: 30 }]
  spec.armour.turretFrontRight = [{ material: 'rolledSteel', mm: 30 }]
  spec.armour.turretSides = [{ material: 'rolledSteel', mm: 25 }]
}

describe('the anti-aircraft gun vehicle tender of 2012', () => {
  it('comes between the self-propelled gun of 2008 and the tank of 2016, with generation two parts and only the twin cannon', () => {
    expect(TENDER_IDS.indexOf('aa2012')).toBe(TENDER_IDS.indexOf('spg2008') + 1)
    expect(TENDER_IDS.indexOf('tank2016')).toBe(TENDER_IDS.indexOf('aa2012') + 1)
    expect(T.year).toBe(2012)
    expect(T.limits.generation).toBe(2)
    expect(T.limits.allowedCalibresMm).toEqual([35])
    expect(T.threats).toEqual([])
    expect(T.marks.air).toBeDefined()
    expect(Math.max(...Object.values(T.weights))).toBe(T.weights.firepower)
    expect(STRINGS.tenders.aa2012.name).toBeTruthy()
    expect(STRINGS.tenders.aa2012.brief).toBeTruthy()
  })

  it('takes tracks or wheels', () => {
    const codes = (spec: VehicleSpec) => buildStatSheet(spec, T.limits).issues.map((issue) => issue.code)
    for (const layout of ['tracks', 'wheels4', 'wheels6', 'wheels8'] as const) {
      const spec = flak((each) => { each.runningGear.layout = layout })
      expect(codes(spec), layout).not.toContain('tracksNotAllowed')
      expect(codes(spec), layout).not.toContain('wheelsNotAllowed')
    }
  })

  it('counts the drive, the endurance run, the armour and the air defence trial, and no tank shoots or spot and report', () => {
    for (const spec of [flak(), flak(wheeled)]) {
      const range = trialBid(spec, T, 3).range
      expect(range.airDefence).toBe(true)
      expect(range.air).not.toBeNull()
      expect(range.air!.marks).toEqual(T.marks.air)
      // A car on wheels is not sent to spot and report on this tender.
      expect(range.scout).toBeNull()
      expect(range.tests).toBe(5)
      const failed = failedTests({ ...range, passes: 0 })
      expect(failed.some((name) => /shoot|drill|berm/i.test(name))).toBe(false)
    }
  })

  it('asks for the mud pit and waives the trench, the step and the slope', () => {
    const range = trialBid(flak(wheeled), T, 3).range
    expect(range.obstacles.results.filter((result) => !result.waived).map((result) => result.id)).toEqual(['mud'])
    expect(range.obstacles.passed).toBe(true)
  })

  it('can be met on tracks or on wheels, under the weight and the price, passing every test', () => {
    for (const spec of [flak(), flak(wheeled)]) {
      const sheet = buildStatSheet(spec, T.limits)
      expect(sheet.issues.filter((issue) => issue.severity === 'error')).toEqual([])
      expect(sheet.massT).toBeLessThanOrEqual(T.limits.maxMassT)
      expect(sheet.unitCostKr).toBeLessThanOrEqual(T.limits.maxUnitCostKr)
      const bid = trialBid(spec, T, 3)
      expect(bid.range.passes).toBe(bid.range.tests)
      expect(scoreBid(bid, T).legal).toBe(true)
    }
  })

  it('scores firepower from the air defence trial, so the radar scores far more', () => {
    const share = SCORING.firepower.air.downedShare
    expect(share).toBeGreaterThan(0)
    expect(share).toBeLessThan(1)
    const firepower = (spec: VehicleSpec) => {
      let sum = 0
      for (const seed of [1, 2, 3, 4, 5, 6]) sum += scoreBid(trialBid(spec, T, seed), T).axes.firepower
      return sum / 6
    }
    const eyes = firepower(flak((spec) => { spec.fireControl.searchRadar = false }))
    const radar = firepower(flak())
    expect(radar).toBeGreaterThan(eyes + 20)
  }, SLOW)

  it('leaves the tank-only rows out when two of its builds are compared', () => {
    const a = trialBid(flak(), T, 7).range
    const b = trialBid(flak((spec) => { spec.fireControl.computer = 'electronic' }), T, 7).range
    const keys = compareTrials(a, b).map((move) => move.key)
    for (const key of ['drill', 'berm', 'firstShot', 'hits:halted']) expect(keys).not.toContain(key)
  })

  it('is told apart from the infantry fighting vehicle\'s tender by the rival bureaus', () => {
    for (const id of TENDER_IDS) {
      expect(wantsAirDefence(TENDERS[id].limits), id).toBe(id === 'aa2012')
      if (id === 'aa2012') expect(wantsCannon(TENDERS[id].limits)).toBe(false)
    }
  })

  it('lets every rival bureau put in a legal bid with the twin cannon and the radar', () => {
    for (const bureau of BUREAU_IDS) {
      const rival = rivalBid(bureau, T, 5)
      expect(rival.score.legal, bureau).toBe(true)
      expect(rival.bid.spec.gun, bureau).toBe('twin35')
      expect(rival.bid.spec.fireControl.searchRadar, bureau).toBe(true)
      expect(rival.bid.spec.crew.troops, bureau).toBe(0)
    }
  }, SLOW)

  it("gets the chief engineer's word on the air defence trial, and none on the tank shoots", () => {
    const kinds = (spec: VehicleSpec) => review(spec, T).map((remark) => remark.kind)
    for (const kind of kinds(flak())) expect(['shoot', 'slowShot', 'drill', 'berm', 'airDowned', 'airReaction']).not.toContain(kind)
    // Without the radar the crew react too late and bring down too few: he points at the radar for both.
    const blind = review(flak((spec) => { spec.fireControl.searchRadar = false }), T)
    const downed = blind.find((remark) => remark.kind === 'airDowned')
    const late = blind.find((remark) => remark.kind === 'airReaction')
    expect(downed).toMatchObject({ part: 'fireControl.searchRadar', limit: T.marks.air!.downed })
    expect(late).toMatchObject({ part: 'fireControl.searchRadar', limit: T.marks.air!.reactionS })
    expect(late!.value!).toBeGreaterThan(T.marks.air!.reactionS)
    for (const remark of [downed!, late!]) expect(remarkText(remark)).not.toContain('{')
    // With the radar but a mechanical computer that cannot lead a jet, he points at the computer.
    const slow = review(flak((spec) => { spec.fireControl.computer = 'mechanical' }), T).find((remark) => remark.kind === 'airDowned')
    expect(slow?.part).toBe('fireControl.computer')
    // With the radar and the digital computer but too few rounds, the belts run dry: he points at the rounds.
    const short = review(flak((spec) => { spec.ammo.rounds = 20 }), T).find((remark) => remark.kind === 'airDowned')
    expect(short?.part).toBe('ammo.rounds')
    // Never a word on a gun that never fires.
    expect(remarkText({ kind: 'airReaction', part: 'fireControl.searchRadar', limit: 6 })).toBe(STRINGS.advisor.remarks.airReactionNever)
  })
})

describe('a career saved before the anti-aircraft gun vehicle tender came in', () => {
  const old = (tenderNo: number) => cleanCareer({ ...JSON.parse(JSON.stringify(newCareer(11))), format: 5, tenderNo })!

  it('stays where it was up to 2008, and moves on one place from 2016', () => {
    expect(tenderIdOf(old(0))).toBe('improvedType1')
    expect(tenderIdOf(old(4))).toBe('scout2004')
    expect(tenderIdOf(old(5))).toBe('spg2008')
    expect(tenderIdOf(old(6))).toBe('tank2016')
    expect(old(6).format).toBe(CAREER_FORMAT)
    expect(CAREER_FORMAT).toBe(6)
  })

  it('is moved only once', () => {
    expect(tenderIdOf(cleanCareer(JSON.parse(JSON.stringify(old(6))))!)).toBe('tank2016')
  })

  it('keeps the trial luck of the tender it was on', () => {
    // Where each was in format five's list.
    for (const [id, was] of [['spg2008', 5], ['tank2016', 6]] as const) {
      expect(trialSeed(old(was))).toBe(trialSeed({ ...newCareer(11), tenderNo: TENDER_IDS.indexOf(id) }))
    }
  })
})
