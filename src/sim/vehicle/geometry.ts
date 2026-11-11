// Sizes worked out from the spec: armour zone areas, turret size, outer dimensions.
import { ZONES, type ZoneId } from '../../data/materials'
import { HULLS, LOADING, TURRETS } from '../../data/parts'
import { TUNING } from '../../data/tuning'
import { PI, detCos } from '../det'
import type { VehicleSpec } from './spec'

export interface Geometry {
  /** Armour plate area of each zone, square metres. */
  zoneAreaM2: Record<ZoneId, number>
  /** How far each zone's plate leans away from square to a level shot at its face, degrees. */
  zoneSlopeDeg: Record<ZoneId, number>
  turretHeightM: number
  turretRadiusM: number
  /** Usable space inside the turret. */
  turretVolumeM3: number
  lengthM: number
  /** Overall width over the tracks. */
  widthM: number
  /** Ground to turret roof. */
  heightM: number
  /** Length of track on the ground, one side. */
  trackContactM: number
}

function degToRad(deg: number): number {
  return (deg * PI) / 180
}

export function geometryOf(spec: VehicleSpec): Geometry {
  const g = TUNING.geometry
  const hull = HULLS[spec.hull.size]
  const turret = TURRETS[spec.turret.shape]
  const loading = LOADING[spec.loading]

  const ringRadius = spec.turret.ringMm / 2000
  const radius = ringRadius + g.turretOverhangM
  const height = turret.heightM + loading.extraTurretHeightM
  const disc = PI * radius * radius

  const upperHeight = hull.bodyHeightM * g.upperGlacisShare
  const lowerHeight = hull.bodyHeightM - upperHeight
  const side = hull.lengthM * hull.bodyHeightM
  const deck = hull.lengthM * hull.bodyWidthM

  const zoneSlopeDeg = Object.fromEntries(ZONES.map((zone) => [zone, 0])) as Record<ZoneId, number>
  zoneSlopeDeg.upperGlacis = spec.hull.glacisAngleDeg
  zoneSlopeDeg.lowerGlacis = g.lowerGlacisAngleDeg
  zoneSlopeDeg.turretFrontLeft = turret.frontSlopeDeg
  zoneSlopeDeg.turretFrontRight = turret.frontSlopeDeg
  zoneSlopeDeg.turretSides = turret.sideSlopeDeg
  /** A sloped plate is bigger than the face it covers. */
  const stretch = (zone: ZoneId): number => 1 / detCos(degToRad(zoneSlopeDeg[zone]))
  const front = g.turretFrontFactor * radius * height * stretch('turretFrontLeft')

  const zoneAreaM2: Record<ZoneId, number> = {
    upperGlacis: hull.bodyWidthM * upperHeight * stretch('upperGlacis'),
    lowerGlacis: hull.bodyWidthM * lowerHeight * stretch('lowerGlacis'),
    // Both sides together; each zone is half the hull length.
    hullSideFront: side,
    hullSideRear: side,
    hullRear: hull.bodyWidthM * hull.bodyHeightM,
    hullRoof: deck - PI * ringRadius * ringRadius,
    belly: deck,
    turretFrontLeft: front,
    turretFrontRight: front,
    mantlet: g.mantletWidthM * height * g.mantletHeightShare,
    turretSides: g.turretSideFactor * radius * height * turret.sideFactor * stretch('turretSides'),
    turretRear: g.turretRearFactor * radius * height,
    turretRoof: disc * turret.roofFactor,
  }

  return {
    zoneAreaM2,
    zoneSlopeDeg,
    turretHeightM: height,
    turretRadiusM: radius,
    turretVolumeM3: disc * height * turret.volumeFactor,
    lengthM: hull.lengthM,
    widthM: hull.widthM + (2 * (spec.runningGear.trackWidthMm - g.standardTrackMm)) / 1000,
    heightM: hull.roofHeightM + height,
    trackContactM: hull.lengthM * g.trackContactShare,
  }
}

