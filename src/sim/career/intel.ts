// The intelligence file on an Accord tank: what the bureau is told of it,
// and how sure the telling is. The tank itself never changes; the file
// closes in on it as prototypes are built and tenders pass.
import { THREATS } from '../../data/ammo'
import { INTEL, INTEL_FACTS, INTEL_GRADES, type IntelFact, type IntelGrade } from '../../data/intel'
import { ACCORD_LIMITS, THREAT_TANK_IDS, THREAT_TANKS, type ThreatTankId } from '../../data/opponents'
import { TENDER_IDS, TENDERS } from '../../data/tenders'
import { unit } from '../rng'
import { penetrationAt } from '../vehicle/protection'
import { buildStatSheet } from '../vehicle/stats'
import type { Career } from './career'

// Names the roll that sets where the truth sits in each figure's range.
const INTEL_LUCK = 93

export interface IntelFigure {
  fact: IntelFact
  /** The least and the most the figure is thought to be. The same once the file is confirmed. */
  low: number
  high: number
}

export interface IntelFile {
  threat: ThreatTankId
  grade: IntelGrade
  figures: IntelFigure[]
}

/** The tank as it truly is. */
export function trueFigures(threat: ThreatTankId): Record<IntelFact, number> {
  const tank = THREAT_TANKS[threat]
  const sheet = buildStatSheet(tank.spec, ACCORD_LIMITS)
  return {
    gunMm: penetrationAt(THREATS[tank.rounds[0]!], INTEL.gunRangeM),
    glacisMm: sheet.protection.upperGlacis.keMm,
    turretMm: Math.min(sheet.protection.turretFrontLeft.keMm, sheet.protection.turretFrontRight.keMm),
    massT: sheet.massT,
    speedKmh: sheet.mobility.topSpeedKmh,
  }
}

/** The tender that first names the tank, counting from nought. Null when none does. */
function firstMet(threat: ThreatTankId): number | null {
  const at = TENDER_IDS.findIndex((id) => TENDERS[id].threats.includes(threat))
  return at < 0 ? null : at
}

/** How good the bureau's file on a tank is now. Null when it has not met the tank yet. */
export function intelGrade(career: Career, threat: ThreatTankId): IntelGrade | null {
  const met = firstMet(threat)
  if (met === null || met > career.tenderNo) return null
  const since = career.tenderNo - met
  // Time in tenders gone by is counted whole; in this one, by the prototypes built and the decision.
  const now = TENDERS[TENDER_IDS[career.tenderNo]!].threats.includes(threat)
    ? career.prototypes.length * INTEL.perPrototype + (career.outcome ? INTEL.decided : 0)
    : 0
  const level = INTEL.first[threat] + since * INTEL.perTender + now
  return INTEL_GRADES[Math.min(INTEL_GRADES.length - 1, level)]!
}

/** The bureau's file on a tank, or null when it has none. The truth is always inside every range. */
export function intelFile(career: Career, threat: ThreatTankId): IntelFile | null {
  const grade = intelGrade(career, threat)
  if (!grade) return null
  const truth = trueFigures(threat)
  const spread = INTEL.spread[grade]
  const index = THREAT_TANK_IDS.indexOf(threat)
  const figures = INTEL_FACTS.map((fact, at): IntelFigure => {
    const step = INTEL.round[fact]
    const real = truth[fact]
    // The middle of the range is off the truth by a share of the spread that never changes, so the range closes in steadily.
    const lean = (unit(career.seed, INTEL_LUCK, index, at) * 2 - 1) * INTEL.offCentre
    const middle = real * (1 + lean * spread)
    const near = Math.round(real / step) * step
    if (spread === 0) return { fact, low: near, high: near }
    const low = Math.min(Math.floor((middle - real * spread) / step) * step, near)
    const high = Math.max(Math.ceil((middle + real * spread) / step) * step, near)
    return { fact, low, high }
  })
  return { threat, grade, figures }
}

/** The files on the tanks this tender expects to meet. */
export function intelFiles(career: Career): IntelFile[] {
  const tender = TENDERS[TENDER_IDS[Math.min(career.tenderNo, TENDER_IDS.length - 1)]!]
  return tender.threats.flatMap((threat) => intelFile(career, threat) ?? [])
}
