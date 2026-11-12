// Builds the tank the range and the battle show, from its list of parts.
// Parts of one colour are joined into one mesh, so a tank is a handful of
// meshes however much detail it carries.
import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, Shape } from 'three'
import { PAINT, type PaintId } from '../data/paint'
import { RENDER } from '../data/render'
import { camoOf, camoPlaces, type Camo } from './camo'
import { placeCorners } from './glb'
import { kitPiece } from './kitPieces'
import type { Kit } from './rangeScene'
import type { Mount, Solid, TankShape, Tone } from './tankShape'

type Loft = Extract<Solid, { kind: 'loft' }>
type Band = Extract<Solid, { kind: 'band' }>
type Sweep = Extract<Solid, { kind: 'sweep' }>

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

type V = [number, number, number]

/**
 * Outlines skinned one to the next, every triangle turned to face outward
 * from the middle. The last is closed with a lid, and the first too if asked.
 */
function skinCorners(rings: readonly (readonly V[])[], closeFirst: boolean): number[] {
  const out: number[] = []
  const all = rings.flat()
  if (all.length === 0) return out
  const mid = [0, 1, 2].map((k) => all.reduce((sum, v) => sum + v[k]!, 0) / all.length) as V
  const face = (a: V, b: V, c: V): void => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const mx = (a[0] + b[0] + c[0]) / 3 - mid[0], my = (a[1] + b[1] + c[1]) / 3 - mid[1], mz = (a[2] + b[2] + c[2]) / 3 - mid[2]
    if (nx * mx + ny * my + nz * mz >= 0) out.push(...a, ...b, ...c)
    else out.push(...a, ...c, ...b)
  }
  for (let r = 0; r + 1 < rings.length; r++) {
    const low = rings[r]!
    const high = rings[r + 1]!
    const n = low.length
    for (let i = 0; i < n; i++) {
      face(low[i]!, low[(i + 1) % n]!, high[(i + 1) % n]!)
      face(low[i]!, high[(i + 1) % n]!, high[i]!)
    }
  }
  const lid = (ring: readonly V[]): void => {
    for (let i = 1; i + 1 < ring.length; i++) face(ring[0]!, ring[i]!, ring[i + 1]!)
  }
  lid(rings[rings.length - 1]!)
  if (closeFirst) lid(rings[0]!)
  return out
}

/** Rings skinned one to the next and closed on top. */
function loftCorners(part: Loft): number[] {
  return skinCorners(part.rings.map((ring) => ring.corners.map((c): V => [c.x, ring.y, c.z])), false)
}

/** Outlines along the tank skinned one to the next and closed at both ends. */
function sweepCorners(part: Sweep): number[] {
  return skinCorners(part.stations.map((station) => station.corners.map((c): V => [station.x, c.y, c.z])), true)
}

/** A loop of plate: the outline, the same outline set in by the plate's thickness, and the faces between. */
function bandCorners(part: Band): number[] {
  return bandSkin(part, 1).corners
}

/**
 * A band's corners, and where each falls on a picture that repeats every
 * `repeatM` round the loop and spans the band once across.
 */
export function bandSkin(part: Band, repeatM: number): { corners: number[]; places: number[] } {
  const outer = part.outline
  const n = outer.length
  // Which way round the outline runs, so "in" is the right side of each edge.
  let area = 0
  for (let i = 0; i < n; i++) area += outer[i]!.x * outer[(i + 1) % n]!.y - outer[(i + 1) % n]!.x * outer[i]!.y
  const turn = area > 0 ? 1 : -1
  const inner = outer.map((p1, i) => {
    const p0 = outer[(i + n - 1) % n]!
    const p2 = outer[(i + 1) % n]!
    const e0 = norm(p1.x - p0.x, p1.y - p0.y)
    const e1 = norm(p2.x - p1.x, p2.y - p1.y)
    const n0 = { x: -e0.y * turn, y: e0.x * turn }
    const n1 = { x: -e1.y * turn, y: e1.x * turn }
    const m = norm(n0.x + n1.x, n0.y + n1.y)
    const reach = part.thickM / Math.max(0.2, m.x * n0.x + m.y * n0.y)
    return { x: p1.x + m.x * reach, y: p1.y + m.y * reach }
  })
  const near = part.atZ - part.widthM / 2
  const far = part.atZ + part.widthM / 2
  // How far round the loop each corner of the outline is, in repeats of the picture.
  const round: number[] = [0]
  for (let i = 1; i <= n; i++) {
    const a = outer[i - 1]!, b = outer[i % n]!
    round.push(round[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y) / repeatM)
  }
  const corners: number[] = []
  const places: number[] = []
  type C = [number, number, number, number, number]
  const quad = (a: C, b: C, c: C, d: C): void => {
    for (const k of [a, b, c, a, c, d]) {
      corners.push(k[0], k[1], k[2])
      places.push(k[3], k[4])
    }
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const o0 = outer[i]!, o1 = outer[j]!, i0 = inner[i]!, i1 = inner[j]!
    const u0 = round[i]!, u1 = round[i + 1]!
    quad([o0.x, o0.y, near, u0, 0], [o1.x, o1.y, near, u1, 0], [o1.x, o1.y, far, u1, 1], [o0.x, o0.y, far, u0, 1])
    quad([i1.x, i1.y, near, u1, 0], [i0.x, i0.y, near, u0, 0], [i0.x, i0.y, far, u0, 1], [i1.x, i1.y, far, u1, 1])
    // The edges of the links: the picture's own edge, the gaps still showing.
    quad([o1.x, o1.y, near, u1, 0], [o0.x, o0.y, near, u0, 0], [i0.x, i0.y, near, u0, 0], [i1.x, i1.y, near, u1, 0])
    quad([o0.x, o0.y, far, u0, 1], [o1.x, o1.y, far, u1, 1], [i1.x, i1.y, far, u1, 1], [i0.x, i0.y, far, u0, 1])
  }
  return { corners, places }
}

function norm(x: number, y: number): { x: number; y: number } {
  const long = Math.hypot(x, y) || 1
  return { x: x / long, y: y / long }
}

/** A part's triangle corners, by tone. Most parts are one tone; a kit piece brings its own two. */
function toneCorners(part: Solid, tone: Tone): Partial<Record<Tone, number[]>> {
  if (part.kind === 'piece') {
    const piece = kitPiece(part.piece)
    if (!piece) return { [tone]: part.fallback.flatMap((plain) => partCorners(plain)) }
    // A tile panel's tiles are painted the tile colour; its frame stays dark.
    const main = tone === 'tile' ? 'tile' : 'body'
    return { [main]: placeCorners(piece.body, part.scale, part.at, part.axes), dark: placeCorners(piece.dark, part.scale, part.at, part.axes) }
  }
  return { [tone]: partCorners(part) }
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
    case 'band':
      return bandCorners(part)
    case 'sweep':
      return sweepCorners(part)
    case 'piece':
      return toneCorners(part, 'body').body ?? []
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
  // The tracks are bare steel with their links painted on, one mesh for both.
  const track = { corners: [] as number[], places: [] as number[] }
  for (const part of shape.parts) {
    if (part.kind === 'band') {
      const skin = bandSkin(part, RENDER.tank.trackLinks.linkM)
      for (const value of skin.corners) track.corners.push(value)
      for (const value of skin.places) track.places.push(value)
      continue
    }
    for (const [tone, corners] of Object.entries(toneCorners(part, part.tone)) as [Tone, number[]][]) {
      const key = `${part.mount}/${tone}`
      let pile = piles.get(key)
      if (!pile) {
        pile = { mount: part.mount, tone, corners: [] }
        piles.set(key, pile)
      }
      for (const value of corners) pile.corners.push(value)
    }
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
  if (track.corners.length > 0) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(track.corners, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(track.places, 2))
    geometry.computeVertexNormals()
    tank.add(kit.tracked(geometry))
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
