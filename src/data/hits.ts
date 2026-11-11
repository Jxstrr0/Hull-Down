// What a shot does once it is through the armour: how much each thing
// inside takes out of it, and the chances of fire and explosion.
// Game-level abstractions, not engineering data.
import type { RoundKind } from './ammo'
import type { StowageId } from './parts'

export const HITS = {
  /** How far out along its line a shot is started from, metres. Only has to be clear of the tank. */
  standOffM: 30,
  /**
   * What each thing inside takes out of a round that goes through it, in
   * millimetres of rolled steel. A round with nothing left stops there.
   */
  stopMm: { crew: 15, ammo: 50, fuel: 40, engine: 350, transmission: 300, gun: 400, autoloader: 80, sight: 30 },
  /** An armoured bin has to be gone through before the rounds in it are reached. */
  binMm: 25,
  /** The chance that rounds reached by a shot go up, by how they are stowed. An autoloader holds its rounds bare. */
  cookOff: {
    plainRacks: 0.75,
    wetStowage: 0.3,
    armouredBins: 0.6,
    blowOutPanels: 0.75,
  } satisfies Record<StowageId, number>,
  autoloaderCookOff: 0.75,
  /** The chance that a fuel tank or an engine that is hit catches fire. */
  fuelFire: 0.4,
  engineFire: 0.25,
  /** The chance that fire suppression, when fitted, puts a fire out. */
  suppression: 0.85,
  /**
   * Fragments thrown off the inside of the plate when a round comes
   * through: how far they carry and how wide they spread about the line of
   * the shot. A liner catches most of them.
   */
  spall: { reachM: 1.4, coneDeg: 40, linerReachM: 0.5, linerConeDeg: 18 },
  /** What tracks and wheels take out of a round on its way to the hull side, and the chance the track is broken. */
  trackMm: { kinetic: 20, shaped: 60 } satisfies Record<RoundKind, number>,
  trackBreak: 0.6,
} as const
