// The game's sound, made in the browser from the tables in src/data/audio.ts,
// with a few short recordings laid over it once they have been fetched.
// Nothing is made until the player first taps something that makes a noise:
// browsers only allow sound to start from a tap. Where there is no sound at
// all (an old browser, a test), every call here quietly does nothing.
import { AUDIO, type CueId, type CueLayer } from '../data/audio'
import { gunShape, type Drone, type TankVoice } from './cues'

/** The steady sounds of one tank, and how to set them. */
interface DroneNodes {
  engine: OscillatorNode
  sub: OscillatorNode
  bright: BiquadFilterNode
  chug: OscillatorNode
  engineOut: GainNode
  whine: OscillatorNode
  whineOut: GainNode
  hissOut: GainNode
  beat: OscillatorNode
  trackOut: GainNode
  /** The engine recording, once it has arrived, and its loudness. */
  tape: AudioBufferSourceNode | null
  tapeOut: GainNode | null
  /** The track recording, the same way. */
  trackTape: AudioBufferSourceNode | null
  trackTapeOut: GainNode | null
  sources: AudioScheduledSourceNode[]
  voice: TankVoice
}

export interface Sound {
  /** True when the player has the sound on. */
  on(): boolean
  setOn(on: boolean): void
  /** Call from a tap: makes the sound ready, which a browser only allows then. */
  wake(): void
  /** A short sound, now. `calibreMm` shapes the gun; `gain` turns it down for being far off. */
  cue(id: CueId, how?: { calibreMm?: number; gain?: number }): void
  /**
   * The engine and tracks of a tank, as they are this instant. Call it with
   * every picture drawn: when the calls stop, the tank goes quiet by itself.
   */
  drone(voice: TankVoice, levels: Drone): void
  /**
   * The air outdoors: light wind. Call it with every picture drawn, like
   * `drone`; when the calls stop it dies away by itself.
   */
  air(): void
  /** Stop the engine, the tracks and the wind and give them back. */
  still(): void
}

type ContextMaker = () => AudioContext | null
/** Fetches a sound file, or gives null when it cannot be had. */
type Loader = (file: string) => Promise<ArrayBuffer | null>

async function browserLoad(file: string): Promise<ArrayBuffer | null> {
  try {
    const reply = await fetch(file)
    return reply.ok ? await reply.arrayBuffer() : null
  } catch {
    return null
  }
}

function browserContext(): AudioContext | null {
  const scope = globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  const Maker = scope.AudioContext ?? scope.webkitAudioContext
  if (!Maker) return null
  try {
    return new Maker()
  } catch {
    return null
  }
}

export function createSound(startOn: boolean, makeContext: ContextMaker = browserContext, load: Loader = browserLoad): Sound {
  let enabled = startOn
  let context: AudioContext | null = null
  let failed = false
  let master: GainNode | null = null
  let noise: AudioBuffer | null = null
  let nodes: DroneNodes | null = null
  /** The wind: its loudness, and what has to be stopped to end it. */
  let wind: { out: GainNode; sources: AudioScheduledSourceNode[] } | null = null
  /** The recordings that have arrived, by cue. */
  const taped = new Map<CueId, AudioBuffer>()
  /** The engine recording, once it has arrived. */
  let engineTape: AudioBuffer | null = null
  let trackTape: AudioBuffer | null = null

  function ready(): AudioContext | null {
    if (context || failed) return context
    context = makeContext()
    if (!context) {
      failed = true
      return null
    }
    master = context.createGain()
    master.gain.value = enabled ? AUDIO.master : 0
    // A gun and an engine together would be too much for a phone speaker: this holds the peaks down.
    const limiter = context.createDynamicsCompressor()
    master.connect(limiter)
    limiter.connect(context.destination)
    const length = Math.floor(context.sampleRate * AUDIO.noiseS)
    noise = context.createBuffer(1, length, context.sampleRate)
    const samples = noise.getChannelData(0)
    for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1
    void fetchRecordings(context)
    return context
  }

  /** Fetch the recordings in the background. One that fails is simply not used. */
  async function fetchRecordings(ctx: AudioContext): Promise<void> {
    for (const [id, each] of Object.entries(AUDIO.recordings)) {
      try {
        const bytes = await load(each.file)
        if (bytes) taped.set(id as CueId, await ctx.decodeAudioData(bytes))
      } catch {
        // A file this browser cannot read: the synth plays alone.
      }
    }
    try {
      const bytes = await load(AUDIO.engineTape.file)
      if (bytes) engineTape = await ctx.decodeAudioData(bytes)
    } catch {
      // The synth engine plays alone.
    }
    try {
      const bytes = await load(AUDIO.trackTape.file)
      if (bytes) trackTape = await ctx.decodeAudioData(bytes)
    } catch {
      // The synth clatter plays alone.
    }
  }

  /** Lay a recording into a running engine, going round and round its middle. */
  function addTape(ctx: AudioContext, into: DroneNodes, tape: AudioBuffer, T: { fromS: number; loopS: number }): { source: AudioBufferSourceNode; out: GainNode } {
    const source = ctx.createBufferSource()
    source.buffer = tape
    source.loop = true
    source.loopStart = T.fromS
    source.loopEnd = T.fromS + T.loopS
    const out = ctx.createGain()
    out.gain.value = 0
    source.connect(out)
    out.connect(master ?? ctx.destination)
    source.start(0, T.fromS)
    into.sources.push(source)
    return { source, out }
  }

  function wake(): void {
    if (!enabled) return
    const ctx = ready()
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {})
  }

  function setOn(on: boolean): void {
    enabled = on
    if (on) {
      wake()
    } else {
      still()
    }
    if (context && master) master.gain.setTargetAtTime(on ? AUDIO.master : 0, context.currentTime, AUDIO.fadeS)
  }

  /** A stretch of the kept noise, starting anywhere in it. */
  function hiss(ctx: AudioContext): AudioBufferSourceNode {
    const source = ctx.createBufferSource()
    source.buffer = noise
    source.loop = true
    return source
  }

  function layer(ctx: AudioContext, out: AudioNode, each: CueLayer, pitch: number, stretch: number, gain: number): void {
    const from = ctx.currentTime + (each.delayS ?? 0)
    const peak = from + each.attackS
    const end = peak + each.decayS * stretch
    const level = ctx.createGain()
    level.gain.setValueAtTime(0.0001, from)
    level.gain.linearRampToValueAtTime(each.gain * gain, peak)
    level.gain.exponentialRampToValueAtTime(0.0001, end)
    level.connect(out)
    if (each.kind === 'tone') {
      const tone = ctx.createOscillator()
      tone.type = each.wave ?? 'sine'
      tone.frequency.setValueAtTime(each.fromHz * pitch, from)
      tone.frequency.exponentialRampToValueAtTime(each.toHz * pitch, end)
      tone.connect(level)
      tone.start(from)
      tone.stop(end)
      return
    }
    const source = hiss(ctx)
    const band = ctx.createBiquadFilter()
    band.type = each.filter ?? 'lowpass'
    band.Q.value = each.q ?? 1
    band.frequency.setValueAtTime(each.fromHz * pitch, from)
    band.frequency.exponentialRampToValueAtTime(each.toHz * pitch, end)
    source.connect(band)
    band.connect(level)
    source.start(from, Math.random() * AUDIO.noiseS)
    source.stop(end)
  }

  function cue(id: CueId, how: { calibreMm?: number; gain?: number } = {}): void {
    const calibreMm = how.calibreMm
    if (!enabled) return
    const ctx = ready()
    if (!ctx || !master || ctx.state !== 'running') return
    const shape = id === 'gun' && calibreMm ? gunShape(calibreMm) : { pitch: 1, stretch: 1 }
    const gain = AUDIO.cueGain * (how.gain ?? (id === 'gun' ? 1 : AUDIO.farGain))
    const recordings: Partial<Record<CueId, { gain: number; synthGain: number }>> = AUDIO.recordings
    const recording = recordings[id]
    const tape = taped.get(id)
    const under = recording && tape ? recording.synthGain : 1
    for (const each of AUDIO.cues[id]) layer(ctx, master, each, shape.pitch, shape.stretch, gain * under)
    if (!recording || !tape) return
    // Played slower for a bigger gun, which makes it lower and longer at once.
    const source = ctx.createBufferSource()
    source.buffer = tape
    source.playbackRate.value = shape.pitch
    const level = ctx.createGain()
    level.gain.value = recording.gain * gain
    source.connect(level)
    level.connect(master)
    source.start()
  }

  function build(ctx: AudioContext, out: AudioNode, voice: TankVoice): DroneNodes {
    const E = AUDIO.engine
    const T = AUDIO.tracks
    const tone = E.voices[voice.engine]

    // The engine: a rough note and one an octave under it, through a filter, throbbing.
    const engine = ctx.createOscillator()
    engine.type = tone.wave
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    const bright = ctx.createBiquadFilter()
    bright.type = 'lowpass'
    const throb = ctx.createGain()
    throb.gain.value = 1 - tone.chug / 2
    const chug = ctx.createOscillator()
    chug.type = 'sine'
    const chugDepth = ctx.createGain()
    chugDepth.gain.value = tone.chug / 2
    chug.connect(chugDepth)
    chugDepth.connect(throb.gain)
    const engineOut = ctx.createGain()
    engineOut.gain.value = 0
    engine.connect(bright)
    sub.connect(bright)
    bright.connect(throb)
    throb.connect(engineOut)
    engineOut.connect(out)

    // A turbine's whine and its rush of air. Silent for the other engines.
    const whine = ctx.createOscillator()
    whine.type = 'sine'
    const whineOut = ctx.createGain()
    whineOut.gain.value = 0
    whine.connect(whineOut)
    whineOut.connect(out)
    const air = hiss(ctx)
    const airBand = ctx.createBiquadFilter()
    airBand.type = 'bandpass'
    airBand.frequency.value = E.hissHz
    airBand.Q.value = E.hissQ
    const hissOut = ctx.createGain()
    hissOut.gain.value = 0
    air.connect(airBand)
    airBand.connect(hissOut)
    hissOut.connect(out)

    // The tracks: a band of noise that beats once a link.
    const clatter = hiss(ctx)
    const clatterBand = ctx.createBiquadFilter()
    clatterBand.type = 'bandpass'
    clatterBand.frequency.value = T.bandHz
    clatterBand.Q.value = T.q
    const pulse = ctx.createGain()
    pulse.gain.value = 1 - T.beatDepth / 2
    const beat = ctx.createOscillator()
    beat.type = 'square'
    const beatDepth = ctx.createGain()
    beatDepth.gain.value = T.beatDepth / 2
    beat.connect(beatDepth)
    beatDepth.connect(pulse.gain)
    const trackOut = ctx.createGain()
    trackOut.gain.value = 0
    clatter.connect(clatterBand)
    clatterBand.connect(pulse)
    pulse.connect(trackOut)
    trackOut.connect(out)

    const sources = [engine, sub, chug, whine, air, clatter, beat]
    for (const source of sources) source.start()
    return {
      engine, sub, bright, chug, engineOut, whine, whineOut, hissOut, beat, trackOut,
      tape: null, tapeOut: null, trackTape: null, trackTapeOut: null, sources, voice,
    }
  }

  function calm(): void {
    if (!wind) return
    const old = wind
    wind = null
    const now = context?.currentTime ?? 0
    old.out.gain.cancelScheduledValues(0)
    old.out.gain.setTargetAtTime(0, now, AUDIO.engine.hushS)
    for (const source of old.sources) source.stop(now + AUDIO.engine.hushS * 4)
  }

  function air(): void {
    if (!enabled) return
    const ctx = ready()
    if (!ctx || !master || ctx.state !== 'running') return
    const W = AUDIO.wind
    if (!wind) {
      // Noise with the top taken off, swelling slowly, and a thin whistle over it.
      const out = ctx.createGain()
      out.gain.value = 0
      const swell = ctx.createGain()
      swell.gain.value = 1 - W.gustDepth / 2
      const gust = ctx.createOscillator()
      gust.type = 'sine'
      gust.frequency.value = W.gustHz
      const gustDepth = ctx.createGain()
      gustDepth.gain.value = W.gustDepth / 2
      gust.connect(gustDepth)
      gustDepth.connect(swell.gain)
      const low = hiss(ctx)
      const lowBand = ctx.createBiquadFilter()
      lowBand.type = 'lowpass'
      lowBand.frequency.value = W.lowHz
      lowBand.Q.value = W.q
      low.connect(lowBand)
      lowBand.connect(swell)
      const high = hiss(ctx)
      const highBand = ctx.createBiquadFilter()
      highBand.type = 'bandpass'
      highBand.frequency.value = W.whistleHz
      highBand.Q.value = W.whistleQ
      const thin = ctx.createGain()
      thin.gain.value = W.whistle
      high.connect(highBand)
      highBand.connect(thin)
      thin.connect(swell)
      swell.connect(out)
      out.connect(master)
      const sources = [gust, low, high]
      low.start(0, Math.random() * AUDIO.noiseS)
      high.start(0, Math.random() * AUDIO.noiseS)
      gust.start()
      wind = { out, sources }
    }
    const now = ctx.currentTime
    wind.out.gain.cancelScheduledValues(now)
    wind.out.gain.setTargetAtTime(W.gain, now, W.riseS)
    wind.out.gain.setTargetAtTime(0, now + AUDIO.engine.hushAfterS, AUDIO.engine.hushS)
  }

  function still(): void {
    calm()
    if (!nodes) return
    const old = nodes
    nodes = null
    const at = (context?.currentTime ?? 0) + AUDIO.engine.hushS * 4
    for (const out of [old.engineOut, old.whineOut, old.hissOut, old.trackOut, ...[old.tapeOut, old.trackTapeOut].filter((out) => out !== null)]) {
      out.gain.cancelScheduledValues(0)
      out.gain.setTargetAtTime(0, context?.currentTime ?? 0, AUDIO.engine.hushS)
    }
    for (const source of old.sources) source.stop(at)
  }

  function drone(voice: TankVoice, levels: Drone): void {
    if (!enabled) return
    const ctx = ready()
    if (!ctx || !master || ctx.state !== 'running') return
    if (nodes && nodes.voice !== voice) still()
    nodes ??= build(ctx, master, voice)
    if (engineTape && !nodes.tape) {
      const added = addTape(ctx, nodes, engineTape, AUDIO.engineTape)
      nodes.tape = added.source
      nodes.tapeOut = added.out
    }
    if (trackTape && !nodes.trackTape) {
      const added = addTape(ctx, nodes, trackTape, AUDIO.trackTape)
      nodes.trackTape = added.source
      nodes.trackTapeOut = added.out
    }
    const E = AUDIO.engine
    const tone = E.voices[voice.engine]
    const now = ctx.currentTime
    const glide = (param: AudioParam, value: number): void => {
      param.setTargetAtTime(value, now, E.followS)
    }
    glide(nodes.engine.frequency, levels.engineHz)
    glide(nodes.sub.frequency, levels.engineHz / 2)
    glide(nodes.bright.frequency, levels.engineHz * tone.bright)
    glide(nodes.chug.frequency, levels.engineHz * tone.chugRatio)
    glide(nodes.whine.frequency, Math.max(1, levels.whineHz))
    glide(nodes.beat.frequency, Math.max(0.01, levels.beatHz))
    if (nodes.tape) glide(nodes.tape.playbackRate, levels.tapeRate)
    if (nodes.trackTape) glide(nodes.trackTape.playbackRate, levels.trackRate)
    // Each loudness is set, and then told to fade if no new picture comes.
    const hold = (param: AudioParam, value: number): void => {
      param.cancelScheduledValues(now)
      param.setTargetAtTime(value, now, E.followS)
      param.setTargetAtTime(0, now + E.hushAfterS, E.hushS)
    }
    hold(nodes.engineOut.gain, levels.engineGain * E.gain * (nodes.tape ? AUDIO.engineTape.synthGain : 1))
    if (nodes.tapeOut) hold(nodes.tapeOut.gain, levels.engineGain * E.gain * AUDIO.engineTape.gain)
    hold(nodes.whineOut.gain, levels.engineGain * E.gain * tone.whine * E.whineGain)
    hold(nodes.hissOut.gain, levels.engineGain * E.gain * tone.hiss)
    hold(nodes.trackOut.gain, levels.trackGain * AUDIO.tracks.gain * (nodes.trackTape ? AUDIO.trackTape.synthGain : 1))
    if (nodes.trackTapeOut) hold(nodes.trackTapeOut.gain, levels.trackGain * AUDIO.tracks.gain * AUDIO.trackTape.gain)
  }

  return { on: () => enabled, setOn, wake, cue, drone, air, still }
}
