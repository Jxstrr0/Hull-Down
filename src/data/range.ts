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
} as const

/** What the Pact asks of a generation-one tank. A tender sets its own marks later. */
export const MARKS_GEN1 = {
  /** Standing start to the sprint speed, seconds at most. */
  sprintS: 12,
  /** Speed held on the strip, km/h at least. */
  topKmh: 50,
} as const
export type Marks = { sprintS: number; topKmh: number }
