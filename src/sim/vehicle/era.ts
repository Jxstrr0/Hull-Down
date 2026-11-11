// Reactive tiles, zone by zone. The spec keeps one whole number a zone: bit
// n is set when tile place n has a tile on it.
import { ERA_GRIDS, ERA_TILE, type TileGrid } from '../../data/era'
import { ZONES, type ZoneId } from '../../data/materials'
import type { Geometry } from './geometry'
import type { VehicleSpec } from './spec'

export interface ZoneEra {
  /** Tile places on the zone, blocked ones included. Nought when the zone takes no tiles. */
  places: number
  /** Places that can take a tile. */
  open: number
  /** Tiles fitted. */
  tiles: number
  /** Share of the zone's face under a tile, 0 to 1. */
  coverage: number
  massT: number
  costKr: number
}

export function tileGrid(zone: ZoneId): TileGrid | null {
  return ERA_GRIDS[zone]
}

/** Every place on the zone that can take a tile, as a spec number. */
export function allTiles(zone: ZoneId): number {
  const grid = tileGrid(zone)
  if (!grid) return 0
  let mask = 0
  for (let place = 0; place < grid.cols * grid.rows; place++) {
    if (!grid.gaps.includes(place)) mask += 2 ** place
  }
  return mask
}

/** Turns anything into a spec number the zone can really have: no tiles on blocked places. */
export function cleanTiles(zone: ZoneId, raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 2 ** 30) return 0
  return raw & allTiles(zone)
}

export function hasTile(tiles: number, place: number): boolean {
  return Number.isInteger(place) && place >= 0 && place < 30 && ((tiles >> place) & 1) === 1
}

/** The spec number with one place fitted or stripped. Blocked places stay bare. */
export function setTile(zone: ZoneId, tiles: number, place: number, on: boolean): number {
  if (!Number.isInteger(place) || place < 0 || place >= 30) return cleanTiles(zone, tiles)
  const bit = 2 ** place
  return cleanTiles(zone, on ? tiles | bit : tiles & ~bit)
}

export function tileCount(tiles: number): number {
  let count = 0
  for (let place = 0; place < 30; place++) if (hasTile(tiles, place)) count++
  return count
}

export function eraOf(spec: VehicleSpec, geo: Geometry): Record<ZoneId, ZoneEra> {
  return Object.fromEntries(ZONES.map((zone): [ZoneId, ZoneEra] => {
    const grid = tileGrid(zone)
    if (!grid) return [zone, { places: 0, open: 0, tiles: 0, coverage: 0, massT: 0, costKr: 0 }]
    const places = grid.cols * grid.rows
    const tiles = tileCount(cleanTiles(zone, spec.era[zone]))
    const coverage = tiles / places
    const areaM2 = geo.zoneAreaM2[zone] * coverage
    return [zone, {
      places,
      open: places - grid.gaps.length,
      tiles,
      coverage,
      massT: areaM2 * ERA_TILE.massTPerM2,
      costKr: areaM2 * ERA_TILE.costPerM2Kr,
    }]
  })) as Record<ZoneId, ZoneEra>
}
