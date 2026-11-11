// Duels: one tank against one, at a set range on set ground. The numbers
// the fight runs by, and the grounds it is fought on.
// Game-level abstractions, not engineering data.
import type { CrewId } from './gunnery'

/** How a tank is placed: standing in the open, coming on across it, or sitting behind a ridge. */
export type Posture = 'halted' | 'advancing' | 'hullDown'

export interface DuelGround {
  /** Metres between the two when they first see each other. */
  rangeM: number
  night: boolean
  /** The tank under test, then the one it meets. */
  postures: readonly [Posture, Posture]
}

export const DUEL_GROUND_IDS = ['meeting', 'longRange', 'attack', 'defend', 'night'] as const
export type DuelGroundId = (typeof DUEL_GROUND_IDS)[number]

export const DUEL = {
  /** The fight is worked out in steps this long, seconds. */
  stepS: 0.1,
  /** With nobody out of the fight by now it is called off, seconds. */
  limitS: 240,
  crew: 'cadre' as CrewId,
  /** Hours the crews have been in their tanks when they meet. */
  crewHours: 2,
  /** Neither tank stands quite square to the other: each is turned up to this far, degrees. */
  facingDeg: 15,
  /** How long a crew takes to pick the other tank out varies by this share either way. */
  spotSpread: 0.35,
  /** A tank that has not been seen is seen this long after it fires, seconds. */
  flashS: 2,
  /** An advancing tank closes at this share of its top speed, and comes no nearer than this. */
  advanceShare: 0.5,
  closestM: 400,
  /** The hull has to show by this much before it is worth aiming at, metres. */
  worthAimingM: 0.3,
  ai: {
    /** Hits on one part of the target that do nothing before the gunner tries the other part. */
    switchAimAfter: 2,
    /** Hits that do nothing, in all, before the crew changes to its other round. */
    switchRoundAfter: 3,
  },
  /** What losing a crewman costs the rest. */
  crewOut: {
    /** Without the commander every job in the turret takes this much longer. */
    commanderPace: 1.5,
    /** Without the gunner the commander lays the gun: slower, and not as well. */
    gunnerPace: 1.6,
    gunnerAim: 1.4,
    /** Without the loader the commander feeds the gun. */
    loaderPace: 2.2,
  },
  smoke: {
    /** Neither tank can see the other for this long after smoke is fired, seconds. */
    blindS: 25,
    /** Seconds to find the target again once it clears. */
    refindS: 4,
  },
  grounds: {
    // Two tanks come over a rise and see each other across open ground.
    meeting: { rangeM: 1500, night: false, postures: ['halted', 'halted'] },
    // The same, at the far end of what the guns can do.
    longRange: { rangeM: 2500, night: false, postures: ['halted', 'halted'] },
    // The other tank sits behind a ridge; this one has to come at it across the open.
    attack: { rangeM: 1800, night: false, postures: ['advancing', 'hullDown'] },
    // This tank holds the ridge and the other comes on.
    defend: { rangeM: 1800, night: false, postures: ['hullDown', 'advancing'] },
    // A meeting in the dark, close.
    night: { rangeM: 900, night: true, postures: ['halted', 'halted'] },
  } satisfies Record<DuelGroundId, DuelGround>,
} as const
