// The proving ground: every test a prototype is put through, run from its
// stat sheet. The same tank always gives the same result.
import { MARKS_GEN1, type ClimateId, type Marks } from '../../data/range'
import type { Limits, VehicleSpec } from '../vehicle/spec'
import { buildStatSheet, type StatSheet } from '../vehicle/stats'
import { runAcceleration, type AccelerationRun } from './acceleration'
import { runEndurance, type EnduranceRun } from './endurance'
import { runObstacles, type ObstacleRun } from './obstacles'

export { runAcceleration, stepTime, type AccelerationRun, type Trace } from './acceleration'
export {
  runEndurance, type EnduranceEvent, type EnduranceLeg, type EnduranceRun, type EnduranceSetup, type PartLoad,
} from './endurance'
export {
  courseLayout, runObstacles, type CourseSpan, type ObstacleCause, type ObstacleResult, type ObstacleRun,
} from './obstacles'

export interface RangeReport {
  marks: Marks
  acceleration: AccelerationRun & {
    sprintPassed: boolean
    topPassed: boolean
    passed: boolean
  }
  obstacles: ObstacleRun
  endurance: EnduranceRun & { passed: boolean }
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
  const passed = [acceleration.passed, obstacles.passed, endurance.passed]
  return {
    marks,
    acceleration,
    obstacles,
    endurance,
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
