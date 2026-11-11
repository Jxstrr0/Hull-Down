// Turns anything read from a save into a career the game can trust. Numbers
// are pulled into range, designs are cleaned part by part, and a decision
// that does not add up is dropped, so the army simply decides again.
import { BODIES, CAREER, type Body } from '../data/career'
import { BUREAU_IDS } from '../data/opponents'
import { SCORE_AXES, TENDER_IDS, TENDER_RULES, TENDERS, type ScoreAxis } from '../data/tenders'
import { CAREER_FORMAT, type BidLine, type Bidder, type Career, type Outcome, type Prototype } from '../sim/career/career'
import { cleanName, cleanSpec } from './specCodec'

const MAX_PROTOTYPES = 1 + TENDER_RULES.revisions + CAREER.extraRevisions
const MAX_ADOPTED = 60
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

function cleanAdopted(raw: unknown): Career['adopted'] {
  if (!Array.isArray(raw)) return []
  const kept: Career['adopted'] = []
  for (const item of raw as unknown[]) {
    if (kept.length >= MAX_ADOPTED) break
    if (!isObject(item) || !isObject(item.spec)) continue
    const designation = cleanName(item.designation)
    if (!designation) continue
    const spec = cleanSpec(item.spec)
    kept.push({ designation, name: spec.name, year: whole(item.year, 1900, 2200, TENDERS[TENDER_IDS[0]].year), spec })
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
  return {
    format: CAREER_FORMAT,
    seed: raw.seed >>> 0,
    tenderNo: whole(raw.tenderNo, 0, TENDER_IDS.length - 1, 0),
    budgetKr: whole(raw.budgetKr, 0, 1e12, 0),
    reputation,
    prototypes,
    outcome: cleanOutcome(raw.outcome, prototypes),
    adopted: cleanAdopted(raw.adopted),
  }
}
