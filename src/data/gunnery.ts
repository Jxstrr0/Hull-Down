// Gunnery: what each sight, rangefinder and loader does to a shot, and the
// numbers the range shoots by. Game-level abstractions, not engineering data.
import type { RoundKind } from './ammo'
import type {
  ComfortId, ComputerId, NightSightId, RangefinderId, SightId, StabiliserId, SuspensionId,
} from './parts'

export interface SightGunnery {
  /** How far off the gunner's aim is, halted and by day, in mils (a metre at 1000 m). */
  layMil: number
  /** Seconds to lay the gun on a target. */
  layS: number
}

export interface RangefinderGunnery {
  /** How far out the measured range is, as a share of the range. */
  errorShare: number
  /** The error never falls below this, metres. */
  minErrorM: number
  /** Seconds to take a range. */
  rangeS: number
  /** The error grows by this much at night. */
  nightFactor: number
}

export interface StabiliserGunnery {
  /** True when the tank has to stop to shoot. */
  halts: boolean
  /** Aim lost across the target when shooting on the move, mils. With `halts`, the rocking left after the stop. */
  acrossMil: number
  /** Aim lost up and down when shooting on the move, mils. */
  upMil: number
  /** Seconds added to the first shot when the tank is moving. */
  moveS: number
  /** Seconds to bring the gun back on after each shot. */
  relayS: number
}

export interface ComputerGunnery {
  /** Share of the wind, tilt and barrel wear that goes uncorrected. */
  uncorrected: number
  /** Seconds to set the range and the round on the gun. */
  setS: number
}

export interface NightGunnery {
  /** How far the gunner can pick out a target at night, metres. */
  seeM: number
  /** Aiming is this much rougher, and slower, at night. */
  layFactor: number
}

export interface Crew {
  /** Multiplier on aiming and ranging error. */
  aim: number
  /** Multiplier on every time: finding, ranging, laying, loading by hand. */
  pace: number
}

/** Who is in the tank. The proving ground uses its own trained crew. */
export const CREWS = {
  cadre: { aim: 1, pace: 1 },
  conscript: { aim: 1.3, pace: 1.35 },
} as const satisfies Record<string, Crew>
export type CrewId = keyof typeof CREWS

export const GUNNERY = {
  /** The target board: about a tank seen from the front. */
  target: { widthM: 2.3, heightM: 2.3 },
  /** Ranges the design office quotes hit chance at, metres. */
  rangesM: [500, 1000, 1500, 2000, 2500],
  /** The range the "on the move" and "at night" figures are quoted at. */
  quoteRangeM: 1000,
  /** Share of a round's quoted scatter that is one standard deviation. */
  scatterShare: 0.7,
  /**
   * Rounds slow down in flight: over this many metres a round loses about
   * two thirds of its speed. A dart keeps its speed; a shaped charge does not.
   */
  dragM: { kinetic: 25_000, shaped: 6_000 } satisfies Record<RoundKind, number>,
  /** Wind, tilt and wear push a shot off by this many metres for each second of flight, squared. */
  driftMPerS2: 0.35,
  /** Share of that push that acts up and down; the rest is sideways. */
  driftUpShare: 0.5,
  /** At night the target fades out between the sight's reach and this many times its reach. */
  nightFade: 1.3,

  sights: {
    daySight: { layMil: 0.38, layS: 3.5 },
    improvedDaySight: { layMil: 0.27, layS: 3 },
  } satisfies Record<SightId, SightGunnery>,
  rangefinders: {
    stadiametric: { errorShare: 0.12, minErrorM: 0, rangeS: 8, nightFactor: 1.5 },
    coincidence: { errorShare: 0.035, minErrorM: 0, rangeS: 6, nightFactor: 2 },
    laser: { errorShare: 0.004, minErrorM: 8, rangeS: 1.5, nightFactor: 1 },
  } satisfies Record<RangefinderId, RangefinderGunnery>,
  stabilisers: {
    none: { halts: true, acrossMil: 1, upMil: 1, moveS: 7, relayS: 6 },
    singlePlane: { halts: false, acrossMil: 1.5, upMil: 0.8, moveS: 2.5, relayS: 4.5 },
    twoPlane: { halts: false, acrossMil: 0.6, upMil: 0.6, moveS: 0.8, relayS: 3.5 },
  } satisfies Record<StabiliserId, StabiliserGunnery>,
  computers: {
    none: { uncorrected: 1, setS: 4 },
    mechanical: { uncorrected: 0.55, setS: 2.5 },
    electronic: { uncorrected: 0.15, setS: 1 },
  } satisfies Record<ComputerId, ComputerGunnery>,
  nightSights: {
    none: { seeM: 300, layFactor: 2.5 },
    activeInfrared: { seeM: 800, layFactor: 1.6 },
    imageIntensifier: { seeM: 1300, layFactor: 1.3 },
  } satisfies Record<NightSightId, NightGunnery>,
  /** Seconds for the commander to find a target and put the gunner on it. */
  find: { plainS: 5, ownSightS: 3 },
  /** How much of the rocking on the move reaches the gun. A smoother ride is a steadier gun. */
  ride: { torsionBar: 1, hydropneumatic: 0.7 } satisfies Record<SuspensionId, number>,

  /** A busy crew is a slow crew: each point of workload above the reference adds this share to every time. */
  pace: { referenceWorkload: 50, perPoint: 0.006 },

  loading: {
    /** The long shoot the "kept up" rate of fire is measured over. */
    drillRounds: 20,
    /** A human loader slows by this share for every round he has thrown, for a round of the reference weight. */
    tirePerRound: 0.022,
    referenceRoundT: 0.03,
    /** He never gets slower than this much over his fresh time. */
    tireMax: 1,
    /** A cramped turret tires him sooner. */
    comfort: { basic: 1.2, standard: 1, improved: 0.85 } satisfies Record<ComfortId, number>,
    /** Loading by hand takes this much longer in a moving tank. A machine does not care. */
    movingFactor: 1.35,
    /** Seconds a round when the machine is empty and the crew feeds the gun by hand from the racks. */
    handFeedS: 20,
    /** Share of an autoloader's unreliability that shows up as a jam on any one round. */
    jamShare: 0.12,
    /** Seconds to clear a jam. */
    clearS: 40,
  },
} as const
