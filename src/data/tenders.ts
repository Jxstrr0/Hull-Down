// Tenders: what the army asks for, what it will pay, and how it weighs the
// bids. Game-level numbers, not engineering data.
//
// Each tender weighs the five counts differently, so that no one way of
// building a tank wins them all: `npm run sim` and tests/balance.test.ts
// check that each rival bureau leads a tender of its own.
import type { Limits } from '../sim/vehicle/spec'
import type { ThreatTankId } from './opponents'
import { MARKS_GEN1, MARKS_GEN2, MARKS_GEN3, MARKS_SPG, type Marks } from './range'
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
  /** The Accord tanks the army expects it to meet. Every bid duels each of them. None for a self-propelled gun, which fights from beyond the hill. */
  threats: readonly ThreatTankId[]
  /** How the army weighs a bid. The five add up to 100. */
  weights: Record<ScoreAxis, number>
  /** What the ministry grants the bureau to build and try its prototypes. */
  grantKr: number
  /** Revisions each rival bureau makes after its first prototype. */
  rivalRevisions: number
  /**
   * Names this tender's own luck at the proving ground. Fixed for each tender,
   * not its place in the career, so a tender put in between never changes
   * another's trials.
   */
  luck: number
}

export const TENDER_IDS = ['improvedType1', 'destroyer1991', 'tank2001', 'spg2008', 'tank2016'] as const
export type TenderId = (typeof TENDER_IDS)[number]

export const TENDERS: Record<TenderId, Tender> = {
  /**
   * The first tender: make the Type 1 better. It asks for a tank that can
   * shoot at night, which the Type 1 as issued cannot do well enough, so
   * firepower counts for most, and getting the gun to where it is needed next.
   * The other bureaus are as new to the proving ground as the player: each
   * enters the tank it first drew up, so a newcomer who fixes the night
   * shoot nearly always wins.
   */
  improvedType1: {
    year: 1981,
    limits: { ...PACT_LIMITS_GEN1, maxUnitCostKr: 3_200_000 },
    marks: { ...MARKS_GEN1, hits: { ...MARKS_GEN1.hits, night: 4 } },
    threats: ['warden', 'palisade'],
    weights: { protection: 15, firepower: 35, mobility: 25, reliability: 15, cost: 10 },
    grantKr: 22_000_000,
    rivalRevisions: 0,
    luck: 0,
  },
  /**
   * Ten years on: the army wants a tank destroyer to stand beside its tanks.
   * The same generation one parts and the same bridges, but a casemate is
   * allowed in place of a turret: a big gun on a cheap, light, low hull.
   * Firepower counts for most, then cost; it is meant to wait hull down for
   * the Accord's tanks, not to fight its way forward.
   */
  destroyer1991: {
    year: 1991,
    limits: { ...PACT_LIMITS_GEN1, maxUnitCostKr: 2_800_000, casemate: true },
    // It waits with its hull already pointed down the likely line, so the first shot may come a little later.
    marks: { ...MARKS_GEN1, firstShotS: 26 },
    threats: ['warden', 'palisade'],
    weights: { protection: 10, firepower: 40, mobility: 15, reliability: 10, cost: 25 },
    grantKr: 18_000_000,
    rivalRevisions: 2,
    luck: 3,
  },
  /**
   * Twenty years on: a tank for the new century. Generation two technology
   * is allowed, the Accord has a rebuilt Palisade and tandem warheads, and
   * the army will pay more for a tank that can meet them. Protection and
   * firepower count for most, level with each other.
   */
  tank2001: {
    year: 2001,
    limits: { ...PACT_LIMITS_GEN1, generation: 2, maxUnitCostKr: 5_000_000 },
    marks: MARKS_GEN2,
    threats: ['palisade', 'palisadeB'],
    weights: { protection: 30, firepower: 30, mobility: 10, reliability: 15, cost: 15 },
    grantKr: 40_000_000,
    rivalRevisions: 3,
    luck: 1,
  },
  /**
   * Seven years on: the army wants a self-propelled gun, a 155 mm howitzer on
   * tracks that can keep up with its tanks and drop shells on map grids 20 km
   * off. It is judged on a fire mission in place of the tank shoots and duels.
   * Generation two parts. Firepower counts for most, then cost and
   * reliability; it stays back, so its armour need only keep out splinters
   * and cannon.
   */
  spg2008: {
    year: 2008,
    limits: { ...PACT_LIMITS_GEN1, generation: 2, maxUnitCostKr: 4_500_000, allowedCalibresMm: [155], casemate: true },
    marks: MARKS_SPG,
    threats: [],
    weights: { protection: 5, firepower: 40, mobility: 15, reliability: 20, cost: 20 },
    grantKr: 35_000_000,
    rivalRevisions: 3,
    luck: 4,
  },
  /**
   * Fifteen years on again: generation three. The Pact's bridges carry
   * more, but the army has a whole fleet to replace: it wants a tank it can
   * buy in numbers and keep running, so cost and reliability count for most.
   */
  tank2016: {
    year: 2016,
    limits: { ...PACT_LIMITS_GEN3, generation: 3, maxUnitCostKr: 8_000_000 },
    marks: MARKS_GEN3,
    threats: ['palisadeB'],
    weights: { protection: 10, firepower: 15, mobility: 10, reliability: 25, cost: 40 },
    grantKr: 60_000_000,
    rivalRevisions: 3,
    luck: 2,
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
    /**
     * For a self-propelled gun, all from the fire mission, times the share of
     * grids it could reach. Each part scores nothing at the tender's mark and
     * full marks at its best.
     */
    mission: {
      timeShare: 0.3,
      bestFirstRoundS: 60,
      rateShare: 0.3,
      bestRpm: 8,
      /** The rest is how close the shells land. */
      bestMissM: 25,
    },
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
