// The grey-box tank for the 3D range, as plain measurements. It uses the
// blueprint's own layout, so the tank on the range is the tank on the drawing.
import { DRAWING } from '../data/drawing'
import { RENDER } from '../data/render'
import { layout } from '../office/drawing'
import type { Geometry, VehicleSpec } from '../sim/vehicle'
import type { Point } from './path'

export interface TankShape {
  lengthM: number
  /** Length of track on the ground, for working out the tilt. */
  footprintM: number
  /** The hull seen from the side: x forward from the middle, y up from the ground. */
  hullOutline: Point[]
  hullWidthM: number
  track: { widthM: number; topM: number; lengthM: number; centreZM: number }
  wheels: { xM: number[]; radiusM: number }
  turret: { xM: number; baseM: number; heightM: number; radiusM: number; bustleM: number }
  gun: { rootXM: number; lengthM: number; radiusM: number; yM: number }
}

export function tankShapeOf(spec: VehicleSpec, geometry: Geometry): TankShape {
  const m = layout(spec, geometry)
  const half = m.length / 2
  // The blueprint measures back from the nose. Here x runs forward from the middle.
  const fromNose = (x: number): number => half - x
  const noseY = m.belly + m.lowerH

  const count = spec.runningGear.roadWheels
  const pitch = (m.length - DRAWING.trackInsetFrontM - DRAWING.trackInsetRearM - 2 * DRAWING.trackCornerM) / count
  const radius = Math.min(DRAWING.roadWheelMaxRadiusM, (pitch * DRAWING.wheelFill) / 2)
  const firstWheel = DRAWING.trackInsetFrontM + DRAWING.trackCornerM + pitch / 2
  const wheelX: number[] = []
  for (let i = 0; i < count; i++) wheelX.push(fromNose(firstWheel + i * pitch))

  return {
    lengthM: m.length,
    footprintM: m.length * RENDER.tank.footprintShare,
    hullOutline: [
      { x: -half, y: m.belly },
      { x: fromNose(m.lowerRun), y: m.belly },
      { x: half, y: noseY },
      { x: fromNose(m.upperRun), y: m.roof },
      { x: -half, y: m.roof },
    ],
    hullWidthM: m.hull.bodyWidthM,
    track: {
      widthM: m.trackWidth,
      topM: m.trackTop,
      lengthM: m.length - DRAWING.trackInsetFrontM - DRAWING.trackInsetRearM,
      centreZM: m.halfWidth - m.trackWidth / 2,
    },
    wheels: { xM: wheelX, radiusM: radius },
    turret: { xM: fromNose(m.turretX), baseM: m.roof, heightM: geometry.turretHeightM, radiusM: m.radius, bustleM: m.bustle },
    gun: {
      rootXM: fromNose(m.gunRootX),
      lengthM: m.gunRootX - m.muzzleX,
      radiusM: m.barrelHalf,
      yM: m.gunY,
    },
  }
}
