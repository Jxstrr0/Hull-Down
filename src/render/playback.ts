// Reading a recorded run back at any moment. Plain numbers, no three.js.
import type { Trace } from '../sim/trials'

export interface Frame {
  /** Metres driven. */
  s: number
  vMs: number
  /** How deep the tracks sit, metres. */
  sinkM: number
  /** True once the record has run out. */
  done: boolean
}

export type RunRecord = Trace & { sinkM?: number[] }

/** Seconds a record lasts. */
export function lengthS(record: RunRecord): number {
  return (record.xM.length - 1) * record.stepS
}

/**
 * The tank at a moment of the run. Between two points of the record it
 * glides. Where the record jumps (the range tractor set a stuck tank down
 * past an obstacle) it holds, then jumps too.
 */
export function frameAt(record: RunRecord, timeS: number): Frame {
  const last = record.xM.length - 1
  const at = timeS / record.stepS
  if (!(at > 0)) return { s: record.xM[0]!, vMs: record.vMs[0]!, sinkM: record.sinkM?.[0] ?? 0, done: last === 0 }
  if (at >= last) return { s: record.xM[last]!, vMs: record.vMs[last]!, sinkM: record.sinkM?.[last] ?? 0, done: true }
  const i = Math.floor(at)
  const share = at - i
  const x0 = record.xM[i]!
  const x1 = record.xM[i + 1]!
  const v0 = record.vMs[i]!
  const v1 = record.vMs[i + 1]!
  const sink0 = record.sinkM?.[i] ?? 0
  const sink1 = record.sinkM?.[i + 1] ?? 0
  // Further than the tank could have driven in the time: it was moved, not driven.
  const jumped = x1 - x0 > Math.max(v0, v1) * record.stepS * 2 + 0.5
  if (jumped) return { s: x0, vMs: v0, sinkM: sink0, done: false }
  return { s: x0 + (x1 - x0) * share, vMs: v0 + (v1 - v0) * share, sinkM: sink0 + (sink1 - sink0) * share, done: false }
}
