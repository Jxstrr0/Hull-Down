// The acceleration and top speed test: a standing start, flat out, down the
// concrete strip.
import { GROUNDS, RANGE } from '../../data/range'
import { TUNING } from '../../data/tuning'
import { footingOf, kmhToMs, pullOf, resistanceN, type Drive } from '../mobility/drive'

/** A recorded run: one point every `stepS` seconds, from the start. */
export interface Trace {
  stepS: number
  /** Metres from the start line. */
  xM: number[]
  /** Metres a second. */
  vMs: number[]
}

/** Seconds after so many steps, without the stray digits that adding small steps leaves. */
export function stepTime(steps: number): number {
  return Math.round(steps * RANGE.stepS * 1000) / 1000
}

export interface AccelerationRun {
  /** Seconds from a standing start to the sprint speed. Null when it never got there. */
  sprintS: number | null
  /** Best speed held on the strip, km/h. */
  topKmh: number
  /** True when the gearing, not the engine, set that speed. */
  gearLimited: boolean
  /** Gear changes made on the way. */
  shifts: number
  /** Seconds the run lasted. */
  timeS: number
  distanceM: number
  trace: Trace
}

export function runAcceleration(drive: Drive): AccelerationRun {
  const test = RANGE.acceleration
  const ground = GROUNDS[test.ground]
  const footing = footingOf(drive, ground)
  const dt = RANGE.stepS
  const movedKg = drive.massKg * TUNING.mobility.spinUpFactor
  const sprintMs = kmhToMs(test.sprintKmh)
  const steps = Math.round(test.maxS / dt)
  const trace: Trace = { stepS: dt * RANGE.traceEvery, xM: [0], vMs: [0] }

  let x = 0
  let v = 0
  let gear = 0
  /** Steps left of the gear change in hand. */
  let shifting = 0
  let shifts = 0
  let sprintS: number | null = null
  let top = 0
  let gearLimited = false
  let step = 0

  while (step < steps && x < test.stripM) {
    let forceN = 0
    const shiftAt = drive.shiftAtMs[gear]
    if (shifting > 0) {
      shifting -= 1
    } else if (shiftAt !== undefined && v >= shiftAt) {
      gear += 1
      shifts += 1
      shifting = Math.round(drive.shiftS / dt)
      if (shifting === 0) forceN = pullOf(drive, ground, v).forceN
    } else {
      forceN = pullOf(drive, ground, v).forceN
    }
    v += ((forceN - resistanceN(drive, footing, v)) / movedKg) * dt
    if (v < 0) v = 0
    gearLimited = v >= drive.gearedMs
    if (gearLimited) v = drive.gearedMs
    x += v * dt
    step += 1
    if (sprintS === null && v >= sprintMs) sprintS = stepTime(step)
    if (v > top) top = v
    if (step % RANGE.traceEvery === 0) {
      trace.xM.push(x)
      trace.vMs.push(v)
    }
  }

  return { sprintS, topKmh: gearLimited ? drive.gearedMs * 3.6 : top * 3.6, gearLimited, shifts, timeS: stepTime(step), distanceM: x, trace }
}
