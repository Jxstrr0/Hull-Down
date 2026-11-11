// The proving ground: every test a prototype is put through, run from its
// stat sheet. The same tank always gives the same result.
import { GUNNERY_TEST_IDS, MARKS_GEN1, type ClimateId, type GunneryTestId, type Marks } from '../../data/range'
import type { Limits, VehicleSpec } from '../vehicle/spec'
import { buildStatSheet, type StatSheet } from '../vehicle/stats'
import { runAcceleration, type AccelerationRun } from './acceleration'
import { runEndurance, type EnduranceRun } from './endurance'
import { runGunnery, type GunneryRun } from './gunnery'
import { runObstacles, type ObstacleRun } from './obstacles'

export { runAcceleration, stepTime, type AccelerationRun, type Trace } from './acceleration'
export {
  runEndurance, type EnduranceEvent, type EnduranceLeg, type EnduranceRun, type EnduranceSetup, type PartLoad,
} from './endurance'
export {
  MISS_CAUSES, runGunnery, type GunneryRun, type MissCause, type ShotRecord, type TargetResult,
} from './gunnery'
export {
  courseLayout, runObstacles, type CourseSpan, type ObstacleCause, type ObstacleResult, type ObstacleRun,
} from './obstacles'

/** A firing test with its marks applied. Only the halted test is timed. */
export type GunneryResult = GunneryRun & {
  hitsPassed: boolean
  /** Null when the test has no time mark. */
  timePassed: boolean | null
  passed: boolean
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

export function runProvingGround(sheet: StatSheet, setup: RangeSetup): RangeReport {
  const marks = setup.marks ?? MARKS_GEN1
  const run = runAcceleration(sheet.drive)
  const sprintPassed = run.sprintS !== null && run.sprintS <= marks.sprintS
  const topPassed = run.topKmh >= marks.topKmh
  const acceleration = { ...run, sprintPassed, topPassed, passed: sprintPassed && topPassed }
  const obstacles = runObstacles(sheet.drive)
  const long = runEndurance(sheet.drive, sheet.wear, { seed: setup.seed, climate: setup.climate })
  const endurance = { ...long, passed: long.finished && long.stops <= marks.enduranceStops }
  const gunnery = {} as Record<GunneryTestId, GunneryResult>
  for (const id of GUNNERY_TEST_IDS) {
    const shot = runGunnery(sheet.fire, id, setup.seed)
    const hitsPassed = shot.hits >= marks.hits[id]
    const timePassed = id === 'halted' ? shot.firstShotS !== null && shot.firstShotS <= marks.firstShotS : null
    gunnery[id] = { ...shot, hitsPassed, timePassed, passed: hitsPassed && timePassed !== false }
  }
  const passed = [acceleration.passed, obstacles.passed, endurance.passed, ...GUNNERY_TEST_IDS.map((id) => gunnery[id].passed)]
  return {
    marks,
    acceleration,
    obstacles,
    endurance,
    gunnery,
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
