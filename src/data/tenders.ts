// Tenders: what the army asks for, what it will pay, and how it weighs the
// bids. Game-level numbers, not engineering data.
import type { Limits } from '../sim/vehicle/spec'
import type { ThreatTankId } from './opponents'
import { MARKS_GEN1, MARKS_GEN2, MARKS_GEN3, type Marks } from './range'
import { PACT_LIMITS_GEN1, PACT_LIMITS_GEN3 } from './tuning'

export const SCORE_AXES = ['protection', 'firepower', 'mobility', 'reliability', 'cost'] as const
export type ScoreAxis = (typeof SCORE_AXES)[number]

export interface Tender {
  /** The year on the paperwork. There is no calendar: it is a label, and it gates technology. */
  year: number
  /** The Pact's limits, with the army's ceiling on unit cost. */
  limits: Limits & { maxUnitCostKr: number }
  /** What the proving ground asks of a prototype. */
  marks: Marks
  /** The Accord tanks the army expects it to meet. Every bid duels each of them. */
  threats: readonly ThreatTankId[]
  /** How the army weighs a bid. The five add up to 100. */
  weights: Record<ScoreAxis, number>
  /** What the ministry grants the bureau to build and try its prototypes. */
  grantKr: number
  /** Revisions each rival bureau makes after its first prototype. */
  rivalRevisions: number
}

export const TENDER_IDS = ['improvedType1', 'tank2001', 'tank2016'] as const
export type TenderId = (typeof TENDER_IDS)[number]

export const TENDERS: Record<TenderId, Tender> = {
  /**
   * The first tender: make the Type 1 better. It asks for a tank that can
   * shoot at night, which the Type 1 as issued cannot do well enough.
   * The other bureaus are as new to the proving ground as the player: each
   * enters the tank it first drew up, so a newcomer who fixes the night
   * shoot nearly always wins.
   */
  improvedType1: {
    year: 1981,
    limits: { ...PACT_LIMITS_GEN1, maxUnitCostKr: 3_200_000 },
    marks: { ...MARKS_GEN1, hits: { ...MARKS_GEN1.hits, night: 4 } },
    threats: ['warden', 'palisade'],
    weights: { protection: 30, firepower: 25, mobility: 15, reliability: 15, cost: 15 },
    grantKr: 22_000_000,
    rivalRevisions: 0,
  },
  /**
   * Twenty years on: a tank for the new century. Generation two technology
   * is allowed, the Accord has a rebuilt Palisade and tandem warheads, and
   * the army will pay more for a tank that can meet them.
   */
  tank2001: {
    year: 2001,
    limits: { ...PACT_LIMITS_GEN1, generation: 2, maxUnitCostKr: 5_000_000 },
    marks: MARKS_GEN2,
    threats: ['palisade', 'palisadeB'],
    weights: { protection: 30, firepower: 30, mobility: 10, reliability: 15, cost: 15 },
    grantKr: 40_000_000,
    rivalRevisions: 3,
  },
  /**
   * Fifteen years on again: generation three. The Pact's bridges carry
   * more, the army will pay more, and protection counts for most.
   */
  tank2016: {
    year: 2016,
    limits: { ...PACT_LIMITS_GEN3, generation: 3, maxUnitCostKr: 8_000_000 },
    marks: MARKS_GEN3,
    threats: ['palisadeB'],
    weights: { protection: 35, firepower: 25, mobility: 10, reliability: 15, cost: 15 },
    grantKr: 60_000_000,
    rivalRevisions: 3,
  },
}

/** The rules every tender is run by. */
export const TENDER_RULES = {
  /** Revisions a bidder may make after its first prototype (Q4). */
  revisions: 3,
} as const

/** How a bid's trial results turn into marks out of 100 on each count. */
export const SCORING = {
  /** Marks off the total for each proving-ground test failed. */
  failedTest: 4,
  protection: {
    /** Share from the armour trial: serials that kept every round out. The rest is from the duels: hits taken that did nothing. */
    trialShare: 0.6,
  },
  firepower: {
    /** Share from the firing tests: targets hit. */
    shootShare: 0.4,
    /** Share from the loading drill, full marks at `drillBestRpm`. The rest is from the duels: rounds fired that got through. */
    drillShare: 0.2,
    drillBestRpm: 8,
  },
  mobility: {
    /** The sprint: no marks at the tender's time, full marks at `bestSprintS`. */
    sprintShare: 0.35,
    bestSprintS: 6,
    /** Top speed: no marks at the tender's speed, full marks at `bestTopKmh`. */
    topShare: 0.3,
    bestTopKmh: 70,
    /** The rest is the obstacle course: obstacles crossed. */
  },
  reliability: {
    /** Share from the design's reliability figure. The rest is the endurance run. */
    indexShare: 0.5,
    /** Marks off the run for each stop for repairs. A run not finished scores nothing. */
    stop: 25,
  },
  cost: {
    /** Full marks at this unit cost or less; none at the tender's ceiling. */
    bestKr: 1_500_000,
  },
} as const
