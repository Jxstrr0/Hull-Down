// The tank for the 3D range, as plain measurements and a list of simple
// parts. It uses the blueprint's own layout, so the tank on the range is
// the tank on the drawing. Nothing here needs three.js, so it can be tested.
import { DRAWING } from '../data/drawing'
import type { ZoneId } from '../data/materials'
import { TURRETS } from '../data/parts'
import { RENDER } from '../data/render'
import { layout } from '../office/drawing'
import type { Geometry, VehicleSpec } from '../sim/vehicle'
import { allTiles, tileCount } from '../sim/vehicle/era'
import type { Point } from './path'

/** Which of the tank's three colours a part is painted. */
export type Tone = 'body' | 'dark' | 'tile'
/** A part is fixed to the hull, or turns with the gun. Turret parts are placed from the middle of the ring. */
export type Mount = 'hull' | 'turret'

interface PartBase {
  mount: Mount
  tone: Tone
}

/** A box, centred at a place. `pitchDeg` tips its nose up about the axis across the tank. */
export interface BoxPart extends PartBase {
  kind: 'box'
  size: { x: number; y: number; z: number }
  at: { x: number; y: number; z: number }
  pitchDeg?: number
}

/** A wheel or a barrel: a round bar along one axis, centred at a place. */
export interface DrumPart extends PartBase {
  kind: 'drum'
  axis: 'x' | 'y' | 'z'
  radiusM: number
  lengthM: number
  sides: number
  at: { x: number; y: number; z: number }
}

/** An outline seen from the side, given width across the tank and centred at `atZ`. */
export interface SlabPart extends PartBase {
  kind: 'slab'
  outline: Point[]
  widthM: number
  atZ: number
}

/** Rings seen from above, one over the other, skinned between and closed on top. Every ring has as many corners. */
export interface LoftPart extends PartBase {
  kind: 'loft'
  rings: { y: number; corners: { x: number; z: number }[] }[]
}

export type TankPart = BoxPart | DrumPart | SlabPart | LoftPart

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
  /** Everything the tank is built from. */
  parts: TankPart[]
}

/** The share of a zone's tile places that carry a tile. */
function tileShare(spec: VehicleSpec, zone: ZoneId): number {
  const all = tileCount(allTiles(zone))
  return all === 0 ? 0 : tileCount(spec.era[zone]) / all
}

export function tankShapeOf(spec: VehicleSpec, geometry: Geometry): TankShape {
  const m = layout(spec, geometry)
  const t = RENDER.tank
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

  const hullOutline: Point[] = [
    { x: -half, y: m.belly },
    { x: fromNose(m.lowerRun), y: m.belly },
    { x: half, y: noseY },
    { x: fromNose(m.upperRun), y: m.roof },
    { x: -half, y: m.roof },
  ]
  const track = {
    widthM: m.trackWidth,
    topM: m.trackTop,
    lengthM: m.length - DRAWING.trackInsetFrontM - DRAWING.trackInsetRearM,
    centreZM: m.halfWidth - m.trackWidth / 2,
  }
  const turret = { xM: fromNose(m.turretX), baseM: m.roof, heightM: geometry.turretHeightM, radiusM: m.radius, bustleM: m.bustle }
  const gun = { rootXM: fromNose(m.gunRootX), lengthM: m.gunRootX - m.muzzleX, radiusM: m.barrelHalf, yM: m.gunY }

  const parts: TankPart[] = []
  const hull = (tone: Tone): PartBase => ({ mount: 'hull', tone })
  const top = (tone: Tone): PartBase => ({ mount: 'turret', tone })

  // --- The hull and what is fixed to it.
  parts.push({ ...hull('body'), kind: 'slab', outline: hullOutline, widthM: m.hull.bodyWidthM, atZ: 0 })

  // The track loop, with its corners cut as on the drawing.
  const c = DRAWING.trackCornerM
  const x0 = fromNose(DRAWING.trackInsetFrontM)
  const x1 = fromNose(m.length - DRAWING.trackInsetRearM)
  const loop: Point[] = [
    { x: x1 + c, y: 0 }, { x: x0 - c, y: 0 }, { x: x0, y: c }, { x: x0, y: m.trackTop - c * 0.4 },
    { x: x0 - c * 0.5, y: m.trackTop }, { x: x1 + c * 0.5, y: m.trackTop }, { x: x1, y: m.trackTop - c * 0.4 }, { x: x1, y: c },
  ]
  const endR = (m.trackTop - c) * 0.5
  const outerZ = track.centreZM + track.widthM / 2 + t.wheelProudM
  const fenderWide = m.halfWidth - m.bodyHalf
  for (const side of [-1, 1]) {
    parts.push({ ...hull('dark'), kind: 'slab', outline: loop, widthM: track.widthM, atZ: side * track.centreZM })
    for (const x of wheelX) {
      parts.push({
        ...hull('body'), kind: 'drum', axis: 'z', radiusM: radius, lengthM: t.wheelThickM, sides: t.wheelSides,
        at: { x, y: radius, z: side * outerZ },
      })
    }
    // The sprocket and the idler, up off the ground at either end of the loop.
    for (const x of [x0 - endR - 0.08, x1 + endR + 0.08]) {
      parts.push({
        ...hull('body'), kind: 'drum', axis: 'z', radiusM: endR, lengthM: t.wheelThickM, sides: t.endWheelSides,
        at: { x, y: m.trackTop - endR - DRAWING.trackThicknessM, z: side * outerZ },
      })
    }
    if (fenderWide > 0.05) {
      parts.push({
        ...hull('body'), kind: 'box', size: { x: m.length, y: t.fenderThickM, z: fenderWide },
        at: { x: 0, y: m.trackTop + t.fenderLiftM + t.fenderThickM / 2, z: side * (m.bodyHalf + fenderWide / 2) },
      })
    }
  }
  // The grille over the engine.
  parts.push({
    ...hull('dark'), kind: 'box',
    size: { x: m.bayEnd - m.bayStart, y: t.grilleThickM, z: m.hull.bodyWidthM * t.grilleWidthShare },
    at: { x: fromNose((m.bayStart + m.bayEnd) / 2), y: m.roof + t.grilleThickM / 2, z: 0 },
  })

  // Reactive tiles on the hull: a panel on the glacis, and panels hung over the tracks.
  const glacis = tileShare(spec, 'upperGlacis')
  if (glacis > 0) {
    const run = m.upperRun
    const rise = m.roof - noseY
    const long = Math.hypot(run, rise)
    // The plate's own slope, and the way out from it.
    const out = { x: rise / long, y: run / long }
    const off = t.tile.offM + t.tile.thickM / 2
    parts.push({
      ...hull('tile'), kind: 'box',
      size: { x: long * t.tile.cover, y: t.tile.thickM, z: m.hull.bodyWidthM * t.tile.cover * glacis },
      at: { x: half - run / 2 + out.x * off, y: noseY + rise / 2 + out.y * off, z: 0 },
      pitchDeg: -(Math.atan2(rise, run) * 180) / Math.PI,
    })
  }
  const sideHigh = (m.roof - m.trackTop * 0.45) * t.tile.cover
  const sideY = (m.roof + m.trackTop * 0.45) / 2
  const sides: [ZoneId, number][] = [['hullSideFront', 1], ['hullSideRear', -1]]
  for (const [zone, way] of sides) {
    const share = tileShare(spec, zone)
    if (share === 0) continue
    const long = half * t.tile.cover * share
    for (const side of [-1, 1]) {
      parts.push({
        ...hull('tile'), kind: 'box', size: { x: long, y: sideHigh, z: t.tile.thickM },
        // Tiles go on from the nose backward, and from the middle backward.
        at: { x: way > 0 ? half - long / 2 - half * (1 - t.tile.cover) / 2 : -long / 2, y: sideY, z: side * (m.halfWidth + t.tile.offM) },
      })
    }
  }

  // --- Everything that turns with the gun, placed from the middle of the ring.
  const R = turret.radiusM
  const h = turret.heightM
  const rings = t.turrets[spec.turret.shape]
  parts.push({
    ...top('body'), kind: 'loft',
    rings: rings.map((ring) => {
      const a = ring.ahead * R
      const b = ring.behind * R
      const w = ring.half * R
      const cut = ring.cut * R
      return {
        y: turret.baseM + ring.up * h,
        corners: [
          { x: a, z: w - cut }, { x: a - cut, z: w }, { x: -b + cut, z: w }, { x: -b, z: w - cut },
          { x: -b, z: -(w - cut) }, { x: -b + cut, z: -w }, { x: a - cut, z: -w }, { x: a, z: -(w - cut) },
        ],
      }
    }),
  })
  const lowest = rings[0]
  const sideZ = (lowest?.half ?? 1) * R
  if (turret.bustleM > 0) {
    const long = turret.bustleM + R * 0.1
    parts.push({
      ...top('body'), kind: 'box',
      size: { x: long, y: m.top - m.bustleFloor, z: R * t.bustleWidthShare },
      at: { x: -(R * 0.9 + long / 2), y: (m.top + m.bustleFloor) / 2, z: 0 },
    })
  }
  const rootX = gun.rootXM - turret.xM
  parts.push({
    ...top('dark'), kind: 'box',
    size: { x: t.mantlet.longM, y: h * t.mantlet.highShare, z: R * t.mantlet.wideShare },
    at: { x: rootX + t.mantlet.longM / 4, y: gun.yM, z: 0 },
  })
  parts.push({
    ...top('dark'), kind: 'drum', axis: 'x', radiusM: gun.radiusM, lengthM: gun.lengthM, sides: t.gunSides,
    at: { x: rootX + gun.lengthM / 2, y: gun.yM, z: 0 },
  })
  parts.push({
    ...top('dark'), kind: 'drum', axis: 'x', radiusM: m.extractorHalf, lengthM: DRAWING.extractorLengthM, sides: t.extractorSides,
    at: { x: fromNose(m.extractorX) - turret.xM + DRAWING.extractorLengthM / 2, y: gun.yM, z: 0 },
  })
  // The commander's hatch, and the sight head if one is fitted. A turret with nobody in it has no hatch.
  const cupolaM = TURRETS[spec.turret.shape].crewed ? DRAWING.cupolaHeightM : 0
  const hatch = { x: -R * t.cupola.backShare, z: TURRETS[spec.turret.shape].crewed ? R * t.cupola.acrossShare : 0 }
  if (cupolaM > 0) {
    parts.push({
      ...top('body'), kind: 'drum', axis: 'y', radiusM: DRAWING.hatchRadiusM, lengthM: cupolaM, sides: t.cupolaSides,
      at: { x: hatch.x, y: m.top + cupolaM / 2, z: hatch.z },
    })
  }
  if (spec.fireControl.commanderSight) {
    const s = DRAWING.sightHeadM
    parts.push({
      ...top('dark'), kind: 'box', size: { x: s.width, y: s.height, z: s.width },
      at: { x: hatch.x, y: m.top + cupolaM + s.height / 2, z: hatch.z },
    })
  }
  if (spec.protection.smokeLaunchers) {
    const l = t.launcher
    for (const side of [-1, 1]) {
      parts.push({
        ...top('dark'), kind: 'box', size: { x: l.longM, y: l.highM, z: l.wideM },
        at: { x: -R * l.backShare, y: turret.baseM + h * l.upShare, z: side * (sideZ + l.wideM / 2) },
      })
    }
  }
  // Reactive tiles on the turret: a block each side of the gun, and a strip along each side.
  const tileY = turret.baseM + h * 0.42
  const fronts: [ZoneId, number][] = [['turretFrontLeft', -1], ['turretFrontRight', 1]]
  for (const [zone, side] of fronts) {
    const share = tileShare(spec, zone)
    if (share === 0) continue
    parts.push({
      ...top('tile'), kind: 'box', size: { x: t.tile.thickM, y: h * 0.6, z: sideZ * 0.6 * share },
      at: { x: (lowest?.ahead ?? 1) * R * 0.94 + t.tile.offM, y: tileY, z: side * sideZ * 0.48 },
    })
  }
  const flank = tileShare(spec, 'turretSides')
  if (flank > 0) {
    for (const side of [-1, 1]) {
      parts.push({
        ...top('tile'), kind: 'box', size: { x: R * 1.2 * flank, y: h * 0.5, z: t.tile.thickM },
        at: { x: R * 0.1, y: tileY, z: side * (sideZ + t.tile.offM) },
      })
    }
  }

  return { lengthM: m.length, footprintM: m.length * t.footprintShare, hullOutline, hullWidthM: m.hull.bodyWidthM, track, wheels: { xM: wheelX, radiusM: radius }, turret, gun, parts }
}

/** Triangles one part is drawn with. */
export function partTriangles(part: TankPart): number {
  switch (part.kind) {
    case 'box': return 12
    case 'drum': return part.sides * 4
    // The edge all round, and a face each side.
    case 'slab': return part.outline.length * 2 + (part.outline.length - 2) * 2
    case 'loft': {
      const corners = part.rings[0]?.corners.length ?? 0
      return (part.rings.length - 1) * corners * 2 + (corners - 2)
    }
  }
}

/** Triangles the whole tank is drawn with. */
export function tankTriangles(shape: TankShape): number {
  return shape.parts.reduce((sum, part) => sum + partTriangles(part), 0)
}
