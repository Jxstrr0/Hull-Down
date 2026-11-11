import { describe, expect, it } from 'vitest'
import { BALANCE } from '../src/data/balance'
import { BUREAU_IDS, type BureauId } from '../src/data/opponents'
import { SCORE_AXES, TENDER_IDS, TENDERS, type TenderId } from '../src/data/tenders'
import {
  balanceSeeds, dominantOf, leaderOf, rivalsOnly, shareOf, tallyTender, verdictOf, type BureauTally, type TenderTally,
} from '../src/sim/career/balance'
import { rivalBid } from '../src/sim/career/rival'

// Whole tenders are run here; give a slow machine room.
const SLOW = 30_000

/** A tally with the wins given and nothing else. */
function made(tender: TenderId, wins: Record<BureauId, number>): TenderTally {
  const bureaus = {} as Record<BureauId, BureauTally>
  let seeds = 0
  for (const bureau of BUREAU_IDS) {
    const axes = Object.fromEntries(SCORE_AXES.map((axis) => [axis, 0])) as BureauTally['axes']
    bureaus[bureau] = { wins: wins[bureau], illegal: 0, total: 0, axes, failed: 0 }
    seeds += wins[bureau]
  }
  return { tender, seeds, bureaus }
}

describe('the seeds the balance check runs', () => {
  it('are as many as the table says, all different', () => {
    const seeds = balanceSeeds()
    expect(seeds).toHaveLength(BALANCE.seeds.count)
    expect(new Set(seeds).size).toBe(seeds.length)
    expect(seeds[0]).toBe(BALANCE.seeds.first)
  })

  it('can be cut short or run on', () => {
    expect(balanceSeeds(3)).toEqual(balanceSeeds().slice(0, 3))
    expect(balanceSeeds(BALANCE.seeds.count + 5)).toHaveLength(BALANCE.seeds.count + 5)
  })
})

describe('a tender with only the rivals bidding', () => {
  it('goes to the bureau with the best legal bid, the same every time', () => {
    const run = rivalsOnly('tank2001', 1001)
    expect(run.bids.map((each) => each.bureau)).toEqual([...BUREAU_IDS])
    const best = Math.max(...run.bids.filter((each) => each.score.legal).map((each) => each.score.total))
    expect(run.bids.find((each) => each.bureau === run.winner)!.score.total).toBe(best)
    expect(rivalsOnly('tank2001', 1001).winner).toBe(run.winner)
  }, SLOW)

  it('is the bid each bureau makes in the career', () => {
    const run = rivalsOnly('improvedType1', 1008)
    for (const each of run.bids) {
      expect(each.score.total).toBe(rivalBid(each.bureau, TENDERS.improvedType1, 1008).score.total)
    }
  }, SLOW)
})

describe('the tally of a tender', () => {
  it('gives every seed one winner and means the marks', () => {
    const seeds = balanceSeeds(4)
    const tally = tallyTender('improvedType1', seeds)
    expect(tally.seeds).toBe(4)
    expect(BUREAU_IDS.reduce((sum, bureau) => sum + tally.bureaus[bureau].wins, 0)).toBe(4)
    const heavy = seeds.map((seed) => rivalBid('heavy', TENDERS.improvedType1, seed).score.total)
    expect(tally.bureaus.heavy.total).toBeCloseTo(heavy.reduce((sum, total) => sum + total, 0) / 4, 6)
    for (const bureau of BUREAU_IDS) {
      expect(tally.bureaus[bureau].total).toBeGreaterThan(0)
      expect(tally.bureaus[bureau].total).toBeLessThanOrEqual(100)
    }
  }, SLOW)
})

describe('the verdict', () => {
  const [first, second, third] = TENDER_IDS

  it('names the leader of a tender, the first named when level', () => {
    expect(leaderOf(made(first, { heavy: 2, light: 5, firepower: 1 }))).toBe('light')
    expect(leaderOf(made(first, { heavy: 4, light: 4, firepower: 0 }))).toBe('heavy')
  })

  it('finds a bureau that leads every tender', () => {
    const tallies = [
      made(first, { heavy: 5, light: 2, firepower: 1 }),
      made(second, { heavy: 4, light: 3, firepower: 1 }),
      made(third, { heavy: 6, light: 1, firepower: 1 }),
    ]
    expect(dominantOf(tallies)).toBe('heavy')
    expect(verdictOf(tallies).balanced).toBe(false)
  })

  it('passes a career where each bureau has its tender', () => {
    const tallies = [
      made(first, { heavy: 4, light: 2, firepower: 2 }),
      made(second, { heavy: 2, light: 4, firepower: 2 }),
      made(third, { heavy: 2, light: 2, firepower: 4 }),
    ]
    expect(dominantOf(tallies)).toBeNull()
    expect(shareOf(tallies, 'light')).toBeCloseTo(1 / 3, 6)
    expect(verdictOf(tallies)).toEqual({ dominant: null, tooStrong: [], tooWeak: [], balanced: true })
  })

  it('still fails a career where one bureau never wins or one wins nearly all', () => {
    const tallies = [
      made(first, { heavy: 7, light: 0, firepower: 1 }),
      made(second, { heavy: 3, light: 0, firepower: 5 }),
      made(third, { heavy: 8, light: 0, firepower: 0 }),
    ]
    const verdict = verdictOf(tallies)
    expect(verdict.dominant).toBeNull()
    expect(verdict.tooStrong).toEqual(['heavy'])
    expect(verdict.tooWeak).toEqual(['light'])
    expect(verdict.balanced).toBe(false)
  })

  it('has nothing to say about no tenders at all', () => {
    expect(dominantOf([])).toBeNull()
    expect(shareOf([], 'heavy')).toBe(0)
  })
})
