// The paint a design wears on the range and in battle. Paint is looks only:
// it is kept beside the design, never inside it, and changes no result.
import { RENDER } from './render'

export const PAINT_IDS = ['green', 'sand', 'threeColour', 'winter'] as const
export type PaintId = (typeof PAINT_IDS)[number]

export const DEFAULT_PAINT: PaintId = 'green'

export interface PaintScheme {
  /** The plate, the running gear and tracks, and the reactive tiles. */
  body: string
  dark: string
  tile: string
  /**
   * Patches painted over the plate, each covering this share of it. The
   * shares add up to less than one: the rest stays the body colour. None
   * means one flat colour.
   */
  patches: readonly { colour: string; share: number }[]
}

export const PAINT: Record<PaintId, PaintScheme> = {
  green: { body: RENDER.colours.tank, dark: RENDER.colours.tankDark, tile: RENDER.colours.tankTile, patches: [] },
  sand: { body: '#b09a6c', dark: '#4a4234', tile: '#c2ad80', patches: [] },
  threeColour: {
    body: '#56603f',
    dark: RENDER.colours.tankDark,
    tile: '#667050',
    patches: [{ colour: '#6e5237', share: 0.3 }, { colour: '#23261f', share: 0.16 }],
  },
  winter: {
    body: '#dcdfd8',
    dark: '#3a3d38',
    tile: '#c4c8c0',
    patches: [{ colour: '#4f5a44', share: 0.3 }],
  },
}

/** How a camouflage pattern is made. It repeats over the tank, so it is small. */
export const CAMO = {
  /** The pattern is a square this many pixels a side, and it covers this much plate before it repeats. */
  sizePx: 64,
  tileM: 3.4,
  /** Patches are grown from a grid of this many random points a side. More gives smaller patches. */
  cells: 4,
  /** A second, finer grid breaks up the edges: this many points a side, at this strength. */
  detailCells: 9,
  detailShare: 0.3,
  /** Every pattern starts from this number, so a scheme looks the same on every device. */
  seed: 1987,
} as const

/** The paint named in a save, or the default when it names none we know. */
export function cleanPaint(raw: unknown): PaintId {
  return PAINT_IDS.find((id) => id === raw) ?? DEFAULT_PAINT
}
