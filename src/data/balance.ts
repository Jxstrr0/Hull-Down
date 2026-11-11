// The balance check (`npm run sim`): how many times each tender is run with
// only the rival bureaus bidding. Game-level numbers, not engineering data.
export const BALANCE = {
  /** The seeds run: `count` of them, starting at `first`, `step` apart. */
  seeds: { first: 1001, step: 7, count: 24 },
  /** How many of those the test suite runs, to keep it quick. */
  testSeeds: 12,
  /** A bureau that takes more than this share of all the tenders run is too strong. */
  tooStrongShare: 0.6,
  /** A bureau that takes less than this share is not a rival at all. */
  tooWeakShare: 0.1,
} as const
