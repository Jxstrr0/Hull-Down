// The tank's main measurements, worked out once from the spec. Distances
// run back from the nose (x), up from the ground (y) and out to the tank's
// right (z). The blueprint, the 3D range and the hit model all use these.
import { LAYOUT } from '../../data/layout'
import { HULLS, LOADING, TURRETS } from '../../data/parts'
import { TUNING } from '../../data/tuning'
import { PI, detCos, detSin } from '../det'
import type { Geometry } from './geometry'
import type { VehicleSpec } from './spec'

export interface Frame {
  /** Hull length, nose to tail. */
  length: number
  /** Height of the hull roof and of the belly above the ground. */
  roof: number
  belly: number
  /** Height of the upper and lower glacis plates. They meet at the nose. */
  upperH: number
  lowerH: number
  /** How far back from the nose the upper and lower glacis plates run. */
  upperRun: number
  lowerRun: number
  /** Half the width of the hull between the tracks, and half the width over them. */
  bodyHalf: number
  halfWidth: number
  trackWidth: number
  /** Top of the track run. */
  trackTop: number
  /** Turret centre, outer radius, ring radius and the height of its roof. */
  turretX: number
  radius: number
  ringRadius: number
  top: number
  /** How far the bustle hangs out behind the turret, and the height of its floor. Nought with no bustle. */
  bustle: number
  bustleFloor: number
  /** Gun axis height, and where the barrel leaves the turret. */
  gunY: number
  gunRootX: number
  /** Engine bay, front and back. */
  bayStart: number
  bayEnd: number
  hasLoader: boolean
}

function tanDeg(deg: number): number {
  const rad = (deg * PI) / 180
  return detSin(rad) / detCos(rad)
}

export function frameOf(spec: VehicleSpec, geo: Geometry): Frame {
  const hull = HULLS[spec.hull.size]
  const g = TUNING.geometry
  const length = hull.lengthM
  const roof = hull.roofHeightM
  const upperH = hull.bodyHeightM * g.upperGlacisShare
  const lowerH = hull.bodyHeightM - upperH
  const radius = geo.turretRadiusM
  const turretX = length * LAYOUT.turretCentre[spec.hull.engineAt]
  const bay = LAYOUT.engineBay[spec.hull.engineAt]
  const hasBustle = TURRETS[spec.turret.shape].hasBustle
  return {
    length,
    roof,
    belly: roof - hull.bodyHeightM,
    upperH,
    lowerH,
    upperRun: upperH * tanDeg(spec.hull.glacisAngleDeg),
    lowerRun: lowerH * tanDeg(g.lowerGlacisAngleDeg),
    bodyHalf: hull.bodyWidthM / 2,
    halfWidth: geo.widthM / 2,
    trackWidth: spec.runningGear.trackWidthMm / 1000,
    trackTop: roof * LAYOUT.trackTopShare,
    turretX,
    radius,
    ringRadius: spec.turret.ringMm / 2000,
    top: roof + geo.turretHeightM,
    bustle: hasBustle ? radius * LAYOUT.bustleOverhang : 0,
    bustleFloor: roof + geo.turretHeightM * LAYOUT.bustleFloorShare,
    gunY: roof + geo.turretHeightM * LAYOUT.gunHeightShare,
    gunRootX: turretX - radius * LAYOUT.gunRootShare,
    bayStart: length * bay[0],
    bayEnd: length * bay[1],
    hasLoader: LOADING[spec.loading].crew > 3,
  }
}
