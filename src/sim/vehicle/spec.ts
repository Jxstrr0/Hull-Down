// The vehicle spec: everything the player chooses. Plain data, safe to save
// as JSON. The stat sheet (stats.ts) is worked out from it.
import type { KineticIssue, ShapedIssue } from '../../data/ammo'
import type { MaterialId, ZoneId } from '../../data/materials'
import type { Generation } from '../../data/tech'
import type {
  ActiveId, BarrelId, LayoutId, ComfortId, ComputerId, CoolingId, EngineId, GunId, HullId, LoadingId, NightSightId,
  RangefinderId, RecoilId, SightId, StabiliserId, StowageId, SuspensionId, TransmissionId, TurretId,
} from '../../data/parts'

export interface ArmourLayer {
  material: MaterialId
  /** Plate thickness in millimetres, measured square to the plate. */
  mm: number
}

export interface VehicleSpec {
  name: string
  hull: {
    size: HullId
    /** Upper glacis slope in degrees from vertical. Steeper is more. */
    glacisAngleDeg: number
    engineAt: 'rear' | 'front'
  }
  turret: {
    shape: TurretId
    ringMm: number
  }
  gun: GunId
  barrel: BarrelId
  recoil: RecoilId
  loading: LoadingId
  ammo: {
    rounds: number
    stowage: StowageId
    /** Which kinetic and which shaped-charge round it carries (src/data/ammo.ts). */
    kinetic: KineticIssue
    shaped: ShapedIssue
  }
  fireControl: {
    sight: SightId
    rangefinder: RangefinderId
    stabiliser: StabiliserId
    computer: ComputerId
    night: NightSightId
    commanderSight: boolean
    /** A search radar to find aircraft, for an anti-aircraft gun. */
    searchRadar: boolean
  }
  powerpack: {
    engine: EngineId
    transmission: TransmissionId
    cooling: CoolingId
    fuelL: number
    apu: boolean
  }
  runningGear: {
    /** Tracks, or four, six or eight wheels. */
    layout: LayoutId
    suspension: SuspensionId
    /** Road wheels on each side. */
    roadWheels: number
    trackWidthMm: number
    /** Thin plates hung over the tracks, outside the wheels. */
    skirts: boolean
  }
  protection: {
    smokeLaunchers: boolean
    fireSuppression: boolean
    spallLiner: boolean
    /** Active protection: none, soft kill or hard kill (src/data/parts.ts). */
    active: ActiveId
  }
  crew: {
    comfort: ComfortId
    /** Soldiers carried in a compartment at the back. Nought for a tank. */
    troops: number
  }
  /** Outside layer first. Up to four layers a zone. */
  armour: Record<ZoneId, ArmourLayer[]>
  /**
   * Reactive tiles on each zone, as one whole number: bit n is set when tile
   * place n has a tile. The places are in `ERA_GRIDS`. Nought is no tiles.
   */
  era: Record<ZoneId, number>
}

/** Hard limits a design is checked against (Pact standard, later the tender). */
export interface Limits {
  maxMassT: number
  maxWidthM: number
  allowedCalibresMm: readonly number[]
  maxUnitCostKr?: number
  /** The newest technology allowed (src/data/tech.ts). Generation one when not given. */
  generation?: Generation
  /** Parts the bureau has yet to research, as `partKey` names them (src/sim/vehicle/tech.ts). None when not given. */
  locked?: readonly string[]
  /** True when the tender is for a tank destroyer, which may have a casemate in place of a turret. */
  casemate?: boolean
  /** True when the tender is for a wheeled vehicle, which may have wheels in place of tracks. */
  wheels?: boolean
  /** True when the tender is for a car on wheels only: tracks are refused. */
  wheelsOnly?: boolean
}
