// Times the frames of a 3D view, to tell whether the device is keeping up.
// No three.js and no clock of its own: it is handed the gap between frames.
import { FRAME_METER, TIER_IDS, type TierId } from '../data/graphics'

export interface FrameMeter {
  /**
   * Tell it the time between two frames, milliseconds. Gives the frame
   * rate once, when it has timed enough of them, and nothing before or after.
   */
  add(gapMs: number): number | null
}

export function createFrameMeter(): FrameMeter {
  const gaps: number[] = []
  let seen = 0
  let done = false
  return {
    add(gapMs) {
      if (done || !(gapMs > 0)) return null
      seen++
      if (seen <= FRAME_METER.skipFrames) return null
      gaps.push(gapMs)
      if (gaps.length < FRAME_METER.sampleFrames) return null
      done = true
      // The middle gap, so one long stall does not count against the device.
      const sorted = [...gaps].sort((a, b) => a - b)
      return 1000 / sorted[Math.floor(sorted.length / 2)]!
    },
  }
}

/** The tier to draw at after measuring this frame rate at `tier`. It never goes up. */
export function tierAfter(tier: TierId, fps: number): TierId {
  const last = TIER_IDS.length - 1
  if (fps < FRAME_METER.lowFps) return TIER_IDS[last]!
  if (fps < FRAME_METER.stepDownFps) return TIER_IDS[Math.min(TIER_IDS.indexOf(tier) + 1, last)]!
  return tier
}
