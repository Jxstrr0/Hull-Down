// Intelligence files on the Accord's tanks. An early file is an estimate
// with wide ranges; it sharpens as time passes. Game-level numbers.
import type { ThreatTankId } from './opponents'

/** How good a file is, worst first. */
export const INTEL_GRADES = ['rumour', 'report', 'assessed', 'confirmed'] as const
export type IntelGrade = (typeof INTEL_GRADES)[number]

/** What a file gives a figure for. */
export const INTEL_FACTS = ['gunMm', 'glacisMm', 'turretMm', 'massT', 'speedKmh'] as const
export type IntelFact = (typeof INTEL_FACTS)[number]

export const INTEL = {
  /** How wide a figure's range is at each grade, as a share of the true figure either way. */
  spread: { rumour: 0.25, report: 0.12, assessed: 0.05, confirmed: 0 } satisfies Record<IntelGrade, number>,
  /** The grade of the file when the bureau first meets the tank, as a place in the list of grades. */
  first: { warden: 3, palisade: 0, palisadeB: 0 } satisfies Record<ThreatTankId, number>,
  /** Grades gained for each prototype the bureau builds (that is time passing), and when the army decides. */
  perPrototype: 1,
  decided: 1,
  /** Grades gained for each tender since the bureau first met the tank. */
  perTender: 2,
  /** How far off centre the true figure can sit in its range, 0 (always the middle) to 1 (anywhere). */
  offCentre: 0.7,
  /** The range the gun's figure is given at, metres. */
  gunRangeM: 2000,
  /** Figures are given to the nearest of these. */
  round: { gunMm: 10, glacisMm: 10, turretMm: 10, massT: 1, speedKmh: 1 } satisfies Record<IntelFact, number>,
} as const
