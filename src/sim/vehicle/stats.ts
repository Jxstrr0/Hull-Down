// The stat sheet: every design-office readout worked out from a spec.
// These are estimates. The proving ground has the final word.
import {
  COMMANDER_SIGHT, COMPUTERS, COOLING, ENGINES, FIRE_SUPPRESSION, GUNS, LOADING, NIGHT_SIGHTS,
  RANGEFINDERS, RECOILS, SIGHTS, STABILISERS, SUSPENSIONS, TRANSMISSIONS, TURRETS, APU,
} from '../../data/parts'
import type { ZoneId } from '../../data/materials'
import { GROUNDS, RUN_PART_IDS } from '../../data/range'
import { TUNING } from '../../data/tuning'
import { busiestOf, comfortOf, stationsOf, type Comfort, type Station } from '../crew/stations'
import { fireOf, quoteOf, turretFallbacks, type Fire, type GunneryQuote, type TurretPart } from '../gunnery/fire'
import { gunRingMm } from '../gunnery/mount'
import { driveOf, maxSlopeDeg, topSpeedOf, type Drive } from '../mobility/drive'
import { survivalOf, type Wear } from '../reliability/wear'
import { checkSpec, type Issue } from './checks'
import { geometryOf, type Geometry } from './geometry'
import { protectionOf, type ZoneProtection } from './protection'
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
  /** How the tank moves. The proving ground tests run on this. */
  drive: Drive
  mobility: {
    /** Engine horsepower per tonne. */
    powerToWeightHpT: number
    topSpeedKmh: number
    /** True when the gearing, not the engine, sets the top speed. */
    gearLimited: boolean
    rangeKm: number
    /** Kilograms per square centimetre under the tracks. */
    groundPressureKgCm2: number
    /** The steepest slope it climbs on firm ground, degrees. */
    maxSlopeDeg: number
    /** The longest trench it bridges, metres. */
    trenchM: number
    /** The highest step it mounts, metres. */
    stepM: number
    /** Ground to belly, metres. */
    clearanceM: number
  }
  firepower: {
    calibreMm: number
    rounds: number
    /** Rounds a minute, tank halted, fresh crew. */
    rateOfFireRpm: number
    gunDepressionDeg: number
  }
  /** How the tank shoots. The gunnery tests run on this. */
  fire: Fire
  /** The turret parts that can fail during a shoot, and how the tank shoots without each. */
  turret: TurretPart[]
  /** What the design office expects of the gun on the range, with the range's own crew. */
  gunnery: GunneryQuote
  /** How hard each stressed part is working: load divided by what it is rated for. */
  stress: {
    transmission: number
    suspension: number
    cooling: number
    tracks: number
  }
  /** The parts an endurance run wears, with what each carries and is rated for. */
  wear: Wear
  /** 0..100. Chance of getting through an endurance run with nothing giving trouble. */
  reliabilityIndex: number
  /** The crew, commander first, and how hard each station is to work. */
  crew: Station[]
  /** How easy the tank is to live in. An uncomfortable tank tires its crew sooner. */
  comfort: Comfort
  /** 10..100. The workload of the busiest station. Higher is a harder tank to fight. */
  crewWorkload: number
  /** Room left for future upgrades. */
  growth: {
    /** Tonnes before the first weight limit (transmission, suspension, tracks or the hard limit). */
    massT: number
    /** Cubic metres of free space inside. */
    volumeM3: number
    /** Engine power the cooling could still handle. */
    coolingHp: number
  }
  /** What each armour zone stops, against a level shot at its face. */
  protection: Record<ZoneId, ZoneProtection>
  issues: Issue[]
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
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
  const drive = driveOf(spec, geometry, rollup)
  const top = topSpeedOf(drive, GROUNDS.hard)
  const fuelPer100Km = engine.fuelPer100KmPerT * massT

  // Firepower
  const g = TUNING.gunnery
  const spareRingDeg = clamp(
    ((spec.turret.ringMm - gunRingMm(spec)) / 100) * g.depressionPerSpareRing100Mm, 0, g.maxSpareRingBonusDeg,
  )
  const loaderDeg = loading.extraTurretHeightM > 0 ? g.loaderDepressionBonusDeg : 0

  // Stress and reliability
  const suspensionRatedT = rollup.stations * suspension.ratedPerStationT
  const trackRatedT = spec.runningGear.trackWidthMm * TUNING.tracks.ratedTPerMm
  const stress = {
    transmission: massT / transmission.ratedT,
    suspension: massT / suspensionRatedT,
    cooling: engine.powerHp / cooling.capacityHp,
    tracks: massT / trackRatedT,
  }
  const wear: Wear = {
    engine: { reliability: engine.reliability, have: engine.powerHp, rated: cooling.capacityHp },
    cooling: { reliability: cooling.reliability, have: 0, rated: null },
    transmission: { reliability: transmission.reliability, have: massT, rated: transmission.ratedT },
    suspension: { reliability: suspension.reliability, have: massT, rated: suspensionRatedT },
    tracks: { reliability: TUNING.tracks.reliability, have: massT, rated: trackRatedT },
  }
  let reliability =
    gun.reliability * RECOILS[spec.recoil].reliability * loading.reliability *
    SIGHTS[fc.sight].reliability * RANGEFINDERS[fc.rangefinder].reliability *
    STABILISERS[fc.stabiliser].reliability * COMPUTERS[fc.computer].reliability *
    NIGHT_SIGHTS[fc.night].reliability
  for (const id of RUN_PART_IDS) reliability *= survivalOf(id, wear[id])
  if (fc.commanderSight) reliability *= COMMANDER_SIGHT.reliability
  if (spec.powerpack.apu) reliability *= APU.reliability
  if (spec.protection.fireSuppression) reliability *= FIRE_SUPPRESSION.reliability

  const crew = stationsOf(spec)
  const fire = fireOf(spec)
  // How it would shoot with each turret part out of action: the crew is busier, too.
  const turretParts = turretFallbacks(spec).map((part) => ({
    id: part.id, reliability: part.reliability, without: fireOf(part.spec),
  }))

  const massCeilingT = Math.min(transmission.ratedT, suspensionRatedT, trackRatedT, limits.maxMassT)

  return {
    name: spec.name,
    geometry,
    rollup,
    massT,
    unitCostKr: rollup.unitCostKr,
    crewCount: rollup.crewCount,
    drive,
    mobility: {
      powerToWeightHpT: engine.powerHp / massT,
      topSpeedKmh: top.gearLimited ? transmission.gearedKmh : top.speedMs * 3.6,
      gearLimited: top.gearLimited,
      rangeKm: (spec.powerpack.fuelL / fuelPer100Km) * 100,
      groundPressureKgCm2: drive.pressureKgCm2,
      maxSlopeDeg: maxSlopeDeg(drive, GROUNDS.firm),
      trenchM: drive.trenchM,
      stepM: drive.stepM,
      clearanceM: drive.clearanceM,
    },
    firepower: {
      calibreMm: gun.calibreMm,
      rounds: spec.ammo.rounds,
      rateOfFireRpm: loading.fixedRof ?? gun.loaderRof,
      gunDepressionDeg: turret.depressionDeg + spareRingDeg + loaderDeg,
    },
    fire,
    turret: turretParts,
    gunnery: quoteOf(fire),
    stress,
    wear,
    reliabilityIndex: reliability * 100,
    crew,
    comfort: comfortOf(spec),
    crewWorkload: busiestOf(crew).workload,
    growth: {
      massT: massCeilingT - massT,
      volumeM3: rollup.capacityM3 - rollup.usedM3,
      coolingHp: cooling.capacityHp - engine.powerHp,
    },
    protection: protectionOf(spec, geometry),
    issues: checkSpec(spec, limits, geometry, rollup),
  }
}
