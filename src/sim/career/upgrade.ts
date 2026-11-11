// Upgrade packages: what the army can ask for, what a package may change
// on a tank that is already built, and whether a package gives the army
// what it asked for. Plain rules; the career applies them.
import type { ZoneId } from '../../data/materials'
import { SERVICE, type FixedPart } from '../../data/service'
import type { VehicleSpec } from '../vehicle/spec'
import type { StatSheet } from '../vehicle/stats'

export const UPGRADE_ASK_KINDS = ['reliability', 'protection', 'firstShot', 'workload', 'comfort'] as const
export type UpgradeAskKind = (typeof UPGRADE_ASK_KINDS)[number]

/** What the army wants from a package. `zone` is the plate, when it is about one. */
export interface UpgradeAsk {
  kind: UpgradeAskKind
  zone?: ZoneId
}

/** A package fitted to a tank in service. */
export interface Upgrade {
  /** The letter it adds to the designation. */
  letter: string
  /** The year of service it was fitted after. Reports from the next year on are of the upgraded tank. */
  afterYear: number
  spec: VehicleSpec
  ask: UpgradeAsk
}

function fixedValue(spec: VehicleSpec, part: FixedPart): string | number {
  switch (part) {
    case 'hull.size': return spec.hull.size
    case 'hull.glacisAngleDeg': return spec.hull.glacisAngleDeg
    case 'hull.engineAt': return spec.hull.engineAt
    case 'turret.shape': return spec.turret.shape
    case 'turret.ringMm': return spec.turret.ringMm
    case 'gun': return spec.gun
    case 'loading': return spec.loading
    case 'runningGear.suspension': return spec.runningGear.suspension
    case 'runningGear.roadWheels': return spec.runningGear.roadWheels
    case 'powerpack.cooling': return spec.powerpack.cooling
  }
}

/** The parts a package would change that cannot be changed on a built tank. */
export function fixedPartsChanged(built: VehicleSpec, spec: VehicleSpec): FixedPart[] {
  return SERVICE.upgrade.fixed.filter((part) => fixedValue(built, part) !== fixedValue(spec, part))
}

export interface AskMeasure {
  /** The figure the army is looking at, on the tank in service and with the package. */
  was: number
  now: number
  /** What it must reach. */
  need: number
  met: boolean
}

/** Whether a package gives the army what it asked for, and by how much. */
export function askMeasure(ask: UpgradeAsk, before: StatSheet, after: StatSheet): AskMeasure {
  const A = SERVICE.upgrade.asks
  const atLeast = (was: number, now: number, need: number): AskMeasure => ({ was, now, need, met: now >= need })
  const atMost = (was: number, now: number, need: number): AskMeasure => ({ was, now, need, met: now <= need })
  switch (ask.kind) {
    case 'reliability':
      return atLeast(before.reliabilityIndex, after.reliabilityIndex, before.reliabilityIndex + A.reliability)
    case 'protection': {
      const zone = ask.zone ?? 'upperGlacis'
      return atLeast(before.protection[zone].keMm, after.protection[zone].keMm, before.protection[zone].keMm * (1 + A.protection))
    }
    case 'firstShot':
      return atMost(before.gunnery.firstShotS, after.gunnery.firstShotS, before.gunnery.firstShotS * (1 - A.firstShot))
    case 'workload':
      return atMost(before.crewWorkload, after.crewWorkload, before.crewWorkload - A.workload)
    case 'comfort':
      return atLeast(before.comfort.score, after.comfort.score, before.comfort.score + A.comfort)
  }
}

/** The weight a package may bring the tank up to: what it weighed when adopted, and what it had to spare. */
export function massCeilingT(adopted: StatSheet): number {
  return adopted.massT + Math.max(0, adopted.growth.massT)
}
