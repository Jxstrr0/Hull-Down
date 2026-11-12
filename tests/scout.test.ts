// Spot and report: drive to three lookouts, find what is hidden, and get home unseen.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { MARKS_GEN1, type Marks } from '../src/data/range'
import { SCOUT_TRIAL } from '../src/data/scout'
import { STRINGS } from '../src/data/strings'
import { judgeScoutPatrol, runBerm, runProvingGround, runScoutPatrol } from '../src/sim/trials'
import { sandboxLimits } from '../src/sim/vehicle/sandbox'
import { buildStatSheet, type VehicleSpec } from '../src/sim/vehicle'
import { failedTests } from '../src/ui/careerWords'

const SEEDS = Array.from({ length: 200 }, (_, n) => n + 1)

/** A light car on six wheels with the 30 mm cannon and thin plate. */
function car(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const out = structuredClone(BASELINE_SPEC)
  out.hull.size = 'light'
  out.gun = 'autocannon30'
  out.loading = 'loader'
  out.turret.ringMm = 1800
  out.powerpack.engine = 'diesel580'
  out.powerpack.transmission = 'manual38'
  out.powerpack.fuelL = 600
  for (const zone of Object.keys(out.armour) as (keyof typeof out.armour)[]) {
    out.armour[zone] = [{ material: 'rolledSteel', mm: 15 }]
    out.era[zone] = 0
  }
  out.runningGear.layout = 'wheels6'
  change?.(out)
  return out
}

const sheetOf = (spec: VehicleSpec) => buildStatSheet(spec, sandboxLimits('none'))
const range = (spec: VehicleSpec, seed = 1, marks: Marks = MARKS_GEN1) => runProvingGround(sheetOf(spec), { seed, marks })

/** Every seed's run for one design, and its berm height unless another is given. */
function patrols(spec: VehicleSpec, showsM?: number) {
  const sheet = sheetOf(spec)
  const shows = showsM ?? runBerm(sheet.interior.frame, sheet.firepower.gunDepressionDeg).showsM
  return SEEDS.map((seed) => runScoutPatrol(sheet.drive, sheet.fire, shows, sheet.geometry.widthM, seed))
}
const mean = (values: number[]): number => values.reduce((a, b) => a + b, 0) / values.length

describe('spot and report', () => {
  it('is run for a car on wheels, or where the tender asks for it', () => {
    const tank = range(BASELINE_SPEC)
    expect(tank.scout).toBeNull()
    const scout = range(car())
    expect(scout.scout).not.toBeNull()
    expect(scout.tests).toBe(tank.tests + 1)
    const asked = range(BASELINE_SPEC, 1, { ...MARKS_GEN1, scout: SCOUT_TRIAL.marks })
    expect(asked.scout).not.toBeNull()
    expect(asked.scout?.marks).toEqual(SCOUT_TRIAL.marks)
  })

  it('comes out the same every time for the same car and seed, and differs between seeds', () => {
    expect(range(car(), 7).scout).toEqual(range(car(), 7).scout)
    const runs = patrols(car())
    expect(new Set(runs.map((run) => run.found + run.seen * 10 + Math.round(run.totalS ?? 0))).size).toBeGreaterThan(5)
  })

  it('visits three lookouts, with everything hidden in front of them counted', () => {
    const run = patrols(car())[0]!
    expect(run.stops).toHaveLength(3)
    expect(run.hidden).toBe(SCOUT_TRIAL.lookouts.reduce((n, lookout) => n + lookout.targets.length, 0))
    expect(STRINGS.range.scout.targetNames).toHaveLength(run.hidden)
    for (const stop of run.stops!) {
      expect(stop.watchS).toBeLessThanOrEqual(SCOUT_TRIAL.watchS)
      for (const target of stop.targets) {
        if (target.foundS !== null) expect(target.foundS).toBeLessThanOrEqual(stop.watchS)
        if (target.noticedS !== null) expect(target.noticedS).toBeLessThanOrEqual(stop.watchS)
      }
    }
    const watch = run.stops!.reduce((s, stop) => s + stop.driveS + stop.watchS, 0)
    expect(run.totalS).toBeCloseTo(watch + run.homeS!, 6)
  })

  it('gets round sooner on wheels than on tracks', () => {
    const wheels = mean(patrols(car()).map((run) => run.totalS!))
    const tracks = mean(patrols(car((s) => { s.runningGear.layout = 'tracks' })).map((run) => run.totalS!))
    expect(wheels).toBeLessThan(SCOUT_TRIAL.marks.timeS)
    expect(tracks).toBeGreaterThan(SCOUT_TRIAL.marks.timeS)
  })

  it("finds more with the commander's own sight, and more again with a thermal sight", () => {
    const plain = mean(patrols(car()).map((run) => run.found))
    const own = mean(patrols(car((s) => { s.fireControl.commanderSight = true })).map((run) => run.found))
    const thermal = mean(patrols(car((s) => { s.fireControl.commanderSight = true; s.fireControl.night = 'thermal' })).map((run) => run.found))
    expect(own).toBeGreaterThan(plain)
    expect(thermal).toBeGreaterThan(own)
    expect(thermal).toBeGreaterThan(SCOUT_TRIAL.marks.found)
  })

  it('is seen first more often the more of it shows over the crest', () => {
    const low = mean(patrols(car(), 1).map((run) => run.seen))
    const high = mean(patrols(car(), 3).map((run) => run.seen))
    expect(high).toBeGreaterThan(low * 1.5)
    expect(patrols(car(), 0).every((run) => run.seen === 0)).toBe(true)
  })

  it('fails every mark when the car cannot move', () => {
    const sheet = sheetOf(car())
    const run = runScoutPatrol({ ...sheet.drive, powerW: 0 }, sheet.fire, 1, sheet.geometry.widthM, 1)
    expect(run.stops).toBeNull()
    expect(run.totalS).toBeNull()
    expect(judgeScoutPatrol(run, SCOUT_TRIAL.marks)).toEqual({ timePassed: false, foundPassed: false, seenPassed: false, passed: false })
  })

  it('judges each mark on its own', () => {
    const run = patrols(car())[0]!
    const loose = judgeScoutPatrol(run, { timeS: 1e9, found: 0, seen: 99 })
    expect(loose.passed).toBe(true)
    const tight = judgeScoutPatrol(run, { timeS: 1, found: 99, seen: -1 })
    expect(tight).toEqual({ timePassed: false, foundPassed: false, seenPassed: false, passed: false })
  })

  it('names a failed spot and report among the failed tests', () => {
    const failed = SEEDS.map((seed) => range(car((s) => { s.runningGear.layout = 'wheels4' }), seed)).find((report) => report.scout && !report.scout.passed)
    expect(failed).toBeDefined()
    expect(failedTests(failed!)).toContain(STRINGS.range.scout.title)
  })
})
