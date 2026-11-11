// The words for a tank in service: what the production settings do, and a
// field report line by line. No DOM here, so they can be tested.
import { BODIES, type Body } from '../data/career'
import { SERVICE, type Production } from '../data/service'
import { STRINGS, fill } from '../data/strings'
import { TENDERS } from '../data/tenders'
import {
  serviceSpec, upgradeBlock, upgradeCostKr, type Adopted, type Career, type UpgradeBlock, productionStanding,
} from '../sim/career/career'
import { askMeasure, fixedPartsChanged, massCeilingT, type Upgrade, type UpgradeAsk } from '../sim/career/upgrade'
import type { VehicleSpec } from '../sim/vehicle/spec'
import { buildStatSheet } from '../sim/vehicle/stats'
import { serviceFaults, serviceUnitCostKr, type Complaint, type FieldReport } from '../sim/career/service'
import type { StatSheet } from '../sim/vehicle/stats'
import { battleFindingText, battleGroundText } from './battleWords'
import { standingChange } from './careerWords'
import { fixed, money } from './format'

const S = STRINGS.service
const P = S.production
const R = S.report

export function serviceTitle(tank: Pick<Adopted, 'designation' | 'name'>): string {
  return tank.name ? fill(S.named, { designation: tank.designation, name: tank.name }) : tank.designation
}

/** How much trouble the tank gives in service, set against the prototype. */
export function faultsLine(faults: number): string {
  const percent = Math.round((faults - 1) * 100)
  if (percent === 0) return P.faultsSame
  return fill(percent > 0 ? P.faultsMore : P.faultsFewer, { n: String(Math.abs(percent)) })
}

export interface ProductionLine {
  label: string
  value: string
  /** True for a line that is a warning. */
  bad?: boolean
}

/** What a choice of rate and quality comes to, before it is made. */
export function productionLines(tank: Adopted, sheet: Pick<StatSheet, 'unitCostKr' | 'crewCount'>, production: Production): ProductionLine[] {
  const tender = TENDERS[tank.tender]
  const unitKr = serviceUnitCostKr(sheet.unitCostKr, production)
  const rate = SERVICE.rates[production.rate].tanksAYear
  const lines: ProductionLine[] = [
    { label: P.cost, value: fill(P.costValue, { cost: money(unitKr), was: money(sheet.unitCostKr) }) },
    { label: P.faults, value: faultsLine(serviceFaults(sheet, production, 1)) },
    { label: P.order, value: fill(P.orderValue, { n: String(SERVICE.orderTanks), years: String(Math.ceil(SERVICE.orderTanks / rate)) }) },
  ]
  const standing = productionStanding(tank, production)
  const changes = BODIES.filter((body) => standing[body] !== 0)
    .map((body) => `${STRINGS.career.bodies[body]}: ${standingChange(standing[body])}`)
  lines.push({ label: P.standing, value: changes.length ? changes.join(' · ') : P.noStanding })
  if (unitKr > tender.limits.maxUnitCostKr) {
    lines.push({ label: '', value: fill(P.overCeiling, { n: money(tender.limits.maxUnitCostKr) }), bad: true })
  }
  return lines
}

/** "Steady rate · Standard quality · Kr 2.06M a tank". */
export function productionSummary(production: Production, unitCostKr: number): string {
  return fill(P.summary, {
    rate: P.rates[production.rate].name, quality: P.qualities[production.quality].name,
    cost: money(serviceUnitCostKr(unitCostKr, production)),
  })
}

export function rateLine(rate: Production['rate']): string {
  return fill(P.rates[rate].line, { n: String(SERVICE.rates[rate].tanksAYear) })
}

export function complaintText(complaint: Complaint): string {
  const C = R.complaints
  const stations = STRINGS.dataSheet.stations
  switch (complaint.kind) {
    case 'workload': {
      const station = stations.names[complaint.station].toLowerCase()
      const n = fixed(complaint.workload, 0)
      return complaint.source
        ? fill(C.workload, { station, n, source: stations.sources[complaint.source].toLowerCase() })
        : fill(C.workloadPlain, { station, n })
    }
    case 'comfort': {
      const n = fixed(complaint.score, 0)
      return complaint.source ? fill(C.comfort, { n, source: R.comfortTakes[complaint.source] }) : fill(C.comfortPlain, { n })
    }
    case 'needsExperts':
      return fill(C.needsExperts, {
        conscripts: String(complaint.conscripts), cadre: String(complaint.cadre), targets: String(complaint.targets),
      })
    case 'threeMen':
      return C.threeMen
  }
}

/** The lines about the year's running. */
export function runningLines(report: FieldReport): string[] {
  const { running } = report
  const lines = [
    fill(R.runningLine, { tanks: String(running.tanks), clean: String(running.clean) }),
    running.stops === 0 ? R.noStops : running.stops === 1 ? R.oneStop : fill(R.stops, { n: String(running.stops) }),
  ]
  if (running.towed > 0) lines.push(fill(R.towed, { n: String(running.towed) }))
  if (running.worst) {
    lines.push(fill(R.worst, {
      part: STRINGS.range.endurance.parts[running.worst].toLowerCase(), n: String(running.byPart[running.worst]),
    }))
  }
  return lines
}

export function fleetLine(report: FieldReport): string {
  return report.built > 0
    ? fill(R.fleet, { built: String(report.built), fleet: String(report.fleet) })
    : fill(R.fleetDone, { fleet: String(report.fleet) })
}

export function shootLine(report: FieldReport): string {
  const { shoot } = report
  return fill(R.shootLine, { conscripts: String(shoot.conscripts), cadre: String(shoot.cadre), targets: String(shoot.targets) })
}

export function exerciseLine(report: FieldReport): string {
  const { exercise } = report
  return fill(R.exerciseLine, {
    ground: battleGroundText(exercise.ground).name, threat: STRINGS.opponents.threats[exercise.threat].name,
    n: String(exercise.won + exercise.lost + exercise.drawn),
    won: String(exercise.won), lost: String(exercise.lost), drawn: String(exercise.drawn),
  })
}

/** The umpires' lessons, each marked as for the tank or against it. */
export function lessonLines(report: FieldReport): { good: boolean; text: string }[] {
  return report.exercise.lessons.map((lesson) => ({ good: lesson.good, text: battleFindingText(lesson) }))
}

/** What the report did to the bureau's standing: only the bodies it moved. */
export function reportStanding(report: FieldReport): { body: Body; text: string }[] {
  return BODIES.filter((body) => report.standing[body] !== 0)
    .map((body) => ({ body, text: `${STRINGS.career.bodies[body]}: ${standingChange(report.standing[body])}` }))
}

export function feeLine(report: FieldReport): string {
  return report.royaltyKr > 0 ? fill(R.fee, { n: money(report.royaltyKr) }) : R.noFee
}

/** What is still to come for a tank in production. */
export function yearsLeftLine(tank: Adopted): string {
  const left = SERVICE.years - tank.years
  if (left <= 0) return fill(S.years.closed, { n: String(SERVICE.years) })
  return left === 1 ? S.years.oneLeft : fill(S.years.left, { n: String(left) })
}

const U = S.upgrade

function zoneOf(ask: UpgradeAsk): string {
  return ask.zone ? STRINGS.zones[ask.zone].name.toLowerCase() : ''
}

/** What the army asks for, as a sentence. */
export function askText(ask: UpgradeAsk): string {
  return fill(U.asks[ask.kind], { zone: zoneOf(ask) })
}

/** "Model 81A · after year 2 · less work for the crew". */
export function fittedLine(tank: Pick<Adopted, 'designation'>, upgrade: Upgrade): string {
  return fill(U.fittedLine, {
    designation: `${tank.designation}${upgrade.letter}`, n: String(upgrade.afterYear),
    ask: fill(U.askShort[upgrade.ask.kind], { zone: zoneOf(upgrade.ask) }),
  })
}

export interface UpgradeCheck {
  /** The figures a package is judged by. */
  rows: { label: string; value: string }[]
  /** Whether the board gives the army what it asked for. */
  met: boolean
  block: UpgradeBlock | null
  /** Why it cannot be fitted, in words. Empty when it can. */
  blockText: string
  /** The designation it would carry. */
  designation: string
}

/** The design on the board, judged as the next package for a tank with a contract open. Null when none is. */
export function upgradeCheck(career: Career, index: number, spec: VehicleSpec): UpgradeCheck | null {
  const tank = career.adopted[index]
  const ask = tank?.contract
  if (!tank || !ask) return null
  const limits = TENDERS[tank.tender].limits
  const before = buildStatSheet(serviceSpec(tank), limits)
  const after = buildStatSheet(spec, limits)
  const measure = askMeasure(ask, before, after)
  const places = ask.kind === 'firstShot' ? 1 : 0
  const ceiling = massCeilingT(buildStatSheet(tank.spec, limits))
  const rows = [
    {
      label: fill(U.measures[ask.kind], { zone: ask.zone ? STRINGS.zones[ask.zone].name : '' }),
      value: fill(U.measureValue, {
        was: fixed(measure.was, places), now: fixed(measure.now, places), need: fixed(measure.need, places), unit: U.units[ask.kind],
        way: measure.need >= measure.was ? U.orMore : U.orLess,
      }),
    },
    { label: U.weight, value: fill(U.weightValue, { now: fixed(after.massT, 1), max: fixed(ceiling, 1) }) },
    { label: U.cooling, value: fill(U.coolingValue, { n: fixed(after.growth.coolingHp, 0) }) },
    { label: U.cost, value: money(upgradeCostKr(tank, spec)) },
    { label: U.fee, value: money(SERVICE.upgrade.feeKr) },
  ]
  const block = upgradeBlock(career, index, spec)
  const blockText = block === null ? '' : fill(U.blocks[block], {
    parts: fixedPartsChanged(tank.spec, spec).map((part) => STRINGS.controls[part].label.toLowerCase()).join(', '),
    over: fixed(Math.max(0.1, after.massT - ceiling), 1),
  })
  return {
    rows, met: measure.met, block, blockText,
    designation: `${tank.designation}${SERVICE.upgrade.letters[tank.upgrades.length] ?? ''}`,
  }
}
