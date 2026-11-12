import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { RANGE } from '../src/data/range'
import { KIT } from '../src/data/kit'
import { RENDER } from '../src/data/render'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { VIEWS, shotAt } from '../src/render/director'
import { courseOutline, coursePath, mudPatch, pointAt, poseAt, stripPath, trenchPit } from '../src/render/path'
import { frameAt, lengthS, type RunRecord } from '../src/render/playback'
import { below, partTriangles, tankShapeOf, tankTriangles } from '../src/render/tankShape'
import { HULLS, TURRETS, type TurretId } from '../src/data/parts'
import { ZONES } from '../src/data/materials'
import { allTiles } from '../src/sim/vehicle/era'
import { heightAt, legGround, placeOnLeg } from '../src/render/terrain'
import { puffAt, timelapseOf } from '../src/render/timelapse'
import { courseLayout, runProvingGround, type EnduranceRun } from '../src/sim/trials'
import { buildStatSheet, type VehicleSpec } from '../src/sim/vehicle'
import { listFilesDeep, readRepoFile } from './helpers'

function sheetOf(change?: (spec: VehicleSpec) => void): { spec: VehicleSpec; sheet: ReturnType<typeof buildStatSheet> } {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return { spec, sheet: buildStatSheet(spec, PACT_LIMITS_GEN1) }
}

describe('the line the tank follows', () => {
  it('is as long as the strip the sim runs on', () => {
    expect(stripPath().lengthM).toBe(RANGE.acceleration.stripM)
  })

  it('is as long as the course the sim runs on', () => {
    const layout = courseLayout()
    expect(coursePath().lengthM).toBeCloseTo(layout.at(-1)!.toM, 6)
  })

  it('rises by the step and by the slope, and nowhere else', () => {
    const path = coursePath()
    const layout = courseLayout()
    const step = layout.find((span) => span.id === 'step')!
    const slope = layout.find((span) => span.id === 'slope')!
    const rise = RANGE.course.slope.lengthM * Math.sin((RANGE.course.slope.angleDeg * Math.PI) / 180)
    expect(pointAt(path, step.fromM).y).toBe(0)
    expect(pointAt(path, step.toM).y).toBeCloseTo(RANGE.course.step.heightM, 6)
    expect(pointAt(path, slope.fromM).y).toBeCloseTo(RANGE.course.step.heightM, 6)
    expect(pointAt(path, slope.toM).y).toBeCloseTo(RANGE.course.step.heightM + rise, 6)
    expect(pointAt(path, path.lengthM).y).toBeCloseTo(RANGE.course.step.heightM + rise, 6)
  })

  it('holds its ends when asked for a place off either one', () => {
    const path = coursePath()
    expect(pointAt(path, -5)).toEqual({ x: 0, y: 0 })
    expect(pointAt(path, path.lengthM + 5)).toEqual(pointAt(path, path.lengthM))
  })

  it('never doubles back', () => {
    const xs = coursePath().points.map((point) => point.x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
  })
})

describe('how the tank sits on the line', () => {
  const path = coursePath()
  const layout = courseLayout()

  it('sits level on the flat', () => {
    const pose = poseAt(path, 5, 4)
    expect(pose.pitchRad).toBe(0)
    expect(pose.y).toBe(0)
  })

  it('lies at the angle of the slope when all of it is on the slope', () => {
    const slope = layout.find((span) => span.id === 'slope')!
    const pose = poseAt(path, (slope.fromM + slope.toM) / 2, 4)
    expect((pose.pitchRad * 180) / Math.PI).toBeCloseTo(RANGE.course.slope.angleDeg, 6)
  })

  it('tips nose up over the step, less than the slope, and comes level again', () => {
    const step = layout.find((span) => span.id === 'step')!
    const onStep = poseAt(path, step.fromM + RENDER.course.stepFaceAtM + 1, 4)
    expect(onStep.pitchRad).toBeGreaterThan(0)
    expect(onStep.pitchRad).toBeLessThan((RANGE.course.slope.angleDeg * Math.PI) / 180)
    expect(poseAt(path, step.toM - 0.5, 0.5).pitchRad).toBe(0)
  })
})

describe('the ground of the course', () => {
  const outline = courseOutline()

  it('runs from before the start to past the finish', () => {
    const xs = outline.map((point) => point.x)
    expect(Math.min(...xs)).toBe(-RENDER.course.leadM)
    expect(Math.max(...xs)).toBeGreaterThan(coursePath().points.at(-1)!.x)
  })

  it('cuts the trench as wide as the sim says and where the tank meets it', () => {
    const pit = trenchPit()
    const span = courseLayout().find((each) => each.id === 'trench')!
    expect(pit.fromX).toBe(span.fromM)
    expect(pit.toX - pit.fromX).toBeCloseTo(RANGE.course.trench.widthM, 6)
    expect(pit.floorY).toBe(-RENDER.course.trenchDepthM)
    const floor = outline.filter((point) => point.y === pit.floorY).map((point) => point.x)
    expect(floor).toEqual([pit.fromX, pit.toX])
  })

  it('stands the step up by its height', () => {
    const ys = outline.map((point) => point.y)
    expect(ys).toContain(RANGE.course.step.heightM)
  })

  it('lays the mud as long as the sim says, on the level', () => {
    const mud = mudPatch()
    expect(mud.toX - mud.fromX).toBeCloseTo(RANGE.course.mud.lengthM, 6)
    expect(mud.y).toBeCloseTo(RANGE.course.step.heightM, 6)
  })

  it('has its top under the tank all the way along', () => {
    // The highest ground at any x is where the tank's line is, give or take the step's ramp.
    const path = coursePath()
    const last = path.points.at(-1)!
    const top = outline.filter((point) => point.y > -RENDER.course.trenchDepthM - 0.01)
    expect(top.at(-1)!.y).toBeCloseTo(last.y, 6)
    expect(top.at(-1)!.x).toBeCloseTo(last.x + RENDER.course.leadM, 6)
  })
})

describe('the camera', () => {
  const course = coursePath()
  const strip = stripPath()
  const layout = courseLayout()
  const foot = 4
  const seats = RENDER.camera.seats

  it('has a name on screen for every view', () => {
    for (const view of VIEWS) expect(STRINGS.range.view.camera[view]).toBeTruthy()
  })

  it('travels with the tank on every leg of the endurance run, whatever the view', () => {
    const pose = { x: 700, y: 2, pitchRad: 0.1 }
    for (const leg of RANGE.endurance.legs) {
      const seat = seats[RENDER.camera.director.endurance[leg.id]]
      expect(shotAt('director', { test: 'endurance', leg: leg.id }, pose).from).toEqual({ x: pose.x - seat.backM, y: pose.y + seat.upM, z: seat.sideM })
      expect(shotAt('above', { test: 'endurance', leg: leg.id }, pose).from.y).toBe(pose.y + seats.above.upM)
    }
  })

  it('travels with the tank in the side, behind and above views, on both ranges', () => {
    for (const view of ['side', 'behind', 'above'] as const) {
      for (const [test, path, s] of [['acceleration', strip, 400], ['obstacles', course, 60]] as const) {
        const pose = poseAt(path, s, foot)
        const shot = shotAt(view, test === 'acceleration' ? { test, s } : { test, s, path }, pose)
        expect(shot.from).toEqual({ x: pose.x - seats[view].backM, y: pose.y + seats[view].upM, z: seats[view].sideM })
        expect(shot.to).toEqual({ x: pose.x, y: pose.y + RENDER.camera.lookUpM, z: 0 })
      }
    }
  })

  it('always looks at the tank', () => {
    for (const view of VIEWS) {
      for (let s = 0; s <= course.lengthM; s += 3) {
        const pose = poseAt(course, s, foot)
        expect(shotAt(view, { test: 'obstacles', s, path: course }, pose).to).toEqual({ x: pose.x, y: pose.y + RENDER.camera.lookUpM, z: 0 })
      }
    }
  })

  it('cuts on the strip where the table says, and nowhere else', () => {
    const cuts = RENDER.camera.director.acceleration
    const seatAt = (s: number): string => {
      const pose = poseAt(strip, s, foot)
      const from = shotAt('director', { test: 'acceleration', s }, pose).from
      return Object.entries(seats).find(([, seat]) => from.x === pose.x - seat.backM && from.y === seat.upM && from.z === seat.sideM)![0]
    }
    expect(cuts[0]!.fromM).toBe(0)
    for (const [index, cut] of cuts.entries()) {
      expect(seatAt(cut.fromM)).toBe(cut.seat)
      const next = cuts[index + 1]
      expect(seatAt((next ? next.fromM : RANGE.acceleration.stripM) - 1)).toBe(cut.seat)
    }
  })

  it('stands still beside each obstacle while the tank goes over it', () => {
    const stands: number[] = []
    for (const span of layout.filter((each) => each.id !== 'flat')) {
      const at = (s: number) => shotAt('director', { test: 'obstacles', s, path: course }, poseAt(course, s, foot)).from
      const before = at(span.fromM - 2)
      expect(at(span.fromM)).toEqual(before)
      expect(at(span.toM)).toEqual(before)
      expect(at(span.toM + RENDER.camera.director.obstacles.holdM)).toEqual(before)
      // Beside the obstacle, off the lane and above the ground.
      expect(before.x).toBeGreaterThan(pointAt(course, span.fromM).x)
      expect(before.x).toBeLessThan(pointAt(course, span.toM).x)
      expect(before.z).toBeGreaterThan(RENDER.course.widthM / 2)
      expect(before.y).toBeGreaterThan(pointAt(course, (span.fromM + span.toM) / 2).y)
      stands.push(before.x)
    }
    // Four obstacles, four different places to stand.
    expect(new Set(stands).size).toBe(4)
  })

  it('hands the run-out to a camera that travels', () => {
    const s = course.lengthM - 1
    const pose = poseAt(course, s, foot)
    const seat = seats[RENDER.camera.director.obstacles.after]
    expect(shotAt('director', { test: 'obstacles', s, path: course }, pose).from).toEqual({ x: pose.x - seat.backM, y: pose.y + seat.upM, z: seat.sideM })
  })

  it('never sits on top of what it looks at', () => {
    for (const view of VIEWS) {
      for (const [test, path] of [['acceleration', strip], ['obstacles', course]] as const) {
        for (let s = 0; s <= path.lengthM; s += 7) {
          const shot = shotAt(view, test === 'acceleration' ? { test, s } : { test, s, path }, poseAt(path, s, foot))
          const gap = Math.hypot(shot.from.x - shot.to.x, shot.from.y - shot.to.y, shot.from.z - shot.to.z)
          expect(gap).toBeGreaterThan(5)
          // Straight down has no "up" to hold the picture level.
          expect(Math.hypot(shot.from.x - shot.to.x, shot.from.z - shot.to.z)).toBeGreaterThan(1)
        }
      }
    }
  })
})

describe('reading a run back', () => {
  const record: RunRecord = { stepS: 0.5, xM: [0, 1, 3, 3.5, 40, 41], vMs: [0, 4, 4, 1, 1, 3], sinkM: [0, 0, 0.2, 0.4, 0, 0] }

  it('lasts as long as its points', () => {
    expect(lengthS(record)).toBe(2.5)
  })

  it('starts at the start', () => {
    expect(frameAt(record, 0)).toEqual({ s: 0, vMs: 0, sinkM: 0, done: false })
    expect(frameAt(record, -1).s).toBe(0)
  })

  it('glides between two points', () => {
    const frame = frameAt(record, 0.75)
    expect(frame.s).toBeCloseTo(2, 9)
    expect(frame.vMs).toBeCloseTo(4, 9)
    expect(frame.sinkM).toBeCloseTo(0.1, 9)
    expect(frame.done).toBe(false)
  })

  it('holds, then jumps, where the tank was moved and not driven', () => {
    expect(frameAt(record, 1.9)).toEqual({ s: 3.5, vMs: 1, sinkM: 0.4, done: false })
    expect(frameAt(record, 2).s).toBe(40)
  })

  it('ends on the last point and says so', () => {
    expect(frameAt(record, 2.5)).toEqual({ s: 41, vMs: 3, sinkM: 0, done: true })
    expect(frameAt(record, 99).done).toBe(true)
  })

  it('reads a record with no sinking as none', () => {
    expect(frameAt({ stepS: 1, xM: [0, 2], vMs: [0, 2] }, 0.5).sinkM).toBe(0)
  })

  it('plays the real runs from the start line to where the report says they ended', () => {
    const { sheet } = sheetOf()
    const report = runProvingGround(sheet, { seed: 1 })
    const strip = report.acceleration.trace
    expect(frameAt(strip, 0).s).toBe(0)
    // The record keeps one point in every few steps, so it may stop a fraction short of the line.
    const gap = report.acceleration.distanceM - frameAt(strip, lengthS(strip)).s
    expect(gap).toBeGreaterThanOrEqual(0)
    expect(gap).toBeLessThan(strip.stepS * Math.max(...strip.vMs))
    const course = report.obstacles.trace
    expect(frameAt(course, lengthS(course)).s).toBeLessThanOrEqual(coursePath().lengthM + 1e-6)
    // Never backwards.
    let before = 0
    for (let t = 0; t <= lengthS(course); t += 0.37) {
      const s = frameAt(course, t).s
      expect(s).toBeGreaterThanOrEqual(before)
      before = s
    }
  })
})

describe('the endurance run as a time-lapse', () => {
  const e = RENDER.endurance
  const enduranceOf = (change?: (spec: VehicleSpec) => void, seed = 1): EnduranceRun =>
    runProvingGround(sheetOf(change).sheet, { seed }).endurance
  /** The first seed that gives the baseline a clean run, one with a roadside stop, and so on. */
  const seedWhere = (wanted: (run: EnduranceRun) => boolean, change?: (spec: VehicleSpec) => void): EnduranceRun => {
    for (let seed = 1; seed < 400; seed++) {
      const run = enduranceOf(change, seed)
      if (wanted(run)) return run
    }
    throw new Error('no seed gives that run')
  }
  const clean = seedWhere((run) => run.finished && run.events.length === 0)
  const stopped = seedWhere((run) => run.finished && run.events.length === 1)
  const wrecked = seedWhere((run) => !run.finished, (spec) => {
    spec.powerpack.transmission = 'manual38'
  })

  it('takes the same time to watch whatever the tank, when nothing breaks', () => {
    expect(timelapseOf(clean).lengthS).toBeCloseTo(clean.lengthKm * e.secondsPerKm, 9)
    expect(timelapseOf(clean).stops).toEqual([])
  })

  it('starts at nought and ends on the whole run', () => {
    const lapse = timelapseOf(clean)
    expect(lapse.at(0)).toMatchObject({ km: 0, hours: 0, legIndex: 0, legM: 0, event: null, done: false })
    expect(lapse.at(-3).km).toBe(0)
    const end = lapse.at(lapse.lengthS)
    expect(end.done).toBe(true)
    expect(end.km).toBe(clean.lengthKm)
    expect(end.hours).toBeCloseTo(clean.movingH, 9)
    expect(lapse.at(lapse.lengthS + 50)).toEqual(end)
  })

  it('counts the kilometres and the hours up, never down', () => {
    for (const run of [clean, stopped, wrecked]) {
      const lapse = timelapseOf(run)
      let before = lapse.at(0)
      for (let t = 0; t <= lapse.lengthS; t += 0.05) {
        const now = lapse.at(t)
        expect(now.km).toBeGreaterThanOrEqual(before.km)
        expect(now.hours).toBeGreaterThanOrEqual(before.hours)
        expect(now.legIndex).toBeGreaterThanOrEqual(before.legIndex)
        before = now
      }
    }
  })

  it('is on the leg the sim says for every kilometre', () => {
    const lapse = timelapseOf(clean)
    for (let t = 0.01; t < lapse.lengthS; t += 0.07) {
      const now = lapse.at(t)
      const leg = clean.legs[now.legIndex]!
      expect(now.km).toBeGreaterThanOrEqual(leg.fromKm)
      expect(now.km).toBeLessThanOrEqual(leg.toKm)
      expect(now.speedKmh).toBe(leg.speedKmh)
    }
  })

  it('starts each leg at the start of its ground', () => {
    const lapse = timelapseOf(clean)
    for (const leg of clean.legs.slice(1)) {
      const justIn = lapse.at(leg.fromKm * e.secondsPerKm + 1e-6)
      expect(justIn.legIndex).toBe(clean.legs.indexOf(leg))
      expect(justIn.legM).toBeLessThan(0.01)
    }
  })

  it('shows a slower tank covering less ground in the picture', () => {
    const slow = seedWhere((run) => run.finished && run.events.length === 0, (spec) => {
      spec.powerpack.engine = 'diesel580'
    })
    expect(slow.legs[0]!.speedKmh).toBeLessThan(clean.legs[0]!.speedKmh)
    const t = 2
    expect(timelapseOf(slow).at(t).legM).toBeLessThan(timelapseOf(clean).at(t).legM)
    // The kilometres go by the same: the count is the time-lapse, the ground is the speed.
    expect(timelapseOf(slow).at(t).km).toBeCloseTo(timelapseOf(clean).at(t).km, 9)
  })

  it('stops for a roadside repair, counts the time lost, and drives on', () => {
    const lapse = timelapseOf(stopped)
    const event = stopped.events[0]!
    expect(lapse.stops).toHaveLength(1)
    const stop = lapse.stops[0]!
    expect(stop.event).toBe(event)
    expect(stop.atS).toBeCloseTo(event.km * e.secondsPerKm, 9)
    expect(lapse.lengthS).toBeCloseTo(stopped.lengthKm * e.secondsPerKm + e.holdS, 9)

    const before = lapse.at(stop.atS - 0.01)
    expect(before.event).toBeNull()
    const during = lapse.at(stop.atS + e.holdS / 2)
    expect(during.event).toBe(event)
    expect(during.speedKmh).toBe(0)
    expect(during.km).toBe(event.km)
    expect(during.heldS).toBeCloseTo(e.holdS / 2, 9)
    expect(during.legM).toBeCloseTo(lapse.at(stop.atS).legM, 9)
    const after = lapse.at(stop.atS + e.holdS + 0.01)
    expect(after.event).toBeNull()
    expect(after.hours - before.hours).toBeGreaterThan(event.haltH)
    expect(lapse.at(lapse.lengthS).hours).toBeCloseTo(stopped.movingH + stopped.haltedH, 9)
  })

  it('ends where the powerpack is wrecked, and holds there', () => {
    const lapse = timelapseOf(wrecked)
    const last = wrecked.events.at(-1)!
    expect(last.ended).toBe(true)
    const stop = lapse.stops.at(-1)!
    expect(stop.event).toBe(last)
    expect(lapse.lengthS).toBeCloseTo(stop.atS + e.endHoldS, 9)
    const end = lapse.at(lapse.lengthS)
    expect(end).toMatchObject({ km: wrecked.reachedKm, event: last, speedKmh: 0, done: true })
    expect(end.heldS).toBeCloseTo(e.endHoldS, 9)
    expect(end.km).toBeLessThan(wrecked.lengthKm)
    expect(wrecked.legs[end.legIndex]!.id).toBe(last.leg)
  })

  it('raises smoke one puff after another, each growing as it climbs', () => {
    const k = e.smoke
    expect(puffAt(0, 0)).toEqual({ upM: 0, driftM: 0, sizeM: k.fromM })
    expect(puffAt(1, 0)).toBeNull()
    const early = puffAt(0, k.everyS * 0.25)!
    const late = puffAt(0, k.everyS * 0.75)!
    expect(late.upM).toBeGreaterThan(early.upM)
    expect(late.sizeM).toBeGreaterThan(early.sizeM)
    expect(late.upM).toBeLessThan(k.riseM)
    // By the end of the hold every puff is in the air.
    for (let i = 0; i < k.puffs; i++) expect(puffAt(i, e.endHoldS)).not.toBeNull()
  })
})

describe('the ground of an endurance leg', () => {
  const ids = RANGE.endurance.legs.map((leg) => leg.id)

  it('has ground for every leg of the run', () => {
    expect(Object.keys(RENDER.endurance.legs).sort()).toEqual([...ids].sort())
    for (const id of ids) expect(RENDER.camera.director.endurance[id]).toBeTruthy()
  })

  it('lies flat on the road and the tracks, and rises and falls on the hills and the rough', () => {
    for (const id of ['road', 'tracks'] as const) expect(legGround(id).path.points.every((point) => point.y === 0)).toBe(true)
    for (const id of ['hills', 'rough'] as const) {
      const ys = legGround(id).path.points.map((point) => point.y)
      expect(Math.max(...ys)).toBeGreaterThan(0)
      expect(Math.min(...ys)).toBeLessThan(0)
    }
    expect(RENDER.endurance.legs.hills.riseM).toBeGreaterThan(RENDER.endurance.legs.rough.riseM * 5)
  })

  it('repeats, so the stretch the tank drives joins up with itself', () => {
    for (const id of ids) {
      const leg = RENDER.endurance.legs[id]
      for (const x of [0, 3.3, 17, 100]) expect(heightAt(id, x + leg.periodM)).toBeCloseTo(heightAt(id, x), 9)
      const ground = legGround(id)
      const foot = 4
      const start = poseAt(ground.path, placeOnLeg(ground, 0), foot)
      const round = poseAt(ground.path, ground.fromS + ground.loopS, foot)
      expect(round.y).toBeCloseTo(start.y, 9)
      expect(round.pitchRad).toBeCloseTo(start.pitchRad, 9)
      // One lap on, the tank is drawn back where it started.
      expect(placeOnLeg(ground, ground.loopS * 3 + 5)).toBeCloseTo(placeOnLeg(ground, 5), 6)
    }
  })

  it('reaches past the haze on both sides of the tank, wherever it is on its stretch', () => {
    for (const id of ids) {
      const ground = legGround(id)
      const points = ground.path.points
      const endX = points.at(-1)!.x
      for (const legM of [0, ground.loopS * 0.5, ground.loopS * 0.999]) {
        const s = placeOnLeg(ground, legM)
        const x = points.find((point) => point.s >= s)!.x
        expect(x).toBeGreaterThan(RENDER.fog.farM)
        expect(endX - x).toBeGreaterThan(RENDER.fog.farM)
      }
    }
  })

  it('stands a marker post at each end of the stretch, so they join up too', () => {
    for (const id of ids) {
      const ground = legGround(id)
      const points = ground.path.points
      const fromX = points.find((point) => point.s >= ground.fromS)!.x
      const toX = points.find((point) => point.s >= ground.fromS + ground.loopS - 1e-9)!.x
      expect(ground.postsX).toContain(fromX)
      expect(ground.postsX).toContain(toX)
    }
  })

  it('never tips the tank steeper than the slope on the obstacle course', () => {
    for (const id of ids) {
      const ground = legGround(id)
      for (let legM = 0; legM < ground.loopS; legM += ground.loopS / 97) {
        const pose = poseAt(ground.path, placeOnLeg(ground, legM), 4)
        expect(Math.abs((pose.pitchRad * 180) / Math.PI)).toBeLessThan(RANGE.course.slope.angleDeg)
      }
    }
  })
})

describe('the grey-box tank', () => {
  it('is the size of the tank on the drawing', () => {
    const { spec, sheet } = sheetOf()
    const shape = tankShapeOf(spec, sheet.geometry)
    const xs = shape.hullOutline.map((point) => point.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(shape.lengthM, 6)
    expect(shape.footprintM).toBeLessThan(shape.lengthM)
    expect(shape.wheels.xM).toHaveLength(spec.runningGear.roadWheels)
  })

  it('keeps every wheel under the hull and on the ground', () => {
    const { spec, sheet } = sheetOf()
    const shape = tankShapeOf(spec, sheet.geometry)
    for (const x of shape.wheels.xM) expect(Math.abs(x)).toBeLessThan(shape.lengthM / 2)
    expect(shape.wheels.radiusM).toBeGreaterThan(0)
    expect(shape.wheels.radiusM * 2).toBeLessThanOrEqual(shape.track.topM + 1e-9)
  })

  it('points the gun forward, out past the nose', () => {
    const { spec, sheet } = sheetOf()
    const shape = tankShapeOf(spec, sheet.geometry)
    expect(shape.gun.lengthM).toBeGreaterThan(0)
    expect(shape.gun.rootXM + shape.gun.lengthM).toBeGreaterThan(shape.lengthM / 2)
  })

  it('changes with the design', () => {
    const base = sheetOf()
    const wide = sheetOf((spec) => {
      spec.runningGear.trackWidthMm += 80
      spec.runningGear.roadWheels = base.spec.runningGear.roadWheels === 6 ? 5 : 6
    })
    const a = tankShapeOf(base.spec, base.sheet.geometry)
    const b = tankShapeOf(wide.spec, wide.sheet.geometry)
    expect(b.track.widthM).toBeGreaterThan(a.track.widthM)
    expect(b.wheels.xM.length).not.toBe(a.wheels.xM.length)
  })
})

describe('the parts the tank is built from', () => {
  const shapes = Object.keys(TURRETS) as TurretId[]
  // Everything on: tiles all over, side skirts, and as many wheels as the hull takes.
  const built = (turret: TurretId, tiles: boolean, skirts = false) => {
    const { spec, sheet } = sheetOf((s) => {
      s.turret.shape = turret
      s.fireControl.commanderSight = true
      if (tiles) for (const zone of ZONES) s.era[zone] = allTiles(zone)
      if (skirts) {
        s.runningGear.skirts = true
        s.runningGear.roadWheels = HULLS[s.hull.size].maxWheels
      }
    })
    return tankShapeOf(spec, sheet.geometry)
  }

  it('gives every turret its own kit piece, and its own stand-in shape of eight corners to a ring', () => {
    const seen = new Set<string>()
    const pieces = new Set<string>()
    for (const turret of shapes) {
      const shell = built(turret, false).parts.find((part) => part.kind === 'piece' && part.piece === KIT.turrets[turret])
      expect(shell?.mount).toBe('turret')
      if (shell?.kind === 'piece') pieces.add(shell.piece)
      const loft = shell?.kind === 'piece' ? shell.fallback.find((part) => part.kind === 'loft') : undefined
      expect(loft?.kind).toBe('loft')
      if (loft?.kind !== 'loft') continue
      expect(loft.rings.length).toBeGreaterThanOrEqual(2)
      for (const ring of loft.rings) expect(ring.corners).toHaveLength(8)
      const ys = loft.rings.map((ring) => ring.y)
      expect(ys).toEqual([...ys].sort((a, b) => a - b))
      seen.add(JSON.stringify(RENDER.tank.turrets[turret]))
    }
    expect(seen.size).toBe(shapes.length)
    expect(pieces.size).toBe(shapes.length)
  })

  it('builds an upper hull out over the tracks, and a lower hull under it', () => {
    const { spec, sheet } = sheetOf()
    const shape = tankShapeOf(spec, sheet.geometry)
    const upper = shape.parts.find((part) => part.kind === 'sweep')
    const lower = shape.parts.find((part) => part.kind === 'slab')
    expect(upper?.kind).toBe('sweep')
    expect(lower?.kind).toBe('slab')
    if (upper?.kind !== 'sweep' || lower?.kind !== 'slab') return
    const deck = Math.min(...upper.stations.flatMap((station) => station.corners.map((c) => c.y)))
    // Out to the tracks' outer edge, and no lower hull above the deck to show through the roof.
    expect(Math.max(...upper.stations.flatMap((station) => station.corners.map((c) => c.z)))).toBeCloseTo(shape.track.centreZM + shape.track.widthM / 2, 6)
    expect(Math.max(...lower.outline.map((point) => point.y))).toBeLessThanOrEqual(deck + 1e-9)
    for (const station of upper.stations) expect(station.corners).toHaveLength(8)
    expect(partTriangles(upper)).toBe(3 * 16 + 2 * 6)
  })

  it('lays the kit tile panels where the design carries tiles, and nowhere else', () => {
    const panels = (tiles: boolean) => built('castDome', tiles).parts.filter((part) => part.kind === 'piece' && part.piece === 'era-tiles')
    expect(panels(false)).toHaveLength(0)
    const all = panels(true)
    const P = RENDER.tank.tilePanels
    const count = (plate: { panelsLong: number; panelsWide: number }) => plate.panelsLong * plate.panelsWide
    expect(all).toHaveLength(count(P.glacis) + 4 * count(P.hullSide) + 2 * count(P.turretFront) + 2 * count(P.turretSide))
    for (const part of all) expect(part.tone).toBe('tile')
  })

  it('cuts an outline off at a height', () => {
    const square = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }]
    expect(below(square, 1)).toEqual([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 1 }])
  })

  it('has a track loop, a sprocket and an idler each side, and a wheel for every road wheel', () => {
    const { spec, sheet } = sheetOf()
    const parts = tankShapeOf(spec, sheet.geometry).parts
    expect(parts.filter((part) => part.kind === 'band')).toHaveLength(2)
    const pieces = parts.filter((part) => part.kind === 'piece')
    const count = (piece: string) => pieces.filter((part) => part.piece === piece).length
    expect(count('road-wheel')).toBe(2 * spec.runningGear.roadWheels)
    expect(count('sprocket')).toBe(2)
    expect(count('idler')).toBe(2)
    expect(count('return-roller')).toBe(2 * RENDER.tank.runningGear.returnRollers)
  })

  it('shows tiles only where the design carries them', () => {
    for (const turret of shapes) {
      expect(built(turret, false).parts.filter((part) => part.tone === 'tile')).toHaveLength(0)
      const tiled = built(turret, true).parts.filter((part) => part.tone === 'tile')
      expect(tiled.length).toBeGreaterThanOrEqual(5)
      expect(tiled.some((part) => part.mount === 'turret')).toBe(true)
      expect(tiled.some((part) => part.mount === 'hull')).toBe(true)
    }
  })

  it('leaves the hatch off a turret with nobody in it, and the launchers off a tank without them', () => {
    const cupola = (turret: TurretId) => built(turret, false).parts.filter((part) => part.kind === 'piece' && part.piece === 'cupola').length
    expect(cupola('castDome')).toBe(1)
    expect(cupola('unmanned')).toBe(0)
    const { spec, sheet } = sheetOf((s) => { s.protection.smokeLaunchers = false })
    const bare = tankShapeOf(spec, sheet.geometry).parts.length
    const withThem = sheetOf((s) => { s.protection.smokeLaunchers = true })
    expect(tankShapeOf(withThem.spec, withThem.sheet.geometry).parts.length).toBe(bare + 2)
  })

  it('hangs side skirts outside the wheels, the length of the track, only when the design has them', () => {
    const plates = (shape: ReturnType<typeof built>) => shape.parts.filter((part) => part.kind === 'piece' && part.piece === 'skirt-panel')
    expect(plates(built('castDome', false))).toHaveLength(0)
    const shape = built('castDome', false, true)
    const all = plates(shape)
    const plate = KIT.reference.skirtPanelM
    const perSide = Math.ceil(shape.track.lengthM / plate.long)
    expect(all).toHaveLength(2 * perSide)
    let covered = 0
    for (const part of all) {
      if (part.kind !== 'piece') continue
      // Outside the track, and hung below the top of it.
      expect(Math.abs(part.at.z)).toBeGreaterThan(shape.track.centreZM + shape.track.widthM / 2)
      expect(part.at.y + plate.bottom * part.scale.y).toBeLessThan(shape.track.topM)
      if (part.at.z > 0) covered += plate.long * part.scale.x
    }
    expect(covered).toBeGreaterThan(shape.track.lengthM * 0.95)
    expect(covered).toBeLessThanOrEqual(shape.track.lengthM)
  })

  it('keeps every part a real size and inside the budget for a phone', () => {
    for (const turret of shapes) {
      const shape = built(turret, true, true)
      for (const part of shape.parts) {
        expect(partTriangles(part)).toBeGreaterThan(0)
        if (part.kind === 'box') for (const side of [part.size.x, part.size.y, part.size.z]) expect(side).toBeGreaterThan(0)
        if (part.kind === 'drum') expect(part.radiusM * part.lengthM).toBeGreaterThan(0)
      }
      expect(tankTriangles(shape)).toBeLessThanOrEqual(RENDER.tank.maxTriangles)
    }
  })
})

describe('the 3D range stays out of the first load', () => {
  const sources = listFilesDeep('src').filter((file) => file.endsWith('.ts'))
  // A line that pulls code in when the page opens. `import type` costs nothing; `import(...)` waits until asked.
  const loadsAtOnce = (text: string, what: RegExp): boolean =>
    text
      .split('\n')
      .some((line) => /^\s*(import|export)\s/.test(line) && !/^\s*(import|export)\s+type\s/.test(line) && what.test(line))

  it('keeps three.js inside src/render', () => {
    const outside = sources.filter((file) => !file.startsWith('src/render/'))
    expect(outside.filter((file) => loadsAtOnce(readRepoFile(file), /from\s+'three(\/[^']*)?'/))).toEqual([])
  })

  it('keeps three.js in the three files that draw', () => {
    const users = sources.filter((file) => /from\s+'three(\/[^']*)?'/.test(readRepoFile(file)))
    expect(users).toEqual(['src/render/battleScene.ts', 'src/render/rangeScene.ts', 'src/render/tankModel.ts'])
  })

  it('lets nothing outside src/render load the scene when the page opens', () => {
    const outside = sources.filter((file) => !file.startsWith('src/render/'))
    expect(outside.filter((file) => loadsAtOnce(readRepoFile(file), /render\/(rangeScene|battleScene)'/))).toEqual([])
  })

  it('opens the scene only when asked', () => {
    expect(readRepoFile('src/ui/rangeScreen.ts')).toMatch(/await import\('\.\.\/render\/rangeScene'\)/)
    expect(readRepoFile('src/ui/battleWatch.ts')).toMatch(/await import\('\.\.\/render\/battleScene'\)/)
  })

  it('uses the version of three.js the studio uses', () => {
    const pkg = JSON.parse(readRepoFile('package.json')) as { dependencies: Record<string, string> }
    expect(pkg.dependencies.three).toBe('0.187.0')
  })
})
