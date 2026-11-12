// What a playback should sound like, worked out from what it shows. Plain
// numbers, no browser sound here, so it can be tested. Nothing in this file
// changes a result: the sim has already run.
import { AUDIO, type CueId, type EngineKind } from '../data/audio'
import { GUNNERY } from '../data/gunnery'
import { ENGINES, GUNS, TRANSMISSIONS } from '../data/parts'
import type { ReelFrame } from '../render/shootReel'
import type { GunneryRun, ShotRecord } from '../sim/trials'
import type { VehicleSpec } from '../sim/vehicle'

/** The parts of a tank that decide how it sounds. */
export interface TankVoice {
  engine: EngineKind
  powerHp: number
  gears: number
  /** Top speed the gearing allows, km/h. */
  gearedKmh: number
  calibreMm: number
}

export function voiceOf(spec: VehicleSpec): TankVoice {
  const engine = ENGINES[spec.powerpack.engine]
  const box = TRANSMISSIONS[spec.powerpack.transmission]
  return { engine: engine.kind, powerHp: engine.powerHp, gears: box.gears, gearedKmh: box.gearedKmh, calibreMm: GUNS[spec.gun].calibreMm }
}

/** How hard the engine is turning at a speed, 0 at tick-over to 1 flat out, and the gear it is in. */
export function revsAt(voice: TankVoice, speedKmh: number): { gear: number; revs: number } {
  if (!(speedKmh > 0)) return { gear: 0, revs: 0 }
  const span = voice.gearedKmh / voice.gears
  const gear = Math.min(voice.gears - 1, Math.floor(speedKmh / span))
  const within = Math.min(1, (speedKmh - gear * span) / span)
  // In bottom gear it climbs from tick-over; after a change it falls part of the way back.
  const from = gear === 0 ? 0 : AUDIO.engine.shiftBackShare
  return { gear, revs: from + (1 - from) * within }
}

/** The steady sounds of a tank on the move, as the levels the synth is set to. */
export interface Drone {
  /** The engine's note, Hz, and its loudness, 0 to 1. */
  engineHz: number
  engineGain: number
  /** A turbine's whine, Hz. */
  whineHz: number
  /** How fast the engine recording plays: 1 is as recorded. */
  tapeRate: number
  /** How fast the track recording plays: its clicks keep step with the links, within limits. */
  trackRate: number
  /** Track links a second, and how loud the clatter is, 0 to 1. */
  beatHz: number
  trackGain: number
}

export function droneAt(voice: TankVoice, speedKmh: number): Drone {
  const E = AUDIO.engine
  const T = AUDIO.tracks
  const tone = E.voices[voice.engine]
  const { revs } = revsAt(voice, speedKmh)
  const pull = (E.refHp / voice.powerHp) ** E.powerPull
  const speedMs = Math.max(0, speedKmh) / 3.6
  return {
    engineHz: (tone.idleHz + (tone.fullHz - tone.idleHz) * revs) * pull,
    engineGain: E.idleGain + (1 - E.idleGain) * revs,
    whineHz: tone.whineIdleHz + (tone.whineFullHz - tone.whineIdleHz) * revs,
    tapeRate: (tone.tapeIdle + (tone.tapeFull - tone.tapeIdle) * revs) * pull,
    beatHz: Math.min(T.maxBeatHz, speedMs / T.linkM),
    trackGain: Math.min(1, Math.max(0, speedKmh) / T.fullKmh),
    trackRate: Math.min(AUDIO.trackTape.fastest, Math.max(AUDIO.trackTape.slowest, Math.min(T.maxBeatHz, speedMs / T.linkM) / AUDIO.trackTape.clickHz)),
  }
}

/** How a gun of this calibre changes the gun cue: a bigger one is lower and rings longer. */
export function gunShape(calibreMm: number): { pitch: number; stretch: number } {
  const G = AUDIO.gun
  const ratio = Math.max(calibreMm, G.floorCalibreMm) / G.refCalibreMm
  return { pitch: ratio ** -G.pitchPull, stretch: ratio ** G.stretchPull }
}

/** The sound a round makes where it lands: on the board, past it, or in the ground short of it. */
export function strikeOf(shot: ShotRecord): Exclude<CueId, 'gun'> {
  if (shot.hit) return 'hit'
  const sideways = Math.abs(shot.acrossM) / GUNNERY.target.widthM > Math.abs(shot.upM) / GUNNERY.target.heightM
  return !sideways && shot.upM < 0 ? 'short' : 'miss'
}

/**
 * Listens to a firing test as it plays and says which sound each new moment
 * calls for. A moment is only heard once, and only while the run is playing:
 * dragging the bar about, or the run starting over, makes no sound by itself.
 */
export interface ShootEar {
  hear(run: GunneryRun, frame: ReelFrame, playing: boolean): CueId[]
}

export function createShootEar(): ShootEar {
  let last = ''
  return {
    hear(run, frame, playing) {
      const now = `${frame.targetIndex}:${frame.shotIndex}:${frame.phase}`
      const fresh = now !== last
      const first = last === ''
      last = now
      if (!fresh || !playing || frame.done) return []
      if (frame.phase === 'flight') {
        // Opened part of the way through a flight: the gun went off before anyone was listening.
        const late = first && (frame.flightShare ?? 0) > 0.2
        return late ? [] : ['gun']
      }
      if (frame.phase === 'strike') {
        const shot = run.targets[frame.targetIndex]?.shots[frame.shotIndex]
        return shot ? [strikeOf(shot)] : []
      }
      return []
    },
  }
}
