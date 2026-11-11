// A rival bureau's bid. It draws up its tank, sends a prototype to the same
// trials as everyone else, and revises it on what the reports say, under the
// same rule on revisions as the player. A revision that does no better is
// dropped and the bureau enters the tank it had.
import type { ObstacleId } from '../../data/range'
import type { BureauId } from '../../data/opponents'
import { TENDER_RULES, type Tender } from '../../data/tenders'
import { draftRival, reviseRival, type Lesson } from '../ai/designer'
import type { RangeReport } from '../trials'
import { scoreBid, trialBid, type BidScore, type Trialled } from './score'

/** What a range report tells a bureau to change, each lesson once. */
export function lessonsOf(range: RangeReport): Lesson[] {
  const lessons: Lesson[] = []
  if (!range.gunnery.night.passed) lessons.push('night')
  if (!range.gunnery.onTheMove.passed) lessons.push('onTheMove')
  if (!range.gunnery.halted.passed) lessons.push('halted')
  if (!range.drill.passed) lessons.push('drill')
  const failed = (id: ObstacleId): boolean => range.obstacles.results.some((result) => result.id === id && !result.passed)
  if (!range.acceleration.passed || failed('slope') || failed('mud')) lessons.push('power')
  if (failed('trench')) lessons.push('trench')
  if (!range.berm.passed) lessons.push('berm')
  for (const zone of range.armour.failed) lessons.push({ zone })
  return lessons
}

export interface RivalBid {
  bureau: BureauId
  bid: Trialled
  score: BidScore
  /** Revisions the bureau kept. */
  revisions: number
}

/** The bid one bureau puts in. The same bureau, tender and seed always give the same bid. */
export function rivalBid(bureau: BureauId, tender: Tender, seed: number): RivalBid {
  let draft = draftRival(bureau, tender.limits, seed)
  let bid = trialBid(draft.spec, tender, seed)
  let score = scoreBid(bid, tender)
  let revisions = 0
  while (revisions < TENDER_RULES.revisions) {
    const lessons = lessonsOf(bid.range)
    if (lessons.length === 0) break
    const next = reviseRival(draft, bureau, tender.limits, lessons)
    if (!next) break
    const trial = trialBid(next.spec, tender, seed)
    const marks = scoreBid(trial, tender)
    if (!marks.legal || marks.total <= score.total) break
    draft = next
    bid = trial
    score = marks
    revisions++
  }
  return { bureau, bid, score, revisions }
}

