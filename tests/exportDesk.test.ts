import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { CUSTOMER_IDS, CUSTOMERS, EXPORT_DESK, NEED_IDS, NEED_KINDS } from '../src/data/export'
import { CLIMATES } from '../src/data/range'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { newCareer, type Adopted } from '../src/sim/career/career'
import { customerChecks, exportOpen, exportTrial, orderOf, saleBlock, saleFeeKr, secrets, sell, sellVariant, strained, suits, variantBlock, variantCostKr, variantDesignation } from '../src/sim/career/exportDesk'
import { cleanCareer } from '../src/persist/careerCodec'
import { buildStatSheet, type VehicleSpec } from '../src/sim/vehicle'

const sheetOf = (spec: VehicleSpec) => buildStatSheet(spec, PACT_LIMITS_GEN1)

describe('the export desk', () => {
  it('opens with the first tank the army adopts', () => {
    const career = newCareer(3)
    expect(exportOpen(career)).toBe(false)
    const tank: Adopted = {
      designation: 'Model 81', name: '', year: 1981, tender: 'improvedType1', spec: structuredClone(BASELINE_SPEC),
      production: null, years: 0, contract: null, upgrades: [],
    }
    expect(exportOpen({ ...career, adopted: [tank] })).toBe(true)
  })

  it('has a name, a line and a word for every customer and need', () => {
    const X = STRINGS.career.exportDesk
    for (const id of CUSTOMER_IDS) {
      expect(X.customers[id].name).not.toBe('')
      expect(X.customers[id].line).not.toBe('')
      expect(X.climates[CUSTOMERS[id].climate]).not.toBe('')
      expect(Object.keys(CUSTOMERS[id].needs).length).toBeGreaterThan(0)
    }
    for (const need of NEED_IDS) expect(X.needs[need]).not.toBe('')
  })

  it('checks each need the right way round', () => {
    const sheet = sheetOf(BASELINE_SPEC)
    for (const id of CUSTOMER_IDS) {
      for (const check of customerChecks(id, BASELINE_SPEC, sheet)) {
        const kind = NEED_KINDS[check.need]
        expect(check.met).toBe(kind === 'atMost' ? check.have <= check.want : check.have >= check.want)
      }
    }
  })

  it('finds the Type 1 as issued suits no one: each customer asks for something new', () => {
    expect(suits(BASELINE_SPEC, sheetOf(BASELINE_SPEC))).toEqual([])
    for (const id of CUSTOMER_IDS) {
      expect(customerChecks(id, BASELINE_SPEC, sheetOf(BASELINE_SPEC)).some((check) => !check.met)).toBe(true)
    }
  })

  it('is suited by a tank built for the customer', () => {
    const desert = structuredClone(BASELINE_SPEC)
    desert.powerpack.cooling = 'heavyDuty'
    desert.powerpack.fuelL = 1400
    const checks = customerChecks('dahrat', desert, sheetOf(desert))
    expect(checks.filter((check) => !check.met).map((check) => check.need)).toEqual([])
    expect(suits(desert, sheetOf(desert))).toContain('dahrat')
  })
})

describe('selling abroad', () => {
  const desert = (): VehicleSpec => {
    const spec = structuredClone(BASELINE_SPEC)
    spec.powerpack.cooling = 'heavyDuty'
    spec.powerpack.fuelL = 1400
    return spec
  }
  const withTank = (spec: VehicleSpec, production: Adopted['production'] = { rate: 'steady', quality: 'standard' }) => {
    const tank: Adopted = {
      designation: 'Model 81', name: '', year: 1981, tender: 'improvedType1', spec, production, years: 0, contract: null, upgrades: [],
    }
    return { ...newCareer(3), adopted: [tank] }
  }

  it('sells a tank that suits: the fee is paid, the ministry is pleased and the customer orders once', () => {
    const career = withTank(desert())
    expect(saleBlock(career, 0, 'dahrat')).toBeNull()
    const after = sell(career, 0, 'dahrat')
    const trial = exportTrial(career, 'dahrat', sheetOf(desert()))
    const tanks = orderOf('dahrat', trial)
    const fee = saleFeeKr(tanks, sheetOf(desert()).unitCostKr)
    expect(fee).toBeGreaterThan(0)
    expect(fee % 1000).toBe(0)
    expect(after.budgetKr).toBe(career.budgetKr + fee)
    expect(after.reputation.ministry).toBe(career.reputation.ministry + EXPORT_DESK.saleMinistry)
    expect(after.sales).toEqual([{ customer: 'dahrat', designation: 'Model 81', tanks, feeKr: fee, variant: null, trial }])
    expect(saleBlock(after, 0, 'dahrat')).toBe('sold')
    expect(() => sell(after, 0, 'dahrat')).toThrow()
    expect(career.sales).toEqual([])
  })

  it('does not sell a tank that falls short, or one with no production line', () => {
    expect(saleBlock(withTank(structuredClone(BASELINE_SPEC)), 0, 'dahrat')).toBe('needs')
    expect(saleBlock(withTank(desert(), null), 0, 'dahrat')).toBe('noLine')
    expect(saleBlock(newCareer(3), 0, 'dahrat')).toBe('closed')
  })

  it('is refused a licence for a tank carrying the bureau\'s research', () => {
    const spec = desert()
    spec.ammo.shaped = 'tandem'
    expect(secrets(spec)).toEqual(['tandemRound'])
    expect(secrets(desert())).toEqual([])
    const career = withTank(spec)
    expect(customerChecks('dahrat', spec, sheetOf(spec)).every((check) => check.met)).toBe(true)
    expect(saleBlock(career, 0, 'dahrat')).toBe('secret')
  })

  it('is refused a licence by a ministry that thinks little of the bureau', () => {
    const career = withTank(desert())
    const low = { ...career, reputation: { ...career.reputation, ministry: EXPORT_DESK.ministryStanding - 1 } }
    expect(saleBlock(low, 0, 'dahrat')).toBe('standing')
  })

  it('keeps its orders through a save, one a customer', () => {
    const after = sell(withTank(desert()), 0, 'dahrat')
    const back = cleanCareer(JSON.parse(JSON.stringify(after)))
    expect(back?.sales).toEqual(after.sales)
    const doubled = cleanCareer({ ...JSON.parse(JSON.stringify(after)), sales: [...after.sales, ...after.sales, { customer: 'nowhere' }] })
    expect(doubled?.sales).toEqual(after.sales)
    expect(cleanCareer({ seed: 1 })?.sales).toEqual([])
  })

  it('sells a version built for the customer: the work-up is paid for and the fee comes in', () => {
    const career = withTank(structuredClone(BASELINE_SPEC))
    const tank = career.adopted[0]!
    expect(variantBlock(career, 0, 'dahrat', BASELINE_SPEC)).toBe('same')
    expect(variantBlock(career, 0, 'dahrat', desert())).toBeNull()
    const after = sellVariant(career, 0, 'dahrat', desert())
    const sale = after.sales[0]!
    expect(sale.designation).toBe(variantDesignation(tank, 'dahrat'))
    expect(sale.designation).not.toBe('Model 81')
    expect(sale.variant?.powerpack.cooling).toBe('heavyDuty')
    expect(after.budgetKr).toBe(career.budgetKr - variantCostKr(career, tank, desert()) + sale.feeKr)
    expect(variantBlock(after, 0, 'dahrat', desert())).toBe('sold')
    expect(cleanCareer(JSON.parse(JSON.stringify(after)))?.sales).toEqual(after.sales)
  })

  it('holds a version to the line the tank is built on, the customer, the ministry and the budget', () => {
    const career = withTank(structuredClone(BASELINE_SPEC))
    const otherGun = desert()
    otherGun.turret.ringMm += 100
    expect(variantBlock(career, 0, 'dahrat', otherGun)).toBe('fixed')
    const short = desert()
    short.powerpack.fuelL = 1000
    expect(variantBlock(career, 0, 'dahrat', short)).toBe('needs')
    const secret = desert()
    secret.ammo.shaped = 'tandem'
    const lab = { ...career, tenderNo: 1, researched: ['tandemRound' as const] }
    expect(variantBlock(lab, 0, 'dahrat', secret)).toBe('secret')
    expect(variantBlock(career, 0, 'dahrat', secret)).toBe('illegal')
    expect(variantBlock({ ...career, budgetKr: 0 }, 0, 'dahrat', desert())).toBe('noMoney')
    expect(() => sellVariant({ ...career, budgetKr: 0 }, 0, 'dahrat', desert())).toThrow()
  })

  it('gives every customer a mark of its own', () => {
    const marks = CUSTOMER_IDS.map((id) => CUSTOMERS[id].mark)
    expect(new Set(marks).size).toBe(marks.length)
    for (const mark of marks) expect(mark).not.toBe('')
  })

  it('tries the tank on the customer\'s ground, the same way every time', () => {
    const career = withTank(desert())
    const sheet = sheetOf(desert())
    const trial = exportTrial(career, 'dahrat', sheet)
    expect(exportTrial(career, 'dahrat', sheet)).toEqual(trial)
    expect(trial.tanks).toBe(EXPORT_DESK.trial.tanks)
    expect(strained('dahrat', sheet)).toEqual([])
    expect(trial.towed).toBe(0)
  })

  it('breaks a tank down where the ground works it past its rating, and the order is cut', () => {
    const sheet = sheetOf(BASELINE_SPEC)
    // Standard cooling in the heat; a heavy tank on soft ground; a long climb.
    expect(strained('dahrat', sheet)).toContain('engine')
    expect(strained('ilandu', sheet)).toContain('suspension')
    expect(strained('tolmar', sheet)).toContain('engine')
    for (const id of CUSTOMER_IDS) {
      const trial = exportTrial(newCareer(5), id, sheet)
      expect(trial.verdict).toBe('bad')
      expect(trial.worst).not.toBeNull()
      expect(orderOf(id, trial)).toBe(Math.round(CUSTOMERS[id].tanks * EXPORT_DESK.trial.badShare))
    }
    expect(orderOf('dahrat', { tanks: 12, stops: 0, towed: 0, worst: null, verdict: 'good' })).toBe(CUSTOMERS.dahrat.tanks)
    expect(orderOf('dahrat', { tanks: 12, stops: 5, towed: 0, worst: 'engine', verdict: 'poor' })).toBe(Math.round(CUSTOMERS.dahrat.tanks * EXPORT_DESK.trial.cutShare))
  })

  it('is at home in a temperate climate: the home endurance run is not changed', () => {
    expect(CLIMATES.temperate).toEqual({ cooling: 1, drive: 1, ride: 1 })
  })

  it('keeps the trial through a save, and reads an order from before there were trials', () => {
    const after = sell(withTank(desert()), 0, 'dahrat')
    const raw = JSON.parse(JSON.stringify(after))
    expect(cleanCareer(raw)?.sales[0]?.trial).toEqual(after.sales[0]!.trial)
    delete raw.sales[0].trial
    expect(cleanCareer(raw)?.sales[0]?.trial).toBeNull()
    expect(cleanCareer(raw)?.sales[0]?.tanks).toBe(after.sales[0]!.tanks)
  })
})
