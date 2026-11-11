// The guided first contract: where a newcomer has got to, worked out from
// the career and the drawing board alone, so it is always right after a
// reload. It says what to do next; it never changes the design.
import { BASELINE_SPEC } from '../../data/baseline'
import { GUIDE, type GuideStep } from '../../data/guide'
import { NIGHT_SIGHTS, type NightSightId } from '../../data/parts'
import type { VehicleSpec } from '../vehicle/spec'
import type { Career } from './career'
import type { BidScore } from './score'

export interface GuideState {
  step: GuideStep
  /** The newest prototype, when there is one. */
  prototype: number
  /** Tests it failed at the range. */
  failed: number
}

function nightRank(id: NightSightId): number {
  return (Object.keys(NIGHT_SIGHTS) as NightSightId[]).indexOf(id)
}

/**
 * The step of the guide the player is on, or null when the guide has
 * nothing to say (any tender after the first). `faults` is the number of
 * faults on the drawing board; `score` is the range's marks for the newest
 * prototype, or null while the range is still running it.
 */
export function guideState(career: Career, spec: VehicleSpec, faults: number, score: BidScore | null): GuideState | null {
  if (career.tenderNo !== GUIDE.tenderNo) return null
  const newest = career.prototypes[career.prototypes.length - 1]
  const prototype = newest?.no ?? 0
  if (career.outcome) return { step: career.outcome.won ? 'won' : 'lost', prototype: career.outcome.entered, failed: 0 }
  if (!newest) {
    if (nightRank(spec.fireControl.night) <= nightRank(BASELINE_SPEC.fireControl.night)) return { step: 'night', prototype, failed: 0 }
    return { step: faults > 0 ? 'faults' : 'build', prototype, failed: 0 }
  }
  if (!score) return { step: 'trial', prototype, failed: 0 }
  if (!score.legal || score.failed > 0) return { step: 'revise', prototype, failed: score.failed }
  return { step: 'enter', prototype, failed: 0 }
}
