// The export desk: which customers abroad a tank of the bureau's would suit.
// It opens with the first tank the army adopts.
import { CUSTOMER_IDS, CUSTOMERS, EXPORT_DESK, NEED_IDS, NEED_KINDS, type CustomerId, type NeedId } from '../../data/export'
import { RANGE, RUN_PART_IDS, type RunPartId } from '../../data/range'
import { legLoad } from '../reliability/wear'
import { TENDERS } from '../../data/tenders'
import { hash32 } from '../rng'
import { runEndurance } from '../trials/endurance'
import { RESEARCH, RESEARCH_IDS, type ResearchId } from '../../data/research'
import { buildStatSheet } from '../vehicle/stats'
import type { StatSheet } from '../vehicle/stats'
import type { VehicleSpec } from '../vehicle/spec'
import { partKey, unresearched } from '../vehicle/tech'
import { sameTank, serviceDesignation, serviceSpec, upgradeLimits, withStanding, type Adopted, type Career, type ExportTrial, type Sale } from './career'
import type { FixedPart } from '../../data/service'
import { fixedPartsChanged } from './upgrade'

/** True once the bureau may look for customers abroad. */
export function exportOpen(career: Career): boolean {
  return career.adopted.length >= EXPORT_DESK.opensAfterAdopted
}

/** True when the customer buys this kind of vehicle: it looks at nothing else. */
export function buys(customer: CustomerId, tank: Adopted): boolean {
  return CUSTOMERS[customer].wants === TENDERS[tank.tender].kind
}

/** The tank's own figure for one need. A fitted part is 1 or 0. */
export function needFigure(need: NeedId, spec: VehicleSpec, sheet: StatSheet): number {
  switch (need) {
    case 'heavyCooling': return spec.powerpack.cooling === 'heavyDuty' ? 1 : 0
    case 'troops': return spec.crew.troops
    case 'rangeKm': return sheet.mobility.rangeKm
    case 'maxMassT': return sheet.massT
    case 'groundPressure': return sheet.mobility.groundPressureKgCm2
    case 'powerToWeight': return sheet.mobility.powerToWeightHpT
    case 'topSpeedKmh': return sheet.mobility.topSpeedKmh
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

/** The research a tank carries the fruit of. The ministry lets none of it out of the country. */
export function secrets(spec: VehicleSpec): ResearchId[] {
  return RESEARCH_IDS.filter((id) => unresearched(spec, [partKey(RESEARCH[id].field, RESEARCH[id].part)]).length > 0)
}

/** The bureau's fee on an order of this many tanks at this unit cost, to the nearest thousand. */
export function saleFeeKr(tanks: number, unitCostKr: number): number {
  return Math.round((tanks * unitCostKr * EXPORT_DESK.feeShare) / 1000) * 1000
}

// Names the roll that gives each customer's trial its own luck.
const EXPORT_TRIAL = 173

/**
 * The customer's own trial of a tank before it orders: a troop of them
 * over the endurance run, on the customer's ground. The same career, the
 * same customer and the same tank always go the same way.
 */
export function exportTrial(career: Career, customer: CustomerId, sheet: StatSheet): ExportTrial {
  const T = EXPORT_DESK.trial
  const climate = CUSTOMERS[customer].climate
  const seed = hash32(career.seed, EXPORT_TRIAL, CUSTOMER_IDS.indexOf(customer))
  const trial: ExportTrial = { tanks: T.tanks, stops: 0, towed: 0, worst: null, verdict: 'good' }
  const byPart = new Map<(typeof RUN_PART_IDS)[number], number>()
  for (let tank = 0; tank < T.tanks; tank++) {
    const run = runEndurance(sheet.drive, sheet.wear, { seed: hash32(seed, tank), climate })
    trial.stops += run.stops
    if (!run.finished) trial.towed++
    for (const event of run.events) byPart.set(event.part, (byPart.get(event.part) ?? 0) + 1)
  }
  for (const id of RUN_PART_IDS) {
    const times = byPart.get(id) ?? 0
    if (times > 0 && (trial.worst === null || times > (byPart.get(trial.worst) ?? 0))) trial.worst = id
  }
  const stops = trial.stops / T.tanks
  if (stops >= T.badStops || trial.towed / T.tanks >= T.badTowedShare) trial.verdict = 'bad'
  else if (stops > T.goodStops || trial.towed > 0) trial.verdict = 'poor'
  return trial
}

/** The parts of a tank that would be worked past their rating on the customer's ground, hardest worked first. */
export function strained(customer: CustomerId, sheet: StatSheet): RunPartId[] {
  const climate = CUSTOMERS[customer].climate
  const worst = (id: RunPartId) => Math.max(...RANGE.endurance.legs.map((leg) => legLoad(id, sheet.wear[id], leg, climate)))
  return RUN_PART_IDS.filter((id) => worst(id) > 1).sort((a, b) => worst(b) - worst(a))
}

/** Tanks the customer orders after a trial like this: the whole order, or what is left of it. */
export function orderOf(customer: CustomerId, trial: ExportTrial): number {
  const T = EXPORT_DESK.trial
  const share = trial.verdict === 'good' ? 1 : trial.verdict === 'poor' ? T.cutShare : T.badShare
  return Math.round(CUSTOMERS[customer].tanks * share)
}

export const SALE_BLOCKS = ['closed', 'sold', 'kind', 'noLine', 'needs', 'secret', 'standing'] as const
/** Why a tank cannot be sold to a customer. */
export type SaleBlock = (typeof SALE_BLOCKS)[number]

/**
 * What stops a tank in service, as the army has it now, being sold to a
 * customer, or null when nothing does. The customer's own needs come first;
 * the last two are the ministry refusing the export licence.
 */
export function saleBlock(career: Career, index: number, customer: CustomerId): SaleBlock | null {
  const tank = career.adopted[index]
  if (!exportOpen(career) || !tank) return 'closed'
  if (career.sales.some((sale) => sale.customer === customer)) return 'sold'
  if (!buys(customer, tank)) return 'kind'
  if (!tank.production) return 'noLine'
  const spec = serviceSpec(tank)
  const sheet = buildStatSheet(spec, TENDERS[tank.tender].limits)
  if (customerChecks(customer, spec, sheet).some((check) => !check.met)) return 'needs'
  if (secrets(spec).length > 0) return 'secret'
  if (career.reputation.ministry < EXPORT_DESK.ministryStanding) return 'standing'
  return null
}

/**
 * Sells a tank in service to a customer: the ministry signs the licence,
 * the customer orders once, and the bureau's fee goes into its budget.
 * Throws when it cannot be sold: ask `saleBlock` first.
 */
export function sell(career: Career, index: number, customer: CustomerId): Career {
  const block = saleBlock(career, index, customer)
  if (block) throw new Error(`tank cannot be sold: ${block}`)
  const tank = career.adopted[index]!
  const sheet = buildStatSheet(serviceSpec(tank), TENDERS[tank.tender].limits)
  const trial = exportTrial(career, customer, sheet)
  const tanks = orderOf(customer, trial)
  const sale: Sale = { customer, designation: serviceDesignation(tank), tanks, feeKr: saleFeeKr(tanks, sheet.unitCostKr), variant: null, trial }
  const { reputation } = withStanding(career, { army: 0, ministry: EXPORT_DESK.saleMinistry, pact: 0 })
  return { ...career, reputation, budgetKr: career.budgetKr + sale.feeKr, sales: [...career.sales, sale] }
}

/** The parts of the tank as adopted that a version for a customer may not change: the factory builds it on the same line. */
export function variantFixed(tank: Adopted, spec: VehicleSpec): FixedPart[] {
  return fixedPartsChanged(tank.spec, spec).filter((part) => !EXPORT_DESK.variantFree.includes(part))
}

/** What a version built for a customer is called. */
export function variantDesignation(tank: Adopted, customer: CustomerId): string {
  return `${serviceDesignation(tank)}${CUSTOMERS[customer].mark}`
}

/** What working up a version of this design costs the bureau. */
export function variantCostKr(career: Career, tank: Adopted, spec: VehicleSpec): number {
  const unitKr = buildStatSheet(spec, upgradeLimits(career, tank)).unitCostKr
  return Math.round((unitKr * EXPORT_DESK.variantWorkUnits) / 1000) * 1000
}

export const VARIANT_BLOCKS = ['closed', 'sold', 'kind', 'noLine', 'same', 'fixed', 'illegal', 'needs', 'secret', 'standing', 'noMoney'] as const
/** Why a design cannot be sold to a customer as a version of a tank in service. */
export type VariantBlock = (typeof VARIANT_BLOCKS)[number]

/**
 * What stops a design being sold to a customer as a version of a tank in
 * service, or null when nothing does. It is held to the tank's own tender,
 * with the technology the bureau has today.
 */
export function variantBlock(career: Career, index: number, customer: CustomerId, spec: VehicleSpec): VariantBlock | null {
  const tank = career.adopted[index]
  if (!exportOpen(career) || !tank) return 'closed'
  if (career.sales.some((sale) => sale.customer === customer)) return 'sold'
  if (!buys(customer, tank)) return 'kind'
  if (!tank.production) return 'noLine'
  if (sameTank(serviceSpec(tank), spec)) return 'same'
  if (variantFixed(tank, spec).length > 0) return 'fixed'
  const sheet = buildStatSheet(spec, upgradeLimits(career, tank))
  if (sheet.issues.some((issue) => issue.severity === 'error')) return 'illegal'
  if (customerChecks(customer, spec, sheet).some((check) => !check.met)) return 'needs'
  if (secrets(spec).length > 0) return 'secret'
  if (career.reputation.ministry < EXPORT_DESK.ministryStanding) return 'standing'
  if (variantCostKr(career, tank, spec) > career.budgetKr) return 'noMoney'
  return null
}

/**
 * Sells a design to a customer as a version of a tank in service: the
 * bureau pays to work it up, the ministry signs the licence and the fee on
 * the order goes into the budget. Throws when it cannot be sold: ask
 * `variantBlock` first.
 */
export function sellVariant(career: Career, index: number, customer: CustomerId, spec: VehicleSpec): Career {
  const block = variantBlock(career, index, customer, spec)
  if (block) throw new Error(`version cannot be sold: ${block}`)
  const tank = career.adopted[index]!
  const sheet = buildStatSheet(spec, upgradeLimits(career, tank))
  const trial = exportTrial(career, customer, sheet)
  const tanks = orderOf(customer, trial)
  const sale: Sale = {
    customer, designation: variantDesignation(tank, customer), tanks, feeKr: saleFeeKr(tanks, sheet.unitCostKr), variant: structuredClone(spec), trial,
  }
  const { reputation } = withStanding(career, { army: 0, ministry: EXPORT_DESK.saleMinistry, pact: 0 })
  return { ...career, reputation, budgetKr: career.budgetKr - variantCostKr(career, tank, spec) + sale.feeKr, sales: [...career.sales, sale] }
}
