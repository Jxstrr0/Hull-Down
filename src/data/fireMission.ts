// The fire mission: the proving-ground test for a self-propelled gun. An
// observer far forward calls for fire on map grids beyond the hill, and the
// gun gets into action, works out its fire data and drops shells on them.
// Game-level abstractions, not engineering data.
import type { ComputerId } from './parts'

export interface FireMissionTarget {
  /** How far off the grid is, kilometres. */
  rangeKm: number
  /** Which way it lies from the line the gun pulled up on, degrees, right positive. */
  bearingDeg: number
}

export interface FireMissionMarks {
  /** Seconds from halting to the first round landing on the first grid, at most. */
  firstRoundS: number
  /** Rounds fired at each grid in the minute from the first, on average, at least. */
  rpm: number
  /** How far from the middle of the grid the shells land, on average, metres at most. */
  missM: number
}

export const FIRE_MISSION = {
  /** The grids the observer calls for, in turn. */
  targets: [
    { rangeKm: 11, bearingDeg: 25 },
    { rangeKm: 15, bearingDeg: -30 },
    { rangeKm: 19, bearingDeg: 10 },
  ] as readonly FireMissionTarget[],
  /** The gun fires on each grid for this long from its first round, seconds. */
  minuteS: 60,
  /** Getting into action at the first grid: halt, set out the aiming posts and lay on the line, seconds. */
  emplaceS: 60,
  /** Working out the fire data for each grid, seconds, by fire control computer: from tables by hand down to a few key presses. */
  plotS: { none: 90, mechanical: 50, electronic: 25, digital: 10 } satisfies Record<ComputerId, number>,
  /**
   * Error in the fire data for the first round, metres for every kilometre of
   * range, with none of the weather, wear and survey corrected. The fire
   * control computer corrects its share (`uncorrected` in src/data/gunnery.ts).
   */
  dataErrorMPerKm: 30,
  /** Share of that error still left once the observer has seen the first round land and called a correction. */
  observedLeft: 0.3,
  /** How far each shell strays on its own, metres for every kilometre, either way, about two times in three. */
  scatterMPerKm: 2.5,
  /** A howitzer's reach grows with the square of its muzzle speed: a short barrel falls short of the farthest grid. */
  reachSpeedPower: 2,
  /** What the range asks of a self-propelled gun, until a tender sets its own. */
  marks: { firstRoundS: 120, rpm: 3, missM: 80 } satisfies FireMissionMarks,
  /** On the report map, a shell further than this from the middle of the grid is drawn on its edge, metres. */
  plotM: 400,
  /** The replay in the report. Only for the picture: the times it shows are the trial's own. */
  replay: {
    /** Seconds of the mission played in each second watched. */
    speed: 8,
    /** Each shell's flight is drawn for this many seconds of the mission before it lands. */
    trailS: 8,
    /** A burst stays on the close-up of the grid this long, seconds of the mission. */
    burstS: 4,
    /** A grid out of reach is passed over in this long, seconds of the mission. */
    skipS: 10,
    /** The map is drawn this far out from the gun, kilometres. */
    mapKm: 21,
  },
} as const
