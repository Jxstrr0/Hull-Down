// The chief engineer's review: the clear problems a design has against the
// tender, worst first, each with the part to look at. It is worked out on
// paper from the design alone, so it is the same every time and quick
// enough to run after every change. He never says what to fit.
import { ADVISOR } from '../../data/advisor'
import { THREATS, type ThreatId } from '../../data/ammo'
import type { ZoneId } from '../../data/materials'
import { COMPUTERS, LOADING, NIGHT_SIGHTS, RANGEFINDERS, SIGHTS, STABILISERS } from '../../data/parts'
import { GUNNERY_TEST_IDS, type GunneryTestId, type ObstacleId } from '../../data/range'
import type { Tender } from '../../data/tenders'
import { runAcceleration, runBerm, runFireMission, runGunnery, runObstacles } from '../trials'
import type { Issue } from '../vehicle/checks'
import { testShot } from '../vehicle/shot'
import type { VehicleSpec } from '../vehicle/spec'
import { buildStatSheet, type StatSheet } from '../vehicle/stats'

export const REMARK_KINDS = [
  'fault', 'plate', 'shoot', 'slowShot', 'drill', 'missionReach', 'missionFirst', 'missionRate', 'missionClose', 'sprint', 'top', 'obstacle', 'berm', 'warning', 'reliability', 'cost',
] as const
export type RemarkKind = (typeof REMARK_KINDS)[number]

export interface Remark {
  kind: RemarkKind
  /** The control or `armour.<zone>` to look at. Empty when no one part is to blame. */
  part: string
  /** What the design has and what the tender asks, when there are numbers to show. */
  value?: number
  limit?: number
  /** For a fault or a warning: the design-office issue itself. */
  issue?: Issue
  zone?: ZoneId
  threat?: ThreatId
  rangeM?: number
  test?: GunneryTestId
  obstacle?: ObstacleId
}

/** True when the part fitted is the last in its table, which lists them plainest first. */
function best<K extends string>(table: Record<K, unknown>, fitted: K): boolean {
  const ids = Object.keys(table) as K[]
  return ids[ids.length - 1] === fitted
}

/** The first of these parts that could still be bettered, or the first of all when none can. */
function firstToBetter(ways: readonly (readonly [part: string, isBest: boolean])[]): string {
  return (ways.find(([, isBest]) => !isBest) ?? ways[0])?.[0] ?? ''
}

function shootPart(test: GunneryTestId, spec: VehicleSpec): string {
  const fc = spec.fireControl
  const rangefinder = ['fireControl.rangefinder', best(RANGEFINDERS, fc.rangefinder)] as const
  const computer = ['fireControl.computer', best(COMPUTERS, fc.computer)] as const
  if (test === 'night') return firstToBetter([['fireControl.night', best(NIGHT_SIGHTS, fc.night)], rangefinder, computer])
  if (test === 'onTheMove') return firstToBetter([['fireControl.stabiliser', best(STABILISERS, fc.stabiliser)], computer, rangefinder])
  return firstToBetter([rangefinder, computer, ['fireControl.sight', best(SIGHTS, fc.sight)]])
}

const OBSTACLE_PART: Record<ObstacleId, string> = {
  trench: 'hull.size', step: 'runningGear.suspension', mud: 'runningGear.trackWidthMm', slope: 'powerpack.engine',
}

const STRESS_PART: Record<keyof StatSheet['stress'], string> = {
  transmission: 'powerpack.transmission', suspension: 'runningGear.suspension', cooling: 'powerpack.cooling',
  tracks: 'runningGear.trackWidthMm',
}

/** Everything the chief engineer would say about this design, worst first. `ADVISOR.remarks` is the most he says at once. */
export function review(spec: VehicleSpec, tender: Tender): Remark[] {
  const sheet = buildStatSheet(spec, tender.limits)
  const marks = tender.marks
  const out: Remark[] = []

  // What cannot be built or entered comes before everything.
  for (const issue of sheet.issues) {
    if (issue.severity === 'error') out.push({ kind: 'fault', part: issue.part, issue, value: issue.value, limit: issue.limit })
  }

  // Plates that must hold at the armour trial and will not, on paper. Each plate once, for the round that beats it worst.
  const holed = new Map<ZoneId, Remark>()
  for (const serial of marks.armour) {
    if (!serial.gate) continue
    const shot = testShot(spec.armour[serial.zone], sheet.geometry.zoneSlopeDeg[serial.zone], {
      round: THREATS[serial.threat], rangeM: serial.rangeM, angleDeg: serial.angleDeg, tile: spec.era[serial.zone] !== 0,
    })
    if (shot.spareMm >= 0) continue
    const before = holed.get(serial.zone)
    if (before && (before.value ?? 0) - (before.limit ?? 0) <= shot.spareMm) continue
    holed.set(serial.zone, {
      kind: 'plate', part: `armour.${serial.zone}`, zone: serial.zone, threat: serial.threat, rangeM: serial.rangeM,
      value: Math.round(shot.worthMm), limit: Math.round(shot.worthMm - shot.spareMm),
    })
  }
  out.push(...holed.values())

  // A self-propelled gun's tender counts no tank shoots, drill or berm, so he says nothing of them.
  const tank = marks.fireMission === undefined
  // The firing tests, rehearsed a few times over.
  for (const test of tank ? GUNNERY_TEST_IDS : []) {
    let hits = 0
    let firstShotS = 0
    let timed = 0
    for (let seed = 1; seed <= ADVISOR.rehearsals; seed++) {
      const run = runGunnery(sheet.fire, test, seed)
      hits += run.hits
      if (run.firstShotS !== null) {
        firstShotS += run.firstShotS
        timed++
      }
    }
    const usual = hits / ADVISOR.rehearsals
    if (usual < marks.hits[test]) {
      out.push({ kind: 'shoot', part: shootPart(test, spec), test, value: Math.round(usual * 10) / 10, limit: marks.hits[test] })
    }
    if (test === 'halted' && timed > 0 && firstShotS / timed > marks.firstShotS) {
      const fc = spec.fireControl
      out.push({
        kind: 'slowShot',
        part: firstToBetter([
          ['fireControl.rangefinder', best(RANGEFINDERS, fc.rangefinder)], ['fireControl.computer', best(COMPUTERS, fc.computer)],
          ['fireControl.commanderSight', fc.commanderSight],
        ]),
        value: Math.round(firstShotS / timed), limit: marks.firstShotS,
      })
    }
  }
  if (tank && sheet.gunnery.sustainedTiredRpm < marks.drillRpm) {
    out.push({
      kind: 'drill', part: best(LOADING, spec.loading) ? 'crew.comfort' : 'loading',
      value: Math.round(sheet.gunnery.sustainedTiredRpm * 10) / 10, limit: marks.drillRpm,
    })
  }

  // A self-propelled gun's fire mission, rehearsed a few times over.
  if (marks.fireMission) {
    const M = marks.fireMission
    let reached = true
    let first = 0
    let firsts = 0
    let rpm = 0
    let miss = 0
    let misses = 0
    for (let seed = 1; seed <= ADVISOR.rehearsals; seed++) {
      const run = runFireMission(sheet.fire, seed)
      reached &&= run.grids.every((grid) => grid.reached)
      if (run.firstRoundS !== null) {
        first += run.firstRoundS
        firsts++
      }
      rpm += run.rpm / ADVISOR.rehearsals
      if (run.missM !== null) {
        miss += run.missM
        misses++
      }
    }
    if (!reached) out.push({ kind: 'missionReach', part: 'barrel' })
    if (firsts > 0 && first / firsts > M.firstRoundS) {
      out.push({ kind: 'missionFirst', part: 'fireControl.computer', value: Math.round(first / firsts), limit: M.firstRoundS })
    }
    if (rpm < M.rpm) out.push({ kind: 'missionRate', part: 'loading', value: Math.round(rpm * 10) / 10, limit: M.rpm })
    if (misses > 0 && miss / misses > M.missM) {
      out.push({ kind: 'missionClose', part: 'fireControl.computer', value: Math.round(miss / misses), limit: M.missM })
    }
  }

  // The strip, the course and the berm come out the same every time, so he can simply work them out.
  const run = runAcceleration(sheet.drive)
  if (run.sprintS === null || run.sprintS > marks.sprintS) {
    out.push({ kind: 'sprint', part: 'powerpack.engine', value: run.sprintS === null ? undefined : Math.round(run.sprintS * 10) / 10, limit: marks.sprintS })
  }
  if (run.topKmh < marks.topKmh) out.push({ kind: 'top', part: 'powerpack.engine', value: Math.round(run.topKmh), limit: marks.topKmh })
  for (const result of runObstacles(sheet.drive).results) {
    if (!result.passed) out.push({ kind: 'obstacle', part: OBSTACLE_PART[result.id], obstacle: result.id })
  }
  const ridge = runBerm(sheet.interior.frame, sheet.firepower.gunDepressionDeg)
  if (tank && ridge.showsM > marks.bermShowsM) {
    out.push({ kind: 'berm', part: 'turret.shape', value: Math.round(ridge.showsM * 100) / 100, limit: marks.bermShowsM })
  }

  // Then what will hurt in service.
  for (const issue of sheet.issues) {
    if (issue.severity === 'warning') out.push({ kind: 'warning', part: issue.part, issue, value: issue.value, limit: issue.limit })
  }
  if (sheet.reliabilityIndex < ADVISOR.reliabilityIndex) {
    const ids = Object.keys(STRESS_PART) as (keyof StatSheet['stress'])[]
    const worst = ids.reduce((a, b) => (sheet.stress[b] > sheet.stress[a] ? b : a))
    out.push({ kind: 'reliability', part: STRESS_PART[worst], value: Math.round(sheet.reliabilityIndex), limit: ADVISOR.reliabilityIndex })
  }
  const dear = tender.limits.maxUnitCostKr * ADVISOR.costShare
  if (sheet.unitCostKr > dear && sheet.unitCostKr <= tender.limits.maxUnitCostKr) {
    out.push({ kind: 'cost', part: '', value: Math.round(sheet.unitCostKr), limit: tender.limits.maxUnitCostKr })
  }
  return out
}

/** What he says at once: the worst few. */
export function briefing(spec: VehicleSpec, tender: Tender): { remarks: Remark[]; more: number } {
  const all = review(spec, tender)
  return { remarks: all.slice(0, ADVISOR.remarks), more: Math.max(0, all.length - ADVISOR.remarks) }
}
