// The challenge of the day: one tender for one date. The date alone decides
// the tender and the luck of its trials, so every player meets the same
// requirement and the same rival bids. The page supplies the date; nothing
// here reads a clock.
import { DAILY, WISH_IDS, type WishId } from '../../data/daily'
import { BUREAU_IDS } from '../../data/opponents'
import { TENDERS, TENDER_IDS, type ScoreAxis, type Tender, type TenderId } from '../../data/tenders'
import { hash32, unit } from '../rng'
import type { VehicleSpec } from '../vehicle/spec'
import type { Bidder, BidLine } from './career'
import { rivalBid } from './rival'
import { decide, scoreBid, trialBid, type BidScore, type Trialled } from './score'

/** A calendar date as the player's own clock has it. */
export interface DayDate {
  year: number
  /** One for January. */
  month: number
  day: number
}

/** Days since 1 January 1970, counting that day as nought. Whole-number maths, the same on every device. */
export function dayNumber(date: DayDate): number {
  const y = date.month <= 2 ? date.year - 1 : date.year
  const era = Math.floor(y / 400)
  const yearOfEra = y - era * 400
  const dayOfYear = Math.floor((153 * (date.month + (date.month > 2 ? -3 : 9)) + 2) / 5) + date.day - 1
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146097 + dayOfEra - 719468
}

/** The date a day number stands for. */
export function dateOfDay(day: number): DayDate {
  const z = day + 719468
  const era = Math.floor(z / 146097)
  const dayOfEra = z - era * 146097
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365)
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100))
  const m = Math.floor((5 * dayOfYear + 2) / 153)
  const month = m < 10 ? m + 3 : m - 9
  return { year: yearOfEra + era * 400 + (month <= 2 ? 1 : 0), month, day: dayOfYear - Math.floor((153 * m + 2) / 5) + 1 }
}

export interface DailyChallenge {
  day: number
  /** The luck of the day's trials. */
  seed: number
  /** The career tender it stands on: its technology, proving ground and threats. */
  basis: TenderId
  /** What the army wants most. */
  wish: WishId
  /** Tonnes taken off the Pact's weight limit. */
  massCutT: number
  tender: Tender
}

/**
 * The tank tenders a challenge is built on. The tank destroyer's, the
 * self-propelled gun's and the infantry fighting vehicle's are left out, so
 * the days stay as they were.
 */
const DAILY_BASES = TENDER_IDS.filter((id) =>
  !TENDERS[id].limits.casemate && TENDERS[id].marks.fireMission === undefined && TENDERS[id].marks.squad === undefined)

function pick<T>(list: readonly T[], seed: number, key: number): T {
  return list[Math.floor(unit(seed, key) * list.length)]!
}

/** The challenge for one day. The same day always gives the same challenge. */
export function dailyChallenge(day: number): DailyChallenge {
  const seed = hash32(DAILY.salt, day)
  const basis = pick(DAILY_BASES, seed, 1)
  const wish = pick(WISH_IDS, seed, 2)
  const massCutT = pick(DAILY.massCutsT, seed, 3)
  const costShare = pick(DAILY.costShares, seed, 4)
  const base = TENDERS[basis]
  const weights: Record<ScoreAxis, number> = { ...DAILY.wishes[wish] }
  const tender: Tender = {
    ...base,
    limits: { ...base.limits, maxMassT: base.limits.maxMassT - massCutT, maxUnitCostKr: Math.round(base.limits.maxUnitCostKr * costShare) },
    weights,
    grantKr: 0,
  }
  return { day, seed, basis, wish, massCutT, tender }
}

function line(who: Bidder, bid: Trialled, score: BidScore, revisions: number): BidLine {
  return { who, legal: score.legal, axes: { ...score.axes }, failed: score.failed, total: score.total, unitCostKr: bid.sheet.unitCostKr, revisions }
}

/** What the three rival bureaus enter that day. Slow: work it out once and keep it. */
export function dailyRivals(challenge: DailyChallenge): BidLine[] {
  return BUREAU_IDS.map((bureau) => {
    const rival = rivalBid(bureau, challenge.tender, challenge.seed)
    return line(bureau, rival.bid, rival.score, rival.revisions)
  })
}

export interface DailyResult {
  day: number
  /** Every bid, best first. */
  bids: BidLine[]
  /** The player's place, one for the winner. */
  place: number
  /** The player's own line. */
  mine: BidLine
}

/** The player's design goes through the day's trials and the army decides. */
export function enterDaily(spec: VehicleSpec, challenge: DailyChallenge, rivals: readonly BidLine[]): DailyResult {
  const bid = trialBid(spec, challenge.tender, challenge.seed)
  const mine = line('bureau', bid, scoreBid(bid, challenge.tender), 0)
  const lines = [mine, ...rivals]
  const order = decide(lines.map((each) => ({ score: { legal: each.legal, total: each.total }, unitCostKr: each.unitCostKr })))
  const bids = order.map((index) => lines[index]!)
  return { day: challenge.day, bids, place: bids.indexOf(mine) + 1, mine }
}

/** What is kept of a try: its place, and whether and how well it scored. */
export interface DailyTry {
  place: number
  mine: Pick<BidLine, 'legal' | 'total'>
}

/** Whether a new try beats the best so far that day: a legal bid over one thrown out, then the better place, then more marks. */
export function betterTry(now: DailyTry, best: DailyTry | null): boolean {
  if (!best) return true
  if (now.mine.legal !== best.mine.legal) return now.mine.legal
  return now.place < best.place || (now.place === best.place && now.mine.total > best.mine.total)
}
