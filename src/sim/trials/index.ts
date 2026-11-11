// The proving ground: every test a prototype is put through, run from its
// stat sheet. The same tank always gives the same result.
import { MARKS_GEN1, type Marks } from '../../data/range'
import type { StatSheet } from '../vehicle/stats'
import { runAcceleration, type AccelerationRun } from './acceleration'
import { runObstacles, type ObstacleRun } from './obstacles'

export { runAcceleration, stepTime, type AccelerationRun, type Trace } from './acceleration'
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
  /** Tests passed and tests run. */
  passes: number
  tests: number
}

export function runProvingGround(sheet: StatSheet, marks: Marks = MARKS_GEN1): RangeReport {
  const run = runAcceleration(sheet.drive)
  const sprintPassed = run.sprintS !== null && run.sprintS <= marks.sprintS
  const topPassed = run.topKmh >= marks.topKmh
  const acceleration = { ...run, sprintPassed, topPassed, passed: sprintPassed && topPassed }
  const obstacles = runObstacles(sheet.drive)
  return {
    marks,
    acceleration,
    obstacles,
    passes: (acceleration.passed ? 1 : 0) + (obstacles.passed ? 1 : 0),
    tests: 2,
  }
}
