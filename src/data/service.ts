// Service life: how a tank the army has adopted is built, and what the
// army makes of it once conscripts are driving it. Game-level numbers.
import type { BattleGroundId } from './battle'
import type { CrewId } from './gunnery'

export const BUILD_RATES = ['slow', 'steady', 'rush'] as const
/** How fast the factory turns the tank out. */
export type BuildRate = (typeof BUILD_RATES)[number]

export const BUILD_QUALITIES = ['economy', 'standard', 'careful'] as const
/** How much care, and money, goes into each one. */
export type BuildQuality = (typeof BUILD_QUALITIES)[number]

export interface Production {
  rate: BuildRate
  quality: BuildQuality
}

export const SERVICE = {
  /**
   * The build rate. `cost` multiplies the unit cost: a slow line carries its
   * overheads on few tanks. `faults` multiplies how often parts give trouble:
   * a hurried line makes mistakes. `army` and `ministry` are what each thinks
   * of how soon the tanks arrive, in standing, when production starts.
   */
  rates: {
    slow: { tanksAYear: 60, cost: 1.06, faults: 0.9, army: -2, ministry: -2 },
    steady: { tanksAYear: 120, cost: 1, faults: 1, army: 0, ministry: 0 },
    rush: { tanksAYear: 200, cost: 0.97, faults: 1.3, army: 2, ministry: 2 },
  } satisfies Record<BuildRate, { tanksAYear: number; cost: number; faults: number; army: number; ministry: number }>,
  /** The quality level: cheaper parts and less inspection, or dearer and more. */
  qualities: {
    economy: { cost: 0.9, faults: 1.5 },
    standard: { cost: 1, faults: 1 },
    careful: { cost: 1.12, faults: 0.65 },
  } satisfies Record<BuildQuality, { cost: number; faults: number }>,
  defaultProduction: { rate: 'steady', quality: 'standard' } satisfies Production,
  /** The ministry thinks this much less of the bureau when the tank as built costs more than the tender's ceiling. */
  overCeilingMinistry: -3,
  /** The army's order. The line stops when it is filled. */
  orderTanks: 600,
  /** The bureau's fee on every tank built, as a share of its cost. */
  royaltyShare: 0.01,
  /** Field reports a tank gets: one for each year followed. */
  years: 6,
  /** With no loader there are three to do the work of four on the tank park: parts give trouble this much more often. */
  threeMenFaults: 1.15,
  /** Each year after the first the fleet is older, and gives trouble this much more often. */
  ageingFaults: 0.06,
  /** Who crews the tank at home, and who crews the tanks it meets on exercise. */
  crew: 'conscript' as CrewId,
  opposingCrew: 'cadre' as CrewId,
  /** The year's running: this many tanks are followed, each over the distance of the endurance run. */
  running: {
    tanks: 40,
    /** At or under this many stops a tank, with none towed in, the army is pleased. */
    goodStops: 0.2,
    /** At or over this many stops a tank, or this share towed in, it is not. */
    badStops: 0.6,
    badTowedShare: 0.15,
    army: { good: 1, bad: -2 },
    ministry: { bad: -1 },
  },
  /** What the crews complain of. */
  complaints: {
    /** A station at or over this workload is too much for a conscript. */
    workload: 62,
    /** A tank at or under this comfort is one they hate living in. */
    comfort: 40,
    /** Conscripts hitting under this share of what the range's crew hits: the tank needs experts. */
    conscriptShare: 0.7,
    /** With this many complaints or more the army thinks less of the tank. Three men for the upkeep is noted, not counted. */
    many: 2,
    army: -1,
  },
  /** The year's exercise: a platoon against the tanks it is expected to meet, on a different ground each year. */
  exercise: {
    grounds: ['defend', 'meeting', 'advance', 'night'] satisfies BattleGroundId[],
    battles: 6,
    /** Lessons the report names. */
    lessons: 2,
    army: { won: 1, lost: -1 },
  },
  /**
   * Upgrade contracts: a package fitted to the tanks already built, inside
   * the weight, room and cooling the design had to spare when it was adopted.
   */
  upgrade: {
    /** Packages one tank can take in its service life, and the letter each adds to its designation. */
    letters: ['A', 'B', 'C'],
    /** What cannot be changed on a tank that is already built: the hull, the turret, the gun and what they are built round. */
    fixed: [
      'hull.size', 'hull.glacisAngleDeg', 'hull.engineAt', 'turret.shape', 'turret.ringMm', 'gun', 'loading',
      'runningGear.suspension', 'runningGear.roadWheels', 'powerpack.cooling',
    ],
    /** Working the package up and proving it costs this many of the tank. */
    workUnits: 1,
    /** What the ministry pays for a package the army accepts. */
    feeKr: 4_000_000,
    standing: { army: 3, ministry: 1 },
    /** What each kind of contract asks for, at least. */
    asks: {
      /** Points on the reliability figure. */
      reliability: 4,
      /** Share more protection on the plate named, against kinetic rounds. */
      protection: 0.1,
      /** Share off the time to the first shot. */
      firstShot: 0.1,
      /** Points off the workload of the busiest station. */
      workload: 4,
      /** Points on comfort. */
      comfort: 10,
    },
  },
} as const

export type FixedPart = (typeof SERVICE.upgrade.fixed)[number]
