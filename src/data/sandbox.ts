// The sandbox: the design office with every part unlocked and no money. The
// player picks which weight limit to work to, or none.
import { PACT_LIMITS_GEN1, PACT_LIMITS_GEN3 } from './tuning'

export const SANDBOX_LIMIT_IDS = ['early', 'today', 'none'] as const
export type SandboxLimitId = (typeof SANDBOX_LIMIT_IDS)[number]

export const SANDBOX = {
  /** The limit the sandbox starts on. */
  startLimit: 'today' as SandboxLimitId,
  /** The Pact limits each choice works to. None means no weight, width or calibre limit at all. */
  limits: {
    early: PACT_LIMITS_GEN1,
    today: PACT_LIMITS_GEN3,
    none: null,
  } satisfies Record<SandboxLimitId, { maxMassT: number; maxWidthM: number; allowedCalibresMm: readonly number[] } | null>,
  /** With no limit, the weight bar is drawn against this many tonnes, or the tank's own weight if it is more. */
  barT: 60,
} as const
