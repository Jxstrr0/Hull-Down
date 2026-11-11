// The stat sheet: every design-office readout worked out from a spec.
// These are estimates. The proving ground has the final word.
import {
  COMFORT, COMMANDER_SIGHT, COMPUTERS, COOLING, ENGINES, FIRE_SUPPRESSION, GUNS, LOADING, NIGHT_SIGHTS,
  RANGEFINDERS, SIGHTS, STABILISERS, SUSPENSIONS, TRANSMISSIONS, TURRETS, APU,
} from '../../data/parts'
import { TUNING } from '../../data/tuning'
import { checkSpec, type Issue } from './checks'
import { geometryOf, type Geometry } from './geometry'
import { rollupOf, type Rollup } from './rollup'
import type { Limits, VehicleSpec } from './spec'

export interface StatSheet {
  name: string
  geometry: Geometry
  rollup: Rollup
  /** Combat weight, tonnes. */
  massT: number
  unitCostKr: number
  crewCount: number
  mobility: {
    /** Engine horsepower per tonne. */
    powerToWeightHpT: number
    topSpeedKmh: number
    /** True when the gearing, not the engine, sets the top speed. */
    gearLimited: boolean
    rangeKm: number
    /** Kilograms per square centimetre under the tracks. */
    groundPressureKgCm2: number
  }
  firepower: {
    calibreMm: number
    rounds: number
    /** Rounds a minute, tank halted, fresh crew. */
    rateOfFireRpm: number
    gunDepressionDeg: number
  }
  /** How hard each stressed part is working: load divided by what it is rated for. */
  stress: {
    transmission: number
    suspension: number
    cooling: number
  }
  /** 0..100. Chance of finishing an endurance run with nothing broken. */
  reliabilityIndex: number
  /** 10..100. Higher is a harder tank to fight. */
  crewWorkload: number
  /** Room left for future upgrades. */
  growth: {
    /** Tonnes before the first weight limit (transmission, suspension or the hard limit). */
    massT: number
    /** Cubic metres of free space inside. */
    volumeM3: number
    /** Engine power the cooling could still handle. */
    coolingHp: number
  }
  issues: Issue[]
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/** Reliability multiplier for a part working at `ratio` of its rating. */
export function stressFactor(ratio: number): number {
  if (ratio <= 1) return 1
  return Math.max(TUNING.reliability.floor, 1 - TUNING.reliability.overloadPenalty * (ratio - 1))
}

export function buildStatSheet(spec: VehicleSpec, limits: Limits): StatSheet {
  const geometry = geometryOf(spec)
  const rollup = rollupOf(spec, geometry)
  const massT = rollup.totalMassT

  const engine = ENGINES[spec.powerpack.engine]
  const transmission = TRANSMISSIONS[spec.powerpack.transmission]
  const cooling = COOLING[spec.powerpack.cooling]
  const suspension = SUSPENSIONS[spec.runningGear.suspension]
  const gun = GUNS[spec.gun]
  const loading = LOADING[spec.loading]
  const turret = TURRETS[spec.turret.shape]
  const fc = spec.fireControl

  // Mobility
  const m = TUNING.mobility
  const trackDrag = 1 - (spec.runningGear.trackWidthMm - TUNING.geometry.standardTrackMm) * m.speedLossPerExtraTrackMm
  const poweredKmh = (m.speedBaseKmh + m.speedPerHpT * ((engine.powerHp * transmission.efficiency) / massT)) * trackDrag
  const gearLimited = poweredKmh > transmission.gearedKmh
  const fuelPer100Km = engine.fuelPer100KmPerT * massT
  const contactCm2 = 2 * geometry.trackContactM * 100 * (spec.runningGear.trackWidthMm / 10)

  // Firepower
  const g = TUNING.gunnery
  const spareRingDeg = clamp(
    ((spec.turret.ringMm - gun.minRingMm) / 100) * g.depressionPerSpareRing100Mm, 0, g.maxSpareRingBonusDeg,
  )
  const loaderDeg = loading.extraTurretHeightM > 0 ? g.loaderDepressionBonusDeg : 0

  // Stress and reliability
  const suspensionRatedT = rollup.stations * suspension.ratedPerStationT
  const stress = {
    transmission: massT / transmission.ratedT,
    suspension: massT / suspensionRatedT,
    cooling: engine.powerHp / cooling.capacityHp,
  }
  let reliability =
    engine.reliability * stressFactor(stress.cooling) *
    cooling.reliability *
    transmission.reliability * stressFactor(stress.transmission) *
    suspension.reliability * stressFactor(stress.suspension) *
    gun.reliability * loading.reliability *
    SIGHTS[fc.sight].reliability * RANGEFINDERS[fc.rangefinder].reliability *
    STABILISERS[fc.stabiliser].reliability * COMPUTERS[fc.computer].reliability *
    NIGHT_SIGHTS[fc.night].reliability
  if (fc.commanderSight) reliability *= COMMANDER_SIGHT.reliability
  if (spec.powerpack.apu) reliability *= APU.reliability
  if (spec.protection.fireSuppression) reliability *= FIRE_SUPPRESSION.reliability

  // Crew workload
  const c = TUNING.crew
  const workload =
    c.workloadBase[rollup.crewCount as 3 | 4] +
    SIGHTS[fc.sight].workload + RANGEFINDERS[fc.rangefinder].workload + STABILISERS[fc.stabiliser].workload +
    COMPUTERS[fc.computer].workload + NIGHT_SIGHTS[fc.night].workload +
    (fc.commanderSight ? COMMANDER_SIGHT.workload : 0) +
    transmission.workload + COMFORT[spec.crew.comfort].workload

  const massCeilingT = Math.min(transmission.ratedT, suspensionRatedT, limits.maxMassT)

  return {
    name: spec.name,
    geometry,
    rollup,
    massT,
    unitCostKr: rollup.unitCostKr,
    crewCount: rollup.crewCount,
    mobility: {
      powerToWeightHpT: engine.powerHp / massT,
      topSpeedKmh: Math.min(poweredKmh, transmission.gearedKmh),
      gearLimited,
      rangeKm: (spec.powerpack.fuelL / fuelPer100Km) * 100,
      groundPressureKgCm2: (massT * 1000) / contactCm2,
    },
    firepower: {
      calibreMm: gun.calibreMm,
      rounds: spec.ammo.rounds,
      rateOfFireRpm: loading.fixedRof ?? gun.loaderRof,
      gunDepressionDeg: turret.depressionDeg + spareRingDeg + loaderDeg,
    },
    stress,
    reliabilityIndex: reliability * 100,
    crewWorkload: clamp(workload, c.workloadMin, c.workloadMax),
    growth: {
      massT: massCeilingT - massT,
      volumeM3: rollup.capacityM3 - rollup.usedM3,
      coolingHp: cooling.capacityHp - engine.powerHp,
    },
    issues: checkSpec(spec, limits, geometry, rollup),
  }
}
