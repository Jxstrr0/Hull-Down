import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { RANGE } from '../src/data/range'
import { RENDER } from '../src/data/render'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { VIEWS, shotAt } from '../src/render/director'
import { courseOutline, coursePath, mudPatch, pointAt, poseAt, stripPath, trenchPit } from '../src/render/path'
import { frameAt, lengthS, type RunRecord } from '../src/render/playback'
import { tankShapeOf } from '../src/render/tankShape'
import { courseLayout, runProvingGround } from '../src/sim/trials'
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

  it('travels with the tank in the side, behind and above views, on both ranges', () => {
    for (const view of ['side', 'behind', 'above'] as const) {
      for (const [test, path, s] of [['acceleration', strip, 400], ['obstacles', course, 60]] as const) {
        const pose = poseAt(path, s, foot)
        const shot = shotAt(test, view, path, pose, s)
        expect(shot.from).toEqual({ x: pose.x - seats[view].backM, y: pose.y + seats[view].upM, z: seats[view].sideM })
        expect(shot.to).toEqual({ x: pose.x, y: pose.y + RENDER.camera.lookUpM, z: 0 })
      }
    }
  })

  it('always looks at the tank', () => {
    for (const view of VIEWS) {
      for (let s = 0; s <= course.lengthM; s += 3) {
        const pose = poseAt(course, s, foot)
        expect(shotAt('obstacles', view, course, pose, s).to).toEqual({ x: pose.x, y: pose.y + RENDER.camera.lookUpM, z: 0 })
      }
    }
  })

  it('cuts on the strip where the table says, and nowhere else', () => {
    const cuts = RENDER.camera.director.acceleration
    const seatAt = (s: number): string => {
      const pose = poseAt(strip, s, foot)
      const from = shotAt('acceleration', 'director', strip, pose, s).from
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
      const at = (s: number) => shotAt('obstacles', 'director', course, poseAt(course, s, foot), s).from
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
    expect(shotAt('obstacles', 'director', course, pose, s).from).toEqual({ x: pose.x - seat.backM, y: pose.y + seat.upM, z: seat.sideM })
  })

  it('never sits on top of what it looks at', () => {
    for (const view of VIEWS) {
      for (const [test, path] of [['acceleration', strip], ['obstacles', course]] as const) {
        for (let s = 0; s <= path.lengthM; s += 7) {
          const shot = shotAt(test, view, path, poseAt(path, s, foot), s)
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

  it('keeps three.js in the one file that draws', () => {
    const users = sources.filter((file) => /from\s+'three(\/[^']*)?'/.test(readRepoFile(file)))
    expect(users).toEqual(['src/render/rangeScene.ts'])
  })

  it('lets nothing outside src/render load the scene when the page opens', () => {
    const outside = sources.filter((file) => !file.startsWith('src/render/'))
    expect(outside.filter((file) => loadsAtOnce(readRepoFile(file), /render\/rangeScene'/))).toEqual([])
  })

  it('opens the scene only when asked', () => {
    expect(readRepoFile('src/ui/rangeScreen.ts')).toMatch(/await import\('\.\.\/render\/rangeScene'\)/)
  })

  it('uses the version of three.js the studio uses', () => {
    const pkg = JSON.parse(readRepoFile('package.json')) as { dependencies: Record<string, string> }
    expect(pkg.dependencies.three).toBe('0.187.0')
  })
})
