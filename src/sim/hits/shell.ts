// The outside of the tank as the hit model sees it: the hull and the turret
// as two solid shapes with flat faces, each face an armour zone or part of
// one. A shot is a straight line; where it first crosses a face is where it
// strikes, and the lean of that face to the line is the real angle.
// Game-level abstractions, not engineering data.
import { ERA_GRIDS } from '../../data/era'
import type { ZoneId } from '../../data/materials'
import { TUNING } from '../../data/tuning'
import { PI, detCos, detSin } from '../det'
import type { Frame } from '../vehicle/frame'
import type { Geometry } from '../vehicle/geometry'
import type { Box } from './interior'

/** x runs back from the nose, y up from the ground, z out to the tank's right. */
export interface Vec {
  x: number
  y: number
  z: number
}

export const FACES = [
  'upperGlacis', 'lowerGlacis', 'hullSide', 'hullRear', 'hullRoof', 'belly',
  'turretFront', 'turretSide', 'turretRear', 'turretRoof', 'turretFloor',
] as const
export type FaceId = (typeof FACES)[number]

interface Plane {
  face: FaceId
  /** Points out of the solid. */
  n: Vec
  /** Any point on the face. */
  p: Vec
}

export interface Solid {
  part: 'hull' | 'turret'
  planes: Plane[]
}

export interface Shell {
  frame: Frame
  hull: Solid
  turret: Solid
  /** Half the width and half the height of the mantlet, about the gun. */
  mantletHalfM: number
  mantletHalfHeightM: number
}

export const vec = (x: number, y: number, z: number): Vec => ({ x, y, z })
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y + a.z * b.z
export const along = (o: Vec, d: Vec, t: number): Vec => ({ x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t })
const minus = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })

function rad(deg: number): number {
  return (deg * PI) / 180
}

export function shellOf(frame: Frame, geo: Geometry): Shell {
  const f = frame
  const nose = vec(0, f.belly + f.lowerH, 0)
  const upper = rad(geo.zoneSlopeDeg.upperGlacis)
  const lower = rad(geo.zoneSlopeDeg.lowerGlacis)
  const front = rad(geo.zoneSlopeDeg.turretFrontLeft)
  const side = rad(geo.zoneSlopeDeg.turretSides)
  const hull: Solid = {
    part: 'hull',
    planes: [
      { face: 'upperGlacis', n: vec(-detCos(upper), detSin(upper), 0), p: nose },
      { face: 'lowerGlacis', n: vec(-detCos(lower), -detSin(lower), 0), p: nose },
      { face: 'hullSide', n: vec(0, 0, 1), p: vec(0, 0, f.bodyHalf) },
      { face: 'hullSide', n: vec(0, 0, -1), p: vec(0, 0, -f.bodyHalf) },
      { face: 'hullRear', n: vec(1, 0, 0), p: vec(f.length, 0, 0) },
      { face: 'hullRoof', n: vec(0, 1, 0), p: vec(0, f.roof, 0) },
      { face: 'belly', n: vec(0, -1, 0), p: vec(0, f.belly, 0) },
    ],
  }
  const turret: Solid = {
    part: 'turret',
    planes: [
      { face: 'turretFront', n: vec(-detCos(front), detSin(front), 0), p: vec(f.turretX - f.radius, f.roof, 0) },
      { face: 'turretSide', n: vec(0, detSin(side), detCos(side)), p: vec(f.turretX, f.roof, f.radius) },
      { face: 'turretSide', n: vec(0, detSin(side), -detCos(side)), p: vec(f.turretX, f.roof, -f.radius) },
      { face: 'turretRear', n: vec(1, 0, 0), p: vec(f.turretX + f.radius + f.bustle, 0, 0) },
      { face: 'turretRoof', n: vec(0, 1, 0), p: vec(0, f.top, 0) },
      { face: 'turretFloor', n: vec(0, -1, 0), p: vec(0, f.roof, 0) },
    ],
  }
  return {
    frame,
    hull,
    turret,
    mantletHalfM: TUNING.geometry.mantletWidthM / 2,
    mantletHalfHeightM: (geo.turretHeightM * TUNING.geometry.mantletHeightShare) / 2,
  }
}

export interface Crossing {
  /** How far along the line it goes in and comes out. */
  tIn: number
  tOut: number
  face: FaceId
  /** The way the face it goes in by points. */
  normal: Vec
}

/** Where a line (from `o`, along `d`) goes into a solid and comes out of it. Null when it misses. */
export function crossing(solid: Solid, o: Vec, d: Vec): Crossing | null {
  let tIn = -Infinity
  let tOut = Infinity
  let entry: Plane | null = null
  for (const plane of solid.planes) {
    const closing = dot(d, plane.n)
    const gap = dot(minus(plane.p, o), plane.n)
    if (closing > -1e-12 && closing < 1e-12) {
      // Running along the face: outside it for good, or inside it for good.
      if (gap < 0) return null
      continue
    }
    const t = gap / closing
    if (closing < 0) {
      if (t > tIn) {
        tIn = t
        entry = plane
      }
    } else if (t < tOut) {
      tOut = t
    }
  }
  if (!entry || tIn >= tOut) return null
  return { tIn, tOut, face: entry.face, normal: entry.n }
}

/** Where a line goes into a box and comes out of it. Null when it misses. */
export function boxCrossing(box: Box, o: Vec, d: Vec): { tIn: number; tOut: number } | null {
  let tIn = -Infinity
  let tOut = Infinity
  const slabs: [number, number, number, number][] = [
    [o.x, d.x, box.x0, box.x1], [o.y, d.y, box.y0, box.y1], [o.z, d.z, box.z0, box.z1],
  ]
  for (const [from, step, low, high] of slabs) {
    if (step > -1e-12 && step < 1e-12) {
      if (from < low || from > high) return null
      continue
    }
    const a = (low - from) / step
    const b = (high - from) / step
    tIn = Math.max(tIn, Math.min(a, b))
    tOut = Math.min(tOut, Math.max(a, b))
  }
  return tIn < tOut ? { tIn, tOut } : null
}

/** The armour zone at a point on a face. Null on the turret floor, which is the ring, not armour. */
export function zoneAt(shell: Shell, face: FaceId, point: Vec): ZoneId | null {
  const f = shell.frame
  switch (face) {
    case 'upperGlacis': return 'upperGlacis'
    case 'lowerGlacis': return 'lowerGlacis'
    case 'hullSide': return point.x < f.length / 2 ? 'hullSideFront' : 'hullSideRear'
    case 'hullRear': return 'hullRear'
    case 'hullRoof': return 'hullRoof'
    case 'belly': return 'belly'
    case 'turretFront': {
      const onMantlet = Math.abs(point.z) <= shell.mantletHalfM && Math.abs(point.y - f.gunY) <= shell.mantletHalfHeightM
      return onMantlet ? 'mantlet' : point.z > 0 ? 'turretFrontRight' : 'turretFrontLeft'
    }
    case 'turretSide': return 'turretSides'
    case 'turretRear': return 'turretRear'
    case 'turretRoof': return 'turretRoof'
    case 'turretFloor': return null
  }
}

function share(value: number, from: number, to: number): number {
  return Math.min(0.999999, Math.max(0, (value - from) / (to - from)))
}

/**
 * Which tile place a point on a zone falls in, counted as the tile grid is
 * drawn: row by row from the top left. Null when the zone takes no tiles.
 */
export function tilePlaceAt(shell: Shell, zone: ZoneId, point: Vec): number | null {
  const grid = ERA_GRIDS[zone]
  if (!grid) return null
  const f = shell.frame
  const turretBack = f.turretX + f.radius + f.bustle
  // Across, then down, each as a share of the zone's face.
  let u: number
  let v: number
  switch (zone) {
    // Seen from the front: the tank's right is on the left of the page.
    case 'upperGlacis': u = share(-point.z, -f.bodyHalf, f.bodyHalf); v = share(-point.y, -f.roof, -(f.belly + f.lowerH)); break
    case 'lowerGlacis': u = share(-point.z, -f.bodyHalf, f.bodyHalf); v = share(-point.y, -(f.belly + f.lowerH), -f.belly); break
    case 'turretFrontLeft': u = share(-point.z, 0, f.radius); v = share(-point.y, -f.top, -f.roof); break
    case 'turretFrontRight': u = share(-point.z, -f.radius, 0); v = share(-point.y, -f.top, -f.roof); break
    // Seen from the side: the nose is on the left of the page.
    case 'hullSideFront': u = share(point.x, 0, f.length / 2); v = share(-point.y, -f.roof, -f.belly); break
    case 'hullSideRear': u = share(point.x, f.length / 2, f.length); v = share(-point.y, -f.roof, -f.belly); break
    case 'turretSides': u = share(point.x, f.turretX - f.radius, turretBack); v = share(-point.y, -f.top, -f.roof); break
    // Seen from above: the tank's right is up the page.
    case 'hullRoof': u = share(point.x, 0, f.length); v = share(-point.z, -f.bodyHalf, f.bodyHalf); break
    case 'turretRoof': u = share(point.x, f.turretX - f.radius, turretBack); v = share(-point.z, -f.radius, f.radius); break
    default: return null
  }
  return Math.floor(v * grid.rows) * grid.cols + Math.floor(u * grid.cols)
}

/** The running gear on one side, as a box. `side` is 1 for the tank's right. */
export function trackBox(frame: Frame, side: 1 | -1): Box {
  const inner = frame.bodyHalf * side
  const outer = frame.halfWidth * side
  return { x0: 0, x1: frame.length, y0: 0, y1: frame.trackTop, z0: Math.min(inner, outer), z1: Math.max(inner, outer) }
}
