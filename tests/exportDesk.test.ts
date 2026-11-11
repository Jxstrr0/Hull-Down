import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { CUSTOMER_IDS, CUSTOMERS, NEED_IDS, NEED_KINDS } from '../src/data/export'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { newCareer, type Adopted } from '../src/sim/career/career'
import { customerChecks, exportOpen, suits } from '../src/sim/career/exportDesk'
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
