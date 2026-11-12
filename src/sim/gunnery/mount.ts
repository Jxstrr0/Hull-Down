// The gun as it is fitted. The barrel changes what the rounds do and the
// recoil mount changes what turret ring the gun needs. Game-level
// abstractions, not engineering data.
import { OWN_ROUNDS, pactRounds, type KineticIssue, type PactRoundId, type Round, type ShapedIssue } from '../../data/ammo'
import { BARRELS, GUNS, RECOILS, TURRETS } from '../../data/parts'
import { TUNING } from '../../data/tuning'
import { detPow } from '../det'
import type { VehicleSpec } from '../vehicle/spec'

/**
 * The rounds as this gun fires them. A longer barrel throws every round
 * faster. A kinetic round goes through more for it; a shaped charge burns
 * through the same whatever speed it arrives at. Where the tank carries one
 * of the bureau's own rounds, it takes the place of the Pact's of that kind.
 */
export function gunRounds(spec: { gun: VehicleSpec['gun']; barrel: VehicleSpec['barrel']; ammo?: Pick<VehicleSpec['ammo'], 'kinetic' | 'shaped'> }): GunRound[] {
  const barrel = BARRELS[spec.barrel]
  const punch = detPow(barrel.speedFactor, TUNING.gunnery.penPerSpeedPower)
  return pactRounds(spec.gun).map(({ id, round }) => {
    const issue = (round.kind === 'kinetic' ? spec.ammo?.kinetic : spec.ammo?.shaped) ?? 'supplied'
    const own = ownRound(round, issue)
    // A missile flies under its own power: the barrel does nothing for it.
    if (issue === 'gunMissile') return { id, issue, round: own }
    return {
      id,
      issue,
      round: {
        ...own,
        speedMs: Math.round(own.speedMs * barrel.speedFactor),
        penMm: own.kind === 'kinetic' ? Math.round(own.penMm * punch) : own.penMm,
      },
    }
  })
}

export interface GunRound {
  id: PactRoundId
  /** Whose round it is: the Pact's, or which of the bureau's own. */
  issue: KineticIssue | ShapedIssue
  round: Round
}

/** The bureau's round made from a Pact round, before the barrel has its say. */
function ownRound(round: Round, issue: KineticIssue | ShapedIssue): Round {
  if (issue === 'supplied') return round
  if (issue === 'gunMissile') {
    const own = OWN_ROUNDS.gunMissile
    return { kind: 'shaped', speedMs: own.speedMs, spreadM: own.spreadM, penMm: Math.round(round.penMm * own.penFactor), lossPerKmMm: 0 }
  }
  const own = OWN_ROUNDS[issue]
  return {
    kind: round.kind,
    speedMs: Math.round(round.speedMs * own.speedFactor),
    spreadM: round.spreadM * own.spreadFactor,
    penMm: Math.round(round.penMm * own.penFactor),
    lossPerKmMm: round.lossPerKmMm * own.lossFactor,
    ...(issue === 'tandem' ? { tandem: true } : {}),
  }
}

/** The smallest turret ring that takes the gun on its recoil mount. */
export function gunRingMm(spec: Pick<VehicleSpec, 'gun' | 'recoil'> & { turret?: Pick<VehicleSpec['turret'], 'shape'> }): number {
  const ring = GUNS[spec.gun].minRingMm + RECOILS[spec.recoil].ringMm
  const share = spec.turret ? TURRETS[spec.turret.shape].gunRingShare : 1
  if (share === 1) return ring
  // A casemate takes the kick into the hull, so a smaller mount will do: to the next step up.
  const step = TUNING.limits.ringStepMm
  return Math.ceil((ring * share) / step) * step
}
