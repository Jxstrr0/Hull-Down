// Tracks or wheels: small helpers every part of the model asks.
import { LAYOUTS } from '../../data/parts'
import type { VehicleSpec } from './spec'

/** Wheels the vehicle stands on, both sides together. Nought for tracks. */
export function wheelsOf(spec: VehicleSpec): number {
  return LAYOUTS[spec.runningGear.layout].wheels
}

/** Skirts hang over tracks: a wheeled vehicle has none, whatever the switch says. */
export function skirtsFitted(spec: VehicleSpec): boolean {
  return spec.runningGear.skirts && wheelsOf(spec) === 0
}
