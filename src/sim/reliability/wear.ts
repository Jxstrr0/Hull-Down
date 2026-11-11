// How parts wear over an endurance run. Each part has a rated load. Within
// it, a part gives trouble now and then, as its reliability says. Over it,
// trouble comes fast. The design office estimate and the endurance run both
// use this one model. Game-level abstractions, not engineering data.
import { CLIMATES, RANGE, RUN_PARTS, type ClimateId, type RunPartId } from '../../data/range'
import { TUNING } from '../../data/tuning'
import { detExp, detLog, detPow } from '../det'

export interface PartWear {
  /** 0..1 chance of getting through the run with no trouble, unstressed. */
  reliability: number
  /** What the part carries: tonnes of tank, or engine horsepower for the cooling to shed. */
  have: number
  /** What it is rated to carry at home. Null for a part with no rated load. */
  rated: number | null
}
export type Wear = Record<RunPartId, PartWear>

export type Leg = (typeof RANGE.endurance.legs)[number]
export type LegId = Leg['id']

export interface LegSpan {
  leg: Leg
  fromKm: number
  toKm: number
}

/** The legs of the run laid end to end. */
export function legSpans(): LegSpan[] {
  const spans: LegSpan[] = []
  let at = 0
  for (const leg of RANGE.endurance.legs) {
    spans.push({ leg, fromKm: at, toKm: at + leg.km })
    at += leg.km
  }
  return spans
}

export function runLengthKm(): number {
  let km = 0
  for (const leg of RANGE.endurance.legs) km += leg.km
  return km
}

/** What a part is rated to carry in a climate. Heat is harder to shed where it is hot. */
export function ratedIn(id: RunPartId, part: PartWear, climate: ClimateId): number | null {
  if (part.rated === null) return null
  return RUN_PARTS[id].heat ? part.rated * CLIMATES[climate].cooling : part.rated
}

/** How hard a leg works a part: its load as a share of its rating. Over 1 is overloaded. */
export function legLoad(id: RunPartId, part: PartWear, leg: Leg, climate: ClimateId): number {
  const works = RUN_PARTS[id].works
  const rated = ratedIn(id, part, climate)
  if (works === null || rated === null) return 0
  return (part.have / rated) * leg[works]
}

/** Share of the run's wear that has built up by a distance. */
function wornBy(km: number): number {
  return detPow(km / runLengthKm(), TUNING.reliability.wearShape)
}

/**
 * Failures to expect from a part between two distances on one leg. The run
 * adds these up and the part fails each time the sum passes a drawn mark.
 */
export function hazardOnLeg(id: RunPartId, part: PartWear, leg: Leg, fromKm: number, toKm: number, climate: ClimateId): number {
  const base = part.reliability >= 1 ? 0 : -detLog(part.reliability)
  const over = legLoad(id, part, leg, climate) - 1
  const rate = base + (over > 0 ? over * TUNING.reliability.overloadHazard : 0)
  return rate * (wornBy(toKm) - wornBy(fromKm))
}

/** Chance a part gets through the whole run with no trouble. */
export function survivalOf(id: RunPartId, part: PartWear, climate: ClimateId = RANGE.endurance.climate): number {
  let hazard = 0
  for (const span of legSpans()) hazard += hazardOnLeg(id, part, span.leg, span.fromKm, span.toKm, climate)
  return detExp(-hazard)
}
