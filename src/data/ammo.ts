// Ammunition: the rounds the Kamen Pact supplies for each
// gun, and the Northern Accord rounds a design is tested against.
// Game-level abstractions, not engineering data.
import type { GunId } from './parts'

/** Kinetic rounds punch through with speed. Shaped charges burn through with a jet. */
export type RoundKind = 'kinetic' | 'shaped'

export interface Round {
  kind: RoundKind
  /** Speed at the muzzle, metres a second. */
  speedMs: number
  /** How far shots scatter at 1000 m, metres. Smaller is more accurate. */
  spreadM: number
  /** Millimetres of rolled steel it goes through at the muzzle, square on. */
  penMm: number
  /** Kinetic rounds slow down: millimetres lost for every 1000 m. Shaped charges lose nothing. */
  lossPerKmMm: number
  /** A shaped charge with a small charge in front that sets off a reactive tile before the main one arrives. */
  tandem?: boolean
  /**
   * How it gets there, when it is not fired from a gun. A rocket flies
   * straight; a missile is steered all the way. Both are slow enough for
   * active protection (src/data/parts.ts) to do something about.
   */
  flight?: 'rocket' | 'missile'
}

/**
 * What the Pact supplies, by gun. A rifled gun spins its rounds, which keeps
 * them tight on the target; a smoothbore throws them faster and flatter, and
 * they scatter more.
 */
export const PACT_ROUNDS = {
  rifled100: {
    sabot100: { kind: 'kinetic', speedMs: 1415, spreadM: 0.35, penMm: 310, lossPerKmMm: 40 },
    shaped100: { kind: 'shaped', speedMs: 900, spreadM: 0.5, penMm: 380, lossPerKmMm: 0 },
  },
  smooth115: {
    sabot115: { kind: 'kinetic', speedMs: 1615, spreadM: 0.6, penMm: 380, lossPerKmMm: 45 },
    shaped115: { kind: 'shaped', speedMs: 950, spreadM: 0.9, penMm: 440, lossPerKmMm: 0 },
  },
  smooth125: {
    sabot125: { kind: 'kinetic', speedMs: 1700, spreadM: 0.55, penMm: 460, lossPerKmMm: 40 },
    shaped125: { kind: 'shaped', speedMs: 905, spreadM: 0.85, penMm: 500, lossPerKmMm: 0 },
  },
  rifled120: {
    sabot120: { kind: 'kinetic', speedMs: 1370, spreadM: 0.3, penMm: 420, lossPerKmMm: 30 },
    shaped120: { kind: 'shaped', speedMs: 1100, spreadM: 0.45, penMm: 440, lossPerKmMm: 0 },
  },
  // Heavy shells for lobbing, not for tank fighting. Fired straight at a tank, both are slow and loose:
  // a solid shot for close in, and the high-explosive shell, which bursts on the plate.
  howitzer155: {
    shot155: { kind: 'kinetic', speedMs: 760, spreadM: 1.0, penMm: 190, lossPerKmMm: 60 },
    shell155: { kind: 'shaped', speedMs: 820, spreadM: 1.2, penMm: 160, lossPerKmMm: 0 },
  },
  // Bursts of five, for light armour and soft targets: a hard-cored shot, and a high-explosive shell that
  // bursts on whatever it strikes. Five shells spread out, but a burst hits more often than one round.
  autocannon30: {
    apds30: { kind: 'kinetic', speedMs: 1150, spreadM: 0.5, penMm: 70, lossPerKmMm: 20 },
    he30: { kind: 'shaped', speedMs: 1000, spreadM: 0.6, penMm: 25, lossPerKmMm: 0 },
  },
} as const satisfies Record<GunId, Record<string, Round>>

type RoundsOf<G extends GunId> = keyof (typeof PACT_ROUNDS)[G]
export type PactRoundId = { [G in GunId]: RoundsOf<G> }[GunId]

/** The rounds for one gun, as a plain list. */
export function pactRounds(gun: GunId): { id: PactRoundId; round: Round }[] {
  return Object.entries(PACT_ROUNDS[gun]).map(([id, round]) => ({ id: id as PactRoundId, round }))
}

/** The kinetic round a tank carries: the Pact's, or one of the bureau's own. */
export const KINETIC_ISSUES = ['supplied', 'longRod'] as const
export type KineticIssue = (typeof KINETIC_ISSUES)[number]
/** The shaped-charge round a tank carries. */
export const SHAPED_ISSUES = ['supplied', 'tandem', 'gunMissile'] as const
export type ShapedIssue = (typeof SHAPED_ISSUES)[number]

/**
 * The bureau's own rounds, each made from the Pact round of the same kind
 * for the gun fitted. The factors are multiples of the Pact round's figures;
 * a missile flies at its own speed and steers itself, whatever the gun.
 */
export const OWN_ROUNDS = {
  // A longer, thinner dart: it goes through more and keeps its speed, and it is too long for a carousel.
  longRod: { penFactor: 1.25, speedFactor: 0.98, lossFactor: 0.75, spreadFactor: 1, costPerRoundKr: 1500 },
  // Two charges: the first sets off a reactive tile, the second does the work.
  tandem: { penFactor: 1.1, speedFactor: 1, lossFactor: 1, spreadFactor: 1, costPerRoundKr: 1000 },
  // Fired from the gun and steered to the target: slow, dear, and very hard to miss with.
  gunMissile: { penFactor: 1.3, speedMs: 370, spreadM: 0.2, costPerRoundKr: 6000 },
} as const
/** The share of the load each kind of round makes up, for costing. */
export const LOAD_SHARE = { kinetic: 0.5, shaped: 0.5 } as const

/** What the other side fires. */
export const THREATS = {
  accord105Sabot: { kind: 'kinetic', speedMs: 1480, spreadM: 0.4, penMm: 400, lossPerKmMm: 35 },
  accord120Sabot: { kind: 'kinetic', speedMs: 1650, spreadM: 0.35, penMm: 520, lossPerKmMm: 35 },
  autocannon: { kind: 'kinetic', speedMs: 1100, spreadM: 0.9, penMm: 70, lossPerKmMm: 20 },
  accord105Shaped: { kind: 'shaped', speedMs: 1170, spreadM: 0.6, penMm: 420, lossPerKmMm: 0 },
  infantryRocket: { kind: 'shaped', speedMs: 300, spreadM: 3, penMm: 320, lossPerKmMm: 0, flight: 'rocket' },
  guidedMissile: { kind: 'shaped', speedMs: 200, spreadM: 0.5, penMm: 580, lossPerKmMm: 0, flight: 'missile' },
  // Generation two: what the Accord fields from about 2000.
  accord120LongRod: { kind: 'kinetic', speedMs: 1680, spreadM: 0.3, penMm: 640, lossPerKmMm: 30 },
  tandemRocket: { kind: 'shaped', speedMs: 280, spreadM: 2.5, penMm: 520, lossPerKmMm: 0, tandem: true, flight: 'rocket' },
  tandemMissile: { kind: 'shaped', speedMs: 240, spreadM: 0.4, penMm: 820, lossPerKmMm: 0, tandem: true, flight: 'missile' },
  // Generation three: what comes down on the roof.
  topAttackMissile: { kind: 'shaped', speedMs: 180, spreadM: 0.4, penMm: 280, lossPerKmMm: 0, flight: 'missile' },
  droneBomblet: { kind: 'shaped', speedMs: 40, spreadM: 0.6, penMm: 70, lossPerKmMm: 0 },
} as const satisfies Record<string, Round>
export type ThreatId = keyof typeof THREATS
export const THREAT_IDS = Object.keys(THREATS) as ThreatId[]

/** The round and range the protection map starts on. */
export const DEFAULT_THREAT: ThreatId = 'accord105Sabot'
