// What stands round the proving ground. A plain list of shapes with no
// three.js, so it can be tested and counted. Nothing here changes a result.
import { RENDER } from '../data/render'
import { unit } from '../sim/rng'
import { partTriangles, type Solid } from './tankShape'

export interface SceneryItem {
  colour: string
  solid: Solid
}

export interface SceneryArgs {
  /** The stretch of lane the scenery runs beside, metres along it. */
  fromX: number
  toX: number
  /** Half the width of the lane: nothing stands on it or close beside it. */
  laneHalfM: number
  /** Thins the woods: 1 is every tree, 0.5 every other one. */
  density?: number
}

const S = RENDER.scenery

/** A ring of corners round a point, seen from above. */
function ring(x: number, z: number, radiusX: number, radiusZ: number, sides: number, turn: number): { x: number; z: number }[] {
  return Array.from({ length: sides }, (_, i) => {
    const angle = turn + (i / sides) * 2 * Math.PI
    return { x: x + Math.cos(angle) * radiusX, z: z + Math.sin(angle) * radiusZ }
  })
}

/** A conifer: a cone that starts a little way up, so it reads as standing on a trunk. */
function tree(x: number, z: number, heightM: number, colour: string, turn: number): SceneryItem {
  const t = S.tree
  const wide = heightM * t.widthShare
  return {
    colour,
    solid: {
      kind: 'loft',
      rings: [
        { y: heightM * t.skirtShare, corners: ring(x, z, wide, wide, t.sides, turn) },
        { y: heightM, corners: ring(x, z, 0.05, 0.05, t.sides, turn) },
      ],
    },
  }
}

/** Woods along one side of the lane. `side` is 1 for the camera's side, -1 for the far side. */
function woods(args: SceneryArgs, side: 1 | -1): SceneryItem[] {
  const out: SceneryItem[] = []
  const from = side === 1 ? S.nearSideFromM : S.farSideFromM
  const start = args.laneHalfM + from
  const every = S.treeEveryM / Math.max(0.05, Math.min(1, args.density ?? 1))
  const count = Math.floor((args.toX - args.fromX) / every)
  for (let i = 0; i < count; i++) {
    const key = side === 1 ? i : i + 100000
    const x = args.fromX + (i + unit(S.seed, key, 0)) * every
    // Squared, so the trees crowd the edge of the wood nearest the lane.
    const deep = unit(S.seed, key, 1) ** 2
    const z = side * (start + deep * S.depthM)
    const heightM = S.tree.minHeightM + unit(S.seed, key, 2) * (S.tree.maxHeightM - S.tree.minHeightM)
    const colour = S.treeColours[Math.floor(unit(S.seed, key, 3) * S.treeColours.length)] ?? S.treeColours[0]
    out.push(tree(x, z, heightM, colour, unit(S.seed, key, 4) * Math.PI))
  }
  return out
}

/** Low hills along the skyline, beyond the woods. */
function hills(args: SceneryArgs): SceneryItem[] {
  const h = S.hills
  const out: SceneryItem[] = []
  const span = args.toX - args.fromX
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < h.eachSide; i++) {
      const key = side === 1 ? i : i + 100
      const x = args.fromX + ((i + 0.2 + 0.6 * unit(S.seed, 7, key, 0)) / h.eachSide) * span
      const z = side * (h.fromM + unit(S.seed, 7, key, 1) * (h.toM - h.fromM))
      const long = h.lengthM * (0.6 + 0.4 * unit(S.seed, 7, key, 2))
      const high = h.heightM * (0.5 + 0.5 * unit(S.seed, 7, key, 3))
      out.push({
        colour: h.colour,
        solid: {
          kind: 'loft',
          rings: [
            { y: -1, corners: ring(x, z, long, long * 0.45, h.sides, 0) },
            { y: high * 0.6, corners: ring(x, z, long * 0.6, long * 0.27, h.sides, 0) },
            { y: high, corners: ring(x, z, long * 0.22, long * 0.1, h.sides, 0) },
          ],
        },
      })
    }
  }
  return out
}

/** The range tower, on the far side beside the start. */
function tower(args: SceneryArgs): SceneryItem[] {
  const t = S.tower
  const c = S.towerColours
  const x = args.fromX + t.alongM
  const z = -(args.laneHalfM + t.offM)
  const out: SceneryItem[] = []
  const reach = t.cabinM / 2 - t.legWidthM / 2
  for (const dx of [-1, 1]) {
    for (const dz of [-1, 1]) {
      out.push({
        colour: c.legs,
        solid: { kind: 'box', size: { x: t.legWidthM, y: t.legHighM, z: t.legWidthM }, at: { x: x + dx * reach, y: t.legHighM / 2, z: z + dz * reach } },
      })
    }
  }
  out.push(
    { colour: c.cabin, solid: { kind: 'box', size: { x: t.cabinM, y: t.cabinHighM, z: t.cabinM }, at: { x, y: t.legHighM + t.cabinHighM / 2, z } } },
    {
      colour: c.roof,
      solid: { kind: 'box', size: { x: t.roofM, y: t.roofThickM, z: t.roofM }, at: { x, y: t.legHighM + t.cabinHighM + t.roofThickM / 2, z } },
    },
  )
  return out
}

/** A red flag on a pole each side of the lane, at both ends of the stretch. */
function flags(args: SceneryArgs): SceneryItem[] {
  const f = S.flag
  const out: SceneryItem[] = []
  for (const x of [args.fromX, args.toX]) {
    for (const side of [-1, 1]) {
      const z = side * (args.laneHalfM + f.offM)
      out.push(
        { colour: f.pole, solid: { kind: 'drum', axis: 'y', radiusM: f.poleRadiusM, lengthM: f.poleHighM, sides: 5, at: { x, y: f.poleHighM / 2, z } } },
        { colour: f.cloth, solid: { kind: 'box', size: { x: f.longM, y: f.highM, z: f.thickM }, at: { x: x - f.longM / 2, y: f.poleHighM - f.highM / 2, z } } },
      )
    }
  }
  return out
}

/** Everything that stands round one stretch of range. The same list every time it is asked for. */
export function rangeScenery(args: SceneryArgs): SceneryItem[] {
  return [...woods(args, -1), ...woods(args, 1), ...hills(args), ...tower(args), ...flags(args)]
}

/** Triangles the scenery is drawn with. */
export function sceneryTriangles(items: readonly SceneryItem[]): number {
  return items.reduce((sum, item) => sum + partTriangles(item.solid), 0)
}
