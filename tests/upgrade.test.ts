import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { SERVICE } from '../src/data/service'
import { TENDERS } from '../src/data/tenders'
import { cleanCareer } from '../src/persist/careerCodec'
import {
  buildPrototype, enterTender, fitUpgrade, newCareer, reportOf, serviceDesignation, serviceSpec, serviceYear, startProduction,
  upgradeBlock, upgradeCostKr, upgradesLeft, type Career,
} from '../src/sim/career/career'
import { askOf } from '../src/sim/career/service'
import { askMeasure, fixedPartsChanged, massCeilingT } from '../src/sim/career/upgrade'
import type { VehicleSpec } from '../src/sim/vehicle/spec'
import { buildStatSheet } from '../src/sim/vehicle/stats'

const SLOW = 30_000
const T = TENDERS.improvedType1
const U = SERVICE.upgrade

function tank(from: VehicleSpec, change: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(from)
  change(spec)
  return spec
}
const LASER = tank(BASELINE_SPEC, (spec) => { spec.fireControl.night = 'imageIntensifier'; spec.fireControl.rangefinder = 'laser' })
const SHEET = buildStatSheet(LASER, T.limits)
/** A package that takes work off the crew. */
const EASIER = tank(LASER, (spec) => { spec.crew.comfort = 'improved' })

/** A career with its tank in production and one year of service: the army wants the crew's work eased. */
function serving(): Career {
  const career = enterTender(buildPrototype(newCareer(2), LASER), 1)
  expect(career.outcome!.won).toBe(true)
  return serviceYear(startProduction(career, 0, SERVICE.defaultProduction), 0)
}

describe('what the army asks for', () => {
  const report = reportOf(serving(), 0, 1)!
  it('comes from the year: breakdowns first, then the exercise, then the crews', () => {
    expect(report.ask).toEqual(askOf(report))
    const bad = { ...report.running, stops: report.running.tanks, towed: report.running.tanks }
    expect(askOf({ ...report, running: bad })).toEqual({ kind: 'reliability' })
    const quiet = { ...report.running, stops: 0, towed: 0 }
    const noLessons = { ...report.exercise, lessons: [] }
    expect(askOf({ running: quiet, exercise: noLessons, complaints: [{ kind: 'comfort' }] as never })).toEqual({ kind: 'comfort' })
    expect(askOf({ running: quiet, exercise: noLessons, complaints: [] })).toBeNull()
  }, SLOW)
})

describe('measuring a package', () => {
  it('asks for a set step on the figure the army is looking at', () => {
    const better = buildStatSheet(EASIER, T.limits)
    const workload = askMeasure({ kind: 'workload' }, SHEET, better)
    expect(workload.need).toBe(SHEET.crewWorkload - U.asks.workload)
    expect(workload.met).toBe(true)
    expect(askMeasure({ kind: 'workload' }, SHEET, SHEET).met).toBe(false)
    expect(askMeasure({ kind: 'comfort' }, SHEET, better).met).toBe(true)
    expect(askMeasure({ kind: 'reliability' }, SHEET, better).met).toBe(false)
    const plate = askMeasure({ kind: 'protection', zone: 'upperGlacis' }, SHEET, SHEET)
    expect(plate.need).toBeCloseTo(SHEET.protection.upperGlacis.keMm * (1 + U.asks.protection))
    expect(plate.met).toBe(false)
    expect(askMeasure({ kind: 'firstShot' }, SHEET, SHEET).met).toBe(false)
  })

  it('knows what cannot be changed on a built tank', () => {
    expect(fixedPartsChanged(LASER, EASIER)).toEqual([])
    const rebuilt = tank(LASER, (spec) => { spec.turret.ringMm += 100; spec.hull.glacisAngleDeg -= 2 })
    expect(fixedPartsChanged(LASER, rebuilt)).toEqual(['hull.glacisAngleDeg', 'turret.ringMm'])
    expect(massCeilingT(SHEET)).toBeCloseTo(SHEET.massT + SHEET.growth.massT)
  })
})

describe('upgrade contracts', () => {
  it('open on what a year showed, one at a time', () => {
    const fresh = startProduction(enterTender(buildPrototype(newCareer(2), LASER), 1), 0, SERVICE.defaultProduction)
    expect(fresh.adopted[0]!.contract).toBeNull()
    expect(upgradeBlock(fresh, 0, EASIER)).toBe('none')
    const career = serving()
    expect(career.adopted[0]!.contract).toEqual(reportOf(career, 0, 1)!.ask)
    expect(career.adopted[0]!.contract).toEqual({ kind: 'workload' })
    // A second year does not replace the contract that is open.
    expect(serviceYear(career, 0).adopted[0]!.contract).toEqual({ kind: 'workload' })
  }, SLOW)

  it('say why a design cannot be fitted', () => {
    const career = serving()
    expect(upgradeBlock(career, 0, LASER)).toBe('same')
    expect(upgradeBlock(career, 0, tank(EASIER, (spec) => { spec.turret.ringMm += 100 }))).toBe('fixed')
    expect(upgradeBlock(career, 0, tank(EASIER, (spec) => { spec.armour.upperGlacis[0]!.mm += 60 }))).toBe('mass')
    expect(upgradeBlock(career, 0, tank(LASER, (spec) => { spec.powerpack.apu = true }))).toBe('ask')
    expect(upgradeBlock({ ...career, budgetKr: 1000 }, 0, EASIER)).toBe('noMoney')
    expect(upgradeBlock(career, 0, EASIER)).toBeNull()
    expect(() => fitUpgrade(career, 0, LASER)).toThrow()
  }, SLOW)

  it('fit a package: paid for, paid back, lettered, and reported on from the next year', () => {
    const career = serving()
    const fitted = fitUpgrade(career, 0, EASIER)
    const model = fitted.adopted[0]!
    expect(model.contract).toBeNull()
    expect(model.upgrades).toEqual([{ letter: 'A', afterYear: 1, spec: EASIER, ask: { kind: 'workload' } }])
    expect(serviceDesignation(model)).toBe(`${model.designation}A`)
    expect(upgradesLeft(model)).toBe(U.letters.length - 1)
    expect(fitted.budgetKr).toBe(career.budgetKr - upgradeCostKr(career.adopted[0]!, EASIER) + U.feeKr)
    expect(fitted.reputation.army).toBeGreaterThan(career.reputation.army)
    // The first year's report is still of the tank as adopted; the next is of the upgraded one.
    expect(serviceSpec(model, 1)).toEqual(LASER)
    expect(serviceSpec(model, 2)).toEqual(EASIER)
    expect(reportOf(fitted, 0, 1)).toEqual(reportOf(career, 0, 1))
    const next = serviceYear(fitted, 0)
    const withIt = reportOf(next, 0, 2)!
    const without = reportOf(serviceYear(career, 0), 0, 2)!
    expect(withIt.complaints.some((each) => each.kind === 'workload')).toBe(false)
    expect(without.complaints.some((each) => each.kind === 'workload')).toBe(true)
  }, SLOW)

  it('lapse when the tank leaves service', () => {
    let career = serving()
    while (career.adopted[0]!.years < SERVICE.years) career = serviceYear(career, 0)
    expect(career.adopted[0]!.contract).toBeNull()
    expect(upgradeBlock(career, 0, EASIER)).toBe('none')
  }, SLOW)

  it('survive a save, and a bad save is cleaned', () => {
    const fitted = fitUpgrade(serving(), 0, EASIER)
    expect(cleanCareer(JSON.parse(JSON.stringify(fitted)))).toEqual(fitted)
    const open = serving()
    expect(cleanCareer(JSON.parse(JSON.stringify(open)))).toEqual(open)
    const raw = JSON.parse(JSON.stringify(fitted))
    raw.adopted[0].contract = { kind: 'nonsense' }
    raw.adopted[0].upgrades[0].letter = 'Z'
    raw.adopted[0].upgrades[0].afterYear = 99
    raw.adopted[0].upgrades.push({ ask: { kind: 'protection' }, spec: {} }, 7)
    const cleaned = cleanCareer(raw)!.adopted[0]!
    expect(cleaned.contract).toBeNull()
    expect(cleaned.upgrades).toHaveLength(1)
    expect(cleaned.upgrades[0]!.letter).toBe('A')
    expect(cleaned.upgrades[0]!.afterYear).toBe(1)
  }, SLOW)
})
