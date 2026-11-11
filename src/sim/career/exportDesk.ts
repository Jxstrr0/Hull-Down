// The export desk: which customers abroad a tank of the bureau's would suit.
// It opens with the first tank the army adopts.
import { CUSTOMER_IDS, CUSTOMERS, EXPORT_DESK, NEED_IDS, NEED_KINDS, type CustomerId, type NeedId } from '../../data/export'
import type { StatSheet } from '../vehicle/stats'
import type { VehicleSpec } from '../vehicle/spec'
import type { Career } from './career'

/** True once the bureau may look for customers abroad. */
export function exportOpen(career: Career): boolean {
  return career.adopted.length >= EXPORT_DESK.opensAfterAdopted
}

/** The tank's own figure for one need. A fitted part is 1 or 0. */
export function needFigure(need: NeedId, spec: VehicleSpec, sheet: StatSheet): number {
  switch (need) {
    case 'heavyCooling': return spec.powerpack.cooling === 'heavyDuty' ? 1 : 0
    case 'rangeKm': return sheet.mobility.rangeKm
    case 'maxMassT': return sheet.massT
    case 'groundPressure': return sheet.mobility.groundPressureKgCm2
    case 'powerToWeight': return sheet.mobility.powerToWeightHpT
    case 'depressionDeg': return sheet.firepower.gunDepressionDeg
    case 'unitCostKr': return sheet.unitCostKr
  }
}

export interface NeedCheck {
  need: NeedId
  /** What the customer asks. */
  want: number
  /** What the tank has. */
  have: number
  met: boolean
}

/** One customer's needs against one tank, in the order the needs are listed. */
export function customerChecks(customer: CustomerId, spec: VehicleSpec, sheet: StatSheet): NeedCheck[] {
  const needs = CUSTOMERS[customer].needs
  const checks: NeedCheck[] = []
  for (const need of NEED_IDS) {
    const want = needs[need]
    if (want === undefined) continue
    const have = needFigure(need, spec, sheet)
    const met = NEED_KINDS[need] === 'atMost' ? have <= want : have >= want
    checks.push({ need, want, have, met })
  }
  return checks
}

/** The customers a tank suits as it stands. */
export function suits(spec: VehicleSpec, sheet: StatSheet): CustomerId[] {
  return CUSTOMER_IDS.filter((customer) => customerChecks(customer, spec, sheet).every((check) => check.met))
}
