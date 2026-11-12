// How a tank moves: the pull its powerpack gives against the drag of the
// ground. The design office estimates and the proving ground tests both run
// on this one model. Game-level abstractions, not engineering data.
import { HULLS, SUSPENSIONS, TRANSMISSIONS, ENGINES, WHEELS } from '../../data/parts'
import { RANGE, type Ground } from '../../data/range'
import { TUNING } from '../../data/tuning'
import { PI, detAtan, detAtan2, detCos, detPow, detSin, powInt } from '../det'
import type { Geometry } from '../vehicle/geometry'
import type { Rollup } from '../vehicle/rollup'
import type { VehicleSpec } from '../vehicle/spec'
import { wheelsOf } from '../vehicle/wheels'

/** Everything about a tank that decides how it moves. */
export interface Drive {
  massKg: number
  weightN: number
  /** Engine power that reaches the tracks, watts. */
  powerW: number
  /** The hardest the bottom gear can pull, newtons. */
  pullN: number
  /** Top speed the gearing allows, metres a second. */
  gearedMs: number
  /** Speed at which each gear but the top one runs out, lowest first, metres a second. */
  shiftAtMs: number[]
  /** Seconds without drive at each gear change. */
  shiftS: number
  /** Multiplier on rolling drag from the width of the tracks. */
  dragFactor: number
  /** True on wheels: each ground then has its own drag and grip for tyres. */
  wheeled: boolean
  /** Kilograms per square centimetre under the tracks or tyres. */
  pressureKgCm2: number
  /** Ground to belly, metres, after any sag from an overloaded suspension. */
  clearanceM: number
  /** The longest trench it bridges, metres. */
  trenchM: number
  /** The highest step it mounts, metres. */
  stepM: number
}

/** What limits the pull at a given moment. */
export type PullLimit = 'power' | 'gear' | 'grip'

export function degToRad(deg: number): number {
  return (deg * PI) / 180
}

export function kmhToMs(kmh: number): number {
  return kmh / 3.6
}

/** Sizes are quoted to the centimetre, so a pass or a fail matches the numbers shown. */
function toCm(metres: number): number {
  return Math.round(metres * 100) / 100
}

export function driveOf(spec: VehicleSpec, geometry: Geometry, rollup: Rollup): Drive {
  const m = TUNING.mobility
  const hull = HULLS[spec.hull.size]
  const engine = ENGINES[spec.powerpack.engine]
  const transmission = TRANSMISSIONS[spec.powerpack.transmission]
  const suspension = SUSPENSIONS[spec.runningGear.suspension]
  const massKg = rollup.totalMassT * 1000
  const powerW = engine.powerHp * m.wattsPerHp * transmission.efficiency
  const wheels = wheelsOf(spec)
  const wheeled = wheels > 0
  // Wheels are geared taller: faster on the road, a weaker pull in bottom gear.
  const gearing = wheeled ? WHEELS.gearFactor : 1
  const lowMs = kmhToMs(transmission.lowGearKmh * gearing)
  const gearedMs = kmhToMs(transmission.gearedKmh * gearing)

  // Gears are spaced evenly by ratio between bottom and top.
  const shiftAtMs: number[] = []
  const ratio = detPow(gearedMs / lowMs, 1 / (transmission.gears - 1))
  for (let gear = 0; gear < transmission.gears - 1; gear++) shiftAtMs.push(lowMs * powInt(ratio, gear))

  const overload = rollup.totalMassT / (rollup.stations * suspension.ratedPerStationT) - 1
  const sagM = overload > 0 ? overload * m.sagMPerOverload : 0
  const contactCm2 = wheeled
    ? wheels * WHEELS.contactCm2
    : 2 * geometry.trackContactM * 100 * (spec.runningGear.trackWidthMm / 10)
  const trenchShare = wheeled ? WHEELS.trenchShare[wheels as keyof typeof WHEELS.trenchShare] : m.trenchShare

  return {
    massKg,
    weightN: massKg * m.gravityMs2,
    powerW,
    pullN: powerW / lowMs,
    gearedMs,
    shiftAtMs,
    shiftS: transmission.shiftS,
    dragFactor: wheeled ? 1 : 1 + (spec.runningGear.trackWidthMm - TUNING.geometry.standardTrackMm) * m.dragPerExtraTrackMm,
    wheeled,
    pressureKgCm2: massKg / contactCm2,
    // A sagging suspension can set the belly down, but not below the ground.
    clearanceM: toCm(Math.max(0, suspension.clearanceM - sagM)),
    trenchM: toCm(hull.lengthM * trenchShare),
    stepM: toCm(hull.roofHeightM * (wheeled ? WHEELS.stepShare : m.stepShare) - sagM),
  }
}

/** How a tank sits on a piece of ground. */
export interface Footing {
  /** Drag at a crawl, as a share of weight, with any sinking counted. */
  drag: number
  /** How deep the tracks sit, metres. Nought on ground that does not give. */
  sinkM: number
  /** True when the tracks have sunk until the belly is on the ground. */
  bellied: boolean
}

/** The share of a ground's grip the tracks or tyres get. */
function gripOf(drive: Drive, ground: Ground): number {
  return ground.grip * (drive.wheeled ? ground.wheelGrip : 1)
}

export function footingOf(drive: Drive, ground: Ground): Footing {
  const base = ground.rolling * (drive.wheeled ? ground.wheelRolling : 1) * drive.dragFactor
  if (ground.bearingKgCm2 === null) return { drag: base, sinkM: 0, bellied: false }
  const s = RANGE.soft
  const load = drive.pressureKgCm2 / ground.bearingKgCm2
  const sinkM = s.sinkM * load * load
  const bellied = sinkM > drive.clearanceM
  return {
    drag: base + s.sinkDrag * powInt(load, s.sinkDragPower) + (bellied ? s.bellyDrag : 0),
    sinkM,
    bellied,
  }
}

/**
 * Force holding the tank back, newtons, at a speed and on a slope.
 * `slopeRad` is positive uphill.
 */
export function resistanceN(drive: Drive, footing: Footing, speedMs: number, slopeRad = 0): number {
  const rolling = footing.drag + TUNING.mobility.dragPerMs * drive.dragFactor * speedMs
  if (slopeRad === 0) return drive.weightN * rolling
  return drive.weightN * (rolling * detCos(slopeRad) + detSin(slopeRad))
}

/** The most the tank can push forward, newtons, and what sets that limit. */
export function pullOf(drive: Drive, ground: Ground, speedMs: number, slopeRad = 0): { forceN: number; limit: PullLimit } {
  let forceN = drive.pullN
  let limit: PullLimit = 'gear'
  if (speedMs > 0 && drive.powerW / speedMs < forceN) {
    forceN = drive.powerW / speedMs
    limit = 'power'
  }
  const gripN = drive.weightN * gripOf(drive, ground) * (slopeRad === 0 ? 1 : detCos(slopeRad))
  if (gripN < forceN) {
    forceN = gripN
    limit = 'grip'
  }
  return { forceN, limit }
}

/** Steady top speed on level ground, metres a second, and whether the gearing holds it back. */
export function topSpeedOf(drive: Drive, ground: Ground): { speedMs: number; gearLimited: boolean } {
  // Power in = drag out:  P / v = W (c0 + c1 v), solved for v.
  const c0 = footingOf(drive, ground).drag
  const c1 = TUNING.mobility.dragPerMs * drive.dragFactor
  const powered = (Math.sqrt(c0 * c0 + (4 * c1 * drive.powerW) / drive.weightN) - c0) / (2 * c1)
  const gearLimited = powered > drive.gearedMs
  return { speedMs: gearLimited ? drive.gearedMs : powered, gearLimited }
}

/** The steepest slope the tank climbs from a crawl on this ground, degrees. */
export function maxSlopeDeg(drive: Drive, ground: Ground): number {
  const c = footingOf(drive, ground).drag
  // Grip:  grip x cos >= sin + c x cos.
  const gripRad = detAtan(gripOf(drive, ground) - c)
  // Pull:  k >= sin + c x cos, with k the pull as a share of weight.
  const k = drive.pullN / drive.weightN
  const reach = k / Math.sqrt(1 + c * c)
  const pullRad = reach >= 1 ? PI / 2 : detAtan2(reach, Math.sqrt(1 - reach * reach)) - detAtan(c)
  const rad = pullRad < gripRad ? pullRad : gripRad
  return rad > 0 ? (rad * 180) / PI : 0
}
