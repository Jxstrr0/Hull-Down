// Builds the tank the range and the battle show, from its list of parts.
// Parts of one colour are joined into one mesh, so a tank is a handful of
// meshes however much detail it carries.
import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, Shape } from 'three'
import { PAINT, type PaintId } from '../data/paint'
import { RENDER } from '../data/render'
import { camoOf, camoPlaces, type Camo } from './camo'
import type { Kit } from './rangeScene'
import type { Mount, Solid, TankShape, Tone } from './tankShape'

type Loft = Extract<Solid, { kind: 'loft' }>

/** The name of the part of a built tank that turns with the gun. */
export const TURRET = 'turret'

/** The three colours a tank is painted in, and the pattern over its plate if it wears one. */
export type Tones = Record<Tone, string> & { camo?: Camo }

/** The colours of a paint scheme. */
export function tonesOf(paint: PaintId): Tones {
  const scheme = PAINT[paint]
  const camo = camoOf(paint)
  return { body: scheme.body, dark: scheme.dark, tile: scheme.tile, ...(camo ? { camo } : {}) }
}

export const OUR_TONES: Tones = { body: RENDER.colours.tank, dark: RENDER.colours.tankDark, tile: RENDER.colours.tankTile }
export const THEIR_TONES: Tones = { body: RENDER.battle.theirTank, dark: RENDER.battle.theirTankDark, tile: RENDER.battle.theirTankTile }

/** The corners of every triangle of a ready-made shape, three numbers to a corner. It is given back once read. */
function cornersOf(geometry: BufferGeometry): number[] {
  const flat = geometry.getIndex() ? geometry.toNonIndexed() : geometry
  const out = Array.from(flat.getAttribute('position').array as ArrayLike<number>)
  if (flat !== geometry) flat.dispose()
  geometry.dispose()
  return out
}

/** Rings skinned one to the next and closed on top, every triangle turned to face outward. */
function loftCorners(part: Loft): number[] {
  const out: number[] = []
  let cx = 0
  let cy = 0
  let cz = 0
  let n = 0
  for (const ring of part.rings) {
    for (const corner of ring.corners) {
      cx += corner.x
      cy += ring.y
      cz += corner.z
      n++
    }
  }
  if (n === 0) return out
  cx /= n
  cy /= n
  cz /= n
  type V = [number, number, number]
  const face = (a: V, b: V, c: V): void => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const mx = (a[0] + b[0] + c[0]) / 3 - cx, my = (a[1] + b[1] + c[1]) / 3 - cy, mz = (a[2] + b[2] + c[2]) / 3 - cz
    if (nx * mx + ny * my + nz * mz >= 0) out.push(...a, ...b, ...c)
    else out.push(...a, ...c, ...b)
  }
  const at = (ring: Loft['rings'][number], i: number): V => {
    const corner = ring.corners[i % ring.corners.length]!
    return [corner.x, ring.y, corner.z]
  }
  for (let r = 0; r + 1 < part.rings.length; r++) {
    const low = part.rings[r]!
    const high = part.rings[r + 1]!
    for (let i = 0; i < low.corners.length; i++) {
      face(at(low, i), at(low, i + 1), at(high, i + 1))
      face(at(low, i), at(high, i + 1), at(high, i))
    }
  }
  const lid = part.rings[part.rings.length - 1]!
  for (let i = 1; i + 1 < lid.corners.length; i++) face(at(lid, 0), at(lid, i), at(lid, i + 1))
  return out
}

function partCorners(part: Solid): number[] {
  switch (part.kind) {
    case 'box': {
      const geometry = new BoxGeometry(part.size.x, part.size.y, part.size.z)
      if (part.pitchDeg) geometry.rotateZ((part.pitchDeg * Math.PI) / 180)
      geometry.translate(part.at.x, part.at.y, part.at.z)
      return cornersOf(geometry)
    }
    case 'drum': {
      const geometry = new CylinderGeometry(part.radiusM, part.radiusM, part.lengthM, part.sides)
      if (part.axis === 'x') geometry.rotateZ(Math.PI / 2)
      if (part.axis === 'z') geometry.rotateX(Math.PI / 2)
      geometry.translate(part.at.x, part.at.y, part.at.z)
      return cornersOf(geometry)
    }
    case 'slab': {
      const shape = new Shape()
      part.outline.forEach((point, index) => (index === 0 ? shape.moveTo(point.x, point.y) : shape.lineTo(point.x, point.y)))
      shape.closePath()
      const geometry = new ExtrudeGeometry(shape, { depth: part.widthM, bevelEnabled: false })
      geometry.translate(0, 0, part.atZ - part.widthM / 2)
      return cornersOf(geometry)
    }
    case 'loft':
      return loftCorners(part)
  }
}

/**
 * A tank, nose along x. The turret and the gun are one part, named
 * `TURRET`, that turns about the turret ring.
 */
export function buildTank(kit: Kit, shape: TankShape, tones: Tones = OUR_TONES): Group {
  const tank = new Group()
  const top = new Group()
  top.name = TURRET
  top.position.set(shape.turret.xM, 0, 0)
  tank.add(top)

  const piles = new Map<string, { mount: Mount; tone: Tone; corners: number[] }>()
  for (const part of shape.parts) {
    const key = `${part.mount}/${part.tone}`
    let pile = piles.get(key)
    if (!pile) {
      pile = { mount: part.mount, tone: part.tone, corners: [] }
      piles.set(key, pile)
    }
    for (const value of partCorners(part)) pile.corners.push(value)
  }
  for (const pile of piles.values()) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(pile.corners, 3))
    geometry.computeVertexNormals()
    let mesh
    if (pile.tone === 'body' && tones.camo) {
      geometry.setAttribute('uv', new Float32BufferAttribute(camoPlaces(pile.corners, tones.camo.tileM), 2))
      mesh = kit.patterned(geometry, tones.camo)
    } else mesh = kit.mesh(geometry, tones[pile.tone])
    ;(pile.mount === 'turret' ? top : tank).add(mesh)
  }
  return tank
}

/** Shapes that stand still, each with its colour. Every shape of one colour is joined into one mesh. */
export function buildSolids(kit: Kit, items: readonly { colour: string; solid: Solid }[]): Group {
  const group = new Group()
  const piles = new Map<string, number[]>()
  for (const item of items) {
    let pile = piles.get(item.colour)
    if (!pile) {
      pile = []
      piles.set(item.colour, pile)
    }
    for (const value of partCorners(item.solid)) pile.push(value)
  }
  for (const [colour, corners] of piles) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(corners, 3))
    geometry.computeVertexNormals()
    group.add(kit.mesh(geometry, colour))
  }
  return group
}
