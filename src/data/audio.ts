// Every number the sound is made from. Most of it is synthesized in the
// browser; a few short recordings are laid over the gun and the strikes. These are numbers that
// sound right on a phone speaker, not measurements of anything.
import type { EnginePart } from './parts'

export type EngineKind = EnginePart['kind']

/** The shapes a tone can have. The names are the browser's own. */
export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle'

/** How the hum of one kind of engine is put together. */
export interface EngineVoice {
  wave: Wave
  /** The note at tick-over and flat out, Hz, for an engine of the reference power. */
  idleHz: number
  fullHz: number
  /** How strongly the note throbs, 0 to 1. A diesel chugs; a turbine does not. */
  chug: number
  /** The throb's beat as a share of the note. */
  chugRatio: number
  /** How bright the note is: the filter opens to this many times the note. */
  bright: number
  /** Loudness of the turbine's whine and of its rush of air, 0 to 1. */
  whine: number
  hiss: number
  /** The whine's note at tick-over and flat out, Hz. */
  whineIdleHz: number
  whineFullHz: number
  /** How fast the engine recording plays at tick-over and flat out, for an engine of the reference power: 1 is as recorded. */
  tapeIdle: number
  tapeFull: number
}

/** One layer of a short sound: a tone or a burst of noise that slides and dies away. */
export interface CueLayer {
  kind: 'tone' | 'noise'
  /** For a tone. */
  wave?: Wave
  /** For noise: which band of it is let through, and how narrow the band is. */
  filter?: 'lowpass' | 'bandpass' | 'highpass'
  q?: number
  /** The note (or the filter) slides from this to this, Hz. */
  fromHz: number
  toHz: number
  /** Seconds to full loudness, then seconds to die away. */
  attackS: number
  decayS: number
  /** Loudness at its peak, 0 to 1. */
  gain: number
  /** Seconds after the cue begins that this layer starts. */
  delayS?: number
}

export const CUE_IDS = ['gun', 'hit', 'miss', 'short', 'ricochet', 'held', 'pierce', 'tap', 'pencil', 'stamp', 'warn'] as const
export type CueId = (typeof CUE_IDS)[number]

export const AUDIO = {
  /** Loudness of everything, 0 to 1. */
  master: 0.7,
  /** Seconds the sound takes to come up or go quiet when it is switched. */
  fadeS: 0.05,
  /** Seconds of noise kept to make every hiss, clatter and bang from. */
  noiseS: 2,

  engine: {
    /** The engine power the voices below are written for. A bigger engine sings lower. */
    refHp: 700,
    /** How strongly power lowers the note: 0 is not at all. */
    powerPull: 0.35,
    /** Loudness at tick-over as a share of flat out. */
    idleGain: 0.45,
    gain: 0.22,
    /** Share of the revs an engine falls back to after a gear change. */
    shiftBackShare: 0.45,
    /** Seconds the note takes to follow the revs. */
    followS: 0.08,
    /** Seconds without a new picture after which the engine and tracks go quiet by themselves. */
    hushAfterS: 0.35,
    hushS: 0.12,
    voices: {
      diesel: {
        wave: 'sawtooth', idleHz: 38, fullHz: 96, chug: 0.5, chugRatio: 0.5, bright: 5,
        whine: 0, hiss: 0, whineIdleHz: 0, whineFullHz: 0, tapeIdle: 0.75, tapeFull: 1.6,
      },
      multiFuel: {
        wave: 'square', idleHz: 34, fullHz: 88, chug: 0.65, chugRatio: 0.5, bright: 4,
        whine: 0, hiss: 0.05, whineIdleHz: 0, whineFullHz: 0, tapeIdle: 0.68, tapeFull: 1.45,
      },
      gasTurbine: {
        wave: 'triangle', idleHz: 70, fullHz: 120, chug: 0.05, chugRatio: 0.25, bright: 3,
        whine: 0.5, hiss: 0.6, whineIdleHz: 1500, whineFullHz: 2900, tapeIdle: 0.95, tapeFull: 1.35,
      },
    } satisfies Record<EngineKind, EngineVoice>,
    /** The band of noise a turbine's rush of air is cut from, Hz. */
    hissHz: 3200,
    hissQ: 0.7,
    /** A whine is piercing: it is turned down to this share. */
    whineGain: 0.25,
  },

  tracks: {
    /** Metres from one track link to the next: the clatter beats once a link. */
    linkM: 0.16,
    /** The fastest the beat goes, a second. Past this it is a rattle anyway. */
    maxBeatHz: 34,
    /** The speed at which the tracks are as loud as they get, km/h. */
    fullKmh: 50,
    gain: 0.16,
    /** The band of noise the clatter is cut from. */
    bandHz: 1100,
    q: 1.4,
    /** How deep the beat cuts into the clatter, 0 to 1. */
    beatDepth: 0.8,
  },

  gun: {
    /** The calibre the gun cue below is written for, mm. A bigger gun is lower and longer. */
    refCalibreMm: 115,
    /** How strongly calibre lowers the note and stretches the sound. */
    pitchPull: 1.6,
    stretchPull: 1.4,
  },

  /** Loudness of every short sound, 0 to 1. */
  cueGain: 0.6,
  /** Loudness of a strike as a share of the cue, for being a long way down the range. */
  farGain: 0.7,

  /**
   * Recordings laid over the synth where a free one fits (CC0, listed in
   * CREDITS.md). They are fetched when the sound first starts, never with the
   * page. Until one arrives, or if it never does, the synth plays alone.
   * `gain` is the recording's loudness; `synthGain` is what the synth under
   * it is turned down to.
   */
  /**
   * The engine, recorded (CC BY, listed in CREDITS.md): a loop `loopS` long
   * played round from `fromS`, faster as the engine works harder (each engine's
   * `tapeIdle` to `tapeFull`), at `gain`. The file holds the loop twice so
   * the part played never touches its ends. Once it has arrived, the synth
   * engine under it is turned down to `synthGain`; a turbine keeps its whine.
   */
  engineTape: { file: 'audio/engine.mp3', fromS: 2, loopS: 3.99238, gain: 1.1, synthGain: 0.3 },

  recordings: {
    gun: { file: 'audio/gun.mp3', gain: 0.9, synthGain: 0.5 },
    hit: { file: 'audio/hit.mp3', gain: 0.7, synthGain: 0.4 },
    short: { file: 'audio/short.mp3', gain: 0.9, synthGain: 0.5 },
  } satisfies Partial<Record<CueId, { file: string; gain: number; synthGain: number }>>,

  /** The cue map: every short sound, layer by layer. */
  cues: {
    // The gun: a crack, a thump that drops away, and a rolling tail.
    gun: [
      { kind: 'noise', filter: 'highpass', q: 0.7, fromHz: 1800, toHz: 900, attackS: 0.002, decayS: 0.06, gain: 0.7 },
      { kind: 'tone', wave: 'sine', fromHz: 130, toHz: 34, attackS: 0.004, decayS: 0.5, gain: 1 },
      { kind: 'noise', filter: 'lowpass', q: 0.7, fromHz: 900, toHz: 120, attackS: 0.005, decayS: 1.1, gain: 0.8 },
    ],
    // A hit: the steel board rings, then goes down.
    hit: [
      { kind: 'noise', filter: 'bandpass', q: 2, fromHz: 3200, toHz: 2400, attackS: 0.001, decayS: 0.04, gain: 0.6 },
      { kind: 'tone', wave: 'sine', fromHz: 523, toHz: 519, attackS: 0.002, decayS: 0.9, gain: 0.5 },
      { kind: 'tone', wave: 'sine', fromHz: 1367, toHz: 1360, attackS: 0.002, decayS: 0.6, gain: 0.35 },
      { kind: 'tone', wave: 'sine', fromHz: 2411, toHz: 2400, attackS: 0.002, decayS: 0.35, gain: 0.2 },
      { kind: 'noise', filter: 'lowpass', q: 0.7, fromHz: 300, toHz: 80, attackS: 0.01, decayS: 0.25, gain: 0.5, delayS: 0.45 },
    ],
    // A miss that goes by the board: the round tears past and is gone.
    miss: [
      { kind: 'noise', filter: 'bandpass', q: 6, fromHz: 2600, toHz: 500, attackS: 0.05, decayS: 0.45, gain: 0.55 },
    ],
    // A round that falls short: it digs into the ground in front of the board.
    short: [
      { kind: 'tone', wave: 'sine', fromHz: 90, toHz: 38, attackS: 0.004, decayS: 0.3, gain: 0.8 },
      { kind: 'noise', filter: 'lowpass', q: 0.7, fromHz: 500, toHz: 90, attackS: 0.005, decayS: 0.4, gain: 0.8 },
      { kind: 'noise', filter: 'bandpass', q: 1, fromHz: 1800, toHz: 900, attackS: 0.06, decayS: 0.5, gain: 0.18, delayS: 0.08 },
    ],
    // In a battle. A round that skids off the plate: a clang and a whine that falls away.
    ricochet: [
      { kind: 'noise', filter: 'bandpass', q: 3, fromHz: 3600, toHz: 2800, attackS: 0.001, decayS: 0.03, gain: 0.6 },
      { kind: 'tone', wave: 'sine', fromHz: 1900, toHz: 1880, attackS: 0.002, decayS: 0.18, gain: 0.3 },
      { kind: 'tone', wave: 'triangle', fromHz: 2600, toHz: 700, attackS: 0.01, decayS: 0.55, gain: 0.3, delayS: 0.03 },
    ],
    // A hit the armour holds: a heavy, dead knock with no ring to it.
    held: [
      { kind: 'noise', filter: 'bandpass', q: 1.5, fromHz: 1400, toHz: 700, attackS: 0.001, decayS: 0.07, gain: 0.7 },
      { kind: 'tone', wave: 'triangle', fromHz: 210, toHz: 150, attackS: 0.002, decayS: 0.22, gain: 0.7 },
      { kind: 'noise', filter: 'lowpass', q: 0.7, fromHz: 600, toHz: 150, attackS: 0.004, decayS: 0.3, gain: 0.5 },
    ],
    // A round that goes through: a sharp crack, then the boom from inside.
    pierce: [
      { kind: 'noise', filter: 'highpass', q: 0.7, fromHz: 2400, toHz: 1200, attackS: 0.001, decayS: 0.05, gain: 0.7 },
      { kind: 'tone', wave: 'sine', fromHz: 110, toHz: 30, attackS: 0.006, decayS: 0.8, gain: 1, delayS: 0.05 },
      { kind: 'noise', filter: 'lowpass', q: 0.7, fromHz: 1200, toHz: 90, attackS: 0.01, decayS: 1.3, gain: 0.8, delayS: 0.05 },
    ],
    // In the office. Any button: a small, dry click.
    tap: [
      { kind: 'noise', filter: 'bandpass', q: 2, fromHz: 2500, toHz: 1800, attackS: 0.001, decayS: 0.025, gain: 0.5 },
      { kind: 'tone', wave: 'sine', fromHz: 900, toHz: 600, attackS: 0.001, decayS: 0.03, gain: 0.3 },
    ],
    // The design changed: two short strokes of a pencil.
    pencil: [
      { kind: 'noise', filter: 'bandpass', q: 2, fromHz: 4200, toHz: 3000, attackS: 0.02, decayS: 0.1, gain: 0.5 },
      { kind: 'noise', filter: 'bandpass', q: 2, fromHz: 3200, toHz: 4400, attackS: 0.015, decayS: 0.08, gain: 0.4, delayS: 0.1 },
    ],
    // A decision: the rubber stamp comes down on the desk.
    stamp: [
      { kind: 'tone', wave: 'sine', fromHz: 140, toHz: 60, attackS: 0.002, decayS: 0.18, gain: 1 },
      { kind: 'noise', filter: 'lowpass', q: 0.7, fromHz: 900, toHz: 200, attackS: 0.002, decayS: 0.12, gain: 0.8 },
      { kind: 'noise', filter: 'bandpass', q: 1.5, fromHz: 2000, toHz: 1500, attackS: 0.001, decayS: 0.03, gain: 0.4 },
    ],
    // The design has just gone over the weight limit: two soft notes, falling.
    warn: [
      { kind: 'tone', wave: 'triangle', fromHz: 440, toHz: 438, attackS: 0.01, decayS: 0.16, gain: 0.5 },
      { kind: 'tone', wave: 'triangle', fromHz: 349, toHz: 347, attackS: 0.01, decayS: 0.28, gain: 0.5, delayS: 0.14 },
    ],
  } satisfies Record<CueId, CueLayer[]>,

  /** Outdoors, while a playback runs: light wind, and nothing else. No music. */
  wind: {
    gain: 0.05,
    /** The wind is noise with the top taken off, Hz. */
    lowHz: 420,
    q: 0.5,
    /** Gusts: how often it swells, a second, and how deep the swell is, 0 to 1. */
    gustHz: 0.13,
    gustDepth: 0.7,
    /** A thin whistle on top of it, as a share of the wind, and its band, Hz. */
    whistle: 0.25,
    whistleHz: 1500,
    whistleQ: 4,
    /** Seconds it takes to come up, so it is never a sudden hiss. */
    riseS: 0.8,
  },

  /** The design office: quiet sounds for what the player does. */
  office: {
    /** What counts as a tap: anything on the page that is pressed. */
    tapOn: 'button, summary, a, select, label, input',
    /** Loudness of each office sound, 0 to 1. A tap is the quietest. */
    gain: { tap: 0.25, pencil: 0.45, stamp: 0.8, warn: 0.5 },
    /** Seconds before the same sound may be heard again: a dragged slider is not a drum roll. */
    gapS: 0.09,
  },

  /** A battle, heard from beside the tank the camera is with. */
  battle: {
    /** Metres away at which a sound is half as loud. */
    halfM: 350,
    /** Nothing in the fight is quieter than this, 0 to 1: a far gun is still a gun. */
    floorGain: 0.12,
    /** The most short sounds started in one picture. More than this is only noise. */
    mostAtOnce: 4,
    /** Seconds of battle between two pictures past which the bar was dragged, and nothing is played. */
    jumpS: 2,
    /** How loud the engine is beside the guns, as a share of the range. */
    droneShare: 0.7,
  },
} as const
