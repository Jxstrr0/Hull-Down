// The ground of each leg of the endurance run. A leg is far too long to
// build, so its ground repeats: the tank drives one stretch over and over,
// and the stretch joins up with itself, so the picture never shows the join.
// Plain numbers, no three.js.
import { RANGE } from '../data/range'
import { RENDER } from '../data/render'
import type { Path, Point } from './path'

export type LegId = (typeof RANGE.endurance.legs)[number]['id']

export interface LegGround {
  id: LegId
  /** The line of the ground from end to end, far enough each way that its ends are lost in the haze. */
  path: Path
  /** The stretch the tank drives over and over: where it starts along the line, and how long it is. */
  fromS: number
  loopS: number
  /** Where the marker posts stand: metres along the ground. */
  postsX: number[]
}

/** Height of a leg's ground at `x` metres along it. */
export function heightAt(id: LegId, x: number): number {
  const leg = RENDER.endurance.legs[id]
  if (leg.riseM === 0) return 0
  const turn = (2 * Math.PI * x) / leg.periodM
  return leg.riseM * (Math.sin(turn) + leg.rippleShare * Math.sin(3 * turn + 1))
}

export function legGround(id: LegId): LegGround {
  const leg = RENDER.endurance.legs[id]
  // Enough ground before and after the tank's stretch to reach past the haze, in whole stretches.
  const stretchM = leg.periodM * leg.postEvery
  const before = Math.ceil(RENDER.fog.farM / stretchM) + 1
  const stretches = 2 * before + 1
  const perStretch = leg.samples * leg.postEvery
  const stepM = leg.periodM / leg.samples

  const points: Path['points'] = []
  let s = 0
  let last: Point | undefined
  for (let i = 0; i <= stretches * perStretch; i++) {
    const point = { x: i * stepM, y: heightAt(id, i * stepM) }
    if (last) s += Math.hypot(point.x - last.x, point.y - last.y)
    points.push({ ...point, s })
    last = point
  }
  const fromS = points[before * perStretch]!.s
  const loopS = points[(before + 1) * perStretch]!.s - fromS
  const postsX: number[] = []
  for (let i = 0; i <= stretches; i++) postsX.push(i * stretchM)
  return { id, path: { points, lengthM: s }, fromS, loopS, postsX }
}

/** How far along a leg's line the tank is drawn, when `legM` metres of it have gone by. */
export function placeOnLeg(ground: LegGround, legM: number): number {
  return ground.fromS + (legM % ground.loopS)
}
