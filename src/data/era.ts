// Explosive reactive armour for generation one: light tiles bolted over the
// plate. A tile breaks up a shaped-charge jet and does nothing to a kinetic
// round. Tiles cannot go where a hatch, a sight or the gun is in the way.
// Game-level abstractions, not engineering data.
import type { ZoneId } from './materials'

export interface EraTile {
  /** Tonnes for each square metre of plate covered, mounts included. */
  massTPerM2: number
  /** Korona for each square metre covered. */
  costPerM2Kr: number
  /** Millimetres of rolled steel a tile is worth against kinetic rounds. */
  keMm: number
  /** The same against shaped-charge warheads. */
  ceMm: number
}

export const ERA_TILE = {
  massTPerM2: 0.11,
  costPerM2Kr: 14_000,
  keMm: 0,
  ceMm: 250,
} as const satisfies EraTile

/** Where tiles can go on a zone: a grid of tile places, some of them blocked. */
export interface TileGrid {
  cols: number
  rows: number
  /** Places that cannot take a tile, counted row by row from the top left, from 0. */
  gaps: readonly number[]
}

/** How each zone's grid is looked at, for the caption under it. */
export type GridView = 'front' | 'side' | 'above'

/**
 * A zone with no grid has no room for tiles at all. Grids are at most six
 * places wide so every place is a full-size tap target on a phone.
 */
export const ERA_GRIDS = {
  // The driver's hatch and periscopes sit top centre.
  upperGlacis: { cols: 6, rows: 3, gaps: [2, 3] },
  // Tow hooks at the bottom corners.
  lowerGlacis: { cols: 6, rows: 2, gaps: [6, 11] },
  hullSideFront: { cols: 6, rows: 2, gaps: [] },
  // The exhaust outlet.
  hullSideRear: { cols: 6, rows: 2, gaps: [3] },
  hullRear: null,
  // The turret ring in the middle and the engine grilles at the back.
  hullRoof: { cols: 6, rows: 3, gaps: [2, 3, 8, 9, 14, 15, 5, 11, 17] },
  belly: null,
  // The gunner's sight.
  turretFrontLeft: { cols: 3, rows: 3, gaps: [0] },
  // The searchlight.
  turretFrontRight: { cols: 3, rows: 3, gaps: [2, 5] },
  mantlet: null,
  // Smoke launchers and the snorkel stowage.
  turretSides: { cols: 5, rows: 2, gaps: [3] },
  turretRear: null,
  // Two hatches and the gunner's sight head.
  turretRoof: { cols: 5, rows: 3, gaps: [0, 6, 8] },
} as const satisfies Record<ZoneId, TileGrid | null>

export const ERA_GRID_VIEW = {
  upperGlacis: 'front',
  lowerGlacis: 'front',
  hullSideFront: 'side',
  hullSideRear: 'side',
  hullRear: 'front',
  hullRoof: 'above',
  belly: 'above',
  turretFrontLeft: 'front',
  turretFrontRight: 'front',
  mantlet: 'front',
  turretSides: 'side',
  turretRear: 'front',
  turretRoof: 'above',
} as const satisfies Record<ZoneId, GridView>
