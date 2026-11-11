// Where a shot comes from. The design office fires its test shot at the
// middle of one zone, a chosen angle off square to it; the range spreads
// its shots over the plate.
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

/** One zone's plate: its middle, and how far it runs each way from there. */
export interface Plate {
  centre: Vec
  /** Half the plate across. */
  u: Vec
  /** Half the plate the other way: up it, or along the tank. */
  v: Vec
}

function tanDeg(deg: number): number {
  const rad = (deg * PI) / 180
  return detSin(rad) / detCos(rad)
}

/** The plate of each zone. The side zones are the ones on the tank's right. */
export function plateOf(shell: Shell, zone: ZoneId, slopeDeg: Record<ZoneId, number>): Plate {
  const f = shell.frame
  const hullH = f.roof - f.belly
  const turretH = f.top - f.roof
  const midHull = (f.belly + f.roof) / 2
  const midTurret = (f.roof + f.top) / 2
  const across = { x: 0, y: 0, z: f.bodyHalf }
  /** How far a leaning turret plate has come in by a given height. */
  const lean = (slope: number, y: number): number => (y - f.roof) * tanDeg(slope)
  const frontX = (y: number): number => f.turretX - f.radius + lean(slopeDeg.turretFrontLeft, y)
  const frontUp = { x: lean(slopeDeg.turretFrontLeft, f.top) / 2, y: turretH / 2, z: 0 }
  switch (zone) {
    case 'upperGlacis':
      return { centre: { x: f.upperRun / 2, y: f.belly + f.lowerH + f.upperH / 2, z: 0 }, u: across, v: { x: f.upperRun / 2, y: f.upperH / 2, z: 0 } }
    case 'lowerGlacis':
      return { centre: { x: f.lowerRun / 2, y: f.belly + f.lowerH / 2, z: 0 }, u: across, v: { x: -f.lowerRun / 2, y: f.lowerH / 2, z: 0 } }
    case 'hullSideFront':
      return { centre: { x: f.length / 4, y: midHull, z: f.bodyHalf }, u: { x: f.length / 4, y: 0, z: 0 }, v: { x: 0, y: hullH / 2, z: 0 } }
    case 'hullSideRear':
      return { centre: { x: (f.length * 3) / 4, y: midHull, z: f.bodyHalf }, u: { x: f.length / 4, y: 0, z: 0 }, v: { x: 0, y: hullH / 2, z: 0 } }
    case 'hullRear':
      return { centre: { x: f.length, y: midHull, z: 0 }, u: across, v: { x: 0, y: hullH / 2, z: 0 } }
    case 'hullRoof': {
      // Ahead of the turret, where the roof is not under it.
      const from = f.upperRun
      const to = f.turretX - f.radius
      return { centre: { x: (from + to) / 2, y: f.roof, z: 0 }, u: across, v: { x: (to - from) / 2, y: 0, z: 0 } }
    }
    case 'belly':
      return { centre: { x: f.length / 2, y: f.belly, z: 0 }, u: across, v: { x: f.length / 2, y: 0, z: 0 } }
    case 'turretFrontLeft':
      return { centre: { x: frontX(midTurret), y: midTurret, z: -f.radius / 2 }, u: { x: 0, y: 0, z: f.radius / 2 }, v: frontUp }
    case 'turretFrontRight':
      return { centre: { x: frontX(midTurret), y: midTurret, z: f.radius / 2 }, u: { x: 0, y: 0, z: f.radius / 2 }, v: frontUp }
    case 'mantlet': {
      const half = shell.mantletHalfHeightM
      return {
        centre: { x: frontX(f.gunY), y: f.gunY, z: 0 },
        u: { x: 0, y: 0, z: shell.mantletHalfM },
        v: { x: half * tanDeg(slopeDeg.turretFrontLeft), y: half, z: 0 },
      }
    }
    case 'turretSides':
      return {
        centre: { x: f.turretX, y: midTurret, z: f.radius - lean(slopeDeg.turretSides, midTurret) },
        u: { x: f.radius, y: 0, z: 0 },
        v: { x: 0, y: turretH / 2, z: -lean(slopeDeg.turretSides, f.top) / 2 },
      }
    case 'turretRear': {
      const floor = f.bustle > 0 ? f.bustleFloor : f.roof
      return {
        centre: { x: f.turretX + f.radius + f.bustle, y: (floor + f.top) / 2, z: 0 },
        u: { x: 0, y: 0, z: f.radius },
        v: { x: 0, y: (f.top - floor) / 2, z: 0 },
      }
    }
    case 'turretRoof':
      return { centre: { x: f.turretX, y: f.top, z: 0 }, u: { x: 0, y: 0, z: f.radius }, v: { x: f.radius, y: 0, z: 0 } }
  }
}

/** Where a shot at a zone comes from, `angleDeg` off square to it: level for an upright plate, from above for a roof. */
function approach(zone: ZoneId, angleDeg: number): { bearingDeg: number; diveDeg: number } {
  switch (zone) {
    case 'upperGlacis':
    case 'lowerGlacis':
    case 'turretFrontRight':
    case 'mantlet':
      return { bearingDeg: angleDeg, diveDeg: 0 }
    case 'turretFrontLeft':
      return { bearingDeg: -angleDeg, diveDeg: 0 }
    case 'hullSideFront':
    case 'hullSideRear':
    case 'turretSides':
      return { bearingDeg: 90 - angleDeg, diveDeg: 0 }
    case 'hullRear':
    case 'turretRear':
      return { bearingDeg: 180 - angleDeg, diveDeg: 0 }
    case 'hullRoof':
    case 'turretRoof':
      return { bearingDeg: 0, diveDeg: 90 - angleDeg }
    case 'belly':
      return { bearingDeg: 0, diveDeg: angleDeg - 90 }
  }
}

/**
 * The line of a shot at a zone, turned `angleDeg` off square to it. `across`
 * and `along` place it on the plate, each from -1 to 1; nought is the middle.
 */
export function lineAt(
  shell: Shell, zone: ZoneId, angleDeg: number, slopeDeg: Record<ZoneId, number>, across = 0, along = 0,
): Line {
  const { centre, u, v } = plateOf(shell, zone, slopeDeg)
  return {
    ...approach(zone, angleDeg),
    aim: {
      x: centre.x + across * u.x + along * v.x,
      y: centre.y + across * u.y + along * v.y,
      z: centre.z + across * u.z + along * v.z,
    },
  }
}

/** The line of the design office's test shot: at the middle of a zone. */
export function paperLine(shell: Shell, zone: ZoneId, angleDeg: number, slopeDeg: Record<ZoneId, number>): Line {
  return lineAt(shell, zone, angleDeg, slopeDeg)
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
