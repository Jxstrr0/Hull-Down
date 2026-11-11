import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BUILD_QUALITIES, BUILD_RATES, SERVICE, type Production } from '../src/data/service'
import { STRINGS } from '../src/data/strings'
import { TENDERS } from '../src/data/tenders'
import {
  buildPrototype, enterTender, newCareer, serviceYear, startProduction, type Adopted,
} from '../src/sim/career/career'
import { fieldReport, type Complaint } from '../src/sim/career/service'
import { buildStatSheet } from '../src/sim/vehicle/stats'
import {
  complaintText, exerciseLine, faultsLine, feeLine, fleetLine, lessonLines, productionLines, productionSummary, rateLine,
  reportStanding, runningLines, serviceTitle, shootLine, yearsLeftLine, askText, fittedLine, upgradeCheck,
} from '../src/ui/serviceWords'

const T = TENDERS.improvedType1
const U = STRINGS.service.upgrade
const SHEET = buildStatSheet(BASELINE_SPEC, T.limits)
const TANK: Adopted = {
  designation: 'Model 81', name: 'Night owl', year: 1981, tender: 'improvedType1', spec: BASELINE_SPEC, production: null, years: 0, contract: null, upgrades: [],
}
const STEADY: Production = SERVICE.defaultProduction

/** No line may be left with a gap in it. */
function whole(text: string): void {
  expect(text).not.toMatch(/[{}]|undefined|NaN/)
  expect(text.trim().length).toBeGreaterThan(0)
}

describe('the words for production', () => {
  it('name the tank by its designation and the bureau\'s own name', () => {
    expect(serviceTitle(TANK)).toBe('Model 81 · Night owl')
    expect(serviceTitle({ ...TANK, name: '' })).toBe('Model 81')
  })

  it('say how much trouble a setting brings, set against the prototype', () => {
    expect(faultsLine(1)).toBe(STRINGS.service.production.faultsSame)
    expect(faultsLine(1.5)).toContain('50 % more')
    expect(faultsLine(0.65)).toContain('35 % less')
  })

  it('give every choice of rate and quality whole lines', () => {
    for (const rate of BUILD_RATES) {
      whole(rateLine(rate))
      expect(rateLine(rate)).toContain(String(SERVICE.rates[rate].tanksAYear))
      for (const quality of BUILD_QUALITIES) {
        const lines = productionLines(TANK, SHEET, { rate, quality })
        for (const line of lines) whole(line.value)
        whole(productionSummary({ rate, quality }, SHEET.unitCostKr))
      }
    }
  })

  it('say what the choice does to the bureau\'s standing, or that it does nothing', () => {
    const standing = (production: Production): string => productionLines(TANK, SHEET, production).find((line) => line.label === STRINGS.service.production.standing)!.value
    expect(standing(STEADY)).toBe(STRINGS.service.production.noStanding)
    expect(standing({ rate: 'rush', quality: 'standard' })).toContain('The army: up 2')
    expect(standing({ rate: 'slow', quality: 'standard' })).toContain('The ministry: down 2')
  })

  it('warn when the tank as built is over the tender\'s ceiling, and only then', () => {
    const dear = { ...SHEET, unitCostKr: T.limits.maxUnitCostKr }
    expect(productionLines(TANK, dear, STEADY).some((line) => line.bad)).toBe(false)
    const over = productionLines(TANK, dear, { rate: 'steady', quality: 'careful' }).filter((line) => line.bad)
    expect(over).toHaveLength(1)
    whole(over[0]!.value)
  })

  it('count down the reports still to come', () => {
    const made: Adopted = { ...TANK, production: STEADY }
    expect(yearsLeftLine(made)).toContain(String(SERVICE.years))
    expect(yearsLeftLine({ ...made, years: SERVICE.years - 1 })).toBe(STRINGS.service.years.oneLeft)
    expect(yearsLeftLine({ ...made, years: SERVICE.years })).toContain('closed')
  })
})

describe('the words of a field report', () => {
  const reports = [1, 2, 3, 4, 5, 6].map((year) => fieldReport(BASELINE_SPEC, T, { rate: 'rush', quality: 'economy' }, year, 7))

  it('are whole, every line of every year', () => {
    for (const report of reports) {
      for (const line of runningLines(report)) whole(line)
      for (const complaint of report.complaints) whole(complaintText(complaint))
      for (const lesson of lessonLines(report)) whole(lesson.text)
      for (const change of reportStanding(report)) whole(change.text)
      whole(fleetLine(report))
      whole(shootLine(report))
      whole(exerciseLine(report))
      whole(feeLine(report))
    }
  }, 30_000)

  it('say when the order is filled and no fee is due', () => {
    const last = reports[reports.length - 1]!
    expect(last.built).toBe(0)
    expect(fleetLine(last)).toContain('The order is filled')
    expect(feeLine(last)).toBe(STRINGS.service.report.noFee)
    expect(fleetLine(reports[0]!)).toContain('200 built this year')
  })

  it('name the part that gave most trouble, and leave it out when nothing did', () => {
    const report = reports[0]!
    const quiet = { ...report, running: { ...report.running, stops: 0, towed: 0, worst: null } }
    expect(runningLines(quiet)).toHaveLength(2)
    expect(runningLines(quiet)[1]).toBe(STRINGS.service.report.noStops)
    const towed = { ...report, running: { ...report.running, stops: 1, towed: 2, worst: 'engine' as const } }
    expect(runningLines(towed).join(' ')).toMatch(/One stop.*2 towed in.*engine/)
  })

  it('put every kind of complaint into a sentence, with its cause when there is one', () => {
    const complaints: Complaint[] = [
      { kind: 'workload', station: 'commander', workload: 67, source: 'noLoader' },
      { kind: 'workload', station: 'gunner', workload: 70, source: null },
      { kind: 'comfort', score: 35, source: 'fittings' },
      { kind: 'comfort', score: 30, source: null },
      { kind: 'needsExperts', conscripts: 5, cadre: 11, targets: 15 },
      { kind: 'threeMen' },
    ]
    for (const complaint of complaints) whole(complaintText(complaint))
    expect(complaintText(complaints[0]!)).toContain('commander')
    expect(complaintText(complaints[0]!)).toContain('no loader')
    expect(complaintText(complaints[4]!)).toContain('5 of 15')
  })

  it('list only the bodies whose opinion moved', () => {
    const report = { ...reports[0]!, standing: { army: -2, ministry: 0, pact: 0 } }
    expect(reportStanding(report)).toEqual([{ body: 'army', text: 'The army: down 2' }])
    expect(reportStanding({ ...report, standing: { army: 0, ministry: 0, pact: 0 } })).toEqual([])
  })
})

describe('upgrade contract words', () => {
  const LASER = structuredClone(BASELINE_SPEC)
  LASER.fireControl.night = 'imageIntensifier'
  LASER.fireControl.rangefinder = 'laser'
  const EASIER = structuredClone(LASER)
  EASIER.crew.comfort = 'improved'
  const career = serviceYear(startProduction(enterTender(buildPrototype(newCareer(2), LASER), 1), 0, STEADY), 0)

  it('say what the army asks for', () => {
    expect(askText({ kind: 'workload' })).toBe(U.asks.workload)
    expect(askText({ kind: 'protection', zone: 'upperGlacis' })).toContain('upper glacis')
    expect(fittedLine({ designation: 'Model 81' }, { letter: 'A', afterYear: 2, spec: LASER, ask: { kind: 'firstShot' } }))
      .toBe('Model 81A · after year 2 · a faster first shot')
  })

  it('judge the board against the contract', () => {
    expect(upgradeCheck(newCareer(1), 0, LASER)).toBeNull()
    const same = upgradeCheck(career, 0, LASER)!
    expect(same.block).toBe('same')
    expect(same.blockText).toBe(U.blocks.same)
    expect(same.met).toBe(false)
    const good = upgradeCheck(career, 0, EASIER)!
    expect(good.block).toBeNull()
    expect(good.blockText).toBe('')
    expect(good.met).toBe(true)
    expect(good.designation).toBe(`${career.adopted[0]!.designation}A`)
    expect(good.rows[0]!.value).toContain(U.orLess)
    expect(good.rows.map((row) => row.label)).toEqual([U.measures.workload, U.weight, U.cooling, U.cost, U.fee])
    const rebuilt = structuredClone(EASIER)
    rebuilt.turret.ringMm += 100
    expect(upgradeCheck(career, 0, rebuilt)!.blockText).toContain(STRINGS.controls['turret.ringMm'].label.toLowerCase())
    const heavy = structuredClone(EASIER)
    heavy.armour.upperGlacis[0]!.mm += 60
    expect(upgradeCheck(career, 0, heavy)!.blockText).toMatch(/Too heavy: \d+\.\d t/)
  }, 30_000)
})
