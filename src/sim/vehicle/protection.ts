// How much each armour zone stops. A first cut of the layer part of the hit
// model: every layer is worth so many millimetres of rolled steel against
// each kind of threat, and slope lengthens the path a shot must cross.
// Game-level abstractions, not engineering data.
import { MATERIALS, ZONES, type ZoneId } from '../../data/materials'
import { PI, detCos } from '../det'
import type { Geometry } from './geometry'
import type { ArmourLayer, VehicleSpec } from './spec'

export interface ZoneProtection {
  slopeDeg: number
  /** How many times the plate thickness a level shot at the zone's face must cross. */
  pathFactor: number
  /** Thickness of the whole stack, square to the plate, gaps included. */
  plateMm: number
  /** The same along the path of the shot. */
  pathMm: number
  /** Worth this many millimetres of rolled steel against kinetic rounds. */
  keMm: number
  /** The same against shaped-charge warheads. */
  ceMm: number
}

/** Path length through a plate leaning `slopeDeg` away from square to the shot, as a multiple of its thickness. */
export function pathFactor(slopeDeg: number): number {
  return 1 / detCos((slopeDeg * PI) / 180)
}

/** What one layer is worth along a path `factor` times its thickness. */
export function layerWorth(layer: ArmourLayer, factor: number): { keMm: number; ceMm: number } {
  const material = MATERIALS[layer.material]
  return { keMm: layer.mm * material.ke * factor, ceMm: layer.mm * material.ce * factor }
}

export function stackProtection(layers: readonly ArmourLayer[], slopeDeg: number): ZoneProtection {
  const factor = pathFactor(slopeDeg)
  let plateMm = 0
  let keMm = 0
  let ceMm = 0
  for (const layer of layers) {
    const worth = layerWorth(layer, factor)
    plateMm += layer.mm
    keMm += worth.keMm
    ceMm += worth.ceMm
  }
  return { slopeDeg, pathFactor: factor, plateMm, pathMm: plateMm * factor, keMm, ceMm }
}

export function protectionOf(spec: VehicleSpec, geo: Geometry): Record<ZoneId, ZoneProtection> {
  return Object.fromEntries(
    ZONES.map((zone) => [zone, stackProtection(spec.armour[zone], geo.zoneSlopeDeg[zone])]),
  ) as Record<ZoneId, ZoneProtection>
}
