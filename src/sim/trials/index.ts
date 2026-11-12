// The proving ground: every test a prototype is put through, run from its
// stat sheet. The same tank always gives the same result.
import { FIRE_MISSION } from '../../data/fireMission'
import { SQUAD_TRIAL, type SquadMarks } from '../../data/squad'
import { GUNNERY_TEST_IDS, MARKS_GEN1, RANGE, type ClimateId, type GunneryTestId, type Marks } from '../../data/range'
import type { Limits, VehicleSpec } from '../vehicle/spec'
import { buildStatSheet, type StatSheet } from '../vehicle/stats'
import { unit } from '../rng'
import { TURRET_PARTS, type TurretPart, type TurretPartId } from '../gunnery/fire'
import { runAcceleration, type AccelerationRun } from './acceleration'
import { runArmourTrial, type ArmourRun } from './armour'
import { runBerm, type BermRun } from './berm'
import { runLoadingDrill, type DrillRun } from './drill'
import { runEndurance, type EnduranceRun } from './endurance'
import { judgeFireMission, runFireMission, type FireMissionRun } from './fireMission'
import { runGunnery, type GunneryRun } from './gunnery'
import { runObstacles, type ObstacleRun } from './obstacles'
import { judgeSquadDrop, runSquadDrop, type SquadRun } from './squad'

export { runAcceleration, stepTime, type AccelerationRun, type Trace } from './acceleration'
export {
  FINDING_KINDS, afterAction, timelineOf, weigh, type AfterAction, type Finding, type FindingKind, type Fix, type ShotLine,
} from './afterAction'
export { runArmourTrial, type ArmourRun, type SerialResult, type TrialShot } from './armour'
export { runBerm, type BermRun } from './berm'
export { runLoadingDrill, type DrillRound, type DrillRun } from './drill'
export { TURRET_PARTS, type TurretPartId } from '../gunnery/fire'
export {
  runEndurance, type EnduranceEvent, type EnduranceLeg, type EnduranceRun, type EnduranceSetup, type PartLoad,
} from './endurance'
export { judgeFireMission, runFireMission, type FireMissionRun, type MissionGrid, type MissionShell } from './fireMission'
export {
  MISS_CAUSES, runGunnery, type GunneryRun, type MissCause, type ShotRecord, type TargetResult,
} from './gunnery'
export { judgeSquadDrop, runSquadDrop, type CoverShot, type CoverTarget, type SquadRun } from './squad'
export {
  courseLayout, runObstacles, type CourseSpan, type ObstacleCause, type ObstacleResult, type ObstacleRun,
} from './obstacles'

/** A firing test with its marks applied. Only the halted test is timed. */
export type GunneryResult = GunneryRun & {
  /** A turret part that failed before the shoot, which the crew did without. Null when all of it worked. */
  fault: TurretPartId | null
  hitsPassed: boolean
  /** Null when the test has no time mark. */
  timePassed: boolean | null
  passed: boolean
}

/** The squad drop with its marks applied. */
export type SquadResult = SquadRun & ReturnType<typeof judgeSquadDrop> & { marks: SquadMarks }

/** The fire mission with its marks applied. */
export type FireMissionResult = FireMissionRun & ReturnType<typeof judgeFireMission> & {
  marks: { firstRoundS: number; rpm: number; missM: number }
}

export interface RangeReport {
  marks: Marks
  acceleration: AccelerationRun & {
    sprintPassed: boolean
    topPassed: boolean
    passed: boolean
  }
  obstacles: ObstacleRun
  endurance: EnduranceRun & { passed: boolean }
  gunnery: Record<GunneryTestId, GunneryResult>
  drill: DrillRun & { passed: boolean }
  armour: ArmourRun & { passed: boolean }
  berm: BermRun & { passed: boolean }
  /** The fire mission, for a howitzer or where the tender asks for one. Null otherwise. */
  fireMission: FireMissionResult | null
  /** The squad drop, for a vehicle that carries soldiers or where the tender asks for one. Null otherwise. */
  squad: SquadResult | null
  /**
   * True on a self-propelled gun's tender: the tank shoots, the loading drill
   * and the berm are run but not counted, and the report leaves them out.
   */
  selfPropelled: boolean
  /** Hours the crew had been in the tank when the shoots and the drill came round. */
  crewHours: number
  /** Tests passed and tests run. */
  passes: number
  tests: number
}

export interface RangeSetup {
  /** Names the luck of the run. The same tank and seed always give the same result. */
  seed: number
  marks?: Marks
  climate?: ClimateId
}

// Names the rolls for turret parts apart from the shots.
const FAULTS = 55

/** The first turret part to let the crew down in this shoot, if any does. */
function faultIn(parts: TurretPart[], testNo: number, seed: number): TurretPart | null {
  for (const part of parts) {
    // Each part keeps its own roll whatever else is fitted, so changing one part does not move another's luck.
    const partNo = TURRET_PARTS.indexOf(part.id)
    if (unit(seed, FAULTS, testNo, partNo) < (1 - part.reliability) * RANGE.gunnery.faultShare) return part
  }
  return null
}

export function runProvingGround(sheet: StatSheet, setup: RangeSetup): RangeReport {
  const marks: Marks = setup.marks ?? MARKS_GEN1
  const run = runAcceleration(sheet.drive)
  const sprintPassed = run.sprintS !== null && run.sprintS <= marks.sprintS
  const topPassed = run.topKmh >= marks.topKmh
  const acceleration = { ...run, sprintPassed, topPassed, passed: sprintPassed && topPassed }
  const obstacles = runObstacles(sheet.drive)
  const long = runEndurance(sheet.drive, sheet.wear, { seed: setup.seed, climate: setup.climate })
  const endurance = { ...long, passed: long.finished && long.stops <= marks.enduranceStops }
  const gunnery = {} as Record<GunneryTestId, GunneryResult>
  for (const [testNo, id] of GUNNERY_TEST_IDS.entries()) {
    const fault = faultIn(sheet.turret, testNo, setup.seed)
    const shot = runGunnery(fault ? fault.without : sheet.fire, id, setup.seed)
    const hitsPassed = shot.hits >= marks.hits[id]
    const timePassed = id === 'halted' ? shot.firstShotS !== null && shot.firstShotS <= marks.firstShotS : null
    gunnery[id] = { ...shot, fault: fault ? fault.id : null, hitsPassed, timePassed, passed: hitsPassed && timePassed !== false }
  }
  const loading = runLoadingDrill(sheet.fire, setup.seed)
  const drill = { ...loading, passed: loading.rpm >= marks.drillRpm }
  const shots = runArmourTrial(sheet.target, sheet.geometry.zoneSlopeDeg, marks.armour, setup.seed)
  const armour = { ...shots, passed: shots.failed.length === 0 }
  const ridge = runBerm(sheet.interior.frame, sheet.firepower.gunDepressionDeg)
  const berm = { ...ridge, passed: ridge.showsM <= marks.bermShowsM }
  // A howitzer is put through a fire mission wherever it goes; a tender for one sets its own marks.
  const missionMarks = marks.fireMission ?? (sheet.fire.mission.howitzer ? FIRE_MISSION.marks : null)
  const mission = missionMarks ? runFireMission(sheet.fire, setup.seed) : null
  const fireMission = mission && missionMarks ? { ...mission, ...judgeFireMission(mission, missionMarks), marks: missionMarks } : null
  // A vehicle with soldiers aboard is put through the squad drop wherever it goes; a tender for one sets its own marks.
  const squadMarks = marks.squad ?? (sheet.rollup.troops > 0 ? SQUAD_TRIAL.marks : null)
  const drop = squadMarks ? runSquadDrop(sheet.drive, sheet.fire, sheet.rollup.troops, setup.seed) : null
  const squad = drop && squadMarks ? { ...drop, ...judgeSquadDrop(drop, squadMarks), marks: squadMarks } : null
  const selfPropelled = marks.fireMission !== undefined
  const passed = selfPropelled
    ? [acceleration.passed, obstacles.passed, endurance.passed, armour.passed, fireMission?.passed ?? false]
    : [
      acceleration.passed, obstacles.passed, endurance.passed, ...GUNNERY_TEST_IDS.map((id) => gunnery[id].passed), drill.passed,
      armour.passed, berm.passed, ...(fireMission ? [fireMission.passed] : []),
    ]
  if (squad) passed.push(squad.passed)
  return {
    marks,
    acceleration,
    obstacles,
    endurance,
    gunnery,
    drill,
    armour,
    berm,
    fireMission,
    squad,
    selfPropelled,
    crewHours: RANGE.crewHours,
    passes: passed.filter(Boolean).length,
    tests: passed.length,
  }
}

/**
 * One visit to the range as plain data: the design, the limits it was built
 * to and the set-up of the tests. It can be handed to another thread whole.
 */
export interface RangeJob {
  spec: VehicleSpec
  limits: Limits
  setup: RangeSetup
}

/** Builds the tank from its design and runs it through the range. The same job always gives the same report. */
export function runRangeJob(job: RangeJob): RangeReport {
  return runProvingGround(buildStatSheet(job.spec, job.limits), job.setup)
}
