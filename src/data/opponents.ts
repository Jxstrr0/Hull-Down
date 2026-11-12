// Who the bureau's tank is measured against: the rival bureaus bidding on
// the same tender, and the Northern Accord tanks it may one day meet.
// A rival's tank is not drawn up here. Each bureau has a way of thinking,
// and a bot designer (src/sim/ai/designer.ts) builds its tank from the same
// parts list and under the same limits as the player's.
// Game-level abstractions, not engineering data.
import type { KineticIssue, ShapedIssue, ThreatId } from './ammo'
import type { MaterialId, ZoneId } from './materials'
import type {
  ActiveId, BarrelId, ComfortId, ComputerId, EngineId, GunId, HullId, LoadingId, NightSightId, RangefinderId, RecoilId,
  SightId, StabiliserId, StowageId, SuspensionId, TurretId,
} from './parts'
import type { Limits, VehicleSpec } from '../sim/vehicle/spec'
import type { Generation } from './tech'

/**
 * What a bureau reaches for, part by part: its first choice, then what it
 * settles for. The designer takes the first that fits, and now and then the
 * second, so no two careers meet quite the same rival.
 */
export interface Picks {
  hull: readonly HullId[]
  turret: readonly TurretId[]
  gun: readonly GunId[]
  barrel: readonly BarrelId[]
  recoil: readonly RecoilId[]
  loading: readonly LoadingId[]
  stowage: readonly StowageId[]
  engine: readonly EngineId[]
  suspension: readonly SuspensionId[]
  sight: readonly SightId[]
  rangefinder: readonly RangefinderId[]
  stabiliser: readonly StabiliserId[]
  computer: readonly ComputerId[]
  night: readonly NightSightId[]
  comfort: readonly ComfortId[]
  commanderSight: readonly boolean[]
  spallLiner: readonly boolean[]
  fireSuppression: readonly boolean[]
}

/**
 * What a bureau moves on to when a later generation of tender allows it.
 * Each part named replaces the bureau's first pick; a material named is
 * laid in place of an older one wherever the bureau's pattern has it.
 */
export interface LaterPicks {
  loading?: LoadingId
  computer?: ComputerId
  night?: NightSightId
  kinetic?: KineticIssue
  shaped?: ShapedIssue
  turret?: TurretId
  active?: ActiveId
  /** True when the bureau fits the auxiliary power unit. */
  apu?: boolean
  /** True when the bureau hangs side skirts against the infantry's rockets. */
  skirts?: boolean
  materials?: Partial<Record<MaterialId, MaterialId>>
}

/** What a bureau builds when the tender is for a self-propelled gun. */
export interface SpgPicks extends LaterPicks {
  /** How much of the weight limit it builds up to: a gun that stays back needs less armour. */
  massShare: number
  rounds: number
}

/**
 * How a self-propelled gun's armour leans, on top of each bureau's own
 * pattern: it is raided by carriers' cannon from the side, not met head on
 * by tank guns, so less goes on the front and more on the sides.
 */
export const SPG_ARMOUR: Partial<Record<ZoneId, number>> = {
  upperGlacis: 0.7, lowerGlacis: 0.7, turretFrontLeft: 0.6, turretFrontRight: 0.6, mantlet: 0.6,
  hullSideFront: 2, hullSideRear: 1.5, turretSides: 1.8,
}

export interface Philosophy {
  picks: Picks
  /** The newer parts the bureau fits from each generation on. */
  later: Partial<Record<Generation, LaterPicks>>
  /** What the bureau fits on top of that when the tender is for a tank destroyer. None: it bids a tank as before. */
  destroyer?: LaterPicks
  /** What the bureau fits when the tender is for a self-propelled gun, in place of its destroyer picks. */
  spg: SpgPicks
  /** How much of the weight limit the bureau builds up to, 0..1. */
  massShare: number
  /**
   * Where the armour goes. Each zone's plates are the baseline's, made
   * thicker or thinner by this much, and then all scaled together until the
   * tank is at its weight.
   */
  armour: Record<ZoneId, number>
  /** Zones that get a full set of reactive tiles. */
  tiles: readonly ZoneId[]
  glacisAngleDeg: number
  rounds: number
  fuelL: number
}

export const BUREAU_IDS = ['heavy', 'light', 'firepower'] as const
export type BureauId = (typeof BUREAU_IDS)[number]

export const DESIGNER = {
  /** Chance that the bureau takes its second choice for any one part. */
  secondChoiceShare: 0.25,
  /** The armour is scaled between these, as a multiple of the bureau's own pattern. */
  armourScale: { min: 0.3, max: 3 },
  /** Halvings of that span before the designer settles. */
  armourSteps: 16,
  /** Turns the designer takes to put right a design that cannot be built. */
  repairTurns: 40,
  /** Each turn short of space puts this many rounds and litres ashore. */
  shedRounds: 2,
  shedFuelL: 100,
  /** A plate that let a round through at trial is made this much thicker, as a share of the bureau's pattern, at the next revision. */
  lessonArmour: 1.15,
} as const

export const BUREAUS = {
  // Heavy and well protected: the weight limit used to the last tonne, and most of it goes on the front.
  heavy: {
    picks: {
      hull: ['medium', 'heavy'],
      turret: ['castDome', 'weldedWedge'],
      gun: ['smooth125', 'smooth115'],
      barrel: ['standard', 'short'],
      recoil: ['standard', 'standard'],
      loading: ['carousel', 'loader'],
      stowage: ['armouredBins', 'wetStowage'],
      engine: ['diesel780', 'multiFuel700'],
      suspension: ['torsionBar', 'torsionBar'],
      sight: ['daySight', 'improvedDaySight'],
      rangefinder: ['coincidence', 'coincidence'],
      stabiliser: ['twoPlane', 'singlePlane'],
      computer: ['mechanical', 'mechanical'],
      night: ['activeInfrared', 'activeInfrared'],
      comfort: ['basic', 'standard'],
      commanderSight: [false, false],
      spallLiner: [true, true],
      fireSuppression: [true, true],
    },
    // By 2000: the new layers at the front, a thermal sight, a warhead for reactive tiles, and side skirts.
    // By 2016: hard kill on the roof, and the auxiliary power unit to feed it.
    later: {
      2: { night: 'thermal', shaped: 'tandem', materials: { compositeInsert: 'layeredComposite' }, skirts: true },
      3: { active: 'hardKill', apu: true },
    },
    // No destroyer picks: asked for a tank destroyer, it bids a well-armoured tank with a turret.
    // For a self-propelled gun: still a turret, the electronic computer, and more armour than the others.
    spg: { computer: 'electronic', massShare: 0.85, rounds: 30 },
    massShare: 1,
    armour: {
      upperGlacis: 1.4, lowerGlacis: 1.3, hullSideFront: 1, hullSideRear: 0.9, hullRear: 0.8, hullRoof: 1, belly: 1,
      turretFrontLeft: 1.4, turretFrontRight: 1.4, mantlet: 1.3, turretSides: 1, turretRear: 0.8, turretRoof: 1,
    },
    tiles: [],
    glacisAngleDeg: 68,
    rounds: 36,
    fuelL: 900,
  },
  // Light and cheap: a small hull, the small engine, plain parts, and tiles where plate would cost weight.
  light: {
    picks: {
      hull: ['light', 'medium'],
      turret: ['lowProfile', 'castDome'],
      gun: ['smooth115', 'rifled100'],
      barrel: ['standard', 'short'],
      recoil: ['standard', 'stiff'],
      loading: ['loader', 'loader'],
      stowage: ['plainRacks', 'wetStowage'],
      engine: ['diesel580', 'diesel780'],
      suspension: ['torsionBar', 'torsionBar'],
      sight: ['daySight', 'daySight'],
      rangefinder: ['stadiametric', 'coincidence'],
      stabiliser: ['singlePlane', 'twoPlane'],
      computer: ['none', 'mechanical'],
      night: ['activeInfrared', 'none'],
      comfort: ['basic', 'basic'],
      commanderSight: [false, false],
      spallLiner: [false, false],
      fireSuppression: [true, false],
    },
    // By 2000: nothing dear. A hand-loaded tank takes the long rod, and the new warhead costs little.
    // By 2016: soft kill, the cheap answer to a missile.
    later: { 2: { kinetic: 'longRod', shaped: 'tandem' }, 3: { active: 'softKill' } },
    // For a tank destroyer: the casemate, cheaper and lighter still.
    destroyer: { turret: 'casemate' },
    // For a self-propelled gun: a cheap casemate, loaded by hand, worked out with the mechanical computer.
    spg: { turret: 'casemate', loading: 'loader', computer: 'mechanical', massShare: 0.6, rounds: 30 },
    massShare: 0.75,
    armour: {
      upperGlacis: 1, lowerGlacis: 0.9, hullSideFront: 0.8, hullSideRear: 0.8, hullRear: 0.9, hullRoof: 1, belly: 1,
      turretFrontLeft: 1, turretFrontRight: 1, mantlet: 1, turretSides: 0.8, turretRear: 0.9, turretRoof: 1,
    },
    tiles: ['upperGlacis', 'turretFrontLeft', 'turretFrontRight'],
    glacisAngleDeg: 70,
    rounds: 40,
    fuelL: 800,
  },
  // Firepower first: the big gun with the long barrel, and the best sights the parts list has.
  firepower: {
    picks: {
      hull: ['medium', 'heavy'],
      turret: ['weldedWedge', 'castDome'],
      gun: ['smooth125', 'smooth125'],
      barrel: ['long', 'standard'],
      recoil: ['standard', 'longStroke'],
      loading: ['carousel', 'carousel'],
      stowage: ['plainRacks', 'wetStowage'],
      engine: ['diesel780', 'turbine1000'],
      suspension: ['torsionBar', 'hydropneumatic'],
      sight: ['improvedDaySight', 'improvedDaySight'],
      rangefinder: ['laser', 'coincidence'],
      stabiliser: ['twoPlane', 'twoPlane'],
      computer: ['electronic', 'mechanical'],
      night: ['imageIntensifier', 'activeInfrared'],
      comfort: ['standard', 'basic'],
      commanderSight: [true, false],
      spallLiner: [false, false],
      fireSuppression: [true, true],
    },
    // By 2000: the digital computer, a thermal sight, and a missile down the barrel.
    // By 2016: the turret with nobody in it, a machine to load it, soft kill, and side skirts.
    later: {
      2: { computer: 'digital', night: 'thermal', shaped: 'gunMissile' },
      3: { turret: 'unmanned', loading: 'carousel', active: 'softKill', skirts: true },
    },
    // For a tank destroyer: the casemate, so the big gun rides on a smaller mount.
    destroyer: { turret: 'casemate' },
    // For a self-propelled gun: a casemate with the carousel and the digital computer, for the quickest first round.
    spg: { turret: 'casemate', loading: 'carousel', computer: 'digital', massShare: 0.8, rounds: 36 },
    massShare: 0.95,
    armour: {
      upperGlacis: 1, lowerGlacis: 1, hullSideFront: 0.9, hullSideRear: 0.9, hullRear: 1, hullRoof: 1, belly: 1,
      turretFrontLeft: 1, turretFrontRight: 1, mantlet: 1.1, turretSides: 0.9, turretRear: 1, turretRoof: 1,
    },
    tiles: [],
    glacisAngleDeg: 66,
    rounds: 42,
    fuelL: 1000,
  },
} as const satisfies Record<BureauId, Philosophy>

/** The Accord builds to its own rules: no bridge class of 44 t, and its own calibres. */
export const ACCORD_LIMITS: Limits = {
  maxMassT: 60,
  maxWidthM: 3.7,
  allowedCalibresMm: [100, 120],
  // The Accord is not held to the Pact's tender years.
  generation: 3,
}

/**
 * A threat tank as the intelligence file has it. It is drawn up from the
 * Pact's own parts list, the nearest part standing in for each Accord one,
 * but it fires Accord rounds.
 */
export interface ThreatTank {
  spec: VehicleSpec
  /** What it fires, the round it reaches for first at the front. */
  rounds: readonly ThreatId[]
  /** The generation of tender that first expects to meet it. */
  generation: Generation
}

const NO_TILES: Record<ZoneId, number> = {
  upperGlacis: 0, lowerGlacis: 0, hullSideFront: 0, hullSideRear: 0, hullRear: 0, hullRoof: 0, belly: 0,
  turretFrontLeft: 0, turretFrontRight: 0, mantlet: 0, turretSides: 0, turretRear: 0, turretRoof: 0,
}

export const THREAT_TANK_IDS = ['warden', 'palisade', 'palisadeB'] as const
export type ThreatTankId = (typeof THREAT_TANK_IDS)[number]

export const THREAT_TANKS: Record<ThreatTankId, ThreatTank> = {
  // The Accord's standard tank: a 105 mm rifled gun, a loader, good sights, steel armour.
  warden: {
    generation: 1,
    rounds: ['accord105Sabot', 'accord105Shaped'],
    spec: {
      name: '',
      hull: { size: 'heavy', glacisAngleDeg: 60, engineAt: 'rear' },
      turret: { shape: 'weldedWedge', ringMm: 2150 },
      // Stands in for the Accord 105 mm gun: about its weight, and loaded by hand at about its rate.
      gun: 'rifled100',
      barrel: 'long',
      recoil: 'standard',
      loading: 'loader',
      ammo: { rounds: 55, stowage: 'plainRacks', kinetic: 'supplied', shaped: 'supplied' },
      fireControl: {
        sight: 'improvedDaySight', rangefinder: 'coincidence', stabiliser: 'twoPlane', computer: 'mechanical',
        night: 'activeInfrared', commanderSight: true,
      },
      powerpack: { engine: 'diesel780', transmission: 'hydro50', cooling: 'standard', fuelL: 1400, apu: false },
      runningGear: { suspension: 'torsionBar', roadWheels: 7, trackWidthMm: 640, skirts: false },
      protection: { smokeLaunchers: true, fireSuppression: true, spallLiner: false, active: 'none' },
      crew: { comfort: 'improved' },
      armour: {
        upperGlacis: [{ material: 'rolledSteel', mm: 110 }],
        lowerGlacis: [{ material: 'rolledSteel', mm: 100 }],
        hullSideFront: [{ material: 'rolledSteel', mm: 70 }],
        hullSideRear: [{ material: 'rolledSteel', mm: 45 }],
        hullRear: [{ material: 'rolledSteel', mm: 35 }],
        hullRoof: [{ material: 'rolledSteel', mm: 30 }],
        belly: [{ material: 'rolledSteel', mm: 20 }],
        turretFrontLeft: [{ material: 'castSteel', mm: 230 }],
        turretFrontRight: [{ material: 'castSteel', mm: 230 }],
        mantlet: [{ material: 'castSteel', mm: 220 }],
        turretSides: [{ material: 'castSteel', mm: 90 }],
        turretRear: [{ material: 'castSteel', mm: 50 }],
        turretRoof: [{ material: 'castSteel', mm: 30 }],
      },
      era: NO_TILES,
    },
  },
  // The tank the Accord is said to be building next: a 120 mm gun behind layered armour, and slow for it.
  palisade: {
    generation: 1,
    rounds: ['accord120Sabot'],
    spec: {
      name: '',
      hull: { size: 'heavy', glacisAngleDeg: 68, engineAt: 'rear' },
      turret: { shape: 'weldedWedge', ringMm: 2250 },
      gun: 'rifled120',
      barrel: 'standard',
      recoil: 'standard',
      loading: 'loader',
      ammo: { rounds: 42, stowage: 'armouredBins', kinetic: 'supplied', shaped: 'supplied' },
      fireControl: {
        sight: 'improvedDaySight', rangefinder: 'laser', stabiliser: 'twoPlane', computer: 'electronic',
        night: 'imageIntensifier', commanderSight: true,
      },
      powerpack: { engine: 'diesel780', transmission: 'hydro50', cooling: 'standard', fuelL: 1000, apu: true },
      runningGear: { suspension: 'hydropneumatic', roadWheels: 7, trackWidthMm: 700, skirts: false },
      protection: { smokeLaunchers: true, fireSuppression: true, spallLiner: true, active: 'none' },
      crew: { comfort: 'improved' },
      armour: {
        upperGlacis: [
          { material: 'rolledSteel', mm: 60 },
          { material: 'compositeInsert', mm: 90 },
          { material: 'rolledSteel', mm: 40 },
        ],
        lowerGlacis: [{ material: 'rolledSteel', mm: 80 }],
        hullSideFront: [{ material: 'rolledSteel', mm: 50 }],
        hullSideRear: [{ material: 'rolledSteel', mm: 35 }],
        hullRear: [{ material: 'rolledSteel', mm: 30 }],
        hullRoof: [{ material: 'rolledSteel', mm: 25 }],
        belly: [{ material: 'rolledSteel', mm: 20 }],
        turretFrontLeft: [
          { material: 'rolledSteel', mm: 100 },
          { material: 'compositeInsert', mm: 150 },
          { material: 'rolledSteel', mm: 100 },
        ],
        turretFrontRight: [
          { material: 'rolledSteel', mm: 100 },
          { material: 'compositeInsert', mm: 150 },
          { material: 'rolledSteel', mm: 100 },
        ],
        mantlet: [{ material: 'castSteel', mm: 260 }],
        turretSides: [{ material: 'rolledSteel', mm: 50 }],
        turretRear: [{ material: 'rolledSteel', mm: 30 }],
        turretRoof: [{ material: 'rolledSteel', mm: 30 }],
      },
      era: NO_TILES,
    },
  },
  // The Palisade as rebuilt around 2000: the long-rod round, a thermal sight, and newer layers at the front.
  palisadeB: {
    generation: 2,
    rounds: ['accord120LongRod'],
    spec: {
      name: '',
      hull: { size: 'heavy', glacisAngleDeg: 68, engineAt: 'rear' },
      turret: { shape: 'weldedWedge', ringMm: 2250 },
      gun: 'rifled120',
      barrel: 'standard',
      recoil: 'standard',
      loading: 'loader',
      ammo: { rounds: 40, stowage: 'armouredBins', kinetic: 'supplied', shaped: 'supplied' },
      fireControl: {
        sight: 'improvedDaySight', rangefinder: 'laser', stabiliser: 'twoPlane', computer: 'digital',
        night: 'thermal', commanderSight: true,
      },
      powerpack: { engine: 'diesel780', transmission: 'hydro50', cooling: 'standard', fuelL: 950, apu: true },
      runningGear: { suspension: 'hydropneumatic', roadWheels: 7, trackWidthMm: 700, skirts: false },
      protection: { smokeLaunchers: true, fireSuppression: true, spallLiner: true, active: 'none' },
      crew: { comfort: 'improved' },
      armour: {
        upperGlacis: [
          { material: 'rolledSteel', mm: 60 },
          { material: 'layeredComposite', mm: 95 },
          { material: 'rolledSteel', mm: 40 },
        ],
        lowerGlacis: [{ material: 'rolledSteel', mm: 70 }],
        hullSideFront: [{ material: 'rolledSteel', mm: 50 }],
        hullSideRear: [{ material: 'rolledSteel', mm: 35 }],
        hullRear: [{ material: 'rolledSteel', mm: 30 }],
        hullRoof: [{ material: 'rolledSteel', mm: 25 }],
        belly: [{ material: 'rolledSteel', mm: 20 }],
        turretFrontLeft: [
          { material: 'rolledSteel', mm: 100 },
          { material: 'layeredComposite', mm: 150 },
          { material: 'rolledSteel', mm: 100 },
        ],
        turretFrontRight: [
          { material: 'rolledSteel', mm: 100 },
          { material: 'layeredComposite', mm: 150 },
          { material: 'rolledSteel', mm: 100 },
        ],
        mantlet: [{ material: 'castSteel', mm: 260 }],
        turretSides: [{ material: 'rolledSteel', mm: 50 }],
        turretRear: [{ material: 'rolledSteel', mm: 30 }],
        turretRoof: [{ material: 'rolledSteel', mm: 30 }],
      },
      era: NO_TILES,
    },
  },
}
