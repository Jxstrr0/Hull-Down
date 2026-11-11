// Words for the challenge of the day: its date, its brief, and the few lines
// a player copies to show how they did.
import { STRINGS, fill } from '../data/strings'
import type { DailyBest } from '../persist/dailyStore'
import { dateOfDay, type DailyChallenge } from '../sim/career/daily'
import { mark } from './careerWords'
import { fixed, money } from './format'

const D = STRINGS.daily

export function dateLine(day: number): string {
  const date = dateOfDay(day)
  return fill(D.date, { day: String(date.day), month: D.months[date.month - 1] ?? '', year: String(date.year) })
}

/** What the army asks for that day, in one line. */
export function briefLine(challenge: DailyChallenge): string {
  const { year, limits } = challenge.tender
  return fill(D.brief, { year: String(year), mass: fixed(limits.maxMassT, 0), cost: money(limits.maxUnitCostKr) })
}

export function weightsLine(challenge: DailyChallenge): string {
  const weights = challenge.tender.weights
  return fill(D.weights, {
    protection: String(weights.protection), firepower: String(weights.firepower), mobility: String(weights.mobility),
    reliability: String(weights.reliability), cost: String(weights.cost),
  })
}

export function triesWords(tries: number): string {
  return fill(tries === 1 ? D.oneTry : D.manyTries, { n: String(tries) })
}

/** How a try came out. */
export function resultLine(result: DailyBest): string {
  if (!result.legal) return D.thrownOut
  return fill(D.result, { place: String(result.place), of: String(result.of), mark: mark(result.total) })
}

export function bestLine(best: DailyBest | null, tries: number): string {
  if (!best) return D.noBest
  return fill(D.best, { result: resultLine(best), tries: triesWords(tries) })
}

/** The lines to copy and paste anywhere. No name, nothing about the device. */
export function shareText(challenge: DailyChallenge, best: DailyBest, tries: number): string {
  const S = D.share
  return [
    fill(S.head, { date: dateLine(challenge.day) }),
    `${briefLine(challenge)} ${D.wishes[challenge.wish]}`,
    fill(S.line, { result: resultLine(best), tries: triesWords(tries) }),
    S.link,
  ].join('\n')
}
