// Track marks: dark strips left on the ground under each track, which narrow
// away after a while. This works out how wide a mark is at an age; the Marks
// pool in rangeScene.ts lays and draws them.
import { RENDER } from '../data/render'

const K = RENDER.marks

/** How wide a mark is `ageS` watched seconds after it was laid, as a share of new: one, then narrowing to nought. Null once gone. */
export function markAt(ageS: number): number | null {
  if (ageS < 0 || ageS >= K.lifeS) return null
  const left = (K.lifeS - ageS) / (K.lifeS * K.fadeShare)
  return Math.min(1, left)
}
