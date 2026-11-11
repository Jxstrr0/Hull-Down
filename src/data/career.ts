// The bureau's career: money, patience and standing. Game-level numbers.

export const BODIES = ['army', 'ministry', 'pact'] as const
/** The three bodies the bureau answers to. Each holds its own opinion of it, 0 to 100. */
export type Body = (typeof BODIES)[number]

export const CAREER = {
  /**
   * What a prototype costs to build and put through its trials, as a
   * multiple of the tank's unit cost in production. The first is built by
   * hand from nothing; a revision rebuilds the one that exists.
   */
  prototypeUnits: 4,
  revisionUnits: 1.5,
  /** Revisions allowed beyond the tender's own, each at a cost in standing (Q4: a fourth). */
  extraRevisions: 1,
  reputation: {
    start: 50,
    min: 0,
    max: 100,
    /** The army wants a good tank. */
    army: {
      won: 12,
      second: 3,
      lower: -4,
      /** Its patience with a revision beyond the rule. */
      extraRevision: -6,
    },
    /** The ministry wants a cheap one, on time. */
    ministry: {
      won: 4,
      lost: -2,
      /** For the cost marks of the tank entered: this much at 100, the same off at 0, nothing at 50. */
      cost: 6,
      /** For each revision, which is time. */
      revision: -1,
      extraRevision: -4,
    },
    /** The Pact committee wants standard parts. */
    pact: {
      /** For the share of main parts in common with the Type 1: this much at all of them, the same off at none. */
      standard: 8,
    },
  },
} as const

/**
 * The main parts the Pact committee counts when it asks how standard a tank
 * is: each is a place in the design where the Type 1 has a part of its own.
 */
export const STANDARD_PARTS = [
  'hull', 'turret', 'gun', 'barrel', 'recoil', 'loading', 'stowage', 'engine', 'transmission', 'cooling', 'suspension',
  'sight', 'rangefinder', 'stabiliser', 'computer', 'night',
] as const
export type StandardPart = (typeof STANDARD_PARTS)[number]
