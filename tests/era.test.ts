import { describe, expect, it } from 'vitest'
import { THREATS } from '../src/data/ammo'
import { BASELINE_SPEC } from '../src/data/baseline'
import { ERA_GRIDS, ERA_GRID_VIEW, ERA_TILE } from '../src/data/era'
import { ZONES } from '../src/data/materials'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { ZONE_VIEW } from '../src/office/drawing'
import { cleanSpec } from '../src/persist/specCodec'
import {
  allTiles, buildStatSheet, cleanTiles, hasTile, setTile, tileCount, tiledVerdictsAgainst, tiledWorth, tileGrid,
  verdictsAgainst, worthAgainst, type VehicleSpec,
} from '../src/sim/vehicle'

function sheetOf(change?: (spec: VehicleSpec) => void) {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return buildStatSheet(spec, PACT_LIMITS_GEN1)
}

describe('tile places', () => {
  it('gives each zone a grid that fits a phone, or says why it takes no tiles', () => {
    for (const zone of ZONES) {
      const grid = ERA_GRIDS[zone]
      if (!grid) {
        expect(STRINGS.eraGaps[zone], zone).toBeTruthy()
        expect(allTiles(zone)).toBe(0)
        continue
      }
      // Six 44 px places and their gaps fit a 360 px wide phone.
      expect(grid.cols).toBeLessThanOrEqual(6)
      expect(grid.cols * grid.rows).toBeLessThanOrEqual(30)
      expect(new Set(grid.gaps).size).toBe(grid.gaps.length)
      for (const gap of grid.gaps) {
        expect(Number.isInteger(gap) && gap >= 0 && gap < grid.cols * grid.rows, zone).toBe(true)
      }
      expect(grid.gaps.length).toBeLessThan(grid.cols * grid.rows)
      // Blocked places are explained.
      if (grid.gaps.length > 0) expect(STRINGS.eraGaps[zone], zone).toBeTruthy()
    }
  })

  it('looks at each grid the way the blueprint shows that zone', () => {
    const same = { front: 'front', side: 'side', top: 'above' } as const
    for (const zone of ZONES) {
      const view = ZONE_VIEW[zone]
      if (view && ERA_GRIDS[zone]) expect(ERA_GRID_VIEW[zone], zone).toBe(same[view])
    }
  })

  it('fits and strips single tiles, and never puts one on a blocked place', () => {
    const zone = 'upperGlacis'
    const grid = tileGrid(zone)
    expect(grid).not.toBeNull()
    let tiles = 0
    tiles = setTile(zone, tiles, 0, true)
    tiles = setTile(zone, tiles, 7, true)
    expect(hasTile(tiles, 0)).toBe(true)
    expect(hasTile(tiles, 7)).toBe(true)
    expect(hasTile(tiles, 1)).toBe(false)
    expect(tileCount(tiles)).toBe(2)
    // Place 2 is under the driver's hatch.
    expect(setTile(zone, tiles, 2, true)).toBe(tiles)
    expect(setTile(zone, tiles, 0, false)).toBe(setTile(zone, 0, 7, true))
    expect(setTile(zone, tiles, 99, true)).toBe(tiles)
    expect(setTile(zone, tiles, -1, true)).toBe(tiles)
    expect(tileCount(allTiles(zone))).toBe(18 - 2)
    expect(setTile('belly', 0, 0, true)).toBe(0)
  })

  it('cleans anything into tiles the zone can have', () => {
    expect(cleanTiles('upperGlacis', 'lots')).toBe(0)
    expect(cleanTiles('upperGlacis', -5)).toBe(0)
    expect(cleanTiles('upperGlacis', 2.5)).toBe(0)
    expect(cleanTiles('upperGlacis', Number.NaN)).toBe(0)
    expect(cleanTiles('upperGlacis', 2 ** 40)).toBe(0)
    expect(cleanTiles('upperGlacis', 2 ** 30 - 1)).toBe(allTiles('upperGlacis'))
    expect(cleanTiles('mantlet', 7)).toBe(0)
  })
})

describe('what tiles cost', () => {
  it('leaves the baseline bare', () => {
    const sheet = sheetOf()
    for (const zone of ZONES) expect(sheet.rollup.era[zone].tiles).toBe(0)
    expect(sheet.issues).toEqual([])
  })

  it('adds weight and cost for the plate covered', () => {
    const bare = sheetOf()
    const tiled = sheetOf((s) => { s.era.hullSideFront = allTiles('hullSideFront') })
    const era = tiled.rollup.era.hullSideFront
    expect(era.tiles).toBe(12)
    expect(era.open).toBe(12)
    expect(era.coverage).toBe(1)
    expect(era.massT).toBeCloseTo(tiled.geometry.zoneAreaM2.hullSideFront * ERA_TILE.massTPerM2, 6)
    expect(era.costKr).toBeCloseTo(tiled.geometry.zoneAreaM2.hullSideFront * ERA_TILE.costPerM2Kr, 3)
    expect(tiled.rollup.zoneMassT.hullSideFront).toBeCloseTo(bare.rollup.zoneMassT.hullSideFront + era.massT, 6)
    expect(tiled.massT).toBeGreaterThan(bare.massT + era.massT)
    expect(tiled.unitCostKr).toBeGreaterThan(bare.unitCostKr + era.costKr)

    const half = sheetOf((s) => {
      for (let place = 0; place < 6; place++) s.era.hullSideFront = setTile('hullSideFront', s.era.hullSideFront, place, true)
    })
    expect(half.rollup.era.hullSideFront.coverage).toBe(0.5)
    expect(half.rollup.era.hullSideFront.massT).toBeCloseTo(era.massT / 2, 6)
  })

  it('cannot cover a zone whose places are partly blocked', () => {
    const sheet = sheetOf((s) => { for (const zone of ZONES) s.era[zone] = allTiles(zone) })
    expect(sheet.rollup.era.upperGlacis.coverage).toBeLessThan(1)
    expect(sheet.rollup.era.belly).toMatchObject({ places: 0, tiles: 0, coverage: 0, massT: 0 })
    // A full set is more than the baseline has weight in hand for.
    expect(sheet.issues.some((issue) => issue.code === 'overMassLimit')).toBe(true)
  })

  it('wants a plate under the tiles', () => {
    const sheet = sheetOf((s) => {
      s.armour.turretRoof = []
      s.era.turretRoof = allTiles('turretRoof')
    })
    const issue = sheet.issues.find((found) => found.code === 'tilesNeedPlate')
    expect(issue).toMatchObject({ severity: 'error', part: 'armour.turretRoof' })
    expect(STRINGS.issues.tilesNeedPlate).toBeTruthy()
  })
})

describe('what tiles stop', () => {
  it('helps against shaped charges only', () => {
    const sheet = sheetOf()
    const side = sheet.protection.hullSideFront
    expect(tiledWorth(side, 'shaped')).toBe(worthAgainst(side, 'shaped') + ERA_TILE.ceMm)
    expect(tiledWorth(side, 'kinetic')).toBe(worthAgainst(side, 'kinetic') + ERA_TILE.keMm)
    expect(ERA_TILE.keMm).toBe(0)
  })

  it('judges a tile only where a zone has tiles, and leaves the bare plate as it was', () => {
    const bare = sheetOf()
    expect(tiledVerdictsAgainst(bare.protection, bare.rollup.era, THREATS.infantryRocket, 1000)).toEqual({})

    const tiled = sheetOf((s) => { s.era.hullSideFront = setTile('hullSideFront', 0, 0, true) })
    const under = tiledVerdictsAgainst(tiled.protection, tiled.rollup.era, THREATS.infantryRocket, 1000)
    expect(Object.keys(under)).toEqual(['hullSideFront'])
    expect(verdictsAgainst(tiled.protection, THREATS.infantryRocket, 1000).hullSideFront).toBe('fails')
    expect(under.hullSideFront).toBe('marginal')
    // Nothing changes against a kinetic round.
    expect(tiledVerdictsAgainst(tiled.protection, tiled.rollup.era, THREATS.autocannon, 1000).hullSideFront)
      .toBe(verdictsAgainst(tiled.protection, THREATS.autocannon, 1000).hullSideFront)
  })
})

describe('saving tiles', () => {
  it('keeps the tiles of a saved design', () => {
    const spec = structuredClone(BASELINE_SPEC)
    spec.era.upperGlacis = allTiles('upperGlacis')
    spec.era.turretRoof = setTile('turretRoof', 0, 4, true)
    expect(cleanSpec(JSON.parse(JSON.stringify(spec))).era).toEqual(spec.era)
  })

  it('loads a design saved before tiles existed, and drops tiles that cannot be', () => {
    const old = JSON.parse(JSON.stringify(BASELINE_SPEC)) as Record<string, unknown>
    delete old.era
    expect(cleanSpec(old).era).toEqual(BASELINE_SPEC.era)

    const odd = JSON.parse(JSON.stringify(BASELINE_SPEC)) as { era: Record<string, unknown> }
    odd.era = { upperGlacis: 2 ** 30 - 1, belly: 3, hullRoof: 'all', turretRoof: -1 }
    const cleaned = cleanSpec(odd).era
    expect(cleaned.upperGlacis).toBe(allTiles('upperGlacis'))
    expect(cleaned.belly).toBe(0)
    expect(cleaned.hullRoof).toBe(0)
    expect(cleaned.turretRoof).toBe(0)
    expect(cleaned.lowerGlacis).toBe(0)
  })
})
