export { buildStatSheet, stressFactor, type StatSheet } from './stats'
export { checkSpec, ISSUE_CODES, type Issue, type IssueCode, type Severity } from './checks'
export { allTiles, cleanTiles, eraOf, hasTile, setTile, tileCount, tileGrid, type ZoneEra } from './era'
export { geometryOf, type Geometry } from './geometry'
export {
  layerWorth, pathFactor, penetrationAt, protectionOf, stackProtection, tiledVerdictsAgainst, tiledWorth, verdictOf,
  verdictsAgainst, worthAgainst,
  type Verdict, type ZoneProtection,
} from './protection'
export { rollupOf, AREAS, type Area, type Rollup } from './rollup'
export type { ArmourLayer, Limits, VehicleSpec } from './spec'
