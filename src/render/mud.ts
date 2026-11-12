// How muddy a tank is at a given point in a run: a share from nought (clean)
// to one (as muddy as it gets). The colour is laid on in the shader.
import type { BattleGroundId } from '../data/battle'
import { RANGE } from '../data/range'
import { RENDER } from '../data/render'

const K = RENDER.tank.mud

function held(share: number): number {
  return Math.max(0, Math.min(K.most, share))
}

/** After `km` of the endurance run, legs taken in order, each lane adding its own mud a kilometre. */
export function enduranceMud(km: number): number {
  let left = km
  let share = 0
  for (const leg of RANGE.endurance.legs) {
    const here = Math.max(0, Math.min(leg.km, left))
    share += here * K.perKm[RENDER.endurance.legs[leg.id].lane]
    left -= here
  }
  return held(share)
}

/** On the obstacle course at `x`: a little from the start, and the pit's worth once through it. */
export function courseMud(x: number, pit: { fromX: number; toX: number }): number {
  const through = Math.max(0, Math.min(1, (x - pit.fromX) / (pit.toX - pit.fromX)))
  return held(K.course + (K.pit - K.course) * through)
}

/** Every tank in a battle on this ground. */
export function battleMud(ground: BattleGroundId): number {
  return held((K.battle satisfies Record<BattleGroundId, number>)[ground])
}
