import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { GUNNERY } from '../src/data/gunnery'
import { GUNNERY_TEST_IDS, MARKS_GEN1, RANGE, type GunneryTestId } from '../src/data/range'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { bell } from '../src/sim/rng'
import { hitChance, RANGE_DAY } from '../src/sim/gunnery/fire'
import { runGunnery, runProvingGround, runRangeJob, type GunneryRun } from '../src/sim/trials'
import { buildStatSheet, type StatSheet, type VehicleSpec } from '../src/sim/vehicle'
import { hitsFix, placeOf, slowFix } from '../src/ui/gunneryAdvice'

function spec(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const out = structuredClone(BASELINE_SPEC)
  change?.(out)
  return out
}

function build(change?: (spec: VehicleSpec) => void): StatSheet {
  return buildStatSheet(spec(change), PACT_LIMITS_GEN1)
}

const SEEDS = Array.from({ length: 200 }, (_, index) => 101 + index)

/** Share of 200 visits to the range on which the design reaches the mark for hits. */
function passRate(sheet: StatSheet, test: GunneryTestId): number {
  return SEEDS.filter((seed) => runGunnery(sheet.fire, test, seed).hits >= MARKS_GEN1.hits[test]).length / SEEDS.length
}

function meanHits(sheet: StatSheet, test: GunneryTestId): number {
  return SEEDS.reduce((sum, seed) => sum + runGunnery(sheet.fire, test, seed).hits, 0) / SEEDS.length
}

describe('the bell curve draw', () => {
  it('is the same for the same name and centred on nought', () => {
    expect(bell(7, 1, 2)).toBe(bell(7, 1, 2))
    expect(bell(7, 1, 2)).not.toBe(bell(7, 1, 3))
    let sum = 0
    let squares = 0
    let within = 0
    const n = 4000
    for (let i = 0; i < n; i++) {
      const draw = bell(99, i)
      sum += draw
      squares += draw * draw
      if (Math.abs(draw) <= 1) within++
    }
    expect(sum / n).toBeCloseTo(0, 1)
    expect(squares / n).toBeCloseTo(1, 1)
    expect(within / n).toBeGreaterThan(0.65)
    expect(within / n).toBeLessThan(0.72)
  })
})

describe('a firing test', () => {
  const base = build()

  it('shoots the same score every time for the same tank and seed', () => {
    for (const id of GUNNERY_TEST_IDS) {
      expect(runGunnery(base.fire, id, 101)).toEqual(runGunnery(base.fire, id, 101))
    }
    const scores = new Set(SEEDS.map((seed) => JSON.stringify(runGunnery(base.fire, 'halted', seed).targets)))
    expect(scores.size).toBeGreaterThan(150)
  })

  it('keeps its books straight', () => {
    for (const id of GUNNERY_TEST_IDS) {
      const layout = RANGE.gunnery.tests[id]
      for (const seed of SEEDS.slice(0, 40)) {
        const run: GunneryRun = runGunnery(base.fire, id, seed)
        expect(run.targets).toHaveLength(layout.targets.length)
        expect(run.hits).toBe(run.targets.filter((target) => target.hit).length)
        expect(run.roundsFired).toBe(run.targets.reduce((sum, target) => sum + target.shots.length, 0))
        expect(run.firstRoundHits).toBeLessThanOrEqual(run.hits)
        for (const target of run.targets) {
          expect(target.shots.length).toBeLessThanOrEqual(RANGE.gunnery.shotsPerTarget)
          if (!target.seen) expect(target.shots).toHaveLength(0)
          target.shots.forEach((shot, index) => {
            expect(shot.atS).toBeLessThanOrEqual(layout.exposureS)
            const onBoard = Math.abs(shot.acrossM) <= GUNNERY.target.widthM / 2 && Math.abs(shot.upM) <= GUNNERY.target.heightM / 2
            expect(shot.hit).toBe(onBoard)
            expect(shot.cause === null).toBe(shot.hit)
            // The crew stops shooting at a target once it is hit.
            if (shot.hit) expect(index).toBe(target.shots.length - 1)
          })
          expect(target.hit).toBe(target.shots.some((shot) => shot.hit))
        }
      }
    }
  })

  it('hits with the first round about as often as the design office said', () => {
    const layout = RANGE.gunnery.tests.halted
    layout.targets.forEach((target, index) => {
      const round = base.fire.rounds.find((each) => each.kind === target.load)!
      const quoted = hitChance(base.fire, round, target.rangeM, RANGE_DAY)
      const firstHits = SEEDS.filter((seed) => runGunnery(base.fire, 'halted', seed).targets[index]!.shots[0]!.hit).length
      expect(Math.abs(firstHits / SEEDS.length - quoted)).toBeLessThan(0.1)
    })
  })

  it('corrects for a miss, so a second round is worth firing', () => {
    const stadia = build((s) => { s.fireControl.rangefinder = 'stadiametric' })
    let firsts = 0
    let seconds = 0
    let secondHits = 0
    let firstHits = 0
    for (const seed of SEEDS) {
      // The far shaped-charge target is where a misread range hurts most.
      const target = runGunnery(stadia.fire, 'halted', seed).targets[2]!
      firsts++
      if (target.shots[0]!.hit) firstHits++
      else if (target.shots[1]) {
        seconds++
        if (target.shots[1].hit) secondHits++
      }
    }
    expect(seconds).toBeGreaterThan(50)
    expect(secondHits / seconds).toBeGreaterThan(firstHits / firsts + 0.1)
  })
})

describe('what the firing tests reward', () => {
  const base = build()

  it('passes the baseline most times on every test', () => {
    for (const id of GUNNERY_TEST_IDS) expect(passRate(base, id)).toBeGreaterThan(0.85)
    expect(base.gunnery.firstShotS).toBeLessThan(MARKS_GEN1.firstShotS)
  })

  it('marks down stadia lines for hits and for time', () => {
    const stadia = build((s) => { s.fireControl.rangefinder = 'stadiametric' })
    expect(meanHits(stadia, 'halted')).toBeLessThan(meanHits(base, 'halted') - 0.5)
    expect(passRate(stadia, 'halted')).toBeLessThan(passRate(base, 'halted') - 0.15)
    expect(stadia.gunnery.firstShotS).toBeGreaterThan(MARKS_GEN1.firstShotS)
    const blames = SEEDS.map((seed) => runGunnery(stadia.fire, 'halted', seed).blame)
    expect(blames.filter((blame) => blame === 'ranging').length).toBeGreaterThan(SEEDS.length / 2)
  })

  it('fails a one-plane stabiliser on the move, and blames the shake', () => {
    const one = build((s) => { s.fireControl.stabiliser = 'singlePlane' })
    expect(passRate(one, 'onTheMove')).toBeLessThan(0.25)
    expect(passRate(one, 'halted')).toBe(passRate(base, 'halted'))
    const blames = SEEDS.map((seed) => runGunnery(one.fire, 'onTheMove', seed).blame)
    expect(blames.filter((blame) => blame === 'shake').length).toBeGreaterThan(SEEDS.length * 0.8)
  })

  it('gives a tank with no stabiliser one round a target, after a halt', () => {
    const none = build((s) => { s.fireControl.stabiliser = 'none' })
    for (const seed of SEEDS.slice(0, 30)) {
      const run = runGunnery(none.fire, 'onTheMove', seed)
      expect(run.halted).toBe(true)
      for (const target of run.targets) expect(target.shots.length).toBeLessThanOrEqual(1)
    }
    expect(runGunnery(none.fire, 'halted', 101).halted).toBe(false)
    expect(meanHits(none, 'onTheMove')).toBeLessThan(meanHits(base, 'onTheMove'))
  })

  it('is blind at night without a night sight, and sees it all with a good one', () => {
    const blind = runGunnery(build((s) => { s.fireControl.night = 'none' }).fire, 'night', 101)
    expect(blind.hits).toBe(0)
    expect(blind.unseen).toBe(blind.targets.length)
    expect(blind.roundsFired).toBe(0)
    expect(blind.firstShotS).toBeNull()
    const starlight = build((s) => { s.fireControl.night = 'imageIntensifier' })
    expect(runGunnery(starlight.fire, 'night', 101).unseen).toBe(0)
    expect(meanHits(starlight, 'night')).toBeGreaterThan(meanHits(base, 'night') + 1)
    expect(passRate(build((s) => { s.fireControl.night = 'none' }), 'night')).toBe(0)
  })

  it('gets a second round off sooner with an autoloader than with a tiring loader', () => {
    const human = build((s) => { s.loading = 'loader' })
    expect(meanHits(human, 'onTheMove')).toBeLessThan(meanHits(base, 'onTheMove') - 0.3)
    expect(passRate(human, 'onTheMove')).toBeLessThan(passRate(base, 'onTheMove') - 0.15)
  })

  it('shoots a rifled gun tighter with good fire control', () => {
    const laser = (gun: VehicleSpec['gun']) => build((s) => {
      s.gun = gun
      s.loading = 'loader'
      s.fireControl.rangefinder = 'laser'
    })
    expect(meanHits(laser('rifled120'), 'halted')).toBeGreaterThan(meanHits(laser('smooth125'), 'halted') + 0.3)
  })
})

describe('the range report', () => {
  it('counts the three firing tests', () => {
    const report = runProvingGround(build(), { seed: 101 })
    expect(report.tests).toBe(3 + GUNNERY_TEST_IDS.length)
    for (const id of GUNNERY_TEST_IDS) {
      const run = report.gunnery[id]
      expect(run.test).toBe(id)
      expect(run.hitsPassed).toBe(run.hits >= MARKS_GEN1.hits[id])
      expect(run.timePassed === null).toBe(id !== 'halted')
      expect(run.passed).toBe(run.hitsPassed && run.timePassed !== false)
    }
  })

  it('fails the halted test on time alone when the crew is too slow', () => {
    const slow = build((s) => {
      s.fireControl.rangefinder = 'stadiametric'
      s.fireControl.computer = 'none'
    })
    const report = runProvingGround(slow, { seed: 101 })
    expect(report.gunnery.halted.timePassed).toBe(false)
    expect(report.gunnery.halted.passed).toBe(false)
  })

  it('survives being handed to another thread', () => {
    const job = { spec: spec(), limits: PACT_LIMITS_GEN1, setup: { seed: 101 } }
    expect(structuredClone(runRangeJob(job)).gunnery).toEqual(runRangeJob(job).gunnery)
  })
})

describe('the advice a failure gives', () => {
  it('points a slow first shot at the slowest step that can still be bettered', () => {
    const base = spec()
    expect(slowFix(buildStatSheet(base, PACT_LIMITS_GEN1), base)).toBe('fireControl.rangefinder')
    const laser = spec((s) => { s.fireControl.rangefinder = 'laser' })
    expect(slowFix(buildStatSheet(laser, PACT_LIMITS_GEN1), laser)).toBe('fireControl.commanderSight')
    const best = spec((s) => {
      s.fireControl.rangefinder = 'laser'
      s.fireControl.commanderSight = true
      s.fireControl.computer = 'electronic'
    })
    expect(slowFix(buildStatSheet(best, PACT_LIMITS_GEN1), best)).toBe('crew.comfort')
  })

  it('points a blind night shoot at the night sight', () => {
    const blind = spec((s) => { s.fireControl.night = 'none' })
    const sheet = buildStatSheet(blind, PACT_LIMITS_GEN1)
    expect(hitsFix(runGunnery(sheet.fire, 'night', 101), sheet, blind)).toBe('fireControl.night')
  })

  it('points a halting tank at the stabiliser, and a shaking gun too', () => {
    const none = spec((s) => { s.fireControl.stabiliser = 'none' })
    const noneSheet = buildStatSheet(none, PACT_LIMITS_GEN1)
    expect(hitsFix(runGunnery(noneSheet.fire, 'onTheMove', 101), noneSheet, none)).toBe('fireControl.stabiliser')
    const one = spec((s) => { s.fireControl.stabiliser = 'singlePlane' })
    const oneSheet = buildStatSheet(one, PACT_LIMITS_GEN1)
    const run = SEEDS.map((seed) => runGunnery(oneSheet.fire, 'onTheMove', seed)).find((each) => each.blame === 'shake')!
    expect(hitsFix(run, oneSheet, one)).toBe('fireControl.stabiliser')
  })

  it('points a misread range at the rangefinder', () => {
    const stadia = spec((s) => { s.fireControl.rangefinder = 'stadiametric' })
    const sheet = buildStatSheet(stadia, PACT_LIMITS_GEN1)
    const run = SEEDS.map((seed) => runGunnery(sheet.fire, 'halted', seed)).find((each) => each.blame === 'ranging')!
    expect(hitsFix(run, sheet, stadia)).toBe('fireControl.rangefinder')
  })

  it('says which way a shot fell', () => {
    const shot = { atS: 0, hit: false, cause: null, jammed: false }
    expect(placeOf({ ...shot, acrossM: 0.2, upM: 2 })).toEqual({ place: 'high', distM: 2 })
    expect(placeOf({ ...shot, acrossM: 0.2, upM: -1.5 })).toEqual({ place: 'low', distM: 1.5 })
    expect(placeOf({ ...shot, acrossM: -3, upM: 1 })).toEqual({ place: 'left', distM: 3 })
    expect(placeOf({ ...shot, acrossM: 1.4, upM: 0 })).toEqual({ place: 'right', distM: 1.4 })
  })
})
