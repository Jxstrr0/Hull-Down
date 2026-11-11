// Which generation a part belongs to, and which parts of a design are newer
// than a tender allows.
import { ZONES } from '../../data/materials'
import { LATER_PARTS, type Generation, type TechField } from '../../data/tech'
import type { VehicleSpec } from './spec'

/** The generation a part came with. One for anything that was there from the start. */
export function generationOf(field: TechField, id: string): Generation {
  return LATER_PARTS[field][id] ?? 1
}

/** True when a tender of this generation may fit the part. */
export function available(field: TechField, id: string, generation: Generation): boolean {
  return generationOf(field, id) <= generation
}

export interface TooNew {
  /** Path of the spec field, such as `fireControl.night` or `armour.upperGlacis`. */
  part: string
  generation: Generation
}

/** The parts of a design that a tender of this generation cannot have. One line a part, one a zone. */
export function tooNew(spec: VehicleSpec, generation: Generation): TooNew[] {
  const found: TooNew[] = []
  const look = (field: Exclude<TechField, 'material'>, id: string): void => {
    const g = generationOf(field, id)
    if (g > generation) found.push({ part: field, generation: g })
  }
  look('fireControl.computer', spec.fireControl.computer)
  look('fireControl.night', spec.fireControl.night)
  for (const zone of ZONES) {
    let newest: Generation = 1
    for (const layer of spec.armour[zone]) {
      const g = generationOf('material', layer.material)
      if (g > newest) newest = g
    }
    if (newest > generation) found.push({ part: `armour.${zone}`, generation: newest })
  }
  return found
}
