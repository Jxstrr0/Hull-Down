// The gun as it is fitted. The barrel changes what the rounds do and the
// recoil mount changes what turret ring the gun needs. Game-level
// abstractions, not engineering data.
import { pactRounds, type PactRoundId, type Round } from '../../data/ammo'
import { BARRELS, GUNS, RECOILS } from '../../data/parts'
import { TUNING } from '../../data/tuning'
import { detPow } from '../det'
import type { VehicleSpec } from '../vehicle/spec'

/**
 * The rounds as this gun fires them. A longer barrel throws every round
 * faster. A kinetic round goes through more for it; a shaped charge burns
 * through the same whatever speed it arrives at.
 */
export function gunRounds(spec: Pick<VehicleSpec, 'gun' | 'barrel'>): { id: PactRoundId; round: Round }[] {
  const barrel = BARRELS[spec.barrel]
  const punch = detPow(barrel.speedFactor, TUNING.gunnery.penPerSpeedPower)
  return pactRounds(spec.gun).map(({ id, round }) => ({
    id,
    round: {
      ...round,
      speedMs: Math.round(round.speedMs * barrel.speedFactor),
      penMm: round.kind === 'kinetic' ? Math.round(round.penMm * punch) : round.penMm,
    },
  }))
}

/** The smallest turret ring that takes the gun on its recoil mount. */
export function gunRingMm(spec: Pick<VehicleSpec, 'gun' | 'recoil'>): number {
  return GUNS[spec.gun].minRingMm + RECOILS[spec.recoil].ringMm
}
