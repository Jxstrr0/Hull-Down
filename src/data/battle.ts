// Platoon battles: three or four tanks a side on a piece of ground with
// ridges to sit behind and woods to hide the far side. The numbers the
// fight runs by, the orders a platoon can be given, and the grounds.
// The gunnery and the crews are the duel's (src/data/duel.ts).
// Game-level abstractions, not engineering data.

/** When a platoon opens fire and how far it closes: at long range, or held until it is close. */
export type RangeOrder = 'long' | 'close'
/** How a platoon moves: from cover to cover and shooting from the halt, or straight on and shooting as it goes. */
export type PaceOrder = 'careful' | 'fast'

export interface Orders {
  range: RangeOrder
  pace: PaceOrder
}

export const RANGE_ORDERS: readonly RangeOrder[] = ['long', 'close']
export const PACE_ORDERS: readonly PaceOrder[] = ['careful', 'fast']

/** A place a tank stands. Metres: x across the ground, y up it. `cover` is a ridge to sit behind. */
export interface Post {
  x: number
  y: number
  cover: boolean
}

/** One tank's places, in the order it takes them. */
export type Lane = readonly Post[]

export interface PlatoonPlan {
  /**
   * `hold`: each tank sits at its first post, with a second to shift to.
   * `attack`: each tank starts at its first post, comes on to the cover
   * (its last post but one) and, ordered to close, on to the last.
   */
  role: 'hold' | 'attack'
  lanes: readonly Lane[]
}

export interface Wood {
  x: number
  y: number
  /** Radius, metres. Nobody sees through it. */
  r: number
}

export interface BattleGround {
  night: boolean
  woods: readonly Wood[]
  /** The platoon under test, which starts at the bottom of the ground, then the one it meets. */
  platoons: readonly [PlatoonPlan, PlatoonPlan]
  /** The orders the other platoon fights by. */
  theirOrders: Orders
}

export const BATTLE_GROUND_IDS = ['defend', 'meeting', 'advance', 'night'] as const
export type BattleGroundId = (typeof BATTLE_GROUND_IDS)[number]

/** The size of the ground, metres. The other platoon's places are the mirror of the first's. */
const WIDTH_M = 2000
const DEPTH_M = 3000

function post(x: number, y: number, cover = false): Post {
  return { x, y, cover }
}

/** The same lanes seen from the far end of the ground. */
function fromTheTop(lanes: readonly Lane[]): Lane[] {
  return lanes.map((lane) => lane.map((p) => ({ ...p, y: DEPTH_M - p.y })))
}

// Three tanks on a ridge, each with a second place along it.
const RIDGE: readonly Lane[] = [
  [post(600, 420, true), post(720, 380, true)],
  [post(1000, 460, true), post(1110, 420, true)],
  [post(1400, 420, true), post(1290, 380, true)],
]

// Four tanks coming down the ground: a start line, a fold to halt behind at
// about 1,500 m from the ridge, and open ground at about 800 m.
const ASSAULT: readonly Lane[] = fromTheTop([
  [post(400, 200), post(450, 1080, true), post(520, 1780)],
  [post(800, 200), post(820, 1120, true), post(860, 1820)],
  [post(1200, 200), post(1180, 1120, true), post(1140, 1820)],
  [post(1600, 200), post(1550, 1080, true), post(1480, 1780)],
])

// Four tanks coming up to a fold in the middle, with the open beyond it.
const MEETING: readonly Lane[] = [
  [post(400, 300), post(430, 1000, true), post(480, 1280)],
  [post(800, 300), post(810, 1030, true), post(840, 1300)],
  [post(1200, 300), post(1190, 1030, true), post(1160, 1300)],
  [post(1600, 300), post(1570, 1000, true), post(1520, 1280)],
]

// Three tanks, close, in the dark.
const NIGHT: readonly Lane[] = [
  [post(600, 700), post(620, 1080, true), post(650, 1250)],
  [post(1000, 700), post(1000, 1110, true), post(1000, 1270)],
  [post(1400, 700), post(1380, 1080, true), post(1350, 1250)],
]

export const BATTLE = {
  field: { widthM: WIDTH_M, depthM: DEPTH_M },
  /** The fight is worked out in steps this long, seconds. */
  stepS: 0.1,
  /** How fast a casemate tank swings its hull round on the spot to bring its gun to bear, degrees a second. */
  hullTurnDegS: 30,
  /** With neither platoon beaten by now it is called off, seconds. */
  limitS: 600,
  /** With nobody moving and no round fired for this long it is over, seconds. */
  stallS: 90,
  /** No more than this many tanks on the ground at once. */
  mostTanks: 8,
  /** A tank crosses country at this share of its top speed. */
  paceShare: 0.5,
  /** A tank is at a post when it is within this many metres of it. */
  arriveM: 5,
  /** Crews look round this often, seconds. */
  lookS: 0.5,
  /** A ridge hides the hull from anyone within this many degrees of straight ahead of it. */
  coverArcDeg: 60,
  /**
   * By day a tank sitting behind a ridge that has not fired is picked out
   * only inside this range, metres, give or take the share below.
   */
  hiddenSeenM: 900,
  hiddenSpread: 0.25,
  /** A tank that fires is seen by anyone with a clear line to it this long after, seconds. */
  flashS: 2,
  /** A tank one crew has found is passed to the rest of the platoon this long after, seconds. */
  radioS: 6,
  /** Going from one target to the next costs this share of finding the first. */
  switchShare: 0.6,
  /** A moving target is this much harder to lay on. */
  movingTargetLay: 1.5,
  /** Choosing a target: range counts for more or less by these. Lower is chosen first. */
  choose: {
    /** A target behind a ridge. */
    hidden: 1.3,
    /** For each of the platoon already shooting at it. */
    shared: 1.25,
    /** A target that is shooting at this tank. */
    threat: 0.8,
  },
  /** A platoon told to hold its fire opens up when a target is this near, metres, or once it has been shot at. */
  holdFireM: 1000,
  /** A careful tank stays behind each ridge at least this long before it goes on, seconds. */
  boundHoldS: 20,
  /** A careful tank that stops on its way to shoot waits this long for the tank to settle, seconds. */
  settleS: 2,
  /** A holding platoon told to move fast shifts each tank to its other place after this many rounds. */
  shiftAfter: 3,
  /** Backing off the ridge and coming up again is slow: a shifting tank makes this share of its pace. */
  shiftPaceShare: 0.4,
  /**
   * A battle is driven far harder than the endurance run: each kilometre
   * wears the tank like this many on the run.
   */
  wearFactor: 30,
  /** The tanks' places are kept this often for the playback, seconds. */
  trackS: 1,
  /** The map plays a battle back this many times faster than it was fought. */
  playbackSpeed: 8,
  /** Battles fought on a ground for the report. */
  runs: 12,
  /** What the report takes to be worth saying. Each is a share, 0..1, unless it says otherwise. */
  report: {
    /** The other platoon shot first in at least this share of the battles, or this one did. */
    shotFirst: 0.6,
    /** This platoon's rounds hit this much less often than the other's. */
    missingBy: 0.12,
    /** Hits that did nothing, of all hits. */
    bounced: 0.5,
    /** Hits that got through, of all hits. */
    gotThrough: 0.6,
    /** Of the tanks lost, those lost to the ammunition going up, and to fire. */
    magazine: 0.4,
    burned: 0.2,
    /** One plate took at least this share of everything that got through. */
    onePlate: 0.4,
    /** A round came in from the side when it was this far round from dead ahead, degrees. */
    flankDeg: 40,
    /** Rounds that got through from the side, of all that got through. */
    flanked: 0.35,
    /** Tanks that broke down, of all the platoon's tanks in all the battles. */
    brokeDown: 0.06,
    /** The platoon lost no more than this share of its tanks while winning most battles. */
    fewLost: 0.25,
    /** Fewer rounds than this is too few to say anything about. */
    fewest: 6,
    /** How many things the report names. */
    findings: 3,
  },
  grounds: {
    // The platoon holds a ridge; four come at it across the open.
    defend: {
      night: false,
      woods: [{ x: 200, y: 1500, r: 180 }],
      platoons: [{ role: 'hold', lanes: RIDGE }, { role: 'attack', lanes: ASSAULT }],
      theirOrders: { range: 'close', pace: 'careful' },
    },
    // Both platoons come over a rise and find each other.
    meeting: {
      night: false,
      woods: [{ x: 1000, y: 1500, r: 150 }],
      platoons: [{ role: 'attack', lanes: MEETING }, { role: 'attack', lanes: fromTheTop(MEETING) }],
      theirOrders: { range: 'long', pace: 'careful' },
    },
    // Four of the platoon's tanks go for a ridge that three hold.
    advance: {
      night: false,
      woods: [{ x: 1800, y: 1500, r: 180 }],
      platoons: [{ role: 'attack', lanes: fromTheTop(ASSAULT) }, { role: 'hold', lanes: fromTheTop(RIDGE) }],
      theirOrders: { range: 'long', pace: 'careful' },
    },
    // A meeting in the dark, close.
    night: {
      night: true,
      woods: [],
      platoons: [{ role: 'attack', lanes: NIGHT }, { role: 'attack', lanes: fromTheTop(NIGHT) }],
      theirOrders: { range: 'long', pace: 'careful' },
    },
  } satisfies Record<BattleGroundId, BattleGround>,
} as const
