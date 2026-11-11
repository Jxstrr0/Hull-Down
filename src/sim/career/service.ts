// A tank in service: what the factory's rate and care do to it, and the
// field report the army sends back each year. A report is worked out from
// the tank, how it was built and the career's seed, and is always the same.
import { BATTLE_GROUND_IDS, type BattleGroundId } from '../../data/battle'
import type { Body } from '../../data/career'
import type { ComfortSource, StationId, WorkSource } from '../../data/crew'
import { ACCORD_LIMITS, THREAT_TANKS, type ThreatTankId } from '../../data/opponents'
import { GUNNERY_TEST_IDS, RUN_PART_IDS, type RunPartId } from '../../data/range'
import { SERVICE, type Production } from '../../data/service'
import type { Tender } from '../../data/tenders'
import { DEFAULT_ORDERS } from '../battle/battle'
import { runBattleSeries, type BattleFinding } from '../battle/series'
import { busiestOf } from '../crew/stations'
import { detPow } from '../det'
import { combatantOf, type Combatant } from '../duel/duel'
import type { Wear } from '../reliability/wear'
import { hash32 } from '../rng'
import { runEndurance } from '../trials/endurance'
import { runGunnery } from '../trials/gunnery'
import type { VehicleSpec } from '../vehicle/spec'
import type { StatSheet } from '../vehicle/stats'
import type { UpgradeAsk } from './upgrade'

// Names the rolls of each part of a report apart.
const ROLL = { running: 1, shoot: 2, exercise: 3 } as const

/** The year's running: tanks followed, and what gave trouble. */
export interface Running {
  tanks: number
  /** Stops for repairs, all the tanks together. */
  stops: number
  /** Tanks that broke for good and were towed in. */
  towed: number
  /** Tanks that got through the year with no trouble at all. */
  clean: number
  /** Times each part gave trouble. */
  byPart: Record<RunPartId, number>
  /** The part that gave most trouble. Null when nothing did. */
  worst: RunPartId | null
}

export type Complaint =
  /** A station with too much to do. `source` is the part of the design that adds most to it. */
  | { kind: 'workload'; station: StationId; workload: number; source: WorkSource | null }
  /** A tank that is hard to live in. `source` is what takes most from its comfort. */
  | { kind: 'comfort'; score: number; source: ComfortSource | null }
  /** Conscripts shoot far worse in it than the range's crew did. */
  | { kind: 'needsExperts'; conscripts: number; cadre: number; targets: number }
  /** Three men to do the upkeep of four. */
  | { kind: 'threeMen' }

export interface Exercise {
  ground: BattleGroundId
  threat: ThreatTankId
  won: number
  lost: number
  drawn: number
  /** What the umpires made of it, heaviest first. */
  lessons: BattleFinding[]
}

export interface FieldReport {
  /** The year in service, counting from one. */
  year: number
  /** Tanks built during the year, and in service at the end of it. */
  built: number
  fleet: number
  /** How much more often parts give trouble than on the prototype. 1 is the same. */
  faults: number
  running: Running
  /** The firing camp: targets put up, and those hit by conscripts and by the range's own crew. */
  shoot: { targets: number; conscripts: number; cadre: number }
  complaints: Complaint[]
  exercise: Exercise
  /** What the report does to the bureau's standing, before the limits are applied. */
  standing: Record<Body, number>
  /** The bureau's fee on the year's tanks. */
  royaltyKr: number
  /** What the army would have changed, when the year showed something a package could mend. */
  ask: UpgradeAsk | null
}

/** What a tank costs as the factory builds it. */
export function serviceUnitCostKr(unitCostKr: number, production: Production): number {
  return unitCostKr * SERVICE.rates[production.rate].cost * SERVICE.qualities[production.quality].cost
}

/** How much more often parts give trouble in service than on the prototype, in a year of service counted from one. */
export function serviceFaults(sheet: Pick<StatSheet, 'crewCount'>, production: Production, year: number): number {
  return (
    SERVICE.rates[production.rate].faults * SERVICE.qualities[production.quality].faults *
    (sheet.crewCount < 4 ? SERVICE.threeMenFaults : 1) * (1 + SERVICE.ageingFaults * Math.max(0, year - 1))
  )
}

/** A part that gives trouble `faults` times as often. */
function worn(reliability: number, faults: number): number {
  return reliability >= 1 ? 1 : detPow(reliability, faults)
}

/** The tank as the army has it: the same design, with the factory's work and the years in it. */
export function serviceSheet(sheet: StatSheet, production: Production, year: number): StatSheet {
  const faults = serviceFaults(sheet, production, year)
  const wear = {} as Wear
  for (const id of RUN_PART_IDS) wear[id] = { ...sheet.wear[id], reliability: worn(sheet.wear[id].reliability, faults) }
  return {
    ...sheet,
    unitCostKr: serviceUnitCostKr(sheet.unitCostKr, production),
    wear,
    turret: sheet.turret.map((part) => ({ ...part, reliability: worn(part.reliability, faults) })),
    reliabilityIndex: worn(sheet.reliabilityIndex / 100, faults) * 100,
  }
}

/** Tanks built during a year of service, and in service at the end of it. */
export function fleetIn(production: Production, year: number): { built: number; fleet: number } {
  const rate = SERVICE.rates[production.rate].tanksAYear
  const before = Math.min(SERVICE.orderTanks, rate * Math.max(0, year - 1))
  const fleet = Math.min(SERVICE.orderTanks, rate * Math.max(0, year))
  return { built: fleet - before, fleet }
}

function runningOf(sheet: StatSheet, seed: number): Running {
  const R = SERVICE.running
  const byPart = {} as Record<RunPartId, number>
  for (const id of RUN_PART_IDS) byPart[id] = 0
  const running: Running = { tanks: R.tanks, stops: 0, towed: 0, clean: 0, byPart, worst: null }
  for (let tank = 0; tank < R.tanks; tank++) {
    const run = runEndurance(sheet.drive, sheet.wear, { seed: hash32(seed, ROLL.running, tank) })
    running.stops += run.stops
    if (!run.finished) running.towed++
    if (run.events.length === 0) running.clean++
    for (const event of run.events) byPart[event.part]++
  }
  for (const id of RUN_PART_IDS) {
    if (byPart[id] > 0 && (running.worst === null || byPart[id] > byPart[running.worst])) running.worst = id
  }
  return running
}

function complaintsOf(sheet: StatSheet, shoot: FieldReport['shoot']): Complaint[] {
  const C = SERVICE.complaints
  const out: Complaint[] = []
  const busiest = busiestOf(sheet.crew)
  if (busiest.workload >= C.workload) {
    const adds = busiest.shares.find((share) => share.points > 0)
    out.push({ kind: 'workload', station: busiest.id, workload: busiest.workload, source: adds ? adds.source : null })
  }
  if (sheet.comfort.score <= C.comfort) {
    const takes = sheet.comfort.shares.find((share) => share.points < 0)
    out.push({ kind: 'comfort', score: sheet.comfort.score, source: takes ? takes.source : null })
  }
  if (shoot.cadre > 0 && shoot.conscripts < shoot.cadre * C.conscriptShare) out.push({ kind: 'needsExperts', ...shoot })
  if (sheet.crewCount < 4) out.push({ kind: 'threeMen' })
  return out
}

/** True when the year's running was bad enough for the army to mark the bureau down. */
function ranBadly(running: Running): boolean {
  const R = SERVICE.running
  return running.stops / running.tanks >= R.badStops || running.towed / running.tanks >= R.badTowedShare
}

/**
 * What the army asks for after a year like this. Breakdowns come first,
 * then what the exercise showed, then what the crews say.
 */
export function askOf(report: Pick<FieldReport, 'running' | 'exercise' | 'complaints'>): UpgradeAsk | null {
  if (ranBadly(report.running)) return { kind: 'reliability' }
  for (const lesson of report.exercise.lessons) {
    if (lesson.good) continue
    if ((lesson.kind === 'holed' || lesson.kind === 'flanked') && lesson.zone) return { kind: 'protection', zone: lesson.zone }
    if (lesson.kind === 'outdrawn') return { kind: 'firstShot' }
    if (lesson.kind === 'brokeDown') return { kind: 'reliability' }
  }
  for (const complaint of report.complaints) {
    if (complaint.kind === 'workload') return { kind: 'workload' }
    if (complaint.kind === 'comfort') return { kind: 'comfort' }
  }
  return null
}

/**
 * The army's report on a year of a tank's service: how it ran, what its
 * crews say, how conscripts shot in it and how a platoon did on exercise.
 * `prototype` is the design as it was adopted, ready to fight.
 */
export function fieldReport(
  spec: VehicleSpec, tender: Tender, production: Production, year: number, seed: number,
): FieldReport {
  const prototype = combatantOf(spec, tender.limits)
  const sheet = serviceSheet(prototype.sheet, production, year)
  const mine: Combatant = { ...prototype, sheet }
  const luck = hash32(seed, year)

  const running = runningOf(sheet, luck)

  const shoot = { targets: 0, conscripts: 0, cadre: 0 }
  for (const id of GUNNERY_TEST_IDS) {
    const shootSeed = hash32(luck, ROLL.shoot)
    const home = runGunnery(sheet.fire, id, shootSeed, SERVICE.crew)
    shoot.targets += home.targets.length
    shoot.conscripts += home.hits
    shoot.cadre += runGunnery(sheet.fire, id, shootSeed).hits
  }
  const complaints = complaintsOf(sheet, shoot)

  const E = SERVICE.exercise
  const ground = E.grounds[(year - 1) % E.grounds.length] ?? BATTLE_GROUND_IDS[0]
  const threat = tender.threats[(year - 1) % tender.threats.length] ?? tender.threats[0]!
  const other = THREAT_TANKS[threat]
  const series = runBattleSeries(
    mine, combatantOf(other.spec, ACCORD_LIMITS, other.rounds), ground, DEFAULT_ORDERS, hash32(luck, ROLL.exercise), E.battles,
    [SERVICE.crew, SERVICE.opposingCrew],
  )
  const exercise: Exercise = {
    ground, threat, won: series.won, lost: series.lost, drawn: series.drawn, lessons: series.findings.slice(0, E.lessons),
  }

  const R = SERVICE.running
  const bad = ranBadly(running)
  const good = !bad && running.stops / running.tanks <= R.goodStops && running.towed === 0
  const standing: Record<Body, number> = {
    army:
      (bad ? R.army.bad : good ? R.army.good : 0) +
      (exercise.won > exercise.lost ? E.army.won : exercise.lost > exercise.won ? E.army.lost : 0) +
      (complaints.filter((each) => each.kind !== 'threeMen').length >= SERVICE.complaints.many ? SERVICE.complaints.army : 0),
    ministry: bad ? R.ministry.bad : 0,
    pact: 0,
  }

  const { built, fleet } = fleetIn(production, year)
  return {
    year, built, fleet, faults: serviceFaults(sheet, production, year), running, shoot, complaints, exercise, standing,
    royaltyKr: Math.round((built * sheet.unitCostKr * SERVICE.royaltyShare) / 1000) * 1000,
    ask: askOf({ running, exercise, complaints }),
  }
}
