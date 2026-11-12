import { STRINGS } from '../src/data/strings'
// Moving the career on from one tender to the next.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BUREAU_IDS } from '../src/data/opponents'
import { MARKS_GEN2 } from '../src/data/range'
import { TENDER_IDS, TENDERS } from '../src/data/tenders'
import { TUNING } from '../src/data/tuning'
import { cleanCareer } from '../src/persist/careerCodec'
import {
  CAREER_FORMAT, buildBlock, buildPrototype, enterTender, newCareer, nextTender, research, tenderIdOf, tenderOf, tendersLeft, trialSeed, upgradeLimits,
} from '../src/sim/career/career'
import { rivalBid } from '../src/sim/career/rival'
import { buildStatSheet, gunRingMm, type VehicleSpec } from '../src/sim/vehicle'

const SLOW = 60_000

function tank(change: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  change(spec)
  return spec
}
const NIGHT = tank((spec) => { spec.fireControl.night = 'imageIntensifier' })
const THERMAL = tank((spec) => { spec.fireControl.night = 'thermal' })
const HOWITZER = tank((spec) => {
  spec.gun = 'howitzer155'
  spec.turret.shape = 'casemate'
  spec.loading = 'loader'
  spec.ammo.rounds = 30
  spec.turret.ringMm = gunRingMm(spec)
})
const CARRIER = tank((spec) => {
  spec.gun = 'autocannon30'
  spec.hull.engineAt = 'front'
  spec.loading = 'loader'
  spec.crew.troops = 6
  // Thin enough to come in under the tender's weight.
  for (const zone of ['upperGlacis', 'turretFrontLeft', 'turretFrontRight', 'mantlet', 'turretSides', 'turretRear', 'lowerGlacis'] as const) spec.armour[zone] = [{ material: 'castSteel', mm: 40 }]
  // The smallest ring the office offers: the cannon needs less.
  spec.turret.ringMm = TUNING.limits.ringMm.min
})
type Career = Parameters<typeof nextTender>[0]
/** On from the first tender, through the tank destroyer's of 1991 and the infantry fighting vehicle's of 1996, to the tender of 2001. */
const to2001 = (career: Career) =>
  nextTender(enterTender(buildPrototype(nextTender(enterTender(buildPrototype(nextTender(career), NIGHT), 1)), CARRIER), 1))
/** The tender of 2001, with the thermal sight researched. */
const onward = (career: Career) => research(research(to2001(career), 'digitalComputer'), 'thermalSight')

describe('the tank destroyer tender of 1991', () => {
  const T = TENDERS.destroyer1991

  it('comes second, ten years after the first, with the same parts and a casemate allowed', () => {
    expect(TENDER_IDS).toEqual(['improvedType1', 'destroyer1991', 'ifv1996', 'tank2001', 'spg2008', 'tank2016'])
    expect(T.year).toBe(1991)
    expect(T.limits.generation ?? 1).toBe(1)
    expect(T.limits.casemate).toBe(true)
    expect(TENDER_IDS.filter((id) => TENDERS[id].limits.casemate)).toEqual(['destroyer1991', 'spg2008'])
    expect(T.limits.maxUnitCostKr).toBeLessThan(TENDERS.improvedType1.limits.maxUnitCostKr)
    expect(Object.values(T.weights).reduce((sum, each) => sum + each, 0)).toBe(100)
    expect(Math.max(...Object.values(T.weights))).toBe(T.weights.firepower)
    expect(STRINGS.tenders.destroyer1991.name).not.toBe('')
  })

  it('takes a casemate the other tenders would not', () => {
    const casemate = tank((spec) => { spec.turret.shape = 'casemate' })
    const refused = (limits: typeof T.limits) => buildStatSheet(casemate, limits).issues.some((issue) => issue.code === 'casemateNotAllowed')
    expect(refused(T.limits)).toBe(false)
    for (const id of TENDER_IDS) if (!TENDERS[id].limits.casemate) expect(refused(TENDERS[id].limits), id).toBe(true)
  })

  it('lets every rival bureau put in a legal bid', () => {
    for (const bureau of BUREAU_IDS) expect(rivalBid(bureau, T, 5).score.legal, bureau).toBe(true)
  }, SLOW)

  it('has luck of its own, and leaves the other tenders\' luck as it was before it came in', () => {
    expect(TENDER_IDS.map((id) => TENDERS[id].luck)).toEqual([0, 3, 5, 1, 4, 2])
  })
})

describe('the tender of 2001', () => {
  const T = TENDERS.tank2001

  it('comes after the infantry fighting vehicle, twenty years on from the first, with generation two allowed', () => {
    expect(TENDER_IDS.indexOf('tank2001')).toBe(TENDER_IDS.indexOf('ifv1996') + 1)
    expect(T.year).toBe(2001)
    expect(T.limits.generation).toBe(2)
    expect(T.marks).toBe(MARKS_GEN2)
    expect(T.threats).toContain('palisadeB')
  })

  it('lets every rival bureau put in a legal bid', () => {
    for (const bureau of BUREAU_IDS) expect(rivalBid(bureau, T, 5).score.legal, bureau).toBe(true)
  }, SLOW)

  it('takes a thermal sight the first tender would not', () => {
    const late = (limits: typeof T.limits) => buildStatSheet(THERMAL, limits).issues.filter((issue) => issue.code === 'notYetAvailable')
    expect(late(TENDERS.improvedType1.limits)).toHaveLength(1)
    expect(late(T.limits)).toEqual([])
  })
})

describe('the tender of 2016', () => {
  const T = TENDERS.tank2016

  it('comes last, with generation three allowed and a heavier bridge class', () => {
    expect(TENDER_IDS[TENDER_IDS.length - 1]).toBe('tank2016')
    expect(T.year).toBe(2016)
    expect(T.limits.generation).toBe(3)
    expect(T.limits.maxMassT).toBeGreaterThan(TENDERS.tank2001.limits.maxMassT)
    expect(T.limits.maxUnitCostKr).toBeGreaterThan(TENDERS.tank2001.limits.maxUnitCostKr)
    expect(Object.values(T.weights).reduce((sum, each) => sum + each, 0)).toBe(100)
    expect(STRINGS.tenders.tank2016.name).not.toBe('')
  })

  it('lets every rival bureau put in a legal bid', () => {
    for (const bureau of BUREAU_IDS) expect(rivalBid(bureau, T, 5).score.legal, bureau).toBe(true)
  }, SLOW)
})

describe('going on to the next tender', () => {
  const start = newCareer(7)
  const decided = enterTender(buildPrototype(start, NIGHT), 1)

  it('waits for the army to decide', () => {
    expect(() => nextTender(start)).toThrow()
    expect(tendersLeft(start)).toBe(true)
  })

  it('opens the next tender with the grant added to what is left', () => {
    const next = nextTender(decided)
    expect(tenderIdOf(next)).toBe('destroyer1991')
    expect(next.budgetKr).toBe(decided.budgetKr + TENDERS.destroyer1991.grantKr)
    expect(next.prototypes).toEqual([])
    expect(next.outcome).toBeNull()
    expect(next.reputation).toEqual(decided.reputation)
    expect(next.adopted).toEqual(decided.adopted)
    expect(trialSeed(next)).not.toBe(trialSeed(decided))
    // The career handed in is left as it was.
    expect(decided.tenderNo).toBe(0)
    expect(decided.outcome).not.toBeNull()
  }, SLOW)

  it('stops at the last tender', () => {
    const second = onward(decided)
    expect(tendersLeft(second)).toBe(true)
    const spg = nextTender(enterTender(buildPrototype(second, THERMAL), 1))
    expect(tenderIdOf(spg)).toBe('spg2008')
    expect(tendersLeft(spg)).toBe(true)
    const third = nextTender(enterTender(buildPrototype(spg, HOWITZER), 1))
    expect(tenderIdOf(third)).toBe('tank2016')
    expect(tendersLeft(third)).toBe(false)
    const done = enterTender(buildPrototype(third, THERMAL), 1)
    expect(() => nextTender(done)).toThrow()
  }, SLOW)

  it('builds a generation-two prototype only once the tender allows it and the research is done', () => {
    expect(buildBlock(start, THERMAL)).toBe('illegal')
    expect(buildBlock(nextTender(decided), THERMAL)).toBe('illegal')
    expect(buildBlock(to2001(decided), THERMAL)).toBe('illegal')
    expect(buildBlock(onward(decided), THERMAL)).toBeNull()
  }, SLOW)

  it('survives a save and a load', () => {
    const next = buildPrototype(onward(decided), THERMAL)
    const back = cleanCareer(JSON.parse(JSON.stringify(next)))
    expect(back).toEqual(next)
    expect(back && tenderOf(back)).toBe(TENDERS.tank2001)
  }, SLOW)

  it('lets a tank in service take today\'s technology in a package, inside its own limits', () => {
    const next = to2001(decided)
    const tank = { tender: 'improvedType1' } as Parameters<typeof upgradeLimits>[1]
    expect(upgradeLimits(decided, tank).generation ?? 1).toBe(1)
    expect(upgradeLimits(nextTender(decided), tank).generation ?? 1).toBe(1)
    expect(upgradeLimits(next, tank).generation).toBe(2)
    expect(upgradeLimits(next, tank).maxUnitCostKr).toBe(TENDERS.improvedType1.limits.maxUnitCostKr)
  }, SLOW)
})

describe('a career saved before the tank destroyer tender came in', () => {
  const old = (tenderNo: number) => cleanCareer({ ...JSON.parse(JSON.stringify(newCareer(11))), format: 1, tenderNo })!

  it('stays on the first tender, and moves on one place from any later one', () => {
    expect(tenderIdOf(old(0))).toBe('improvedType1')
    expect(tenderIdOf(old(1))).toBe('tank2001')
    expect(tenderIdOf(old(2))).toBe('tank2016')
  })

  it('is saved in the new format, so it is moved only once', () => {
    const moved = old(1)
    expect(moved.format).toBe(CAREER_FORMAT)
    expect(tenderIdOf(cleanCareer(JSON.parse(JSON.stringify(moved)))!)).toBe('tank2001')
  })

  it('keeps the trial luck it had', () => {
    // The tender of 2001 was second, number one; its luck is still one.
    const moved = old(1)
    expect(trialSeed(moved)).toBe(trialSeed({ ...newCareer(11), tenderNo: TENDER_IDS.indexOf('tank2001') }))
    expect(TENDERS[tenderIdOf(moved)].luck).toBe(1)
  })

  it('goes from the first tender to the tank destroyer\'s', () => {
    const first = enterTender(buildPrototype(old(0), NIGHT), 1)
    expect(tenderIdOf(nextTender(first))).toBe('destroyer1991')
  }, SLOW)
})
