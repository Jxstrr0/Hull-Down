export { buildStatSheet, type StatSheet } from './stats'
export {
  busiestOf, comfortOf, fatigueAfter, slowOf, stationsOf, tiringPerHour, workloadAt,
  type Comfort, type Station, type WorkShare,
} from '../crew/stations'
export { gunRingMm, gunRounds } from '../gunnery/mount'
export {
  ITEM_IDS, ITEM_KINDS, interiorOf, type Box, type Interior, type InteriorItem, type ItemId, type ItemKind,
} from '../hits/interior'
export { electricsOf, type Electrics } from './electrics'
export { checkSpec, ISSUE_CODES, type Issue, type IssueCode, type Severity } from './checks'
export { allTiles, cleanTiles, eraOf, hasTile, setTile, tileCount, tileGrid, type ZoneEra } from './era'
export { frameOf, type Frame } from './frame'
export { geometryOf, type Geometry } from './geometry'
export {
  layerWorth, pathFactor, penetrationAt, protectionOf, stackProtection, tiledVerdictsAgainst, tiledWorth, tileWorthMm, verdictOf,
  verdictsAgainst, worthAgainst,
  type Verdict, type ZoneProtection,
} from './protection'
export { lineAt, paperLine, paperShot, plateOf, type Line, type Plate } from '../hits/aim'
export { FACES, shellOf, tilePlaceAt, zoneAt, type FaceId, type Shell, type Vec } from '../hits/shell'
export {
  OUTCOMES, directionOf, targetOf, tileKey, traceShot,
  type Effect, type HitResult, type Incoming, type Outcome, type Reached, type Target,
} from '../hits/trace'
export { rollupOf, AREAS, type Area, type Rollup } from './rollup'
export { shotCosine, shotThrough, testShot, type ShotResult, type ShotSetup, type ShotStep, type StackShot } from './shot'
export type { ArmourLayer, Limits, VehicleSpec } from './spec'
