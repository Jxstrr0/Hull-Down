// Spot and report: the proving-ground test for a scout car. It drives a
// route of road and open country to three lookout points, watches from each
// for vehicles hidden in the landscape, and drives home to report. It is
// marked on the time it takes, how many it finds, and whether any of them
// saw it first.
// Game-level abstractions, not engineering data.

export interface ScoutTarget {
  /** How far off it is, metres. */
  rangeM: number
  /** How much of it shows through the cover, square metres. */
  areaM2: number
}

export interface ScoutLookout {
  /** The drive to it from the last stop: kilometres of road, then of open country. */
  roadKm: number
  crossKm: number
  /** What is hidden in the landscape in front of it. */
  targets: readonly ScoutTarget[]
}

export interface ScoutMarks {
  /** Seconds from the start line back to it, at most. */
  timeS: number
  /** Hidden vehicles found, at least. */
  found: number
  /** Hidden vehicles that saw the car before it saw them, at most. */
  seen: number
}

export const SCOUT_TRIAL = {
  /** The share of its top speed on each ground the car holds over the whole route. */
  pace: 0.7,
  lookouts: [
    { roadKm: 8, crossKm: 2, targets: [{ rangeM: 1800, areaM2: 2.2 }, { rangeM: 3200, areaM2: 3.5 }] },
    { roadKm: 4, crossKm: 3, targets: [{ rangeM: 1400, areaM2: 1.2 }, { rangeM: 2600, areaM2: 2 }] },
    { roadKm: 2, crossKm: 3, targets: [{ rangeM: 2200, areaM2: 1.6 }, { rangeM: 3000, areaM2: 2.8 }] },
  ] as readonly ScoutLookout[],
  /** The drive home to report. */
  home: { roadKm: 10, crossKm: 1 },
  /** The longest the car watches from a lookout, seconds. It drives on sooner once it has found everything there. */
  watchS: 180,
  /**
   * The commander's search. On average he finds a target showing one square
   * metre 1000 m off in this many times his time to find a target in the
   * tank shoots. Twice as far takes four times as long; twice as much
   * showing, half. A thermal sight finds them sooner (src/data/gunnery.ts).
   */
  searchPerFindS: 8,
  /** On average a hidden vehicle notices a car showing one square metre over the crest 1000 m off in this many seconds. */
  noticeS: 2000,
  /** The share of the car's width that shows over the crest, with the height the berm test measures. */
  showWidthShare: 0.6,
  /** What the range asks of a car on wheels, until a tender sets its own. */
  marks: { timeS: 3000, found: 5, seen: 0 } satisfies ScoutMarks,
  /** The replay in the report. Only for the picture: the times it shows are the trial's own. */
  replay: {
    /** Seconds of the watches played in each second watched. */
    speed: 8,
    /** Each drive is played as this many seconds of a watch, however long it took: a time-lapse. */
    legS: 40,
    /** The car stays on the crest this long after each watch, so the last find shows, in the same seconds. */
    holdS: 8,
    /** The replay runs on this long after the car is home, in the same seconds. */
    tailS: 16,
    /** The view from a lookout is drawn this far out from the car, metres. */
    viewM: 3400,
    /** The bearing of each hidden vehicle from the car's nose at each lookout, degrees. */
    bearingsDeg: [[-24, 12], [18, -10], [-8, 26]] as readonly (readonly number[])[],
    /** The commander's search sweeps this far either side of straight ahead, degrees, and back again in this many seconds. */
    sweepDeg: 34,
    sweepS: 20,
  },
} as const
