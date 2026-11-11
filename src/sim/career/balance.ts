// The balance check: the three rival bureaus bid for every tender over many
// seeds, with no player, and the wins are counted. If one bureau's way of
// building a tank takes every tender, the game has one right answer and the
// numbers need another look. `npm run sim` prints the table.
import { BALANCE } from '../../data/balance'
import { BUREAU_IDS, type BureauId } from '../../data/opponents'
import { SCORE_AXES, TENDER_IDS, TENDERS, type ScoreAxis, type TenderId } from '../../data/tenders'
import { rivalBid } from './rival'
import { decide } from './score'

export interface BureauTally {
  /** Tenders won, out of the seeds run. */
  wins: number
  /** Bids thrown out for breaking a limit. */
  illegal: number
  /** Mean marks, overall and on each count. */
  total: number
  axes: Record<ScoreAxis, number>
  /** Mean proving-ground tests failed. */
  failed: number
}

export interface TenderTally {
  tender: TenderId
  seeds: number
  bureaus: Record<BureauId, BureauTally>
}

/** Who wins one tender with only the rival bureaus bidding. */
export function rivalsOnly(tender: TenderId, seed: number): { winner: BureauId; bids: ReturnType<typeof rivalBid>[] } {
  const bids = BUREAU_IDS.map((bureau) => rivalBid(bureau, TENDERS[tender], seed))
  const order = decide(bids.map((each) => ({ score: each.score, unitCostKr: each.bid.sheet.unitCostKr })))
  return { winner: bids[order[0]!]!.bureau, bids }
}

function emptyTally(): BureauTally {
  const axes = {} as Record<ScoreAxis, number>
  for (const axis of SCORE_AXES) axes[axis] = 0
  return { wins: 0, illegal: 0, total: 0, axes, failed: 0 }
}

/** One tender run once for each seed. */
export function tallyTender(tender: TenderId, seeds: readonly number[]): TenderTally {
  const bureaus = {} as Record<BureauId, BureauTally>
  for (const bureau of BUREAU_IDS) bureaus[bureau] = emptyTally()
  for (const seed of seeds) {
    const run = rivalsOnly(tender, seed)
    bureaus[run.winner].wins++
    for (const each of run.bids) {
      const tally = bureaus[each.bureau]
      if (!each.score.legal) tally.illegal++
      tally.total += each.score.total / seeds.length
      tally.failed += each.score.failed / seeds.length
      for (const axis of SCORE_AXES) tally.axes[axis] += each.score.axes[axis] / seeds.length
    }
  }
  return { tender, seeds: seeds.length, bureaus }
}

/** Every tender in the career. */
export function tallyCareer(seeds: readonly number[]): TenderTally[] {
  return TENDER_IDS.map((tender) => tallyTender(tender, seeds))
}

/** The bureau with the most wins in a tender. Level counts go to the first named. */
export function leaderOf(tally: TenderTally): BureauId {
  let best: BureauId = BUREAU_IDS[0]
  for (const bureau of BUREAU_IDS) if (tally.bureaus[bureau].wins > tally.bureaus[best].wins) best = bureau
  return best
}

/** A bureau that leads every tender, or null when no one way of building wins them all. */
export function dominantOf(tallies: readonly TenderTally[]): BureauId | null {
  const leaders = tallies.map(leaderOf)
  const first = leaders[0]
  return first !== undefined && leaders.every((leader) => leader === first) ? first : null
}

/** A bureau's share of all the tenders run, 0 to 1. */
export function shareOf(tallies: readonly TenderTally[], bureau: BureauId): number {
  let wins = 0
  let runs = 0
  for (const tally of tallies) {
    wins += tally.bureaus[bureau].wins
    runs += tally.seeds
  }
  return runs ? wins / runs : 0
}

/** The seeds the check runs by default, or the first `count` of them. */
export function balanceSeeds(count: number = BALANCE.seeds.count): number[] {
  const seeds: number[] = []
  for (let index = 0; index < count; index++) seeds.push(BALANCE.seeds.first + index * BALANCE.seeds.step)
  return seeds
}

export interface BalanceVerdict {
  /** The bureau that leads every tender, if one does. */
  dominant: BureauId | null
  /** Bureaus that take too many of the tenders, and too few. */
  tooStrong: BureauId[]
  tooWeak: BureauId[]
  /** True when no one way of building wins everything and every bureau is a real rival. */
  balanced: boolean
}

export function verdictOf(tallies: readonly TenderTally[]): BalanceVerdict {
  const dominant = dominantOf(tallies)
  const tooStrong = BUREAU_IDS.filter((bureau) => shareOf(tallies, bureau) > BALANCE.tooStrongShare)
  const tooWeak = BUREAU_IDS.filter((bureau) => shareOf(tallies, bureau) < BALANCE.tooWeakShare)
  return { dominant, tooStrong, tooWeak, balanced: dominant === null && tooStrong.length === 0 && tooWeak.length === 0 }
}
