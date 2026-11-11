// Adds up weight, space and cost from the spec, grouped by area of the tank.
import { MATERIALS, ZONES, type ZoneId } from '../../data/materials'
import {
  APU, COMFORT, COMMANDER_SIGHT, COMPUTERS, COOLING, ENGINES, FIRE_SUPPRESSION, GUNS, HULLS, LOADING,
  NIGHT_SIGHTS, RANGEFINDERS, SIGHTS, SMOKE_LAUNCHERS, SPALL_LINER, STABILISERS, STOWAGE, SUSPENSIONS,
  TRANSMISSIONS, TURRETS, type Part,
} from '../../data/parts'
import { TUNING } from '../../data/tuning'
import type { Geometry } from './geometry'
import type { VehicleSpec } from './spec'

export const AREAS = [
  'structure', 'armour', 'firepower', 'fireControl', 'powerpack', 'fuel', 'runningGear', 'systems', 'crew',
] as const
export type Area = (typeof AREAS)[number]

export interface Rollup {
  massT: Record<Area, number>
  volumeM3: Record<Area, number>
  costKr: Record<Area, number>
  /** Armour weight of each zone, tonnes. */
  zoneMassT: Record<ZoneId, number>
  totalMassT: number
  /** Space taken inside. */
  usedM3: number
  /** Space there is inside. */
  capacityM3: number
  unitCostKr: number
  crewCount: number
  /** Rounds held in the autoloader. */
  readyRounds: number
  /** Rounds in racks or bins. */
  stowedRounds: number
  /** Wheel stations, both sides. */
  stations: number
}

function zeroAreas(): Record<Area, number> {
  return { structure: 0, armour: 0, firepower: 0, fireControl: 0, powerpack: 0, fuel: 0, runningGear: 0, systems: 0, crew: 0 }
}

function sum(values: Record<string, number>): number {
  let total = 0
  for (const key of Object.keys(values)) total += values[key] ?? 0
  return total
}

export function rollupOf(spec: VehicleSpec, geo: Geometry): Rollup {
  const massT = zeroAreas()
  const volumeM3 = zeroAreas()
  const costKr = zeroAreas()
  const add = (area: Area, part: Part, count = 1): void => {
    massT[area] += part.massT * count
    volumeM3[area] += part.volumeM3 * count
    costKr[area] += part.costKr * count
  }

  const hull = HULLS[spec.hull.size]
  const gun = GUNS[spec.gun]
  const loading = LOADING[spec.loading]
  const stowage = STOWAGE[spec.ammo.stowage]
  const suspension = SUSPENSIONS[spec.runningGear.suspension]
  const comfort = COMFORT[spec.crew.comfort]

  // Structure
  add('structure', hull)
  add('structure', TURRETS[spec.turret.shape])

  // Armour, zone by zone
  const zoneMassT = {} as Record<ZoneId, number>
  for (const zone of ZONES) {
    let zoneMass = 0
    for (const layer of spec.armour[zone]) {
      const material = MATERIALS[layer.material]
      const layerMass = geo.zoneAreaM2[zone] * (layer.mm / 1000) * material.densityTM3
      zoneMass += layerMass
      costKr.armour += layerMass * material.costPerTKr
    }
    zoneMassT[zone] = zoneMass
    massT.armour += zoneMass
  }

  // Firepower: gun, loading, ammunition
  const readyRounds = Math.min(spec.ammo.rounds, loading.readyRounds)
  const stowedRounds = spec.ammo.rounds - readyRounds
  add('firepower', gun)
  add('firepower', loading)
  add('firepower', stowage)
  massT.firepower += spec.ammo.rounds * gun.roundMassT + stowedRounds * stowage.massPerRoundT
  volumeM3.firepower += stowedRounds * gun.roundVolumeM3 * stowage.volumeFactor
  costKr.firepower += stowedRounds * stowage.costPerRoundKr

  // Fire control
  const fc = spec.fireControl
  add('fireControl', SIGHTS[fc.sight])
  add('fireControl', RANGEFINDERS[fc.rangefinder])
  add('fireControl', STABILISERS[fc.stabiliser])
  add('fireControl', COMPUTERS[fc.computer])
  add('fireControl', NIGHT_SIGHTS[fc.night])
  if (fc.commanderSight) add('fireControl', COMMANDER_SIGHT)

  // Powerpack and fuel
  add('powerpack', ENGINES[spec.powerpack.engine])
  add('powerpack', TRANSMISSIONS[spec.powerpack.transmission])
  add('powerpack', COOLING[spec.powerpack.cooling])
  if (spec.powerpack.apu) add('powerpack', APU)
  massT.fuel += spec.powerpack.fuelL * TUNING.mass.fuelTPerL
  volumeM3.fuel += spec.powerpack.fuelL * TUNING.volume.fuelM3PerL

  // Running gear
  const stations = spec.runningGear.roadWheels * 2
  const trackM = 2 * hull.lengthM * TUNING.geometry.trackLoopFactor
  const trackScale = spec.runningGear.trackWidthMm / TUNING.geometry.standardTrackMm
  massT.runningGear +=
    trackM * TUNING.mass.trackTPerM * trackScale +
    stations * (TUNING.mass.roadWheelT + suspension.massPerStationT) +
    TUNING.mass.runningGearFixedT
  volumeM3.runningGear += stations * suspension.volumePerStationM3
  costKr.runningGear +=
    trackM * TUNING.cost.trackKrPerM * trackScale + stations * (TUNING.cost.roadWheelKr + suspension.costPerStationKr)

  // Protection systems
  if (spec.protection.smokeLaunchers) add('systems', SMOKE_LAUNCHERS)
  if (spec.protection.fireSuppression) add('systems', FIRE_SUPPRESSION)
  if (spec.protection.spallLiner) add('systems', SPALL_LINER)

  // Crew
  const crewCount = loading.crew
  massT.crew += crewCount * (TUNING.mass.crewmanT + comfort.massPerCrewT)
  volumeM3.crew += crewCount * comfort.volumePerCrewM3
  costKr.crew += crewCount * comfort.costPerCrewKr

  // Fittings ride on everything else; assembly is charged on the parts bill.
  massT.structure += sum(massT) * TUNING.mass.fittingsShare
  costKr.structure += sum(costKr) * TUNING.cost.assemblyShare

  const glacisLoss =
    Math.max(0, spec.hull.glacisAngleDeg - TUNING.volume.glacisReferenceDeg) * TUNING.volume.glacisLossM3PerDeg
  const engineLoss = spec.hull.engineAt === 'front' ? TUNING.volume.frontEngineLossM3 : 0

  return {
    massT,
    volumeM3,
    costKr,
    zoneMassT,
    totalMassT: sum(massT),
    usedM3: sum(volumeM3),
    capacityM3: hull.internalM3 + geo.turretVolumeM3 - glacisLoss - engineLoss,
    unitCostKr: sum(costKr),
    crewCount,
    readyRounds,
    stowedRounds,
    stations,
  }
}
