// The obstacle course: a trench, a step, a mud pit and a slope, one after
// the other. A tank that sticks is pulled clear and sent at the next one, so
// one run tests all four.
import { GROUNDS, OBSTACLES, RANGE, type ObstacleId } from '../../data/range'
import { TUNING } from '../../data/tuning'
import { degToRad, footingOf, kmhToMs, pullOf, resistanceN, type Drive, type Footing } from '../mobility/drive'
import { stepTime, type Trace } from './acceleration'

/** Why a tank failed an obstacle. */
export type ObstacleCause =
  /** The hull is too short to bridge the trench. */
  | 'tooShort'
  /** The nose sits too low to mount the step. */
  | 'tooLow'
  /** The tracks sank and spun. */
  | 'tracks'
  /** The belly sat down on the mud. */
  | 'belly'
  /** Bottom gear could not pull it up the slope, or through the mud. */
  | 'pull'
  /** The tracks slipped on the slope. */
  | 'grip'

export interface ObstacleResult {
  id: ObstacleId
  passed: boolean
  /** True when the tender does not ask the vehicle to cross it: it is tried, but neither passed nor failed. */
  waived?: boolean
  cause?: ObstacleCause
  /**
   * What the tank has and what the obstacle needs. Metres for the trench and
   * the step. Tonnes of pull for the mud and the slope, except a bellied
   * tank, where it is ground clearance against the depth it sank to, metres.
   */
  have: number
  need: number
  /** Seconds into the run when the tank reached it. */
  enteredS: number
  /** Seconds it spent on it, to the far side or to the moment it stuck. */
  timeS: number
  /** Metres into it the tank got. */
  reachedM: number
  /** How deep the tracks sat, metres. Nought off the mud. */
  sinkM: number
}

/** One stretch of the course. */
export interface CourseSpan {
  /** The obstacle on this stretch, or `flat` for the run before it. */
  id: ObstacleId | 'flat'
  fromM: number
  toM: number
}

export interface ObstacleRun {
  results: ObstacleResult[]
  passed: boolean
  timeS: number
  /** The tank's place on the course. It jumps forward when a stuck tank is pulled clear. */
  trace: Trace & {
    /** How deep the tracks sat at each point, metres. */
    sinkM: number[]
  }
}

function spanOf(id: ObstacleId): number {
  const c = RANGE.course
  return id === 'trench' ? c.trench.widthM : id === 'step' ? c.step.spanM : id === 'mud' ? c.mud.lengthM : c.slope.lengthM
}

/** The course laid out end to end, for anything that draws it. */
export function courseLayout(): CourseSpan[] {
  const spans: CourseSpan[] = []
  let at = 0
  for (const id of OBSTACLES) {
    spans.push({ id: 'flat', fromM: at, toM: at + RANGE.course.runUpM })
    at += RANGE.course.runUpM
    spans.push({ id, fromM: at, toM: at + spanOf(id) })
    at += spanOf(id)
  }
  spans.push({ id: 'flat', fromM: at, toM: at + RANGE.course.runUpM })
  return spans
}

function tonnes(forceN: number): number {
  return forceN / (TUNING.mobility.gravityMs2 * 1000)
}

export function runObstacles(drive: Drive): ObstacleRun {
  const c = RANGE.course
  const dt = RANGE.stepS
  const firm = GROUNDS[c.ground]
  const firmFooting = footingOf(drive, firm)
  const mudFooting = footingOf(drive, GROUNDS.mud)
  const slopeRad = degToRad(c.slope.angleDeg)
  const movedKg = drive.massKg * TUNING.mobility.spinUpFactor
  const stuckSteps = Math.round(c.stuckS / dt)
  const recoverSteps = Math.round(c.recoverS / dt)
  const timeoutSteps = Math.round(c.timeoutS / dt)

  const trace: ObstacleRun['trace'] = { stepS: dt * RANGE.traceEvery, xM: [0], vMs: [0], sinkM: [0] }
  const results: ObstacleResult[] = []
  let x = 0
  let v = 0
  let step = 0
  let sink = 0

  const record = (): void => {
    step += 1
    if (step % RANGE.traceEvery !== 0) return
    trace.xM.push(x)
    trace.vMs.push(v)
    trace.sinkM.push(sink)
  }

  /**
   * Drive to `toM`, holding `limitMs` at most. False when the tank sticks or
   * runs out of time on the way.
   */
  const driveTo = (toM: number, limitMs: number, ground: typeof firm | typeof GROUNDS.mud, footing: Footing, rad: number, fromM: number): boolean => {
    let still = 0
    let spent = 0
    while (x < toM) {
      const pull = v < limitMs ? pullOf(drive, ground, v, rad).forceN : 0
      v += ((pull - resistanceN(drive, footing, v, rad)) / movedKg) * dt
      if (v > limitMs) v = limitMs
      if (v < 0) v = 0
      x += v * dt
      if (x > toM) x = toM
      if (footing.sinkM > 0) {
        const settled = (x - fromM) / RANGE.soft.settleM
        sink = footing.sinkM * (settled < 1 ? settled : 1)
      }
      record()
      still = v < c.stuckMs ? still + 1 : 0
      spent += 1
      if (still >= stuckSteps || spent >= timeoutSteps) return false
    }
    return true
  }

  /** The range tractor pulls a stuck tank clear and sets it down past the obstacle. */
  const recover = (toM: number): void => {
    v = 0
    for (let i = 0; i < recoverSteps; i++) record()
    x = toM
    sink = 0
  }

  for (const span of courseLayout()) {
    if (span.id === 'flat') {
      const next = results.length < OBSTACLES.length ? OBSTACLES[results.length] : undefined
      // The driver takes each obstacle at its own speed; after the last he just drives off.
      driveTo(span.toM, kmhToMs(next ? c.approachKmh[next] : c.approachKmh.mud), firm, firmFooting, 0, span.fromM)
      continue
    }

    const id = span.id
    const enteredAt = step
    const limitMs = kmhToMs(c.approachKmh[id])
    let passed: boolean
    let cause: ObstacleCause | undefined
    let have: number
    let need: number
    let sinkM = 0

    if (id === 'trench' || id === 'step') {
      have = id === 'trench' ? drive.trenchM : drive.stepM
      need = id === 'trench' ? c.trench.widthM : c.step.heightM
      passed = have >= need
      if (passed) driveTo(span.toM, limitMs, firm, firmFooting, 0, span.fromM)
      else cause = id === 'trench' ? 'tooShort' : 'tooLow'
    } else if (id === 'mud') {
      sinkM = mudFooting.sinkM
      passed = driveTo(span.toM, limitMs, GROUNDS.mud, mudFooting, 0, span.fromM)
      if (mudFooting.bellied) {
        have = drive.clearanceM
        need = mudFooting.sinkM
        if (!passed) cause = 'belly'
      } else {
        const pull = pullOf(drive, GROUNDS.mud, 0)
        have = tonnes(pull.forceN)
        need = tonnes(resistanceN(drive, mudFooting, 0))
        if (!passed) cause = pull.limit === 'grip' ? 'tracks' : 'pull'
      }
    } else {
      passed = driveTo(span.toM, limitMs, firm, firmFooting, slopeRad, span.fromM)
      const pull = pullOf(drive, firm, 0, slopeRad)
      have = tonnes(pull.forceN)
      need = tonnes(resistanceN(drive, firmFooting, 0, slopeRad))
      if (!passed) cause = pull.limit === 'grip' ? 'grip' : 'pull'
    }

    results.push({
      id, passed, cause, have, need, sinkM,
      enteredS: stepTime(enteredAt),
      timeS: stepTime(step - enteredAt),
      reachedM: x - span.fromM,
    })
    if (!passed) recover(span.toM)
    else sink = 0
  }

  // End the record on a kept point, so it shows the tank at the finish.
  while (step % RANGE.traceEvery !== 0) record()

  return { results, passed: results.every((result) => result.passed), timeS: stepTime(step), trace }
}
