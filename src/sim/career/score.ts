// How the army marks a bid: every bidder's prototype goes through the same
// proving ground and the same duels, and the results are weighed as the
// tender says. The same tanks and seed always give the same decision.
import { THREAT_TANKS, ACCORD_LIMITS, type ThreatTankId } from '../../data/opponents'
import { GUNNERY_TEST_IDS } from '../../data/range'
import { SCORE_AXES, SCORING, type ScoreAxis, type Tender } from '../../data/tenders'
import { combatantOf } from '../duel/duel'
import { runCard, type DuelSeries } from '../duel/series'
import { runProvingGround, type FireMissionResult, type RangeReport } from '../trials'
import type { VehicleSpec } from '../vehicle/spec'
import { buildStatSheet, type StatSheet } from '../vehicle/stats'

/** A bid with its trials run. */
export interface Trialled {
  spec: VehicleSpec
  sheet: StatSheet
  range: RangeReport
  /** Its duels with each of the tender's threat tanks, a card of five grounds each. */
  duels: { threat: ThreatTankId; card: DuelSeries[] }[]
}

export interface BidScore {
  /** False when the design breaks a limit. Such a bid is thrown out. */
  legal: boolean
  /** Marks out of 100 on each count. */
  axes: Record<ScoreAxis, number>
  /** The five weighed as the tender says, out of 100. */
  weighted: number
  /** Proving-ground tests failed, and the marks they cost. */
  failed: number
  penalty: number
  /** What the army goes by. Never below nought. */
  total: number
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** 0 at `none`, 1 at `full`, whichever way round they are. */
function between(value: number, none: number, full: number): number {
  return full === none ? 1 : clamp01((value - none) / (full - none))
}

/** A self-propelled gun's firepower, 0..1, all from its fire mission. */
function missionFirepower(run: FireMissionResult): number {
  const M = SCORING.firepower.mission
  const reached = run.grids.filter((grid) => grid.reached).length / run.grids.length
  const time = run.firstRoundS === null ? 0 : between(run.firstRoundS, run.marks.firstRoundS, M.bestFirstRoundS)
  const rate = between(run.rpm, run.marks.rpm, M.bestRpm)
  const close = run.missM === null ? 0 : between(run.missM, run.marks.missM, M.bestMissM)
  return reached * (M.timeShare * time + M.rateShare * rate + (1 - M.timeShare - M.rateShare) * close)
}

/** Puts a bid through the tender's proving ground and duels. */
export function trialBid(spec: VehicleSpec, tender: Tender, seed: number): Trialled {
  const sheet = buildStatSheet(spec, tender.limits)
  const range = runProvingGround(sheet, { seed, marks: tender.marks })
  const me = combatantOf(spec, tender.limits)
  const duels = tender.threats.map((threat) => {
    const tank = THREAT_TANKS[threat]
    return { threat, card: runCard(me, combatantOf(tank.spec, ACCORD_LIMITS, tank.rounds), seed) }
  })
  return { spec, sheet, range, duels }
}

export function scoreBid(bid: Trialled, tender: Tender): BidScore {
  const S = SCORING
  const { range, sheet } = bid
  let fired = 0
  let through = 0
  let taken = 0
  let holed = 0
  for (const { card } of bid.duels) {
    for (const series of card) {
      fired += series.tally[0].fired
      through += series.tally[0].through
      taken += series.tally[1].hits
      holed += series.tally[1].through
    }
  }

  const serials = range.armour.serials
  const held = serials.filter((serial) => serial.through === 0).length
  const trial = serials.length ? held / serials.length : 1
  // With no duels, as for a self-propelled gun, the armour trial is all there is to go by.
  const protection = bid.duels.length === 0
    ? trial
    : S.protection.trialShare * trial + (1 - S.protection.trialShare) * (taken ? 1 - holed / taken : 1)

  let targets = 0
  let hits = 0
  for (const id of GUNNERY_TEST_IDS) {
    targets += range.gunnery[id].targets.length
    hits += range.gunnery[id].hits
  }
  const mission = range.fireMission
  const firepower = range.selfPropelled && mission ? missionFirepower(mission) :
    S.firepower.shootShare * (targets ? hits / targets : 0) +
    S.firepower.drillShare * between(range.drill.rpm, 0, S.firepower.drillBestRpm) +
    (1 - S.firepower.shootShare - S.firepower.drillShare) * (fired ? through / fired : 0)

  const run = range.acceleration
  const crossed = range.obstacles.results.filter((result) => result.passed).length
  const mobility =
    S.mobility.sprintShare * (run.sprintS === null ? 0 : between(run.sprintS, tender.marks.sprintS, S.mobility.bestSprintS)) +
    S.mobility.topShare * between(run.topKmh, tender.marks.topKmh, S.mobility.bestTopKmh) +
    (1 - S.mobility.sprintShare - S.mobility.topShare) * (crossed / range.obstacles.results.length)

  const long = range.endurance
  const reliability =
    S.reliability.indexShare * clamp01(sheet.reliabilityIndex / 100) +
    (1 - S.reliability.indexShare) * (long.finished ? clamp01(1 - (long.stops * S.reliability.stop) / 100) : 0)

  const cost = between(sheet.unitCostKr, tender.limits.maxUnitCostKr, S.cost.bestKr)

  const axes: Record<ScoreAxis, number> = {
    protection: protection * 100, firepower: firepower * 100, mobility: mobility * 100, reliability: reliability * 100, cost: cost * 100,
  }
  let weighted = 0
  for (const axis of SCORE_AXES) weighted += (axes[axis] * tender.weights[axis]) / 100
  const failed = range.tests - range.passes
  const penalty = failed * S.failedTest
  const legal = !sheet.issues.some((issue) => issue.severity === 'error')
  return { legal, axes, weighted, failed, penalty, total: Math.max(0, weighted - penalty) }
}

/**
 * The army's order of merit: places in the list of bids, best first. A bid
 * that breaks a limit goes to the bottom. Level bids go to the cheaper tank,
 * then to the one that bid first.
 */
export function decide(bids: readonly { score: Pick<BidScore, 'legal' | 'total'>; unitCostKr: number }[]): number[] {
  return bids
    .map((_, index) => index)
    .sort((a, b) => {
      const x = bids[a]!
      const y = bids[b]!
      if (x.score.legal !== y.score.legal) return x.score.legal ? -1 : 1
      return y.score.total - x.score.total || x.unitCostKr - y.unitCostKr || a - b
    })
}
