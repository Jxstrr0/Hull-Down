// Electrical power: what the tank makes and what its systems draw.
import { ACTIVE, ELECTRICS } from '../../data/parts'
import type { VehicleSpec } from './spec'

export interface Electrics {
  /** Kilowatts the fitted systems draw. */
  drawKw: number
  /** Kilowatts the generator and the auxiliary power unit make between them. */
  supplyKw: number
}

export function electricsOf(spec: VehicleSpec): Electrics {
  return {
    drawKw: ACTIVE[spec.protection.active].drawKw,
    supplyKw: ELECTRICS.generatorKw + (spec.powerpack.apu ? ELECTRICS.apuKw : 0),
  }
}
