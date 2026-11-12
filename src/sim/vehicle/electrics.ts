// Electrical power: what the tank makes and what its systems draw.
import { ACTIVE, ELECTRICS, SEARCH_RADAR, TURRETS } from '../../data/parts'
import type { VehicleSpec } from './spec'

export interface Electrics {
  /** Kilowatts the fitted systems draw. */
  drawKw: number
  /** Kilowatts the generator and the auxiliary power unit make between them. */
  supplyKw: number
}

export function electricsOf(spec: VehicleSpec): Electrics {
  return {
    drawKw: ACTIVE[spec.protection.active].drawKw + TURRETS[spec.turret.shape].drawKw +
      (spec.fireControl.searchRadar ? SEARCH_RADAR.drawKw : 0),
    supplyKw: ELECTRICS.generatorKw + (spec.powerpack.apu ? ELECTRICS.apuKw : 0),
  }
}
