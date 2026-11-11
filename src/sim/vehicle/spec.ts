// The vehicle spec: everything the player chooses. Plain data, safe to save
// as JSON. The stat sheet (stats.ts) is worked out from it.
import type { MaterialId, ZoneId } from '../../data/materials'
import type {
  ComfortId, ComputerId, CoolingId, EngineId, GunId, HullId, LoadingId, NightSightId,
  RangefinderId, SightId, StabiliserId, StowageId, SuspensionId, TransmissionId, TurretId,
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
  loading: LoadingId
  ammo: {
    rounds: number
    stowage: StowageId
  }
  fireControl: {
    sight: SightId
    rangefinder: RangefinderId
    stabiliser: StabiliserId
    computer: ComputerId
    night: NightSightId
    commanderSight: boolean
  }
  powerpack: {
    engine: EngineId
    transmission: TransmissionId
    cooling: CoolingId
    fuelL: number
    apu: boolean
  }
  runningGear: {
    suspension: SuspensionId
    /** Road wheels on each side. */
    roadWheels: number
    trackWidthMm: number
  }
  protection: {
    smokeLaunchers: boolean
    fireSuppression: boolean
    spallLiner: boolean
  }
  crew: {
    comfort: ComfortId
  }
  /** Outside layer first. Up to four layers a zone. */
  armour: Record<ZoneId, ArmourLayer[]>
}

/** Hard limits a design is checked against (Pact standard, later the tender). */
export interface Limits {
  maxMassT: number
  maxWidthM: number
  allowedCalibresMm: readonly number[]
  maxUnitCostKr?: number
}
