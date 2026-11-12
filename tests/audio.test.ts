import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createShootEar, droneAt, gunShape, revsAt, strikeOf, voiceOf, type TankVoice } from '../src/audio/cues'
import { createSound } from '../src/audio/sound'
import { AUDIO, CUE_IDS } from '../src/data/audio'
import { BASELINE_SPEC } from '../src/data/baseline'
import { ENGINES, GUNS } from '../src/data/parts'
import { GUNNERY_TEST_IDS } from '../src/data/range'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { SOUND_KEY, loadSound, parseSound, saveSound } from '../src/persist/soundStore'
import { reelOf } from '../src/render/shootReel'
import { runGunnery, type ShotRecord } from '../src/sim/trials'
import { buildStatSheet } from '../src/sim/vehicle'

const VOICE = voiceOf(BASELINE_SPEC)
const shot = (over: Partial<ShotRecord>): ShotRecord => ({ atS: 1, acrossM: 0, upM: 0, hit: false, cause: null, jammed: false, ...over })

describe('the cue map', () => {
  it('has every cue, each made of layers a browser can play', () => {
    for (const id of CUE_IDS) {
      const layers = AUDIO.cues[id]
      expect(layers.length).toBeGreaterThan(0)
      for (const layer of layers) {
        // A slide between two notes cannot start or end at nought.
        expect(layer.fromHz).toBeGreaterThan(0)
        expect(layer.toHz).toBeGreaterThan(0)
        expect(layer.attackS).toBeGreaterThan(0)
        expect(layer.decayS).toBeGreaterThan(0)
        expect(layer.gain).toBeGreaterThan(0)
        expect(layer.gain).toBeLessThanOrEqual(1)
        if (layer.kind === 'tone') expect(layer.wave).toBeDefined()
        else expect(layer.filter).toBeDefined()
      }
    }
  })

  it('tells a hit, a miss and a round that fell short apart by ear', () => {
    const shape = (id: (typeof CUE_IDS)[number]): string => AUDIO.cues[id].map((layer) => `${layer.kind}:${layer.fromHz}`).join(',')
    expect(new Set(['hit', 'miss', 'short'].map((id) => shape(id as 'hit'))).size).toBe(3)
    // The board rings; the ground does not.
    expect(AUDIO.cues.hit.filter((layer) => layer.kind === 'tone' && layer.fromHz > 400).length).toBeGreaterThanOrEqual(2)
    expect(AUDIO.cues.short.every((layer) => layer.kind === 'noise' || layer.fromHz < 200)).toBe(true)
  })

  it('has a voice for every kind of engine in the parts list', () => {
    for (const engine of Object.values(ENGINES)) {
      const voice = AUDIO.engine.voices[engine.kind]
      expect(voice.fullHz).toBeGreaterThan(voice.idleHz)
    }
    expect(AUDIO.engine.voices.gasTurbine.whine).toBeGreaterThan(0)
    expect(AUDIO.engine.voices.diesel.whine).toBe(0)
  })
})

describe('a tank on the move', () => {
  it('takes its voice from its engine, its gearbox and its gun', () => {
    expect(VOICE.engine).toBe(ENGINES[BASELINE_SPEC.powerpack.engine].kind)
    expect(VOICE.calibreMm).toBe(GUNS[BASELINE_SPEC.gun].calibreMm)
    expect(VOICE.gears).toBeGreaterThan(1)
  })

  it('ticks over at a halt with silent tracks', () => {
    const still = droneAt(VOICE, 0)
    expect(revsAt(VOICE, 0)).toEqual({ gear: 0, revs: 0 })
    expect(still.trackGain).toBe(0)
    expect(still.beatHz).toBe(0)
    expect(still.engineGain).toBeCloseTo(AUDIO.engine.idleGain)
  })

  it('climbs through each gear and falls back at the change', () => {
    const span = VOICE.gearedKmh / VOICE.gears
    const low = droneAt(VOICE, span * 0.2)
    const high = droneAt(VOICE, span * 0.95)
    const changed = droneAt(VOICE, span * 1.05)
    expect(high.engineHz).toBeGreaterThan(low.engineHz)
    expect(changed.engineHz).toBeLessThan(high.engineHz)
    expect(revsAt(VOICE, span * 1.05).gear).toBe(1)
    // Flat out in top gear is as high as it goes, however fast the tank is said to be.
    expect(revsAt(VOICE, VOICE.gearedKmh * 2)).toEqual({ gear: VOICE.gears - 1, revs: 1 })
  })

  it('clatters faster and louder with speed, up to a limit', () => {
    const slow = droneAt(VOICE, 5)
    const quick = droneAt(VOICE, 40)
    expect(quick.beatHz).toBeGreaterThan(slow.beatHz)
    expect(quick.trackGain).toBeGreaterThan(slow.trackGain)
    expect(droneAt(VOICE, 200).beatHz).toBe(AUDIO.tracks.maxBeatHz)
    expect(droneAt(VOICE, 200).trackGain).toBe(1)
  })

  it('sings lower with a bigger engine of the same kind', () => {
    const small: TankVoice = { ...VOICE, engine: 'diesel', powerHp: 580 }
    const big: TankVoice = { ...VOICE, engine: 'diesel', powerHp: 780 }
    expect(droneAt(big, 20).engineHz).toBeLessThan(droneAt(small, 20).engineHz)
  })

  it('whines when it is a turbine, higher the harder it works', () => {
    const turbine: TankVoice = { ...VOICE, engine: 'gasTurbine', powerHp: 1000 }
    expect(droneAt(turbine, 30).whineHz).toBeGreaterThan(droneAt(turbine, 0).whineHz)
  })
})

describe('the gun and where its rounds land', () => {
  it('is lower and longer the bigger the calibre', () => {
    const small = gunShape(100)
    const big = gunShape(125)
    expect(gunShape(AUDIO.gun.refCalibreMm)).toEqual({ pitch: 1, stretch: 1 })
    expect(big.pitch).toBeLessThan(small.pitch)
    expect(big.stretch).toBeGreaterThan(small.stretch)
  })

  it('knows a hit, a round in the ground short of the board, and one that went by', () => {
    expect(strikeOf(shot({ hit: true }))).toBe('hit')
    expect(strikeOf(shot({ upM: -2 }))).toBe('short')
    expect(strikeOf(shot({ upM: 2 }))).toBe('miss')
    expect(strikeOf(shot({ acrossM: 3, upM: -1 }))).toBe('miss')
  })

  it('is heard once for every round fired and once for every round landed', () => {
    const sheet = buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1)
    for (const id of GUNNERY_TEST_IDS) {
      const run = runGunnery(sheet.fire, id, 101)
      const reel = reelOf(run, sheet.fire)
      const ear = createShootEar()
      const heard: string[] = []
      for (let t = 0; t <= reel.lengthS; t += 1 / 30) heard.push(...ear.hear(run, reel.at(t), true))
      const shots = run.targets.flatMap((target) => target.shots)
      expect(heard.filter((cue) => cue === 'gun').length).toBe(shots.length)
      expect(heard.filter((cue) => cue !== 'gun')).toEqual(shots.map(strikeOf))
    }
  })

  it('makes no sound while the run is held still, or for a moment already heard', () => {
    const sheet = buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1)
    const run = runGunnery(sheet.fire, 'halted', 101)
    const reel = reelOf(run, sheet.fire)
    const fired = reel.firedS[0]!
    const ear = createShootEar()
    // Dragged over the shot with the run paused.
    expect(ear.hear(run, reel.at(fired - 0.1), false)).toEqual([])
    expect(ear.hear(run, reel.at(fired + 0.01), false)).toEqual([])
    // Played on from there: the same moment is not heard again.
    expect(ear.hear(run, reel.at(fired + 0.05), true)).toEqual([])
    // A view opened well into a flight missed the gun.
    const late = createShootEar()
    const flight = reel.at(fired + 0.01)
    expect(late.hear(run, { ...flight, flightShare: 0.8 }, true)).toEqual([])
  })
})

describe('the sound switch', () => {
  it('is on until it is clearly switched off, and remembers', () => {
    expect(parseSound(null)).toBe(true)
    expect(parseSound('on')).toBe(true)
    expect(parseSound('nonsense')).toBe(true)
    expect(parseSound('off')).toBe(false)
    const kept = new Map<string, string>()
    const storage = { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => void kept.set(key, value) }
    expect(loadSound(storage)).toBe(true)
    saveSound(false, storage)
    expect([...kept.keys()]).toEqual([SOUND_KEY])
    expect(SOUND_KEY.startsWith('hulldown.')).toBe(true)
    expect(loadSound(storage)).toBe(false)
    saveSound(true, storage)
    expect(loadSound(storage)).toBe(true)
  })

  it('does not throw when storage is blocked', () => {
    const blocked = {
      getItem: (): string | null => { throw new Error('blocked') },
      setItem: (): void => { throw new Error('blocked') },
    }
    expect(loadSound(blocked)).toBe(true)
    expect(() => saveSound(false, blocked)).not.toThrow()
  })

  it('says what it is in words, not by colour', () => {
    expect(STRINGS.sound.on).not.toBe(STRINGS.sound.off)
    expect(STRINGS.sound.turnOn.length).toBeGreaterThan(0)
    expect(STRINGS.sound.turnOff.length).toBeGreaterThan(0)
  })
})

/** A stand-in for the browser's sound: it answers anything, and counts what was asked of it. */
function fakeContext(): { context: AudioContext; calls: Map<string, number> } {
  const calls = new Map<string, number>()
  const facts: Record<string, unknown> = { state: 'running', currentTime: 0, sampleRate: 10 }
  // Everything is both a thing with parts and a thing that can be called.
  const part = (name: string): unknown =>
    new Proxy(function () {}, {
      get: (_target, key) => {
        if (typeof key !== 'string' || key === 'then') return undefined
        return key in facts ? facts[key] : part(key)
      },
      set: () => true,
      apply: () => {
        calls.set(name, (calls.get(name) ?? 0) + 1)
        return name === 'getChannelData' ? new Float32Array(20) : anything
      },
    })
  const anything = part('')
  return { context: anything as AudioContext, calls }
}

describe('the synth', () => {
  it('does nothing, quietly, where there is no sound to be had', () => {
    const sound = createSound(true, () => null)
    expect(() => {
      sound.wake()
      sound.cue('gun', { calibreMm: 115 })
      sound.drone(VOICE, droneAt(VOICE, 20))
      sound.still()
      sound.setOn(false)
      sound.setOn(true)
    }).not.toThrow()
    expect(sound.on()).toBe(true)
  })

  it('makes nothing at all while it is switched off', () => {
    const fake = fakeContext()
    let made = 0
    const sound = createSound(false, () => {
      made++
      return fake.context
    })
    sound.wake()
    sound.cue('hit')
    sound.drone(VOICE, droneAt(VOICE, 20))
    expect(made).toBe(0)
    expect(sound.on()).toBe(false)
  })

  it('plays every layer of a cue', () => {
    const fake = fakeContext()
    const sound = createSound(true, () => fake.context)
    sound.wake()
    const before = (fake.calls.get('createOscillator') ?? 0) + (fake.calls.get('createBufferSource') ?? 0)
    sound.cue('hit')
    const after = (fake.calls.get('createOscillator') ?? 0) + (fake.calls.get('createBufferSource') ?? 0)
    expect(after - before).toBe(AUDIO.cues.hit.length)
  })

  it('builds one engine for a tank, keeps it while pictures come, and gives it back', () => {
    const fake = fakeContext()
    const sound = createSound(true, () => fake.context)
    sound.drone(VOICE, droneAt(VOICE, 10))
    const built = fake.calls.get('createOscillator')
    expect(built).toBeGreaterThan(0)
    sound.drone(VOICE, droneAt(VOICE, 20))
    expect(fake.calls.get('createOscillator')).toBe(built)
    expect(fake.calls.get('stop')).toBeUndefined()
    sound.still()
    expect(fake.calls.get('stop')).toBe(fake.calls.get('start'))
    // Switched off, a running engine is given back too.
    sound.drone(VOICE, droneAt(VOICE, 20))
    sound.setOn(false)
    expect(fake.calls.get('stop')).toBe(fake.calls.get('start'))
  })

  it('makes one wind outdoors, keeps it while pictures come, and gives it back', () => {
    const fake = fakeContext()
    const sound = createSound(true, () => fake.context)
    sound.air()
    const started = fake.calls.get('start')
    expect(started).toBeGreaterThan(0)
    sound.air()
    sound.air()
    expect(fake.calls.get('start')).toBe(started)
    expect(fake.calls.get('stop')).toBeUndefined()
    sound.still()
    expect(fake.calls.get('stop')).toBe(started)
    // Quiet enough to sit under everything else, and never sudden.
    expect(AUDIO.wind.gain).toBeLessThan(AUDIO.engine.gain * AUDIO.engine.idleGain)
    expect(AUDIO.wind.riseS).toBeGreaterThan(AUDIO.fadeS)
    // Switched off, there is no wind at all.
    sound.setOn(false)
    sound.air()
    expect(fake.calls.get('start')).toBe(started)
  })

  it('lays a recording over a cue once it has arrived, and plays the synth alone until then', async () => {
    const fake = fakeContext()
    const asked: string[] = []
    const sound = createSound(true, () => fake.context, (file) => {
      asked.push(file)
      return Promise.resolve(file === AUDIO.recordings.hit.file ? null : new ArrayBuffer(8))
    })
    const sources = (): number => fake.calls.get('createBufferSource') ?? 0
    sound.wake()
    let before = sources()
    sound.cue('short')
    const alone = sources() - before
    await new Promise((done) => setTimeout(done, 0))
    expect(asked).toEqual([...Object.values(AUDIO.recordings).map((each) => each.file), AUDIO.engineTape.file])
    before = sources()
    sound.cue('short')
    expect(sources() - before).toBe(alone + 1)
    // One that could not be fetched is done without.
    before = sources()
    sound.cue('hit')
    expect(sources() - before).toBe(AUDIO.cues.hit.filter((layer) => layer.kind === 'noise').length)
  })
})

describe('the engine recording', () => {
  it('plays faster the harder the engine works, and slower for a bigger engine', () => {
    const idle = droneAt(VOICE, 0).tapeRate
    const top = Math.max(...[5, 10, 20, 30, 40, 60].map((kmh) => droneAt(VOICE, kmh).tapeRate))
    expect(top).toBeGreaterThan(idle)
    expect(droneAt({ ...VOICE, powerHp: VOICE.powerHp * 2 }, 0).tapeRate).toBeLessThan(idle)
    for (const tone of Object.values(AUDIO.engine.voices)) {
      expect(tone.tapeIdle).toBeGreaterThan(0.5)
      expect(tone.tapeFull).toBeLessThan(2)
    }
  })

  it('goes into the engine once it has arrived, round and round, and stops with it', async () => {
    const fake = fakeContext()
    const sound = createSound(true, () => fake.context, () => Promise.resolve(new ArrayBuffer(8)))
    const sources = (): number => fake.calls.get('createBufferSource') ?? 0
    sound.wake()
    sound.drone(VOICE, droneAt(VOICE, 10))
    const before = sources()
    await new Promise((done) => setTimeout(done, 0))
    sound.drone(VOICE, droneAt(VOICE, 20))
    expect(sources() - before).toBe(1)
    sound.drone(VOICE, droneAt(VOICE, 30))
    expect(sources() - before).toBe(1)
    sound.still()
    expect(fake.calls.get('stop')).toBe(fake.calls.get('start'))
  })

  it('is in the build, and is played round inside the file, never across its ends', () => {
    const T = AUDIO.engineTape
    expect(T.file).toMatch(/^audio\/[a-z]+\.mp3$/)
    expect(existsSync(`public/${T.file}`)).toBe(true)
    // The file holds the loop twice over.
    expect(T.fromS).toBeGreaterThan(0.5)
    expect(T.fromS + T.loopS).toBeLessThan(2 * T.loopS - 0.5)
    expect(T.synthGain).toBeLessThan(1)
  })
})

describe('the recordings', () => {
  it('are all in the build, small, and of a kind every phone can play', () => {
    for (const each of Object.values(AUDIO.recordings)) {
      expect(each.file).toMatch(/^audio\/[a-z]+\.mp3$/)
      expect(existsSync(`public/${each.file}`)).toBe(true)
      expect(each.gain).toBeGreaterThan(0)
      expect(each.synthGain).toBeLessThanOrEqual(1)
    }
  })
})
