import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BODIES, CAREER } from '../src/data/career'
import { BUILD_QUALITIES, BUILD_RATES, SERVICE, type Production } from '../src/data/service'
import { TENDERS } from '../src/data/tenders'
import { cleanCareer } from '../src/persist/careerCodec'
import {
  buildPrototype, enterTender, newCareer, productionStanding, reportOf, serviceYear, serviceYearsLeft, startProduction,
  type Career,
} from '../src/sim/career/career'
import { fieldReport, fleetIn, serviceFaults, serviceSheet, serviceUnitCostKr } from '../src/sim/career/service'
import type { VehicleSpec } from '../src/sim/vehicle/spec'
import { buildStatSheet } from '../src/sim/vehicle/stats'

const SLOW = 30_000
const T = TENDERS.improvedType1
const STEADY: Production = SERVICE.defaultProduction
const CHEAP: Production = { rate: 'rush', quality: 'economy' }
const CAREFUL: Production = { rate: 'slow', quality: 'careful' }
const SHEET = buildStatSheet(BASELINE_SPEC, T.limits)

function tank(change: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  change(spec)
  return spec
}
const LASER = tank((spec) => { spec.fireControl.night = 'imageIntensifier'; spec.fireControl.rangefinder = 'laser' })

/** A career that has just won its tender. */
function won(): Career {
  for (let seed = 1; seed <= 10; seed++) {
    const career = enterTender(buildPrototype(newCareer(seed), LASER), 1)
    if (career.outcome!.won) return career
  }
  throw new Error('no seed wins')
}

describe('production settings', () => {
  it('trade cost against trouble, each way', () => {
    const R = SERVICE.rates
    const Q = SERVICE.qualities
    expect(R.slow.cost).toBeGreaterThan(R.steady.cost)
    expect(R.rush.cost).toBeLessThan(R.steady.cost)
    expect(R.slow.faults).toBeLessThan(R.steady.faults)
    expect(R.rush.faults).toBeGreaterThan(R.steady.faults)
    expect(Q.economy.cost).toBeLessThan(Q.standard.cost)
    expect(Q.careful.cost).toBeGreaterThan(Q.standard.cost)
    expect(Q.economy.faults).toBeGreaterThan(Q.standard.faults)
    expect(Q.careful.faults).toBeLessThan(Q.standard.faults)
    expect(R.steady).toMatchObject({ cost: 1, faults: 1, army: 0, ministry: 0 })
    expect(Q.standard).toEqual({ cost: 1, faults: 1 })
  })

  it('set the unit cost and the reliability of the tank as built', () => {
    expect(serviceUnitCostKr(1000, STEADY)).toBe(1000)
    expect(serviceUnitCostKr(1000, CHEAP)).toBeLessThan(1000)
    expect(serviceUnitCostKr(1000, CAREFUL)).toBeGreaterThan(1000)
    const cheap = serviceSheet(SHEET, CHEAP, 1)
    const careful = serviceSheet(SHEET, CAREFUL, 1)
    expect(cheap.reliabilityIndex).toBeLessThan(SHEET.reliabilityIndex)
    expect(careful.reliabilityIndex).toBeGreaterThan(cheap.reliabilityIndex)
    expect(cheap.wear.engine.reliability).toBeLessThan(SHEET.wear.engine.reliability)
    expect(cheap.unitCostKr).toBeLessThan(careful.unitCostKr)
    // The design itself is not touched.
    expect(cheap.massT).toBe(SHEET.massT)
    expect(SHEET.reliabilityIndex).toBe(buildStatSheet(BASELINE_SPEC, T.limits).reliabilityIndex)
  })

  it('make a fleet older every year, and a three-man tank harder to keep up', () => {
    expect(serviceFaults({ crewCount: 4 }, STEADY, 1)).toBe(1)
    expect(serviceFaults({ crewCount: 3 }, STEADY, 1)).toBeCloseTo(SERVICE.threeMenFaults)
    expect(serviceFaults({ crewCount: 4 }, STEADY, 4)).toBeCloseTo(1 + 3 * SERVICE.ageingFaults)
  })

  it('fill the army\'s order at the rate chosen and then stop', () => {
    for (const rate of BUILD_RATES) {
      let total = 0
      for (let year = 1; year <= 20; year++) {
        const { built, fleet } = fleetIn({ rate, quality: 'standard' }, year)
        total += built
        expect(fleet).toBe(total)
      }
      expect(total).toBe(SERVICE.orderTanks)
      expect(fleetIn({ rate, quality: 'standard' }, 1).built).toBe(SERVICE.rates[rate].tanksAYear)
    }
  })
})

describe('a field report', () => {
  const report = fieldReport(BASELINE_SPEC, T, STEADY, 1, 7)

  it('is the same every time, and each year has its own', () => {
    expect(fieldReport(BASELINE_SPEC, T, STEADY, 1, 7)).toEqual(report)
    const next = fieldReport(BASELINE_SPEC, T, STEADY, 2, 7)
    expect(next.year).toBe(2)
    expect(next.exercise?.ground).not.toBe(report.exercise?.ground)
    expect(fieldReport(BASELINE_SPEC, T, STEADY, 1, 8)).not.toEqual(report)
  })

  it('adds up', () => {
    const { running, shoot, exercise } = report
    expect(running.tanks).toBe(SERVICE.running.tanks)
    expect(running.clean + running.towed).toBeLessThanOrEqual(running.tanks)
    expect(Object.values(running.byPart).reduce((sum, n) => sum + n, 0)).toBe(running.stops + running.towed)
    if (running.stops + running.towed > 0) expect(running.byPart[running.worst!]).toBe(Math.max(...Object.values(running.byPart)))
    else expect(running.worst).toBeNull()
    expect(shoot.conscripts).toBeLessThanOrEqual(shoot.targets)
    expect(shoot.cadre).toBeLessThanOrEqual(shoot.targets)
    if (!exercise) throw new Error("a tank always goes on exercise")
    expect(exercise.won + exercise.lost + exercise.drawn).toBe(SERVICE.exercise.battles)
    expect(exercise.lessons.length).toBeLessThanOrEqual(SERVICE.exercise.lessons)
    expect(T.threats).toContain(exercise.threat)
    expect(report.royaltyKr).toBeCloseTo(report.built * SHEET.unitCostKr * SERVICE.royaltyShare, -3)
    for (const body of BODIES) expect(Number.isInteger(report.standing[body])).toBe(true)
  })

  it('says what the crews of the Type 1 as issued say: the commander is overworked and it is hard to live in', () => {
    const kinds = report.complaints.map((each) => each.kind)
    expect(kinds).toContain('workload')
    expect(kinds).toContain('comfort')
    expect(kinds).toContain('threeMen')
    const work = report.complaints.find((each) => each.kind === 'workload')
    expect(work).toMatchObject({ station: 'commander', source: 'noLoader' })
  })

  it('hears fewer complaints of a tank with a loader and better fittings', () => {
    const kind = tank((spec) => { spec.loading = 'loader'; spec.crew.comfort = 'improved' })
    const better = fieldReport(kind, T, STEADY, 1, 7)
    expect(better.complaints.map((each) => each.kind)).not.toContain('comfort')
    expect(better.complaints.map((each) => each.kind)).not.toContain('threeMen')
  })

  it('finds a cheaply built fleet gives more trouble than a carefully built one', () => {
    let cheap = 0
    let careful = 0
    for (let year = 1; year <= SERVICE.years; year++) {
      cheap += fieldReport(BASELINE_SPEC, T, CHEAP, year, 7).running.stops
      careful += fieldReport(BASELINE_SPEC, T, CAREFUL, year, 7).running.stops
    }
    expect(cheap).toBeGreaterThan(careful)
  }, SLOW)

  it('has conscripts hit no more than the range\'s own crew, over the years', () => {
    let conscripts = 0
    let cadre = 0
    for (let year = 1; year <= SERVICE.years; year++) {
      const { shoot } = fieldReport(BASELINE_SPEC, T, STEADY, year, 7)
      conscripts += shoot.conscripts
      cadre += shoot.cadre
    }
    expect(conscripts).toBeLessThan(cadre)
  }, SLOW)
})

describe('a career with a tank in service', () => {
  const start = won()

  it('adopts the tank with no production set and no years served', () => {
    expect(start.adopted[0]).toMatchObject({ tender: 'improvedType1', production: null, years: 0 })
    expect(serviceYearsLeft(start.adopted[0]!)).toBe(0)
    expect(() => serviceYear(start, 0)).toThrow()
    expect(reportOf(start, 0, 1)).toBeNull()
  })

  it('sets production once, and the army and the ministry mark how soon the tanks come', () => {
    const rushed = startProduction(start, 0, { rate: 'rush', quality: 'standard' })
    expect(rushed.adopted[0]!.production).toEqual({ rate: 'rush', quality: 'standard' })
    expect(rushed.reputation.army).toBe(Math.min(CAREER.reputation.max, start.reputation.army + SERVICE.rates.rush.army))
    expect(rushed.reputation.ministry).toBe(Math.min(CAREER.reputation.max, start.reputation.ministry + SERVICE.rates.rush.ministry))
    expect(start.adopted[0]!.production).toBeNull()
    expect(() => startProduction(rushed, 0, STEADY)).toThrow()
    expect(() => startProduction(start, 3, STEADY)).toThrow()
  })

  it('costs standing with the ministry when the tank as built is over the tender\'s ceiling', () => {
    const dear = { ...start.adopted[0]!, spec: tank((spec) => { spec.armour.upperGlacis = [{ material: 'compositeInsert', mm: 300 }, { material: 'compositeInsert', mm: 300 }, { material: 'compositeInsert', mm: 300 }] }) }
    const unit = buildStatSheet(dear.spec, T.limits).unitCostKr
    for (const quality of BUILD_QUALITIES) {
      const production: Production = { rate: 'steady', quality }
      const over = serviceUnitCostKr(unit, production) > T.limits.maxUnitCostKr
      expect(productionStanding(dear, production).ministry).toBe(over ? SERVICE.overCeilingMinistry : 0)
    }
  })

  it('passes the years one at a time, pays the fee and moves the standing as the report says', () => {
    let career = startProduction(start, 0, STEADY)
    expect(serviceYearsLeft(career.adopted[0]!)).toBe(SERVICE.years)
    for (let year = 1; year <= SERVICE.years; year++) {
      const before = career
      career = serviceYear(career, 0)
      const report = reportOf(career, 0, year)!
      expect(report.year).toBe(year)
      expect(career.adopted[0]!.years).toBe(year)
      expect(career.budgetKr).toBe(before.budgetKr + report.royaltyKr)
      for (const body of BODIES) {
        const want = before.reputation[body] + report.standing[body]
        expect(career.reputation[body]).toBe(Math.max(CAREER.reputation.min, Math.min(CAREER.reputation.max, want)))
      }
      expect(before.adopted[0]!.years).toBe(year - 1)
    }
    expect(serviceYearsLeft(career.adopted[0]!)).toBe(0)
    expect(() => serviceYear(career, 0)).toThrow()
    expect(reportOf(career, 0, SERVICE.years + 1)).toBeNull()
  }, SLOW)

  it('goes into a save and comes out the same', () => {
    const career = serviceYear(serviceYear(startProduction(start, 0, CAREFUL), 0), 0)
    expect(cleanCareer(JSON.parse(JSON.stringify(career)))).toEqual(career)
  })

  it('reads a save from before service life: the tank is adopted, with production still to set', () => {
    const old = JSON.parse(JSON.stringify(start)) as { adopted: Record<string, unknown>[] }
    for (const each of old.adopted) {
      delete each.tender
      delete each.production
      delete each.years
    }
    expect(cleanCareer(old)).toEqual(start)
  })

  it('drops service years a save claims for a tank with no production, and production it cannot read', () => {
    const raw = JSON.parse(JSON.stringify(start)) as { adopted: Record<string, unknown>[] }
    raw.adopted[0]!.years = 4
    raw.adopted[0]!.production = { rate: 'warp', quality: 'standard' }
    expect(cleanCareer(raw)!.adopted[0]).toMatchObject({ production: null, years: 0 })
    raw.adopted[0]!.production = { rate: 'slow', quality: 'careful' }
    raw.adopted[0]!.years = 99
    expect(cleanCareer(raw)!.adopted[0]).toMatchObject({ production: CAREFUL, years: SERVICE.years })
  })
})
