// Where a shot comes from. The design office fires its test shot at the
// middle of one zone, a chosen angle off square to it.
import type { ZoneId } from '../../data/materials'
import { PI, detCos, detSin } from '../det'
import type { Geometry } from '../vehicle/geometry'
import type { ShotSetup } from '../vehicle/shot'
import type { Shell, Vec } from './shell'
import { traceShot, type HitResult, type Target } from './trace'

export interface Line {
  bearingDeg: number
  diveDeg: number
  aim: Vec
}

function tanDeg(deg: number): number {
  const rad = (deg * PI) / 180
  return detSin(rad) / detCos(rad)
}

/**
 * The line of the design office's test shot: at the middle of a zone, level
 * for an upright plate and straight down or up for a roof or the belly, and
 * turned `angleDeg` off that. The side zones are shot at from the tank's right.
 */
export function paperLine(shell: Shell, zone: ZoneId, angleDeg: number, slopeDeg: Record<ZoneId, number>): Line {
  const f = shell.frame
  const midHull = (f.belly + f.roof) / 2
  const midTurret = (f.roof + f.top) / 2
  /** How far a leaning turret plate has come in by a given height. */
  const lean = (slope: number, y: number): number => (y - f.roof) * tanDeg(slope)
  const frontX = (y: number): number => f.turretX - f.radius + lean(slopeDeg.turretFrontLeft, y)
  switch (zone) {
    case 'upperGlacis':
      return { bearingDeg: angleDeg, diveDeg: 0, aim: { x: f.upperRun / 2, y: f.belly + f.lowerH + f.upperH / 2, z: 0 } }
    case 'lowerGlacis':
      return { bearingDeg: angleDeg, diveDeg: 0, aim: { x: f.lowerRun / 2, y: f.belly + f.lowerH / 2, z: 0 } }
    case 'hullSideFront':
      return { bearingDeg: 90 - angleDeg, diveDeg: 0, aim: { x: f.length / 4, y: midHull, z: f.bodyHalf } }
    case 'hullSideRear':
      return { bearingDeg: 90 - angleDeg, diveDeg: 0, aim: { x: (f.length * 3) / 4, y: midHull, z: f.bodyHalf } }
    case 'hullRear':
      return { bearingDeg: 180 - angleDeg, diveDeg: 0, aim: { x: f.length, y: midHull, z: 0 } }
    case 'hullRoof':
      // Ahead of the turret, where the roof is not under it.
      return { bearingDeg: 0, diveDeg: 90 - angleDeg, aim: { x: (f.upperRun + f.turretX - f.radius) / 2, y: f.roof, z: 0 } }
    case 'belly':
      return { bearingDeg: 0, diveDeg: angleDeg - 90, aim: { x: f.length / 2, y: f.belly, z: 0 } }
    case 'turretFrontLeft':
      return { bearingDeg: -angleDeg, diveDeg: 0, aim: { x: frontX(midTurret), y: midTurret, z: -f.radius / 2 } }
    case 'turretFrontRight':
      return { bearingDeg: angleDeg, diveDeg: 0, aim: { x: frontX(midTurret), y: midTurret, z: f.radius / 2 } }
    case 'mantlet':
      return { bearingDeg: angleDeg, diveDeg: 0, aim: { x: frontX(f.gunY), y: f.gunY, z: 0 } }
    case 'turretSides':
      return {
        bearingDeg: 90 - angleDeg, diveDeg: 0,
        aim: { x: f.turretX, y: midTurret, z: f.radius - lean(slopeDeg.turretSides, midTurret) },
      }
    case 'turretRear': {
      const y = f.bustle > 0 ? (f.bustleFloor + f.top) / 2 : midTurret
      return { bearingDeg: 180 - angleDeg, diveDeg: 0, aim: { x: f.turretX + f.radius + f.bustle, y, z: 0 } }
    }
    case 'turretRoof':
      return { bearingDeg: 0, diveDeg: 90 - angleDeg, aim: { x: f.turretX, y: f.top, z: 0 } }
  }
}

/**
 * The design office's test shot, followed inside: one round at the middle
 * of one zone, on paper. Its armour result is the same as `testShot` gives.
 */
export function paperShot(target: Target, geo: Geometry, zone: ZoneId, setup: ShotSetup): HitResult {
  return traceShot(target, {
    ...paperLine(target.shell, zone, setup.angleDeg, geo.zoneSlopeDeg),
    round: setup.round,
    rangeM: setup.rangeM,
    tile: setup.tile,
    onPaper: true,
    seed: 0,
    shotNo: 0,
  })
}
