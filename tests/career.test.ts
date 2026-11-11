import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BODIES, CAREER, STANDARD_PARTS } from '../src/data/career'
import { BUREAU_IDS } from '../src/data/opponents'
import { TENDER_RULES, TENDERS } from '../src/data/tenders'
import {
  buildBlock, buildPrototype, designationOf, enterTender, newCareer, prototypeCostKr, prototypeTrial, revisionsLeft,
  revisionsMade, standardShare, tenderOf, trialSeed, type Career,
} from '../src/sim/career/career'
import type { VehicleSpec } from '../src/sim/vehicle/spec'

const SLOW = 30_000
const T = TENDERS.improvedType1

function tank(change: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  change(spec)
  return spec
}
const NIGHT = tank((spec) => { spec.fireControl.night = 'imageIntensifier' })
const LASER = tank((spec) => { spec.fireControl.night = 'imageIntensifier'; spec.fireControl.rangefinder = 'laser' })
/** Four more designs, each different from the last. */
const STEPS = [200, 300, 400, 500, 600].map((fuel) => tank((spec) => { spec.powerpack.fuelL = 1000 + fuel }))

describe('a new career', () => {
  const career = newCareer(7)

  it('starts on the first tender with its grant and a middling name with everyone', () => {
    expect(tenderOf(career)).toBe(T)
    expect(career.budgetKr).toBe(T.grantKr)
    for (const body of BODIES) expect(career.reputation[body]).toBe(CAREER.reputation.start)
    expect(career.prototypes).toEqual([])
    expect(career.outcome).toBeNull()
    expect(revisionsLeft(career)).toEqual({ free: TENDER_RULES.revisions, extra: CAREER.extraRevisions })
  })

  it('gives each career its own luck and each the same luck every time', () => {
    expect(trialSeed(newCareer(7))).toBe(trialSeed(career))
    expect(trialSeed(newCareer(8))).not.toBe(trialSeed(career))
  })
})

describe('building prototypes', () => {
  const start = newCareer(7)

  it('charges four tanks for the first and one and a half for a revision', () => {
    const unit = prototypeTrial(buildPrototype(start, BASELINE_SPEC), 1)!.bid.sheet.unitCostKr
    expect(prototypeCostKr(start, BASELINE_SPEC)).toBeCloseTo(unit * CAREER.prototypeUnits, -3)
    const one = buildPrototype(start, BASELINE_SPEC)
    expect(one.budgetKr).toBe(start.budgetKr - one.prototypes[0]!.costKr)
    expect(prototypeCostKr(one, BASELINE_SPEC)).toBeCloseTo(unit * CAREER.revisionUnits, -3)
  })

  it('leaves the career it was given alone, and keeps its own copy of the design', () => {
    const before = JSON.stringify(start)
    const spec = structuredClone(BASELINE_SPEC)
    const one = buildPrototype(start, spec)
    spec.powerpack.fuelL += 100
    expect(JSON.stringify(start)).toBe(before)
    expect(one.prototypes[0]!.spec.powerpack.fuelL).toBe(BASELINE_SPEC.powerpack.fuelL)
  })

  it('will not build a design that breaks a limit, or the same tank twice', () => {
    const heavy = tank((spec) => { spec.armour.upperGlacis = spec.armour.upperGlacis.map((layer) => ({ ...layer, mm: layer.mm * 3 })) })
    expect(buildBlock(start, heavy)).toBe('illegal')
    expect(() => buildPrototype(start, heavy)).toThrow()
    const one = buildPrototype(start, BASELINE_SPEC)
    expect(buildBlock(one, tank((spec) => { spec.name = 'Another name' }))).toBe('same')
    expect(buildBlock(one, NIGHT)).toBeNull()
  })

  it('allows three revisions, a fourth beyond the rule, and then no more', () => {
    let career = buildPrototype(start, BASELINE_SPEC)
    const cheap = { ...career, budgetKr: 1e9 }
    career = cheap
    for (let i = 0; i < TENDER_RULES.revisions; i++) {
      expect(revisionsLeft(career).free).toBe(TENDER_RULES.revisions - i)
      career = buildPrototype(career, STEPS[i]!)
    }
    expect(revisionsMade(career)).toBe(3)
    expect(revisionsLeft(career)).toEqual({ free: 0, extra: 1 })
    career = buildPrototype(career, STEPS[3]!)
    expect(revisionsLeft(career)).toEqual({ free: 0, extra: 0 })
    expect(buildBlock(career, STEPS[4]!)).toBe('noRevisions')
    expect(career.prototypes.map((each) => each.no)).toEqual([1, 2, 3, 4, 5])
  })

  it('stops when the money runs out', () => {
    const poor = { ...buildPrototype(start, BASELINE_SPEC), budgetKr: 1_000_000 }
    expect(buildBlock(poor, NIGHT)).toBe('noMoney')
  })

  it('lets the grant stretch to every revision of a tank at the Type 1 price, and no further', () => {
    const unit = prototypeTrial(buildPrototype(start, BASELINE_SPEC), 1)!.bid.sheet.unitCostKr
    const all = unit * (CAREER.prototypeUnits + CAREER.revisionUnits * (TENDER_RULES.revisions + CAREER.extraRevisions))
    expect(all).toBeLessThanOrEqual(T.grantKr)
    expect(all * 1.15).toBeGreaterThan(T.grantKr)
  })

  it('tries a prototype on the tender ground, the same every time', () => {
    const one = buildPrototype(start, BASELINE_SPEC)
    const a = prototypeTrial(one, 1)!
    expect(prototypeTrial(one, 1)!.score).toEqual(a.score)
    expect(a.score.failed).toBeGreaterThanOrEqual(0)
    expect(prototypeTrial(one, 2)).toBeNull()
  })
})

describe('the Pact count of standard parts', () => {
  it('is all of them for the Type 1 and falls by one for each part changed', () => {
    expect(standardShare(BASELINE_SPEC)).toBe(1)
    expect(standardShare(NIGHT)).toBeCloseTo(1 - 1 / STANDARD_PARTS.length, 9)
    expect(standardShare(LASER)).toBeCloseTo(1 - 2 / STANDARD_PARTS.length, 9)
    expect(standardShare(tank((spec) => { spec.powerpack.fuelL += 100; spec.name = 'x' }))).toBe(1)
  })
})

describe('service designations', () => {
  it('are Model and the year, with a number for a second tank that year', () => {
    expect(designationOf(1981, 0)).toBe('Model 81')
    expect(designationOf(1981, 1)).toBe('Model 81/2')
    expect(designationOf(2004, 0)).toBe('Model 04')
  })
})

describe('the decision', () => {
  /** Careers whose trials the given design wins, and ones it loses. */
  function decided(spec: VehicleSpec, seed: number): Career {
    return enterTender(buildPrototype(newCareer(seed), spec), 1)
  }
  const outcomes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) => decided(LASER, seed))

  it('ranks the bureau with the three rivals, best first', () => {
    for (const career of outcomes) {
      const outcome = career.outcome!
      expect(outcome.bids.map((each) => each.who).sort()).toEqual(['bureau', ...BUREAU_IDS].sort())
      for (let i = 1; i < outcome.bids.length; i++) expect(outcome.bids[i]!.total).toBeLessThanOrEqual(outcome.bids[i - 1]!.total)
      expect(outcome.bids[outcome.place - 1]!.who).toBe('bureau')
      expect(outcome.won).toBe(outcome.place === 1)
    }
  }, SLOW)

  it('can be won and can be lost', () => {
    expect(outcomes.some((career) => career.outcome!.won)).toBe(true)
    const base = [1, 2, 3, 4, 5, 6].map((seed) => decided(BASELINE_SPEC, seed))
    expect(base.some((career) => !career.outcome!.won)).toBe(true)
  }, SLOW)

  it('adopts the winner under a designation and raises the army\'s opinion', () => {
    const won = outcomes.find((career) => career.outcome!.won)!
    expect(won.outcome!.designation).toBe('Model 81')
    expect(won.adopted).toHaveLength(1)
    expect(won.adopted[0]!.designation).toBe('Model 81')
    expect(won.reputation.army).toBe(CAREER.reputation.start + CAREER.reputation.army.won)
    expect(won.outcome!.standing.army).toBe(CAREER.reputation.army.won)
  })

  it('adopts nothing from a loser, lowers the army\'s opinion, and the career goes on', () => {
    const lost = [1, 2, 3, 4, 5, 6].map((seed) => decided(BASELINE_SPEC, seed)).find((career) => !career.outcome!.won)!
    expect(lost.outcome!.designation).toBeNull()
    expect(lost.adopted).toEqual([])
    expect(lost.reputation.army).toBeLessThan(CAREER.reputation.start + CAREER.reputation.army.won)
    expect(lost.budgetKr).toBeGreaterThan(0)
  }, SLOW)

  it('pleases the Pact with the Type 1 parts and displeases it without them', () => {
    const standard = decided(BASELINE_SPEC, 1)
    expect(standard.outcome!.standing.pact).toBe(CAREER.reputation.pact.standard)
    const odd = decided(tank((spec) => {
      spec.fireControl = { sight: 'improvedDaySight', rangefinder: 'laser', stabiliser: 'twoPlane', computer: 'electronic', night: 'imageIntensifier', commanderSight: true }
    }), 1)
    expect(odd.outcome!.standing.pact).toBeLessThan(standard.outcome!.standing.pact)
  })

  it('charges standing for revisions, and more for one beyond the rule', () => {
    let career: Career = { ...buildPrototype(newCareer(1), BASELINE_SPEC), budgetKr: 1e9 }
    const none = enterTender(career, 1).outcome!.standing
    for (let i = 0; i < 3; i++) career = buildPrototype(career, STEPS[i]!)
    const three = enterTender(career, 1).outcome!.standing
    career = buildPrototype(career, STEPS[3]!)
    const four = enterTender(career, 1).outcome!.standing
    const R = CAREER.reputation
    expect(three.ministry - none.ministry).toBe(3 * R.ministry.revision)
    expect(three.army).toBe(none.army)
    expect(four.army - three.army).toBe(R.army.extraRevision)
    expect(four.ministry - three.ministry).toBe(R.ministry.extraRevision)
  })

  it('lets the bureau enter an earlier prototype than its last', () => {
    let career = buildPrototype(newCareer(1), LASER)
    career = buildPrototype(career, BASELINE_SPEC)
    expect(enterTender(career, 1).outcome!.entered).toBe(1)
    expect(enterTender(career, 1).outcome!.bids.find((each) => each.who === 'bureau')!.total).toBe(prototypeTrial(career, 1)!.score.total)
    expect(() => enterTender(career, 3)).toThrow()
  })

  it('is final: nothing more is built or entered', () => {
    const done = outcomes[0]!
    expect(buildBlock(done, NIGHT)).toBe('decided')
    expect(() => enterTender(done, 1)).toThrow()
  })

  it('keeps standing between nought and a hundred', () => {
    const low = { ...buildPrototype(newCareer(1), BASELINE_SPEC), reputation: { army: 1, ministry: 99, pact: 99 } }
    const after = enterTender(low, 1)
    for (const body of BODIES) {
      expect(after.reputation[body]).toBeGreaterThanOrEqual(0)
      expect(after.reputation[body]).toBeLessThanOrEqual(100)
      expect(after.reputation[body] - low.reputation[body]).toBe(after.outcome!.standing[body])
    }
  })

  it('survives a trip through JSON, as a save must', () => {
    const done = outcomes[0]!
    expect(JSON.parse(JSON.stringify(done))).toEqual(done)
  })
})
