// The career: one bureau's run from tender to tender. Everything here is a
// plain value that can be saved and restored, and every step gives back a
// new career and leaves the old one alone. The same career and the same
// choices always come out the same.
import { BASELINE_SPEC } from '../../data/baseline'
import { BODIES, CAREER, STANDARD_PARTS, type Body, type StandardPart } from '../../data/career'
import { BUREAU_IDS, type BureauId } from '../../data/opponents'
import { RESEARCH, RESEARCH_IDS, type ResearchId } from '../../data/research'
import { SERVICE, type Production } from '../../data/service'
import { TENDER_IDS, TENDER_RULES, TENDERS, type ScoreAxis, type Tender, type TenderId } from '../../data/tenders'
import { hash32 } from '../rng'
import type { Limits, VehicleSpec } from '../vehicle/spec'
import { buildStatSheet } from '../vehicle/stats'
import { generationOf, partKey } from '../vehicle/tech'
import { rivalBid } from './rival'
import { decide, scoreBid, trialBid, type BidScore, type Trialled } from './score'
import { fieldReport, serviceUnitCostKr, type FieldReport } from './service'
import { askMeasure, fixedPartsChanged, massCeilingT, type Upgrade, type UpgradeAsk } from './upgrade'

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
  adopted: Adopted[]
  /** Research the bureau has paid for, in the order it was done. It is kept from tender to tender. */
  researched: ResearchId[]
}

/** A tank of the bureau's in the army's hands. */
export interface Adopted {
  designation: string
  name: string
  /** The year of the tender it won, and the tender. */
  year: number
  tender: TenderId
  spec: VehicleSpec
  /** How the factory builds it. Null until the bureau has said. */
  production: Production | null
  /** Years of service the army has reported on. */
  years: number
  /** The upgrade contract the army has open on it, if any. */
  contract: UpgradeAsk | null
  /** Packages fitted, oldest first. */
  upgrades: Upgrade[]
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
    researched: [],
  }
  career.budgetKr = tenderOf(career).grantKr
  return career
}

/** True when there is a tender after this one. */
export function tendersLeft(career: Career): boolean {
  return career.tenderNo < TENDER_IDS.length - 1
}

/**
 * The bureau goes on to the next tender once the army has decided this one.
 * What is left of the budget is kept and the new grant added to it; the
 * prototypes stay behind. Throws when this tender is undecided or the last.
 */
export function nextTender(career: Career): Career {
  if (!career.outcome) throw new Error('the tender is not decided yet')
  if (!tendersLeft(career)) throw new Error('there is no later tender')
  const next: Career = { ...career, tenderNo: career.tenderNo + 1, prototypes: [], outcome: null }
  next.budgetKr = career.budgetKr + tenderOf(next).grantKr
  return next
}

/** The parts the bureau has yet to research, as `partKey` names them. */
export function lockedParts(career: Career): string[] {
  return RESEARCH_IDS.filter((id) => !career.researched.includes(id)).map((id) => partKey(RESEARCH[id].field, RESEARCH[id].part))
}

/** The limits the bureau designs to: the tender's, less the parts it has yet to research. */
export function careerLimits(career: Career): Limits {
  return { ...tenderOf(career).limits, locked: lockedParts(career) }
}

/** The limits a package for a tank in service is held to: its own tender's, with the technology the bureau has today. */
export function upgradeLimits(career: Career, tank: Adopted): Limits {
  return { ...TENDERS[tank.tender].limits, generation: tenderOf(career).limits.generation, locked: lockedParts(career) }
}

/** The projects the bureau can see in this tender: those of its generation and earlier, done or not. */
export function researchOpen(career: Career): ResearchId[] {
  const generation = tenderOf(career).limits.generation ?? 1
  return RESEARCH_IDS.filter((id) => generationOf(RESEARCH[id].field, RESEARCH[id].part) <= generation)
}

export const RESEARCH_BLOCKS = ['done', 'tooNew', 'needs', 'noMoney'] as const
/** Why a project cannot be paid for. */
export type ResearchBlock = (typeof RESEARCH_BLOCKS)[number]

/** What stops the bureau paying for a project, or null when nothing does. */
export function researchBlock(career: Career, id: ResearchId): ResearchBlock | null {
  if (career.researched.includes(id)) return 'done'
  if (!researchOpen(career).includes(id)) return 'tooNew'
  if (RESEARCH[id].needs.some((need) => !career.researched.includes(need))) return 'needs'
  if (RESEARCH[id].costKr > career.budgetKr) return 'noMoney'
  return null
}

/** Pays for a project: its part can be fitted from now on. Throws when it cannot be paid for: ask `researchBlock` first. */
export function research(career: Career, id: ResearchId): Career {
  const block = researchBlock(career, id)
  if (block) throw new Error(`research cannot be done: ${block}`)
  return { ...career, budgetKr: career.budgetKr - RESEARCH[id].costKr, researched: [...career.researched, id] }
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
  if (buildStatSheet(spec, careerLimits(career)).issues.some((issue) => issue.severity === 'error')) return 'illegal'
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
    ? [...career.adopted, {
      designation, name: prototype.spec.name, year: tender.year, tender: tenderIdOf(career), spec: structuredClone(prototype.spec),
      production: null, years: 0, contract: null, upgrades: [],
    }]
    : career.adopted
  return { ...career, reputation, adopted, outcome: { entered: prototypeNo, bids, place, won, designation, standing } }
}


// Names the roll that gives each tank in service its own luck.
const SERVICE_LUCK = 92

/** The luck of one adopted tank's years in service. */
export function serviceSeed(career: Career, index: number): number {
  return hash32(career.seed, SERVICE_LUCK, index)
}

function adoptedAt(career: Career, index: number): Adopted {
  const tank = career.adopted[index]
  if (!tank) throw new Error(`no adopted tank ${index}`)
  return tank
}

function withStanding(career: Career, change: Record<Body, number>): { reputation: Record<Body, number>; standing: Record<Body, number> } {
  const reputation = { ...career.reputation }
  const standing = { ...change }
  for (const body of BODIES) {
    const after = clampStanding(career.reputation[body] + change[body])
    standing[body] = after - career.reputation[body]
    reputation[body] = after
  }
  return { reputation, standing }
}

/** What the bureau's choice of rate and quality does to its standing, before the limits are applied. */
export function productionStanding(tank: Adopted, production: Production): Record<Body, number> {
  const rate = SERVICE.rates[production.rate]
  const tender = TENDERS[tank.tender]
  const unitKr = serviceUnitCostKr(buildStatSheet(tank.spec, tender.limits).unitCostKr, production)
  return {
    army: rate.army,
    ministry: rate.ministry + (unitKr > tender.limits.maxUnitCostKr ? SERVICE.overCeilingMinistry : 0),
    pact: 0,
  }
}

/** Sets how an adopted tank is built. It is set once: the line is tooled for it. */
export function startProduction(career: Career, index: number, production: Production): Career {
  const tank = adoptedAt(career, index)
  if (tank.production) throw new Error('production has already started')
  const { reputation } = withStanding(career, productionStanding(tank, production))
  const adopted = career.adopted.map((each, at) => (at === index ? { ...each, production: { ...production } } : each))
  return { ...career, reputation, adopted }
}

/** Years of service still to be reported on. Nought before production starts. */
export function serviceYearsLeft(tank: Adopted): number {
  return tank.production ? Math.max(0, SERVICE.years - tank.years) : 0
}

/** The army's report on one of a tank's years in service, counted from one. Null for a year it has not had. */
export function reportOf(career: Career, index: number, year: number): FieldReport | null {
  const tank = career.adopted[index]
  if (!tank?.production || year < 1 || year > tank.years) return null
  return fieldReport(serviceSpec(tank, year), TENDERS[tank.tender], tank.production, year, serviceSeed(career, index))
}

/**
 * The tank as the army has it in a year of service: the design as adopted,
 * or the last package fitted before that year. With no year, as it is now.
 */
export function serviceSpec(tank: Adopted, year = Infinity): VehicleSpec {
  let spec = tank.spec
  for (const upgrade of tank.upgrades) if (upgrade.afterYear < year) spec = upgrade.spec
  return spec
}

/** What the army calls the tank now: its designation and the letter of its last package. */
export function serviceDesignation(tank: Adopted): string {
  const last = tank.upgrades[tank.upgrades.length - 1]
  return last ? `${tank.designation}${last.letter}` : tank.designation
}

/** Packages the tank can still take. */
export function upgradesLeft(tank: Adopted): number {
  return Math.max(0, SERVICE.upgrade.letters.length - tank.upgrades.length)
}

/**
 * A year of service passes for an adopted tank: the army reports, the
 * bureau's standing moves and its fee on the year's tanks is paid.
 */
export function serviceYear(career: Career, index: number): Career {
  const tank = adoptedAt(career, index)
  if (!tank.production) throw new Error('production has not started')
  if (serviceYearsLeft(tank) === 0) throw new Error('the tank has had all its years')
  const year = tank.years + 1
  const report = fieldReport(serviceSpec(tank), TENDERS[tank.tender], tank.production, year, serviceSeed(career, index))
  const { reputation } = withStanding(career, report.standing)
  // The army opens a contract on what the year showed, if it has none open and the tank has service and room left.
  // A contract still open when the tank's service ends lapses.
  const last = year >= SERVICE.years
  const opens = !tank.contract && !last && upgradesLeft(tank) > 0 ? report.ask : null
  const adopted = career.adopted.map((each, at) => (at === index ? { ...each, years: year, contract: last ? null : opens ?? each.contract } : each))
  return { ...career, reputation, budgetKr: career.budgetKr + report.royaltyKr, adopted }
}

/** What working up a package of this design costs the bureau. */
export function upgradeCostKr(tank: Adopted, spec: VehicleSpec): number {
  const unitKr = buildStatSheet(spec, TENDERS[tank.tender].limits).unitCostKr
  return Math.round((unitKr * SERVICE.upgrade.workUnits) / 1000) * 1000
}

export const UPGRADE_BLOCKS = ['none', 'illegal', 'same', 'fixed', 'mass', 'power', 'ask', 'noMoney'] as const
/** Why a design cannot be fitted as a package. */
export type UpgradeBlock = (typeof UPGRADE_BLOCKS)[number]

/** What stops this design being fitted to an adopted tank as its next package, or null when nothing does. */
export function upgradeBlock(career: Career, index: number, spec: VehicleSpec): UpgradeBlock | null {
  const tank = career.adopted[index]
  if (!tank?.contract || upgradesLeft(tank) === 0) return 'none'
  const limits = upgradeLimits(career, tank)
  const now = serviceSpec(tank)
  if (sameTank(now, spec)) return 'same'
  if (fixedPartsChanged(tank.spec, spec).length > 0) return 'fixed'
  const sheet = buildStatSheet(spec, limits)
  if (sheet.massT > massCeilingT(buildStatSheet(tank.spec, limits))) return 'mass'
  if (sheet.growth.coolingHp < 0) return 'power'
  if (sheet.issues.some((issue) => issue.severity === 'error')) return 'illegal'
  if (!askMeasure(tank.contract, buildStatSheet(now, limits), sheet).met) return 'ask'
  if (upgradeCostKr(tank, spec) > career.budgetKr) return 'noMoney'
  return null
}

/**
 * Fits a design to an adopted tank as its next package: the bureau pays to
 * work it up, the ministry pays its fee, and the army's reports from the
 * next year on are of the upgraded tank. Throws when it cannot be fitted:
 * ask `upgradeBlock` first.
 */
export function fitUpgrade(career: Career, index: number, spec: VehicleSpec): Career {
  const block = upgradeBlock(career, index, spec)
  if (block) throw new Error(`package cannot be fitted: ${block}`)
  const tank = adoptedAt(career, index)
  const U = SERVICE.upgrade
  const upgrade: Upgrade = {
    letter: U.letters[tank.upgrades.length]!, afterYear: tank.years, spec: structuredClone(spec), ask: { ...tank.contract! },
  }
  const { reputation } = withStanding(career, { army: U.standing.army, ministry: U.standing.ministry, pact: 0 })
  const adopted = career.adopted.map((each, at) => (at === index ? { ...each, contract: null, upgrades: [...each.upgrades, upgrade] } : each))
  return { ...career, reputation, budgetKr: career.budgetKr - upgradeCostKr(tank, spec) + U.feeKr, adopted }
}
