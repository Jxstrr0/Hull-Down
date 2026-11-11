// The career: one bureau's run from tender to tender. Everything here is a
// plain value that can be saved and restored, and every step gives back a
// new career and leaves the old one alone. The same career and the same
// choices always come out the same.
import { BASELINE_SPEC } from '../../data/baseline'
import { BODIES, CAREER, STANDARD_PARTS, type Body, type StandardPart } from '../../data/career'
import { BUREAU_IDS, type BureauId } from '../../data/opponents'
import { TENDER_IDS, TENDER_RULES, TENDERS, type ScoreAxis, type Tender, type TenderId } from '../../data/tenders'
import { hash32 } from '../rng'
import type { VehicleSpec } from '../vehicle/spec'
import { buildStatSheet } from '../vehicle/stats'
import { rivalBid } from './rival'
import { decide, scoreBid, trialBid, type BidScore, type Trialled } from './score'

export const CAREER_FORMAT = 1

/** A prototype the bureau paid for. The first is number one; each after it is a revision. */
export interface Prototype {
  no: number
  spec: VehicleSpec
  costKr: number
}

export type Bidder = 'bureau' | BureauId

/** One line of the army's order of merit. */
export interface BidLine {
  who: Bidder
  legal: boolean
  axes: Record<ScoreAxis, number>
  failed: number
  total: number
  unitCostKr: number
  /** Revisions the bidder made. */
  revisions: number
}

export interface Outcome {
  /** The prototype the bureau entered. */
  entered: number
  /** Every bid, best first. */
  bids: BidLine[]
  /** The bureau's place, one for the winner. */
  place: number
  won: boolean
  /** What the army calls the tank, when it is adopted. */
  designation: string | null
  /** What the decision did to the bureau's standing with each body. */
  standing: Record<Body, number>
}

export interface Career {
  format: number
  /** Names the luck of the whole career. */
  seed: number
  /** Which tender the bureau is on, counting from nought. */
  tenderNo: number
  budgetKr: number
  reputation: Record<Body, number>
  /** Prototypes built for this tender, oldest first. */
  prototypes: Prototype[]
  /** Null until the army has decided. */
  outcome: Outcome | null
  /** Tanks of the bureau's the army has adopted, oldest first. */
  adopted: { designation: string; name: string; year: number; spec: VehicleSpec }[]
}

// Names the roll that gives each tender its own luck.
const TRIAL = 91

function clampStanding(value: number): number {
  const r = CAREER.reputation
  return Math.round(value < r.min ? r.min : value > r.max ? r.max : value)
}

export function tenderIdOf(career: Career): TenderId {
  return TENDER_IDS[Math.min(career.tenderNo, TENDER_IDS.length - 1)] ?? TENDER_IDS[0]
}

export function tenderOf(career: Career): Tender {
  return TENDERS[tenderIdOf(career)]
}

/** The luck of this tender's trials: the same for every bidder and every prototype. */
export function trialSeed(career: Career): number {
  return hash32(career.seed, TRIAL, career.tenderNo)
}

export function newCareer(seed: number): Career {
  const start = CAREER.reputation.start
  const career: Career = {
    format: CAREER_FORMAT,
    seed: seed >>> 0,
    tenderNo: 0,
    budgetKr: 0,
    reputation: { army: start, ministry: start, pact: start },
    prototypes: [],
    outcome: null,
    adopted: [],
  }
  career.budgetKr = tenderOf(career).grantKr
  return career
}

/** True when two specs build the same tank. The name is paint: it does not count. */
function sameTank(a: VehicleSpec, b: VehicleSpec): boolean {
  return JSON.stringify({ ...a, name: '' }) === JSON.stringify({ ...b, name: '' })
}

/** Revisions made so far: every prototype after the first. */
export function revisionsMade(career: Career): number {
  return Math.max(0, career.prototypes.length - 1)
}

/** Revisions still to be had: inside the rule, and beyond it at a cost in standing. */
export function revisionsLeft(career: Career): { free: number; extra: number } {
  const made = revisionsMade(career)
  const free = Math.max(0, TENDER_RULES.revisions - made)
  const extra = Math.max(0, TENDER_RULES.revisions + CAREER.extraRevisions - Math.max(made, TENDER_RULES.revisions))
  return { free, extra }
}

/** What the next prototype of this design would cost. */
export function prototypeCostKr(career: Career, spec: VehicleSpec): number {
  const unitKr = buildStatSheet(spec, tenderOf(career).limits).unitCostKr
  const units = career.prototypes.length === 0 ? CAREER.prototypeUnits : CAREER.revisionUnits
  return Math.round((unitKr * units) / 1000) * 1000
}

export const BUILD_BLOCKS = ['decided', 'illegal', 'same', 'noRevisions', 'noMoney'] as const
/** Why a prototype cannot be built. */
export type BuildBlock = (typeof BUILD_BLOCKS)[number]

/** What stops this design being built as the next prototype, or null when nothing does. */
export function buildBlock(career: Career, spec: VehicleSpec): BuildBlock | null {
  if (career.outcome) return 'decided'
  if (buildStatSheet(spec, tenderOf(career).limits).issues.some((issue) => issue.severity === 'error')) return 'illegal'
  const last = career.prototypes[career.prototypes.length - 1]
  if (last && sameTank(last.spec, spec)) return 'same'
  if (career.prototypes.length > 0) {
    const left = revisionsLeft(career)
    if (left.free + left.extra === 0) return 'noRevisions'
  }
  if (prototypeCostKr(career, spec) > career.budgetKr) return 'noMoney'
  return null
}

/** Pays for a prototype of this design. Throws when it cannot be built: ask `buildBlock` first. */
export function buildPrototype(career: Career, spec: VehicleSpec): Career {
  const block = buildBlock(career, spec)
  if (block) throw new Error(`prototype cannot be built: ${block}`)
  const costKr = prototypeCostKr(career, spec)
  const prototype: Prototype = { no: career.prototypes.length + 1, spec: structuredClone(spec), costKr }
  return { ...career, budgetKr: career.budgetKr - costKr, prototypes: [...career.prototypes, prototype] }
}

/** A prototype's trials and marks. Worked out afresh each time, and always the same. */
export function prototypeTrial(career: Career, no: number): { bid: Trialled; score: BidScore } | null {
  const prototype = career.prototypes.find((each) => each.no === no)
  if (!prototype) return null
  const tender = tenderOf(career)
  const bid = trialBid(prototype.spec, tender, trialSeed(career))
  return { bid, score: scoreBid(bid, tender) }
}

/** The share of main parts a design has in common with the Type 1, 0..1. */
export function standardShare(spec: VehicleSpec): number {
  const part = (s: VehicleSpec, id: StandardPart): string => {
    switch (id) {
      case 'hull': return s.hull.size
      case 'turret': return s.turret.shape
      case 'gun': return s.gun
      case 'barrel': return s.barrel
      case 'recoil': return s.recoil
      case 'loading': return s.loading
      case 'stowage': return s.ammo.stowage
      case 'engine': return s.powerpack.engine
      case 'transmission': return s.powerpack.transmission
      case 'cooling': return s.powerpack.cooling
      case 'suspension': return s.runningGear.suspension
      case 'sight': return s.fireControl.sight
      case 'rangefinder': return s.fireControl.rangefinder
      case 'stabiliser': return s.fireControl.stabiliser
      case 'computer': return s.fireControl.computer
      case 'night': return s.fireControl.night
    }
  }
  const same = STANDARD_PARTS.filter((id) => part(spec, id) === part(BASELINE_SPEC, id)).length
  return same / STANDARD_PARTS.length
}

/**
 * What the army calls a tank it adopts: "Model" and the last two figures of
 * the year. A second tank adopted in the same year is "Model 81/2".
 */
export function designationOf(year: number, alreadyThatYear: number): string {
  const base = `Model ${String(year % 100).padStart(2, '0')}`
  return alreadyThatYear > 0 ? `${base}/${alreadyThatYear + 1}` : base
}

/**
 * The bureau enters one of its prototypes and the army decides. Throws when
 * there is no such prototype or the tender is already decided.
 */
export function enterTender(career: Career, prototypeNo: number): Career {
  if (career.outcome) throw new Error('the tender is already decided')
  const mine = prototypeTrial(career, prototypeNo)
  const prototype = career.prototypes.find((each) => each.no === prototypeNo)
  if (!mine || !prototype) throw new Error(`no prototype ${prototypeNo}`)
  const tender = tenderOf(career)
  const seed = trialSeed(career)
  const made = revisionsMade(career)

  const line = (who: Bidder, bid: Trialled, score: BidScore, revisions: number): BidLine => ({
    who, legal: score.legal, axes: { ...score.axes }, failed: score.failed, total: score.total, unitCostKr: bid.sheet.unitCostKr, revisions,
  })
  const lines: BidLine[] = [line('bureau', mine.bid, mine.score, made)]
  for (const bureau of BUREAU_IDS) {
    const rival = rivalBid(bureau, tender, seed)
    lines.push(line(bureau, rival.bid, rival.score, rival.revisions))
  }
  const order = decide(lines.map((each) => ({ score: { legal: each.legal, total: each.total }, unitCostKr: each.unitCostKr })))
  const bids = order.map((index) => lines[index]!)
  const place = bids.findIndex((each) => each.who === 'bureau') + 1
  const won = place === 1 && mine.score.legal

  const R = CAREER.reputation
  const beyond = Math.max(0, made - TENDER_RULES.revisions)
  const standing: Record<Body, number> = {
    army: (won ? R.army.won : place === 2 ? R.army.second : R.army.lower) + beyond * R.army.extraRevision,
    ministry:
      (won ? R.ministry.won : R.ministry.lost) + ((mine.score.axes.cost - 50) / 50) * R.ministry.cost +
      Math.min(made, TENDER_RULES.revisions) * R.ministry.revision + beyond * R.ministry.extraRevision,
    pact: (standardShare(prototype.spec) * 2 - 1) * R.pact.standard,
  }
  const reputation = { ...career.reputation }
  for (const body of BODIES) {
    const after = clampStanding(career.reputation[body] + standing[body])
    standing[body] = after - career.reputation[body]
    reputation[body] = after
  }

  const designation = won ? designationOf(tender.year, career.adopted.filter((each) => each.year === tender.year).length) : null
  const adopted = designation
    ? [...career.adopted, { designation, name: prototype.spec.name, year: tender.year, spec: structuredClone(prototype.spec) }]
    : career.adopted
  return { ...career, reputation, adopted, outcome: { entered: prototypeNo, bids, place, won, designation, standing } }
}

