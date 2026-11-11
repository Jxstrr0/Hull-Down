export { buildStatSheet, type StatSheet } from './stats'
export {
  busiestOf, comfortOf, fatigueAfter, slowOf, stationsOf, tiringPerHour, workloadAt,
  type Comfort, type Station, type WorkShare,
} from '../crew/stations'
export { gunRingMm, gunRounds } from '../gunnery/mount'
export { checkSpec, ISSUE_CODES, type Issue, type IssueCode, type Severity } from './checks'
export { allTiles, cleanTiles, eraOf, hasTile, setTile, tileCount, tileGrid, type ZoneEra } from './era'
export { geometryOf, type Geometry } from './geometry'
export {
  layerWorth, pathFactor, penetrationAt, protectionOf, stackProtection, tiledVerdictsAgainst, tiledWorth, verdictOf,
  verdictsAgainst, worthAgainst,
  type Verdict, type ZoneProtection,
} from './protection'
export { rollupOf, AREAS, type Area, type Rollup } from './rollup'
export { shotCosine, testShot, type ShotResult, type ShotSetup, type ShotStep } from './shot'
export type { ArmourLayer, Limits, VehicleSpec } from './spec'
