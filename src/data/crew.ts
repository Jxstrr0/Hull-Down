// The crew: who sits where, and what work the design gives each of them.
// Game-level abstractions, not engineering data.
import type { RangefinderId } from './parts'

/** The loader's seat is only there when the gun is loaded by hand. */
export const STATION_IDS = ['commander', 'gunner', 'driver', 'loader'] as const
export type StationId = (typeof STATION_IDS)[number]

/** Where a station's work comes from. */
export const WORK_SOURCES = [
  'noLoader', 'commanderSight', 'rangefinder', 'sight', 'stabiliser', 'computer', 'night', 'transmission', 'rounds', 'comfort',
] as const
export type WorkSource = (typeof WORK_SOURCES)[number]

export const CREW = {
  /** A station's workload before the design adds to it or takes from it, out of 100. */
  stationBase: 50,
  /** With no loader in the turret his other jobs fall to the commander: the radio, the lookout, the machine gun. */
  noLoader: 12,
  /**
   * Who works each rangefinder. The lines in the sight and the laser are the
   * gunner's. An optical rangefinder runs across the turret roof and is the
   * commander's, so a commander who ranges the gun is slower to find the next target.
   */
  ranging: { stadiametric: 'gunner', coincidence: 'commander', laser: 'gunner' } satisfies Record<RangefinderId, StationId>,
  /** A loader's workload rises by this for every kilogram a round weighs over the reference round. */
  loaderPerRoundKg: 2,
} as const
