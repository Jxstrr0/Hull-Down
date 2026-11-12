// The career's words: the lines the bureau screen is made of. No DOM here,
// so they can be tested.
import { BODIES, CAREER, type Body } from '../data/career'
import { GUNNERY_TEST_IDS } from '../data/range'
import { STRINGS, fill } from '../data/strings'
import { SCORE_AXES, TENDER_RULES } from '../data/tenders'
import type { BidLine, BuildBlock, Career, Outcome } from '../sim/career/career'
import { revisionsLeft } from '../sim/career/career'
import type { BidScore } from '../sim/career/score'
import type { RangeReport } from '../sim/trials'
import { fixed, money } from './format'

const C = STRINGS.career

/** A mark out of 100, as the army writes it. */
export function mark(value: number): string {
  return fixed(value, 1)
}

/** A change in standing, with its sign. Nought has none. */
export function standingChange(change: number): string {
  if (change === 0) return C.standing.noChange
  return fill(change > 0 ? C.standing.up : C.standing.down, { n: String(Math.abs(change)) })
}

/** How a body feels about the bureau, in a word. */
export function standingWord(value: number): string {
  const R = CAREER.reputation
  const share = (value - R.min) / (R.max - R.min)
  const words = C.standing.words
  return words[Math.min(words.length - 1, Math.max(0, Math.floor(share * words.length)))] ?? ''
}

export function standingLine(career: Career, body: Body): string {
  const value = career.reputation[body]
  return fill(C.standing.line, { n: String(value), max: String(CAREER.reputation.max), word: standingWord(value) })
}

/** The five marks on one line: "Protection 47 · Firepower 57 · …". */
export function axesLine(axes: BidScore['axes']): string {
  return SCORE_AXES.map((axis) => `${C.axes[axis]} ${fixed(axes[axis], 0)}`).join(' · ')
}

/** The names of the proving-ground tests a prototype failed. */
export function failedTests(range: RangeReport): string[] {
  const R = STRINGS.range
  const out: string[] = []
  if (!range.acceleration.passed) out.push(R.acceleration.title)
  if (!range.obstacles.passed) out.push(R.obstacles.title)
  if (!range.endurance.passed) out.push(R.endurance.title)
  // A self-propelled gun's or an infantry fighting vehicle's shoots, drill and berm are run but do not count.
  const tank = !range.selfPropelled && !range.carrier
  if (tank) for (const id of GUNNERY_TEST_IDS) if (!range.gunnery[id].passed) out.push(R.gunnery.titles[id])
  if (tank && !range.drill.passed) out.push(R.drill.title)
  if (!range.armour.passed) out.push(R.armour.title)
  if (tank && !range.berm.passed) out.push(R.berm.title)
  if (range.fireMission && !range.fireMission.passed) out.push(R.fireMission.title)
  if (range.squad && !range.squad.passed) out.push(R.squad.title)
  if (range.scout && !range.scout.passed) out.push(R.scout.title)
  return out
}

/** "Failed 2 tests, 8 marks off: Night gunnery, Armour trial." */
export function failedLine(score: BidScore, range: RangeReport): string {
  if (score.failed === 0) return C.marks.noneFailed
  return fill(score.failed === 1 ? C.marks.oneFailed : C.marks.manyFailed, {
    n: String(score.failed), off: fixed(score.penalty, 0), tests: failedTests(range).join(', '),
  })
}

/** Why the shop will not build the design, in a sentence. */
export function blockLine(block: BuildBlock): string {
  return C.build.blocks[block]
}

/** What is left of the bureau's revisions. */
export function revisionsLine(career: Career): string {
  if (career.prototypes.length === 0) return fill(C.build.first, { n: String(TENDER_RULES.revisions) })
  const left = revisionsLeft(career)
  if (left.free > 0) return fill(left.free === 1 ? C.build.oneLeft : C.build.manyLeft, { n: String(left.free) })
  if (left.extra > 0) return C.build.extraLeft
  return C.build.noneLeft
}

/** Who a line of the order of merit belongs to. */
export function bidderName(who: BidLine['who']): string {
  return who === 'bureau' ? C.decision.you : STRINGS.opponents.bureaus[who].name
}

/** "53.1 marks · Kr 2.06M · 1 revision", or that the bid was thrown out. */
export function bidLine(line: BidLine): string {
  if (!line.legal) return C.decision.thrownOut
  const revisions = line.revisions === 0 ? C.decision.noRevisions
    : fill(line.revisions === 1 ? C.decision.oneRevision : C.decision.manyRevisions, { n: String(line.revisions) })
  return fill(C.decision.line, { mark: mark(line.total), cost: money(line.unitCostKr), revisions })
}

/** The army's decision in a sentence. */
export function verdictLine(outcome: Outcome): string {
  if (outcome.won && outcome.designation) return fill(C.decision.won, { designation: outcome.designation })
  return fill(C.decision.lost, { place: String(outcome.place), of: String(outcome.bids.length) })
}

/** What the decision did to the bureau's standing, body by body. */
export function standingChanges(outcome: Outcome): { body: Body; text: string }[] {
  return BODIES.map((body) => ({ body, text: `${C.bodies[body]}: ${standingChange(outcome.standing[body])}` }))
}
