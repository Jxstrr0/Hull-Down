// What a playback should sound like, worked out from what it shows. Plain
// numbers, no browser sound here, so it can be tested. Nothing in this file
// changes a result: the sim has already run.
import { AUDIO, type CueId, type EngineKind, type VoiceLineId } from '../data/audio'
import { GUNNERY } from '../data/gunnery'
import { ENGINES, GUNS, TRANSMISSIONS, WHEELS } from '../data/parts'
import type { ReelFrame } from '../render/shootReel'
import type { GunneryRun, ShotRecord } from '../sim/trials'
import { wheelsOf, type VehicleSpec } from '../sim/vehicle'

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
  // Wheels are geared taller, so each gear runs on to a higher speed.
  const gearedKmh = box.gearedKmh * (wheelsOf(spec) > 0 ? WHEELS.gearFactor : 1)
  return { engine: engine.kind, powerHp: engine.powerHp, gears: box.gears, gearedKmh, calibreMm: GUNS[spec.gun].calibreMm }
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

/** What the range officer calls when a round lands: a hit, or which way it missed. */
export function callOf(shot: ShotRecord): VoiceLineId {
  if (shot.hit) return 'hit'
  const sideways = Math.abs(shot.acrossM) / GUNNERY.target.widthM > Math.abs(shot.upM) / GUNNERY.target.heightM
  if (sideways) return shot.acrossM > 0 ? 'missRight' : 'missLeft'
  return shot.upM < 0 ? 'missShort' : 'missOver'
}

/**
 * The range officer at a firing test: a word as each target comes up, as
 * each round lands, at a jam and when the shoot is over. Like the shoot ear,
 * a moment is only spoken once, and only while the run is playing.
 */
export interface ShootOfficer {
  hear(run: GunneryRun, frame: ReelFrame, playing: boolean): VoiceLineId[]
}

export function createShootOfficer(): ShootOfficer {
  let last = ''
  return {
    hear(run, frame, playing) {
      const now = frame.done ? 'done' : `${frame.targetIndex}:${frame.shotIndex}:${frame.phase}`
      const fresh = now !== last
      const first = last === ''
      last = now
      if (!fresh || !playing) return []
      // Opened at the very end: nothing was heard, so nothing is over.
      if (frame.done) return first ? [] : ['ceaseFire']
      const target = run.targets[frame.targetIndex]
      const shot = target?.shots[frame.shotIndex]
      switch (frame.phase) {
        case 'unseen': return ['notSeen']
        case 'tooSlow': return ['noShot']
        // A jam is the news when there is one, even as the target comes up: both would run over the shot.
        case 'working': return shot?.jammed ? ['jam'] : frame.shotIndex === 0 ? ['targetUp'] : []
        case 'strike': return shot ? [callOf(shot)] : []
        case 'flight': return []
      }
    },
  }
}

/**
 * The range officer on a drive: the range is clear as the run starts, and a
 * breakdown when the endurance run stops for one. Going back to the start
 * lets it all be said again.
 */
export interface RunOfficer {
  hear(timeS: number, playing: boolean, stoppedFor: object | null): VoiceLineId[]
}

export function createRunOfficer(): RunOfficer {
  let lastS = Infinity
  let started = false
  let stop: object | null = null
  return {
    hear(timeS, playing, stoppedFor) {
      if (timeS < lastS) {
        started = false
        stop = null
      }
      lastS = timeS
      const out: VoiceLineId[] = []
      if (!playing) return out
      if (!started) {
        started = true
        if (timeS <= AUDIO.voice.startWithinS) out.push('rangeClear')
      }
      if (stoppedFor && stoppedFor !== stop) out.push('breakdown')
      stop = stoppedFor
      return out
    },
  }
}

/**
 * One speaker: a line waits for the one before to finish, and is let go if
 * it would start too long after its moment. Gives the second each line is
 * to start at, or null for one let go.
 */
export interface VoiceQueue {
  slot(nowS: number, lengthS: number): number | null
}

export function createVoiceQueue(maxLateS: number = AUDIO.voice.maxLateS): VoiceQueue {
  let freeAt = -Infinity
  return {
    slot(nowS, lengthS) {
      const at = Math.max(nowS, freeAt)
      if (at - nowS > maxLateS) return null
      freeAt = at + lengthS
      return at
    },
  }
}
