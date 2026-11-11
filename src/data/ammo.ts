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
} as const satisfies Record<GunId, Record<string, Round>>

type RoundsOf<G extends GunId> = keyof (typeof PACT_ROUNDS)[G]
export type PactRoundId = { [G in GunId]: RoundsOf<G> }[GunId]

/** The rounds for one gun, as a plain list. */
export function pactRounds(gun: GunId): { id: PactRoundId; round: Round }[] {
  return Object.entries(PACT_ROUNDS[gun]).map(([id, round]) => ({ id: id as PactRoundId, round }))
}

/** What the other side fires. */
export const THREATS = {
  accord105Sabot: { kind: 'kinetic', speedMs: 1480, spreadM: 0.4, penMm: 400, lossPerKmMm: 35 },
  accord120Sabot: { kind: 'kinetic', speedMs: 1650, spreadM: 0.35, penMm: 520, lossPerKmMm: 35 },
  autocannon: { kind: 'kinetic', speedMs: 1100, spreadM: 0.9, penMm: 70, lossPerKmMm: 20 },
  accord105Shaped: { kind: 'shaped', speedMs: 1170, spreadM: 0.6, penMm: 420, lossPerKmMm: 0 },
  infantryRocket: { kind: 'shaped', speedMs: 300, spreadM: 3, penMm: 320, lossPerKmMm: 0 },
  guidedMissile: { kind: 'shaped', speedMs: 200, spreadM: 0.5, penMm: 580, lossPerKmMm: 0 },
  // Generation two: what the Accord fields from about 2000.
  accord120LongRod: { kind: 'kinetic', speedMs: 1680, spreadM: 0.3, penMm: 640, lossPerKmMm: 30 },
  tandemRocket: { kind: 'shaped', speedMs: 280, spreadM: 2.5, penMm: 520, lossPerKmMm: 0, tandem: true },
  tandemMissile: { kind: 'shaped', speedMs: 240, spreadM: 0.4, penMm: 820, lossPerKmMm: 0, tandem: true },
} as const satisfies Record<string, Round>
export type ThreatId = keyof typeof THREATS
export const THREAT_IDS = Object.keys(THREATS) as ThreatId[]

/** The round and range the protection map starts on. */
export const DEFAULT_THREAT: ThreatId = 'accord105Sabot'
