// The crew: who sits where, and what work the design gives each of them.
// Game-level abstractions, not engineering data.
import type { ComfortId, RangefinderId, SuspensionId } from './parts'

/** The loader's seat is only there when the gun is loaded by hand. */
export const STATION_IDS = ['commander', 'gunner', 'driver', 'loader'] as const
export type StationId = (typeof STATION_IDS)[number]

/** Where a station's work comes from. */
export const WORK_SOURCES = [
  'noLoader', 'commanderSight', 'rangefinder', 'sight', 'stabiliser', 'computer', 'night', 'transmission', 'rounds', 'comfort',
] as const
export type WorkSource = (typeof WORK_SOURCES)[number]

/** Where a tank's comfort comes from. */
export const COMFORT_SOURCES = ['fittings', 'ride', 'engine'] as const
export type ComfortSource = (typeof COMFORT_SOURCES)[number]

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

  /** How easy the tank is to live in, out of 100. */
  comfort: {
    base: 50,
    /** Room for each crewman, heating and ventilation. */
    fittings: { basic: -15, standard: 0, improved: 15 } satisfies Record<ComfortId, number>,
    /** A smoother ride shakes the crew less. */
    ride: { torsionBar: 0, hydropneumatic: 10 } satisfies Record<SuspensionId, number>,
    /** An engine at the front puts its heat and noise beside the driver. */
    engineAtFront: -6,
    min: 0,
    max: 100,
  },

  /**
   * Fatigue runs from 0 (fresh) to 1 (worn out) and builds with hours in the
   * tank. A busy station and an uncomfortable tank both tire a crewman sooner.
   */
  fatigue: {
    /** Fatigue an hour at a station of the reference workload, in a tank of middling comfort. */
    perHour: 0.03,
    referenceWorkload: 50,
    referenceComfort: 50,
    /** Each point of workload over the reference tires him this share faster. */
    perWorkloadPoint: 0.02,
    /** Each point of comfort under the reference tires him this share faster. */
    perComfortPoint: 0.015,
    /** However easy the station and the tank, he tires at least this share as fast as the reference. */
    leastShare: 0.25,
    /** A crewman worn right out takes this share longer over every job. */
    slowAtFull: 0.3,
  },
} as const
