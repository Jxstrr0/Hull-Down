// The challenge of the day: a one-off tender, the same for every player on
// the same date. The day picks one of the career's tenders to stand on, what
// the army wants most, and how far the weight limit and the cost ceiling are
// tightened. Game-level numbers, not engineering data.
import type { ScoreAxis } from './tenders'

export const WISH_IDS = ['armour', 'gun', 'pace', 'upkeep', 'price', 'allRound'] as const
export type WishId = (typeof WISH_IDS)[number]

export const DAILY = {
  /** Names the roll that turns a date into a challenge, so it shares no luck with a career. */
  salt: 7741,
  /** What the army can want most. Each adds up to 100, like a tender's weights. */
  wishes: {
    armour: { protection: 40, firepower: 20, mobility: 10, reliability: 15, cost: 15 },
    gun: { protection: 15, firepower: 40, mobility: 15, reliability: 15, cost: 15 },
    pace: { protection: 15, firepower: 20, mobility: 40, reliability: 15, cost: 10 },
    upkeep: { protection: 15, firepower: 15, mobility: 10, reliability: 40, cost: 20 },
    price: { protection: 10, firepower: 15, mobility: 10, reliability: 20, cost: 45 },
    allRound: { protection: 20, firepower: 20, mobility: 20, reliability: 20, cost: 20 },
  } satisfies Record<WishId, Record<ScoreAxis, number>>,
  /** Tonnes taken off the Pact's weight limit. One is picked. */
  massCutsT: [0, 0, 2, 4],
  /** The share of the tender's cost ceiling that stands. One is picked. */
  costShares: [1, 0.9, 0.8],
} as const
