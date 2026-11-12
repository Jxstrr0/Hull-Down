// The range officer's voice: each line said on the moment it belongs to, one
// at a time, and each file as long as the table says, so the timing checked
// here is the timing heard.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { AUDIO, VOICE_LINE_IDS, type VoiceLineId } from '../src/data/audio'
import { BASELINE_SPEC } from '../src/data/baseline'
import { GUNNERY_TEST_IDS } from '../src/data/range'
import { RENDER } from '../src/data/render'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { callOf, createRunOfficer, createShootOfficer, createVoiceQueue } from '../src/audio/cues'
import { reelOf } from '../src/render/shootReel'
import { runGunnery, type GunneryRun } from '../src/sim/trials'
import { buildStatSheet, type StatSheet, type VehicleSpec } from '../src/sim/vehicle'

const V = AUDIO.voice
const K = RENDER.shoot
const STEP = 1 / 60

function build(change?: (spec: VehicleSpec) => void): StatSheet {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return buildStatSheet(spec, PACT_LIMITS_GEN1)
}

/** Seconds an MP3 runs, from the frame count its encoder wrote at the front. */
function mp3Seconds(file: string): number {
  const bytes = readFileSync(`public/${file}`)
  const tag = Math.max(bytes.indexOf('Info'), bytes.indexOf('Xing'))
  expect(tag, file).toBeGreaterThan(0)
  expect(bytes.readUInt32BE(tag + 4) & 1, file).toBe(1)
  return (bytes.readUInt32BE(tag + 8) * 1152) / 44100
}

interface Said { line: VoiceLineId; momentS: number; atS: number | null }

/** A whole shoot watched from the start, as a phone at sixty frames a second would hear it. */
function listen(run: GunneryRun, sheet: StatSheet) {
  const reel = reelOf(run, sheet.fire)
  const officer = createShootOfficer()
  const queue = createVoiceQueue()
  const said: Said[] = []
  const frames = []
  for (let t = 0; t <= reel.lengthS + 0.1; t += STEP) {
    const frame = reel.at(t)
    frames.push({ t, frame })
    for (const line of officer.hear(run, frame, true)) said.push({ line, momentS: t, atS: queue.slot(t, V.lines[line].speechS) })
  }
  return { reel, said, frames }
}

const sheets = [
  build(),
  // A plain day sight and no stabiliser: more misses and more targets gone before a shot.
  build((spec) => { spec.fireControl.stabiliser = 'none'; spec.fireControl.rangefinder = 'stadiametric' }),
]
const runs = sheets.flatMap((sheet) => [101, 102, 103, 107, 131, 140, 151].flatMap((seed) => GUNNERY_TEST_IDS.map((id) => ({ sheet, run: runGunnery(sheet.fire, id, seed) }))))

describe('the range officer\'s voice', () => {
  it('has a file for every line, as long as the table says', () => {
    expect(Object.keys(V.lines).sort()).toEqual([...VOICE_LINE_IDS].sort())
    for (const line of VOICE_LINE_IDS) {
      // An MP3 encoder adds a few hundredths of a second at each end.
      expect(Math.abs(mp3Seconds(V.lines[line].file) - V.lines[line].speechS), line).toBeLessThan(0.08)
    }
  })

  it('says each line in the time the shoot gives it', () => {
    // A call fits on the strike before the next round is worked up; the target is up before the gun fires.
    for (const line of ['hit', 'missShort', 'missOver', 'missLeft', 'missRight'] as const) expect(V.lines[line].speechS, line).toBeLessThan(K.strikeS)
    expect(V.lines.targetUp.speechS).toBeLessThan(K.waitS)
    expect(V.lines.notSeen.speechS).toBeLessThan(K.passS)
  })

  it('calls every round as it lands, the right call, on time', () => {
    for (const { run, sheet } of runs) {
      const { reel, said } = listen(run, sheet)
      const calls = said.filter((each) => ['hit', 'missShort', 'missOver', 'missLeft', 'missRight'].includes(each.line))
      const shots = run.targets.flatMap((target) => target.shots)
      expect(calls.map((each) => each.line)).toEqual(shots.map(callOf))
      for (const [n, call] of calls.entries()) {
        // Said as the round lands, after the gun that fired it.
        expect(call.momentS).toBeGreaterThan(reel.firedS[n]!)
        expect(reel.at(call.momentS).phase).toBe('strike')
        expect(call.atS, `${run.test} ${n}`).not.toBeNull()
        expect(call.atS! - call.momentS, `${run.test} ${n}`).toBeLessThan(0.25)
      }
    }
  })

  it('says the target is up before the gun fires, and a jam in place of it', () => {
    let up = 0
    for (const { run, sheet } of runs) {
      const { reel, said } = listen(run, sheet)
      const ups = said.filter((each) => each.line === 'targetUp')
      const fired = reel.firedS
      for (const each of ups) {
        if (each.atS === null) continue
        up++
        const next = fired.find((s) => s >= each.momentS)
        if (next !== undefined) expect(each.atS + V.lines.targetUp.speechS, run.test).toBeLessThanOrEqual(next + 0.05)
      }
      const jams = run.targets.flatMap((target) => target.shots).filter((shot) => shot.jammed).length
      expect(said.filter((each) => each.line === 'jam')).toHaveLength(jams)
    }
    expect(up).toBeGreaterThan(50)
  })

  it('tells of targets not seen or gone before a shot, and ends with cease fire, once', () => {
    let notSeen = 0
    for (const { run, sheet } of runs) {
      const { said } = listen(run, sheet)
      notSeen += said.filter((each) => each.line === 'notSeen').length
      expect(said.filter((each) => each.line === 'notSeen')).toHaveLength(run.unseen)
      expect(said.filter((each) => each.line === 'noShot')).toHaveLength(run.tooSlow)
      expect(said.filter((each) => each.line === 'ceaseFire')).toHaveLength(1)
      expect(said.at(-1)!.line).toBe('ceaseFire')
    }
    expect(notSeen).toBeGreaterThan(0)
  })

  it('never talks over itself, and lets go of very little', () => {
    let total = 0
    let dropped = 0
    for (const { run, sheet } of runs) {
      const { said } = listen(run, sheet)
      const spoken = said.filter((each) => each.atS !== null)
      for (let n = 1; n < spoken.length; n++) {
        expect(spoken[n]!.atS!).toBeGreaterThanOrEqual(spoken[n - 1]!.atS! + V.lines[spoken[n - 1]!.line].speechS - 1e-9)
      }
      total += said.length
      dropped += said.length - spoken.length
    }
    expect(dropped / total).toBeLessThan(0.05)
  })

  it('says nothing while the shoot is held still, or opened at its end', () => {
    const { run, sheet } = runs[0]!
    const reel = reelOf(run, sheet.fire)
    const officer = createShootOfficer()
    expect(officer.hear(run, reel.at(1), false)).toEqual([])
    expect(createShootOfficer().hear(run, reel.at(reel.lengthS), true)).toEqual([])
  })

  it('calls the range clear at the start of a drive, and each breakdown once, again after going back to the start', () => {
    const officer = createRunOfficer()
    const stop = {}
    expect(officer.hear(0, true, null)).toEqual(['rangeClear'])
    expect(officer.hear(1, true, null)).toEqual([])
    expect(officer.hear(2, true, stop)).toEqual(['breakdown'])
    expect(officer.hear(3, true, stop)).toEqual([])
    expect(officer.hear(4, true, null)).toEqual([])
    expect(officer.hear(0, true, null)).toEqual(['rangeClear'])
    // Opened part of the way through: the range is not called clear.
    expect(createRunOfficer().hear(5, true, null)).toEqual([])
    expect(createRunOfficer().hear(0, false, null)).toEqual([])
  })
})
