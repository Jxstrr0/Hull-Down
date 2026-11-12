// Turns anything read from a save into a career the game can trust. Numbers
// are pulled into range, designs are cleaned part by part, and a decision
// that does not add up is dropped, so the army simply decides again.
import { BODIES, CAREER, type Body } from '../data/career'
import { CUSTOMER_IDS } from '../data/export'
import { ZONES } from '../data/materials'
import { BUREAU_IDS } from '../data/opponents'
import { RUN_PART_IDS } from '../data/range'
import { RESEARCH_IDS } from '../data/research'
import { BUILD_QUALITIES, BUILD_RATES, SERVICE, type Production } from '../data/service'
import { SCORE_AXES, TENDER_IDS, TENDER_RULES, TENDERS, type ScoreAxis } from '../data/tenders'
import { CAREER_FORMAT, TRIAL_VERDICTS, type BidLine, type ExportTrial, type Bidder, type Career, type Outcome, type Prototype, type Sale } from '../sim/career/career'
import { UPGRADE_ASK_KINDS, type Upgrade, type UpgradeAsk } from '../sim/career/upgrade'
import { cleanName, cleanSpec } from './specCodec'

const MAX_PROTOTYPES = 1 + TENDER_RULES.revisions + CAREER.extraRevisions
const MAX_ADOPTED = 60
/** The first career format with the tank destroyer tender of 1991 in second place. */
const FIRST_WITH_DESTROYER = 2
const BIDDERS: readonly Bidder[] = ['bureau', ...BUREAU_IDS]

function isObject(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
}

function finite(raw: unknown): raw is number {
  return typeof raw === 'number' && Number.isFinite(raw)
}

function whole(raw: unknown, min: number, max: number, fallback: number): number {
  return finite(raw) ? Math.min(max, Math.max(min, Math.round(raw))) : fallback
}

function cleanPrototypes(raw: unknown): Prototype[] {
  if (!Array.isArray(raw)) return []
  const kept: Prototype[] = []
  for (const item of raw as unknown[]) {
    if (kept.length >= MAX_PROTOTYPES) break
    if (!isObject(item) || !isObject(item.spec)) continue
    // Prototypes are numbered in the order they were built, whatever the save says.
    kept.push({ no: kept.length + 1, spec: cleanSpec(item.spec), costKr: whole(item.costKr, 0, 1e12, 0) })
  }
  return kept
}

function cleanLine(raw: unknown): BidLine | null {
  if (!isObject(raw) || !BIDDERS.includes(raw.who as Bidder) || !isObject(raw.axes)) return null
  const axes = {} as Record<ScoreAxis, number>
  for (const axis of SCORE_AXES) {
    const marks = raw.axes[axis]
    if (!finite(marks)) return null
    axes[axis] = Math.min(100, Math.max(0, marks))
  }
  if (!finite(raw.total) || !finite(raw.unitCostKr) || typeof raw.legal !== 'boolean') return null
  return {
    who: raw.who as Bidder,
    legal: raw.legal,
    axes,
    failed: whole(raw.failed, 0, 99, 0),
    total: Math.min(100, Math.max(0, raw.total)),
    unitCostKr: Math.max(0, raw.unitCostKr),
    revisions: whole(raw.revisions, 0, MAX_PROTOTYPES, 0),
  }
}

/** A decision is kept only whole: every bidder once, the bureau where it says, a prototype that exists. */
function cleanOutcome(raw: unknown, prototypes: Prototype[]): Outcome | null {
  if (!isObject(raw) || !Array.isArray(raw.bids) || !isObject(raw.standing)) return null
  const bids: BidLine[] = []
  for (const item of raw.bids as unknown[]) {
    const line = cleanLine(item)
    if (!line || bids.some((each) => each.who === line.who)) return null
    bids.push(line)
  }
  if (bids.length !== BIDDERS.length) return null
  const place = bids.findIndex((each) => each.who === 'bureau') + 1
  if (raw.place !== place) return null
  if (!finite(raw.entered) || !prototypes.some((each) => each.no === raw.entered)) return null
  const won = place === 1 && bids[0]!.legal
  if (raw.won !== won) return null
  const designation = typeof raw.designation === 'string' ? cleanName(raw.designation) : ''
  if (won !== (designation !== '')) return null
  const standing = {} as Record<Body, number>
  for (const body of BODIES) standing[body] = whole(raw.standing[body], -100, 100, 0)
  return { entered: raw.entered, bids, place, won, designation: won ? designation : null, standing }
}

/** How a tank is built, or null when the save does not say. */
function cleanProduction(raw: unknown): Production | null {
  if (!isObject(raw)) return null
  const rate = BUILD_RATES.find((id) => id === raw.rate)
  const quality = BUILD_QUALITIES.find((id) => id === raw.quality)
  return rate && quality ? { rate, quality } : null
}

function cleanAsk(raw: unknown): UpgradeAsk | null {
  if (!isObject(raw)) return null
  const kind = UPGRADE_ASK_KINDS.find((id) => id === raw.kind)
  if (!kind) return null
  if (kind !== 'protection') return { kind }
  const zone = ZONES.find((id) => id === raw.zone)
  return zone ? { kind, zone } : null
}

/** Packages are lettered in the order they were fitted, and none is fitted after a year the tank has not had. */
function cleanUpgrades(raw: unknown, years: number): Upgrade[] {
  if (!Array.isArray(raw)) return []
  const kept: Upgrade[] = []
  let after = 0
  for (const item of raw as unknown[]) {
    const letter = SERVICE.upgrade.letters[kept.length]
    if (!letter) break
    if (!isObject(item) || !isObject(item.spec)) continue
    const ask = cleanAsk(item.ask)
    if (!ask) continue
    after = whole(item.afterYear, after, years, after)
    kept.push({ letter, afterYear: after, spec: cleanSpec(item.spec), ask })
  }
  return kept
}

function cleanAdopted(raw: unknown): Career['adopted'] {
  if (!Array.isArray(raw)) return []
  const kept: Career['adopted'] = []
  for (const item of raw as unknown[]) {
    if (kept.length >= MAX_ADOPTED) break
    if (!isObject(item) || !isObject(item.spec)) continue
    const designation = cleanName(item.designation)
    if (!designation) continue
    const spec = cleanSpec(item.spec)
    const tender = TENDER_IDS.find((id) => id === item.tender) ?? TENDER_IDS[0]
    const production = cleanProduction(item.production)
    kept.push({
      designation, name: spec.name, year: whole(item.year, 1900, 2200, TENDERS[tender].year), tender, spec,
      production, years: production ? whole(item.years, 0, SERVICE.years, 0) : 0, contract: null, upgrades: [],
    })
    const tank = kept[kept.length - 1]!
    tank.upgrades = cleanUpgrades(item.upgrades, tank.years)
    // A contract is open only on a tank with service and room for a package left.
    if (production && tank.years < SERVICE.years && tank.upgrades.length < SERVICE.upgrade.letters.length) tank.contract = cleanAsk(item.contract)
  }
  return kept
}

function cleanTrial(raw: unknown): ExportTrial | null {
  if (!isObject(raw)) return null
  const verdict = TRIAL_VERDICTS.find((each) => each === raw.verdict)
  const tanks = whole(raw.tanks, 0, 1000, 0)
  if (!verdict || tanks === 0) return null
  return {
    tanks, stops: whole(raw.stops, 0, 100_000, 0), towed: whole(raw.towed, 0, tanks, 0),
    worst: RUN_PART_IDS.find((id) => id === raw.worst) ?? null, verdict,
  }
}

/** Each customer orders once. An order with no tank named, or no tanks, is dropped. */
function cleanSales(raw: unknown): Sale[] {
  if (!Array.isArray(raw)) return []
  const kept: Sale[] = []
  for (const item of raw as unknown[]) {
    if (!isObject(item)) continue
    const customer = CUSTOMER_IDS.find((id) => id === item.customer)
    const designation = cleanName(item.designation)
    const tanks = whole(item.tanks, 0, 100_000, 0)
    if (!customer || !designation || tanks === 0 || kept.some((sale) => sale.customer === customer)) continue
    kept.push({ customer, designation, tanks, feeKr: whole(item.feeKr, 0, 1e12, 0), variant: isObject(item.variant) ? cleanSpec(item.variant) : null, trial: cleanTrial(item.trial) })
  }
  return kept
}

/** A career from anything read out of a save, or null when there is no career in it. */
export function cleanCareer(raw: unknown): Career | null {
  if (!isObject(raw) || !finite(raw.seed)) return null
  const R = CAREER.reputation
  const reputation = {} as Record<Body, number>
  const rep = isObject(raw.reputation) ? raw.reputation : {}
  for (const body of BODIES) reputation[body] = whole(rep[body], R.min, R.max, R.start)
  const prototypes = cleanPrototypes(raw.prototypes)
  // Before format two there was no tank destroyer tender of 1991: every tender after the first is one place later now.
  const saved = whole(raw.tenderNo, 0, TENDER_IDS.length - 1, 0)
  const older = whole(raw.format, 0, CAREER_FORMAT, CAREER_FORMAT) < FIRST_WITH_DESTROYER
  return {
    format: CAREER_FORMAT,
    seed: raw.seed >>> 0,
    tenderNo: older && saved > 0 ? Math.min(saved + 1, TENDER_IDS.length - 1) : saved,
    budgetKr: whole(raw.budgetKr, 0, 1e12, 0),
    reputation,
    prototypes,
    outcome: cleanOutcome(raw.outcome, prototypes),
    adopted: cleanAdopted(raw.adopted),
    // Each project once, in the order the save has them.
    researched: Array.isArray(raw.researched)
      ? [...new Set((raw.researched as unknown[]).flatMap((item) => RESEARCH_IDS.filter((id) => id === item)))]
      : [],
    sales: cleanSales(raw.sales),
  }
}
