import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { GUNNERY_TEST_IDS, RANGE } from '../src/data/range'
import { RENDER } from '../src/data/render'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { VIEWS, shotAt, type Scene } from '../src/render/director'
import { reelOf } from '../src/render/shootReel'
import { flightOf } from '../src/sim/gunnery/fire'
import { runGunnery, type GunneryRun } from '../src/sim/trials'
import { buildStatSheet, type StatSheet, type VehicleSpec } from '../src/sim/vehicle'

function build(change?: (spec: VehicleSpec) => void): StatSheet {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return buildStatSheet(spec, PACT_LIMITS_GEN1)
}

const K = RENDER.shoot
const base = build()
const SEEDS = [101, 102, 103, 107, 131]
const runs = (sheet: StatSheet): GunneryRun[] =>
  SEEDS.flatMap((seed) => GUNNERY_TEST_IDS.map((id) => runGunnery(sheet.fire, id, seed)))

/** Every moment of a reel, a tenth of a second apart. */
function frames(run: GunneryRun, sheet: StatSheet) {
  const reel = reelOf(run, sheet.fire)
  const out = []
  for (let t = 0; t <= reel.lengthS + 0.05; t += 0.1) out.push({ t, ...reel.at(t) })
  return { reel, out }
}

describe('a shoot laid out for watching', () => {
  it('shows every target in turn and ends on the last', () => {
    for (const run of runs(base)) {
      const { reel, out } = frames(run, base)
      const seen = [...new Set(out.map((frame) => frame.targetIndex))]
      expect(seen).toEqual(run.targets.map((_, index) => index))
      expect(reel.at(0).done).toBe(false)
      expect(reel.at(reel.lengthS).done).toBe(true)
      expect(reel.at(reel.lengthS + 5)).toEqual(reel.at(reel.lengthS))
      expect(reel.at(-1)).toEqual(reel.at(0))
    }
  })

  it('fires every round the sim fired, in order, and counts the same hits', () => {
    for (const run of runs(base)) {
      const reel = reelOf(run, base.fire)
      expect(reel.firedS).toHaveLength(run.roundsFired)
      expect(reel.firedS).toEqual([...reel.firedS].sort((a, b) => a - b))
      const end = reel.at(reel.lengthS)
      expect(end.rounds).toBe(run.roundsFired)
      expect(end.hits).toBe(run.hits)
    }
  })

  it('is short enough to watch: under a minute, whatever the real test took', () => {
    for (const sheet of [base, build((s) => { s.loading = 'loader'; s.fireControl.rangefinder = 'stadiametric' })]) {
      for (const run of runs(sheet)) {
        const { lengthS } = reelOf(run, sheet.fire)
        expect(lengthS).toBeGreaterThan(5)
        expect(lengthS).toBeLessThan(60)
        // Each round costs the wait, its flight and the hold; each target that drew none costs a pass.
        const quiet = run.targets.filter((target) => target.shots.length === 0).length
        expect(lengthS).toBeGreaterThanOrEqual(run.roundsFired * (K.waitS + K.flightMinS + K.strikeS) + quiet * K.passS - 1e-9)
        expect(lengthS).toBeLessThanOrEqual(run.roundsFired * (K.waitS + K.flightMaxS + K.strikeS) + quiet * K.passS + 1e-9)
      }
    }
  })

  it('counts the clock of the real test up to each shot and never back within a target', () => {
    for (const run of runs(base)) {
      const { out } = frames(run, base)
      for (let i = 1; i < out.length; i++) {
        const a = out[i - 1]!
        const b = out[i]!
        if (a.targetIndex === b.targetIndex) expect(b.clockS).toBeGreaterThanOrEqual(a.clockS - 1e-9)
        else expect(b.clockS).toBeLessThan(a.clockS + 1e-9)
      }
      // At the moment each round leaves the gun the clock reads what the sim says.
      const reel = reelOf(run, base.fire)
      const shots = run.targets.flatMap((target) => target.shots)
      reel.firedS.forEach((atS, index) => {
        expect(reel.at(atS).clockS).toBeCloseTo(shots[index]!.atS, 6)
        expect(reel.at(atS).phase).toBe('flight')
      })
    }
  })

  it('shows a round in the air for as long as it really flew, within its limits', () => {
    const run = runGunnery(base.fire, 'halted', 101)
    const reel = reelOf(run, base.fire)
    let n = 0
    for (const target of run.targets) {
      const round = base.fire.rounds.find((each) => each.id === target.round)!
      const real = flightOf(round, target.rangeM).timeS
      const shown = Math.min(K.flightMaxS, Math.max(K.flightMinS, real))
      for (const _ of target.shots) {
        const firedS = reel.firedS[n++]!
        expect(reel.at(firedS + shown * 0.5).flightShare).toBeCloseTo(0.5, 6)
        expect(reel.at(firedS + shown * 0.5).sinceFiredS).toBeCloseTo(shown * 0.5, 6)
        expect(reel.at(firedS + shown + 0.01).phase).toBe('strike')
        expect(reel.at(firedS + shown + 0.01).flightShare).toBeNull()
      }
    }
    expect(n).toBe(run.roundsFired)
  })

  it('lands a round before it counts it, and drops the board a moment after a hit', () => {
    for (const run of runs(base)) {
      const { out } = frames(run, base)
      for (const frame of out) {
        const target = run.targets[frame.targetIndex]!
        expect(frame.landed).toBeLessThanOrEqual(target.shots.length)
        if (frame.phase === 'flight') expect(frame.landed).toBe(frame.shotIndex)
        if (frame.phase === 'strike') expect(frame.landed).toBe(frame.shotIndex + 1)
        if (frame.fallen) expect(frame.struck).toBe(true)
        if (frame.struck) expect(target.hit).toBe(true)
      }
      // Every target that was hit is seen standing with its hit, then down.
      run.targets.forEach((target, index) => {
        if (!target.hit) return
        const mine = out.filter((frame) => frame.targetIndex === index)
        expect(mine.some((frame) => frame.struck && !frame.fallen)).toBe(true)
        expect(mine.at(-1)!.fallen).toBe(true)
      })
    }
  })

  it('passes over a target that drew no shot, and says which kind it was', () => {
    const blind = build((s) => { s.fireControl.night = 'none' })
    const run = runGunnery(blind.fire, 'night', 101)
    expect(run.unseen).toBeGreaterThan(0)
    const { out } = frames(run, blind)
    run.targets.forEach((target, index) => {
      if (target.shots.length > 0) return
      const mine = out.filter((frame) => frame.targetIndex === index)
      expect(new Set(mine.map((frame) => frame.phase))).toEqual(new Set([target.seen ? 'tooSlow' : 'unseen']))
      expect(mine.every((frame) => frame.flightShare === null && frame.landed === 0)).toBe(true)
    })
  })

  it('stands the tank still for the halted and night shoots and drives it on the move', () => {
    for (const seed of SEEDS) {
      for (const id of ['halted', 'night'] as const) {
        const { out } = frames(runGunnery(base.fire, id, seed), base)
        expect(out.every((frame) => frame.tankM === 0 && frame.speedKmh === 0)).toBe(true)
      }
      const { out } = frames(runGunnery(base.fire, 'onTheMove', seed), base)
      expect(out.every((frame) => frame.speedKmh === K.driveKmh)).toBe(true)
      for (let i = 1; i < out.length; i++) expect(out[i]!.tankM).toBeGreaterThanOrEqual(out[i - 1]!.tankM)
      expect(out.at(-1)!.tankM).toBeGreaterThan(50)
    }
  })

  it('halts a tank with no stabiliser for each shot', () => {
    const plain = build((s) => { s.fireControl.stabiliser = 'none' })
    const run = runGunnery(plain.fire, 'onTheMove', 101)
    expect(run.halted).toBe(true)
    const { out } = frames(run, plain)
    const firing = out.filter((frame) => frame.phase === 'flight' || frame.phase === 'strike')
    expect(firing.length).toBeGreaterThan(0)
    expect(firing.every((frame) => frame.speedKmh === 0)).toBe(true)
    expect(out.some((frame) => frame.speedKmh === K.driveKmh)).toBe(true)
  })

  it('stands each board its range down the lane from where the tank was, on ground the range has', () => {
    for (const run of runs(base)) {
      const { out } = frames(run, base)
      run.targets.forEach((target, index) => {
        const mine = out.filter((frame) => frame.targetIndex === index)
        const places = new Set(mine.map((frame) => frame.boardM))
        expect(places.size).toBe(1)
        // The first moment looked at is up to a tenth of a second into the target, so the tank may have rolled a little.
        expect(Math.abs(mine[0]!.boardM - mine[0]!.tankM - target.rangeM)).toBeLessThan(1)
        expect(mine[0]!.boardM).toBeLessThan(K.toM - RENDER.fog.farM / 2)
      })
      // The tank never drives off the end of its lane.
      expect(out.at(-1)!.tankM).toBeLessThan(K.laneToM)
    }
  })

  it('has nothing to show for a shoot with no targets, and says it is over', () => {
    const empty: GunneryRun = { ...runGunnery(base.fire, 'halted', 101), targets: [], roundsFired: 0, hits: 0 }
    const reel = reelOf(empty, base.fire)
    expect(reel.lengthS).toBe(0)
    expect(reel.at(0).done).toBe(true)
  })
})

describe('the camera on a shoot', () => {
  const pose = { x: 40, y: 0, pitchRad: 0 }
  const board = { x: 1240, y: 1.45, z: 0 }
  const scene = (onTarget: boolean): Scene => ({ test: 'shoot', board, onTarget })

  it('stays with the tank until a round is near the board, then stands by the board', () => {
    const withTank = shotAt('director', scene(false), pose)
    expect(Math.abs(withTank.to.x - pose.x)).toBeLessThan(1)
    expect(Math.abs(withTank.from.x - pose.x)).toBeLessThan(30)
    const byBoard = shotAt('director', scene(true), pose)
    expect(byBoard.to).toEqual(board)
    expect(byBoard.from.x).toBeLessThan(board.x)
    expect(board.x - byBoard.from.x).toBeLessThan(40)
    expect(byBoard.from.y).toBeGreaterThan(0)
  })

  it('travels with the tank in the other views, whatever the round is doing', () => {
    for (const view of VIEWS) {
      if (view === 'director') continue
      expect(shotAt(view, scene(true), pose)).toEqual(shotAt(view, scene(false), pose))
      expect(shotAt(view, scene(true), pose).to.x).toBeCloseTo(pose.x, 6)
    }
  })

  it('cuts to the board part of the way through the flight', () => {
    expect(RENDER.camera.director.shoot.cutShare).toBeGreaterThan(0)
    expect(RENDER.camera.director.shoot.cutShare).toBeLessThan(1)
  })
})

describe('the words on a shoot', () => {
  it('names every firing test for a screen reader', () => {
    for (const id of GUNNERY_TEST_IDS) expect(STRINGS.range.view.label[id]).toContain('3D')
  })

  it('keeps the board marks within the board the report draws', () => {
    expect(K.markM).toBeLessThan(RANGE.gunnery.plotM)
    expect(K.fallAfterS).toBeLessThan(K.strikeS)
    expect(K.flashS).toBeLessThan(K.flightMinS)
  })
})
