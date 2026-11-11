import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { TRANSMISSIONS } from '../src/data/parts'
import { GROUNDS, MARKS_GEN1, OBSTACLES, RANGE } from '../src/data/range'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { footingOf, maxSlopeDeg, pullOf, resistanceN, topSpeedOf } from '../src/sim/mobility/drive'
import { courseLayout, runAcceleration, runObstacles, runProvingGround, type ObstacleResult } from '../src/sim/trials'
import { buildStatSheet, type StatSheet, type VehicleSpec } from '../src/sim/vehicle'

function build(change?: (spec: VehicleSpec) => void): StatSheet {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return buildStatSheet(spec, PACT_LIMITS_GEN1)
}

function obstacle(sheet: StatSheet, id: ObstacleResult['id']): ObstacleResult {
  const result = runObstacles(sheet.drive).results.find((r) => r.id === id)
  if (!result) throw new Error(`no result for ${id}`)
  return result
}

/** Pile armour on until the tank is well over the Pact limit. */
function overweight(spec: VehicleSpec): void {
  for (const zone of ['turretFrontLeft', 'turretFrontRight'] as const) spec.armour[zone] = [{ material: 'castSteel', mm: 600 }]
  spec.armour.hullSideFront = [{ material: 'rolledSteel', mm: 150 }]
  spec.armour.hullSideRear = [{ material: 'rolledSteel', mm: 100 }]
}

describe('the drive model', () => {
  const base = build()

  it('balances pull against drag at top speed', () => {
    const { drive } = build((s) => { s.powerpack.engine = 'diesel580' })
    const top = topSpeedOf(drive, GROUNDS.hard)
    expect(top.gearLimited).toBe(false)
    const pull = pullOf(drive, GROUNDS.hard, top.speedMs)
    expect(pull.limit).toBe('power')
    expect(pull.forceN).toBeCloseTo(resistanceN(drive, footingOf(drive, GROUNDS.hard), top.speedMs), 3)
  })

  it('is slower on soft ground than on the road', () => {
    const road = topSpeedOf(base.drive, GROUNDS.hard).speedMs
    const firm = topSpeedOf(base.drive, GROUNDS.firm).speedMs
    const mud = topSpeedOf(base.drive, GROUNDS.mud).speedMs
    expect(firm).toBeLessThan(road)
    expect(mud).toBeLessThan(firm / 2)
  })

  it('pulls hardest at a crawl, and no harder than the tracks grip', () => {
    const crawl = pullOf(base.drive, GROUNDS.hard, 0)
    expect(crawl.limit).toBe('gear')
    expect(crawl.forceN).toBe(base.drive.pullN)
    expect(pullOf(base.drive, GROUNDS.hard, 10).forceN).toBeLessThan(crawl.forceN)
    const mud = pullOf(base.drive, GROUNDS.mud, 0)
    expect(mud.limit).toBe('grip')
    expect(mud.forceN).toBeCloseTo(base.drive.weightN * GROUNDS.mud.grip, 6)
  })

  it('sinks deeper and drags harder as ground pressure rises', () => {
    const narrow = build((s) => { s.runningGear.trackWidthMm = 480 })
    const wide = build((s) => { s.runningGear.trackWidthMm = 700 })
    const sunk = (sheet: StatSheet) => footingOf(sheet.drive, GROUNDS.mud)
    expect(sunk(narrow).sinkM).toBeGreaterThan(sunk(base).sinkM)
    expect(sunk(base).sinkM).toBeGreaterThan(sunk(wide).sinkM)
    expect(sunk(narrow).drag).toBeGreaterThan(sunk(base).drag)
    expect(footingOf(base.drive, GROUNDS.hard).sinkM).toBe(0)
    // Wide tracks cost a little speed on the road.
    expect(wide.mobility.topSpeedKmh).toBeLessThan(base.mobility.topSpeedKmh)
  })

  it('climbs what its bottom gear and its grip allow', () => {
    expect(base.mobility.maxSlopeDeg).toBeGreaterThan(RANGE.course.slope.angleDeg)
    expect(base.mobility.maxSlopeDeg).toBeLessThan(40)
    const weak = build((s) => { s.powerpack.engine = 'diesel580' })
    expect(weak.mobility.maxSlopeDeg).toBeLessThan(base.mobility.maxSlopeDeg)
    // A torque converter pulls harder, but the tracks only grip so much.
    const hydro = build((s) => { s.powerpack.transmission = 'hydro50' })
    expect(hydro.drive.pullN).toBeGreaterThan(base.drive.pullN)
    expect(maxSlopeDeg(hydro.drive, GROUNDS.firm)).toBeLessThan(40)
  })

  it('sags when the suspension is overloaded', () => {
    const heavy = build(overweight)
    expect(heavy.stress.suspension).toBeGreaterThan(1)
    expect(heavy.mobility.clearanceM).toBeLessThan(base.mobility.clearanceM)
    expect(heavy.mobility.stepM).toBeLessThan(base.mobility.stepM)
    expect(heavy.mobility.trenchM).toBe(base.mobility.trenchM)
    expect(build((s) => { s.runningGear.suspension = 'hydropneumatic' }).mobility.clearanceM).toBeGreaterThan(base.mobility.clearanceM)
  })

  it('spaces the gears between bottom and top', () => {
    const t = TRANSMISSIONS[BASELINE_SPEC.powerpack.transmission]
    expect(base.drive.shiftAtMs).toHaveLength(t.gears - 1)
    expect(base.drive.shiftAtMs[0]).toBeCloseTo(t.lowGearKmh / 3.6, 9)
    for (let i = 1; i < base.drive.shiftAtMs.length; i++) {
      expect(base.drive.shiftAtMs[i]).toBeGreaterThan(base.drive.shiftAtMs[i - 1]!)
    }
    expect(base.drive.shiftAtMs.at(-1)).toBeLessThan(base.drive.gearedMs)
  })
})

describe('acceleration and top speed test', () => {
  const base = build()
  const run = runAcceleration(base.drive)

  it('gets the baseline through with room to spare', () => {
    expect(run.sprintS).not.toBeNull()
    expect(run.sprintS!).toBeGreaterThan(5)
    expect(run.sprintS!).toBeLessThan(MARKS_GEN1.sprintS)
    expect(run.topKmh).toBeGreaterThan(MARKS_GEN1.topKmh)
    expect(run.distanceM).toBeGreaterThanOrEqual(RANGE.acceleration.stripM)
  })

  it('reaches the speed the design office promised', () => {
    for (const change of [
      undefined,
      (s: VehicleSpec) => { s.powerpack.engine = 'diesel580' },
      (s: VehicleSpec) => { s.powerpack.engine = 'turbine1000'; s.powerpack.cooling = 'heavyDuty' },
      (s: VehicleSpec) => { s.runningGear.trackWidthMm = 700 },
    ]) {
      const sheet = build(change)
      const result = runAcceleration(sheet.drive)
      expect(Math.abs(result.topKmh - sheet.mobility.topSpeedKmh)).toBeLessThan(1)
      expect(result.gearLimited).toBe(sheet.mobility.gearLimited)
    }
  })

  it('records the run: always forward, never faster than the gearing', () => {
    const { xM, vMs } = run.trace
    expect(xM.length).toBe(vMs.length)
    expect(xM.length).toBeGreaterThan(100)
    for (let i = 1; i < xM.length; i++) {
      expect(xM[i]).toBeGreaterThanOrEqual(xM[i - 1]!)
      expect(vMs[i]).toBeLessThanOrEqual(base.drive.gearedMs)
    }
    expect((xM.length - 1) * run.trace.stepS).toBeCloseTo(run.timeS, 0)
  })

  it('loses time at each gear change with a manual box', () => {
    const hydro = runAcceleration(build((s) => { s.powerpack.transmission = 'hydro50' }).drive)
    expect(run.shifts).toBe(4)
    expect(hydro.shifts).toBe(3)
    expect(hydro.sprintS!).toBeLessThan(run.sprintS!)
    // The manual box wastes less power once it is in top gear.
    expect(hydro.topKmh).toBeLessThan(run.topKmh)
  })

  it('is slower with a weaker engine or more weight', () => {
    const weak = runAcceleration(build((s) => { s.powerpack.engine = 'diesel580' }).drive)
    expect(weak.sprintS!).toBeGreaterThan(run.sprintS!)
    expect(weak.topKmh).toBeLessThan(MARKS_GEN1.topKmh)
    const heavy = runAcceleration(build(overweight).drive)
    expect(heavy.sprintS!).toBeGreaterThan(run.sprintS!)
    expect(heavy.topKmh).toBeLessThan(run.topKmh)
  })

  it('gives the same run every time', () => {
    expect(runAcceleration(base.drive)).toEqual(run)
  })
})

describe('obstacle course', () => {
  const base = build()
  const run = runObstacles(base.drive)

  it('lays the course out end to end with a run before each obstacle', () => {
    const spans = courseLayout()
    expect(spans.filter((span) => span.id !== 'flat').map((span) => span.id)).toEqual([...OBSTACLES])
    expect(spans[0]!.fromM).toBe(0)
    for (let i = 1; i < spans.length; i++) expect(spans[i]!.fromM).toBe(spans[i - 1]!.toM)
    for (const span of spans) expect(span.toM).toBeGreaterThan(span.fromM)
  })

  it('gets the baseline over all four', () => {
    expect(run.results.map((r) => r.id)).toEqual([...OBSTACLES])
    expect(run.passed).toBe(true)
    for (const result of run.results) {
      expect(result.passed, result.id).toBe(true)
      expect(result.cause).toBeUndefined()
      expect(result.have, result.id).toBeGreaterThanOrEqual(result.need)
      expect(result.timeS).toBeGreaterThan(0)
    }
    const end = courseLayout().at(-1)!.toM
    expect(run.trace.xM.at(-1)).toBeCloseTo(end, 6)
  })

  it('bogs a heavy tank on narrow tracks in the mud', () => {
    const narrow = build((s) => { s.runningGear.trackWidthMm = 480 })
    const mud = obstacle(narrow, 'mud')
    expect(mud.passed).toBe(false)
    expect(mud.cause).toBe('tracks')
    expect(mud.need).toBeGreaterThan(mud.have)
    expect(mud.reachedM).toBeGreaterThan(0)
    expect(mud.reachedM).toBeLessThan(RANGE.course.mud.lengthM)
    expect(mud.sinkM).toBeGreaterThan(obstacle(base, 'mud').sinkM)
    // Wider tracks are the fix.
    expect(obstacle(build((s) => { s.runningGear.trackWidthMm = 700 }), 'mud').passed).toBe(true)
  })

  it('names the bottom gear when a weak engine is what stops it in the mud', () => {
    const weak = obstacle(build((s) => { s.powerpack.engine = 'diesel580'; s.runningGear.trackWidthMm = 480 }), 'mud')
    expect(weak.passed).toBe(false)
    expect(weak.cause).toBe('pull')
    expect(weak.need).toBeGreaterThan(weak.have)
  })

  it('sits an overweight tank on its belly, short of the step and stalled on the slope', () => {
    const heavy = build(overweight)
    expect(heavy.massT).toBeGreaterThan(50)
    const course = runObstacles(heavy.drive)
    expect(course.passed).toBe(false)
    const byId = Object.fromEntries(course.results.map((r) => [r.id, r]))
    expect(byId.trench!.passed).toBe(true)
    expect(byId.step!.cause).toBe('tooLow')
    expect(byId.mud!.cause).toBe('belly')
    expect(byId.mud!.need).toBeGreaterThan(byId.mud!.have)
    expect(byId.slope!.cause).toBe('pull')
    expect(byId.slope!.reachedM).toBeLessThan(RANGE.course.slope.lengthM)
  })

  it('stalls a weak engine on the slope and drops a short hull in the trench', () => {
    const weak = obstacle(build((s) => { s.powerpack.engine = 'diesel580' }), 'slope')
    expect(weak.passed).toBe(false)
    expect(weak.cause).toBe('pull')
    expect(weak.need).toBeGreaterThan(weak.have)
    const short = obstacle(build((s) => { s.hull.size = 'light'; s.turret.ringMm = 1950; s.gun = 'smooth115' }), 'trench')
    expect(short.passed).toBe(false)
    expect(short.cause).toBe('tooShort')
    expect(short.reachedM).toBe(0)
  })

  it('agrees with the design office about the slope, the trench and the step', () => {
    for (const change of [
      undefined, overweight,
      (s: VehicleSpec) => { s.powerpack.engine = 'diesel580' },
      (s: VehicleSpec) => { s.powerpack.transmission = 'hydro50' },
      (s: VehicleSpec) => { s.hull.size = 'heavy' },
      (s: VehicleSpec) => { s.hull.size = 'light'; s.turret.ringMm = 1950; s.gun = 'smooth115' },
    ]) {
      const sheet = build(change)
      const c = RANGE.course
      expect(obstacle(sheet, 'slope').passed).toBe(sheet.mobility.maxSlopeDeg >= c.slope.angleDeg)
      expect(obstacle(sheet, 'trench').passed).toBe(sheet.mobility.trenchM >= c.trench.widthM)
      expect(obstacle(sheet, 'step').passed).toBe(sheet.mobility.stepM >= c.step.heightM)
    }
  })

  it('pulls a stuck tank clear and carries on', () => {
    const heavy = runObstacles(build(overweight).drive)
    expect(heavy.results).toHaveLength(OBSTACLES.length)
    const { xM, vMs, sinkM } = heavy.trace
    expect(xM.length).toBe(vMs.length)
    expect(xM.length).toBe(sinkM.length)
    for (let i = 1; i < xM.length; i++) expect(xM[i]).toBeGreaterThanOrEqual(xM[i - 1]!)
    expect(Math.max(...sinkM)).toBeGreaterThan(0)
    expect(xM.at(-1)).toBeCloseTo(courseLayout().at(-1)!.toM, 6)
  })

  it('gives the same run every time', () => {
    expect(runObstacles(base.drive)).toEqual(run)
  })
})

describe('proving ground report', () => {
  it('passes the baseline on every test', () => {
    const report = runProvingGround(build(), { seed: 1 })
    expect(report.tests).toBe(6)
    expect(report.passes).toBe(6)
    expect(report.acceleration.passed).toBe(true)
    expect(report.obstacles.passed).toBe(true)
    expect(report.endurance.passed).toBe(true)
  })

  it('marks a weak engine down on top speed', () => {
    const report = runProvingGround(build((s) => { s.powerpack.engine = 'diesel580' }), { seed: 1 })
    expect(report.acceleration.sprintPassed).toBe(true)
    expect(report.acceleration.topPassed).toBe(false)
    expect(report.acceleration.passed).toBe(false)
    expect(report.obstacles.passed).toBe(false)
  })

  it('uses the marks it is given', () => {
    const report = runProvingGround(build(), { seed: 1, marks: { ...MARKS_GEN1, sprintS: 5, topKmh: 70 } })
    expect(report.acceleration.sprintPassed).toBe(false)
    expect(report.acceleration.topPassed).toBe(false)
  })
})
