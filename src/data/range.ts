// The proving ground: what the ground is like, how the tests are laid out
// and the marks a tank has to reach. Game-level abstractions, not
// engineering data.

export interface Ground {
  /** Drag at a crawl, as a share of the tank's weight. */
  rolling: number
  /** The most the tracks can push before they spin, as a share of the weight on them. */
  grip: number
  /** Ground pressure this ground carries before the tracks sink in, kg/cm². Null for ground that does not give. */
  bearingKgCm2: number | null
}

export const GROUNDS = {
  /** Road and the concrete test strip. */
  hard: { rolling: 0.03, grip: 0.8, bearingKgCm2: null },
  /** Dry, beaten range ground. */
  firm: { rolling: 0.05, grip: 0.7, bearingKgCm2: null },
  /** The mud pit. */
  mud: { rolling: 0.1, grip: 0.5, bearingKgCm2: 0.9 },
} as const satisfies Record<string, Ground>
export type GroundId = keyof typeof GROUNDS

export const OBSTACLES = ['trench', 'step', 'mud', 'slope'] as const
export type ObstacleId = (typeof OBSTACLES)[number]

export interface Climate {
  /** Share of its home rating a cooling system manages here. */
  cooling: number
}

export const CLIMATES = {
  /** Tarnovia and its neighbours. Parts are rated for this. */
  temperate: { cooling: 1 },
  /** A hot export range. */
  desert: { cooling: 0.85 },
} as const satisfies Record<string, Climate>
export type ClimateId = keyof typeof CLIMATES

export interface RunPart {
  /** What works the part: `drive` is pulling the tank along, `ride` is the pounding from the ground. Null for a part with no rated load. */
  works: 'drive' | 'ride' | null
  /** True when the rating is a cooling rating, which falls in a hot climate. */
  heat: boolean
  /** True when breaking it while overloaded ends the run. The others are mended at the roadside. */
  wrecks: boolean
  /** Hours the crew takes to mend it. */
  repairH: number
}

/** The parts an endurance run wears, in the order the range inspects them. */
export const RUN_PARTS = {
  engine: { works: 'drive', heat: true, wrecks: true, repairH: 3 },
  cooling: { works: null, heat: false, wrecks: false, repairH: 1 },
  transmission: { works: 'drive', heat: false, wrecks: true, repairH: 4 },
  suspension: { works: 'ride', heat: false, wrecks: false, repairH: 2 },
  tracks: { works: 'ride', heat: false, wrecks: false, repairH: 0.75 },
} as const satisfies Record<string, RunPart>
export type RunPartId = keyof typeof RUN_PARTS
export const RUN_PART_IDS = Object.keys(RUN_PARTS) as RunPartId[]

export const RANGE = {
  /** The sim's fixed time step, seconds. */
  stepS: 0.05,
  /** One point of the recorded run is kept for every so many steps. */
  traceEvery: 2,
  soft: {
    /** Extra drag at the bearing pressure, as a share of weight. It grows with (pressure / bearing) to the power below. */
    sinkDrag: 0.25,
    sinkDragPower: 4,
    /** How deep the tracks sit at the bearing pressure, metres. Grows with the square of (pressure / bearing). */
    sinkM: 0.3,
    /** Extra drag once the belly is on the ground. */
    bellyDrag: 0.3,
    /** Distance over which the tracks settle to their full depth, metres. */
    settleM: 5,
  },
  acceleration: {
    ground: 'hard',
    stripM: 1500,
    /** The test is called off after this long. */
    maxS: 120,
    /** The speed the standing-start time is measured to. */
    sprintKmh: 32,
  },
  course: {
    ground: 'firm',
    /** Flat run before each obstacle and after the last, metres. */
    runUpM: 15,
    /** The speed the driver takes each obstacle at, km/h. */
    approachKmh: { trench: 8, step: 4, mud: 15, slope: 6 },
    trench: { widthM: 2.7 },
    /** `spanM` is the ground the tank covers getting over it. */
    step: { heightM: 0.8, spanM: 4 },
    mud: { lengthM: 30 },
    slope: { angleDeg: 30, lengthM: 25 },
    /** A tank that has not moved for this long is stuck. */
    stuckS: 2,
    /** Slower than this counts as not moving, metres a second. */
    stuckMs: 0.02,
    /** Time the range tractor takes to pull a stuck tank clear. */
    recoverS: 3,
    /** An obstacle not cleared in this time is failed. */
    timeoutS: 90,
  },
  endurance: {
    climate: 'temperate',
    /** The run is worked out a stretch at a time, this long. Each leg is a whole number of them. */
    stepKm: 1,
    /**
     * The legs, in order. `drive` and `ride` are how hard the leg works a part,
     * as a share of the load it is rated for: a part at its rating is safe on
     * every leg. `pace` is the share of its top speed on that ground the tank holds.
     */
    legs: [
      { id: 'road', km: 90, ground: 'hard', drive: 0.75, ride: 0.7, pace: 0.8 },
      { id: 'tracks', km: 110, ground: 'firm', drive: 0.85, ride: 0.85, pace: 0.65 },
      { id: 'hills', km: 50, ground: 'firm', drive: 1, ride: 0.85, pace: 0.35 },
      { id: 'rough', km: 50, ground: 'firm', drive: 0.9, ride: 1, pace: 0.4 },
    ],
  },
  gunnery: {
    /** Rounds the crew may fire at each target. */
    shotsPerTarget: 2,
    /**
     * A gunner who watches a shot fall corrects for it: this share of a
     * misread range, and of the wind, is still left for the next shot.
     */
    correction: 0.35,
    /** Shots further than this from the middle of the board are drawn on its edge, metres. */
    plotM: 3.5,
    /**
     * Share of a turret part's unreliability that shows up as a failure in any
     * one shoot. The crew then falls back on the plainest way of doing its job.
     */
    faultShare: 0.35,
    /** The firing tests, in the order the range runs them. `exposureS` is how long each target stays up. */
    tests: {
      halted: {
        moving: false, night: false, exposureS: 45,
        targets: [
          { rangeM: 800, load: 'shaped' },
          { rangeM: 1200, load: 'kinetic' },
          { rangeM: 1500, load: 'shaped' },
          { rangeM: 1800, load: 'kinetic' },
          { rangeM: 2100, load: 'kinetic' },
          { rangeM: 2400, load: 'kinetic' },
        ],
      },
      onTheMove: {
        moving: true, night: false, exposureS: 30,
        targets: [
          { rangeM: 600, load: 'kinetic' },
          { rangeM: 900, load: 'kinetic' },
          { rangeM: 1200, load: 'kinetic' },
          { rangeM: 1500, load: 'kinetic' },
        ],
      },
      night: {
        moving: false, night: true, exposureS: 45,
        targets: [
          { rangeM: 400, load: 'kinetic' },
          { rangeM: 600, load: 'kinetic' },
          { rangeM: 800, load: 'kinetic' },
          { rangeM: 1000, load: 'kinetic' },
          { rangeM: 1200, load: 'kinetic' },
        ],
      },
    },
  },
} as const

export type GunneryTestId = keyof typeof RANGE.gunnery.tests
export const GUNNERY_TEST_IDS = Object.keys(RANGE.gunnery.tests) as GunneryTestId[]

/** What the Pact asks of a generation-one tank. A tender sets its own marks later. */
export const MARKS_GEN1 = {
  /** Standing start to the sprint speed, seconds at most. */
  sprintS: 12,
  /** Speed held on the strip, km/h at least. */
  topKmh: 50,
  /** Stops for repairs on the endurance run, at most. */
  enduranceStops: 1,
  /** Targets hit in each firing test, at least. */
  hits: { halted: 4, onTheMove: 3, night: 3 },
  /** Seconds from a target showing to the first shot, halted and by day, on average, at most. */
  firstShotS: 21,
  /** Rounds a minute kept up through the loading drill, at least. */
  drillRpm: 3.7,
} as const
export type Marks = {
  sprintS: number
  topKmh: number
  enduranceStops: number
  hits: Record<GunneryTestId, number>
  firstShotS: number
  drillRpm: number
}
