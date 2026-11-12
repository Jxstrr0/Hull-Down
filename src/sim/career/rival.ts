// A rival bureau's bid. It draws up its tank, sends a prototype to the same
// trials as everyone else, and revises it on what the reports say, under the
// same rule on revisions as the player (a tender may allow it fewer). A revision that does no better is
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
  const mission = range.fireMission
  if (range.selfPropelled) {
    // Only the fire mission counts: late or wide wants a better computer, slow wants a quicker way to load.
    if (mission && (!mission.timePassed || !mission.closePassed)) lessons.push('fireData')
    if (mission && !mission.ratePassed) lessons.push('drill')
  } else if (range.carrier) {
    // Only the squad drop counts of the shooting: targets left standing want a better rangefinder and computer.
    if (range.squad && !range.squad.coverPassed) lessons.push('halted')
    // A squad late to the drop point wants a stronger engine.
    if (range.squad && !range.squad.dropPassed) lessons.push('power')
  } else if (range.scouting) {
    // Only spot and report counts of the sights: vehicles missed want a better sight to search with.
    if (range.scout && !range.scout.foundPassed) lessons.push('search')
    // Seen first wants less of the car over a crest; late home wants a stronger engine.
    if (range.scout && !range.scout.seenPassed) lessons.push('berm')
    if (range.scout && !range.scout.timePassed) lessons.push('power')
  } else {
    if (!range.gunnery.night.passed) lessons.push('night')
    if (!range.gunnery.onTheMove.passed) lessons.push('onTheMove')
    if (!range.gunnery.halted.passed) lessons.push('halted')
    if (!range.drill.passed) lessons.push('drill')
  }
  const failed = (id: ObstacleId): boolean => range.obstacles.results.some((result) => result.id === id && !result.passed && !result.waived)
  // A scout car bogged in the mud wants more wheels before more power.
  if (range.scouting && failed('mud')) lessons.push('mud')
  if (!range.acceleration.passed || failed('slope') || (!range.scouting && failed('mud'))) lessons.push('power')
  if (failed('trench')) lessons.push('trench')
  if (!range.selfPropelled && !range.carrier && !range.scouting && !range.berm.passed) lessons.push('berm')
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
  while (revisions < Math.min(tender.rivalRevisions, TENDER_RULES.revisions)) {
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

