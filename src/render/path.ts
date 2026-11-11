// The line a tank follows on the range, and the shape of the ground under
// it. The sim only knows how far along the tank is; this turns that distance
// into a place and a tilt. Plain numbers, no three.js, so it can be tested.
import { RANGE } from '../data/range'
import { RENDER } from '../data/render'
import { courseLayout } from '../sim/trials'

/** A point seen from the side: metres along the ground and metres up. */
export interface Point {
  x: number
  y: number
}

/** A line the tank follows. `s` is the distance driven to reach each point. */
export interface Path {
  points: (Point & { s: number })[]
  lengthM: number
}

export interface Pose {
  x: number
  y: number
  /** Nose up is positive, radians. */
  pitchRad: number
}

function pathFrom(points: Point[]): Path {
  const out: Path['points'] = []
  let s = 0
  points.forEach((point, index) => {
    const before = points[index - 1]
    if (before) s += Math.hypot(point.x - before.x, point.y - before.y)
    out.push({ ...point, s })
  })
  return { points: out, lengthM: s }
}

/** The acceleration strip: dead flat. */
export function stripPath(): Path {
  return pathFrom([{ x: 0, y: 0 }, { x: RANGE.acceleration.stripM, y: 0 }])
}

function slopeRise(): Point {
  const rad = (RANGE.course.slope.angleDeg * Math.PI) / 180
  return { x: RANGE.course.slope.lengthM * Math.cos(rad), y: RANGE.course.slope.lengthM * Math.sin(rad) }
}

/**
 * The obstacle course as the tank drives it. A tank that crosses the trench
 * bridges it, so the line runs straight over. The step and the slope lift it.
 */
export function coursePath(): Path {
  const c = RENDER.course
  const points: Point[] = [{ x: 0, y: 0 }]
  let x = 0
  let y = 0
  const to = (dx: number, dy: number): void => {
    x += dx
    y += dy
    points.push({ x, y })
  }
  for (const span of courseLayout()) {
    const long = span.toM - span.fromM
    if (span.id === 'step') {
      // The climb takes more ground than it gains, so the line is as long as the sim's stretch.
      const rise = RANGE.course.step.heightM
      const run = Math.sqrt(c.stepClimbM * c.stepClimbM - rise * rise)
      to(c.stepFaceAtM, 0)
      to(run, rise)
      to(long - c.stepFaceAtM - c.stepClimbM, 0)
    } else if (span.id === 'slope') {
      const rise = slopeRise()
      to(rise.x, rise.y)
    } else {
      to(long, 0)
    }
  }
  return pathFrom(points)
}

/**
 * The ground of the obstacle course seen from the side, as a closed outline:
 * along the top from before the start to past the finish, then back underneath.
 */
export function courseOutline(): Point[] {
  const c = RENDER.course
  const top: Point[] = [{ x: -c.leadM, y: 0 }]
  let x = 0
  let y = 0
  for (const span of courseLayout()) {
    const long = span.toM - span.fromM
    if (span.id === 'trench') {
      top.push({ x, y }, { x, y: y - c.trenchDepthM }, { x: x + long, y: y - c.trenchDepthM }, { x: x + long, y })
      x += long
    } else if (span.id === 'step') {
      const rise = RANGE.course.step.heightM
      const run = Math.sqrt(c.stepClimbM * c.stepClimbM - rise * rise)
      // The face stands where the tank's line is half way up it.
      const face = x + c.stepFaceAtM + run / 2
      top.push({ x: face, y }, { x: face, y: y + rise })
      x += long - c.stepClimbM + run
      y += rise
    } else if (span.id === 'slope') {
      const rise = slopeRise()
      top.push({ x, y })
      x += rise.x
      y += rise.y
      top.push({ x, y })
    } else {
      x += long
    }
  }
  top.push({ x: x + c.leadM, y })
  const floor = -c.trenchDepthM - c.footM
  return [...top, { x: x + c.leadM, y: floor }, { x: -c.leadM, y: floor }]
}

/** Where the mud pit lies along the ground, and how high its surface is. */
export function mudPatch(): { fromX: number; toX: number; y: number } {
  const path = coursePath()
  const span = courseLayout().find((each) => each.id === 'mud')!
  const from = pointAt(path, span.fromM)
  return { fromX: from.x, toX: pointAt(path, span.toM).x, y: from.y }
}

/** Where the trench is cut across the lane, and how deep its floor lies. */
export function trenchPit(): { fromX: number; toX: number; floorY: number } {
  const span = courseLayout().find((each) => each.id === 'trench')!
  const from = pointAt(coursePath(), span.fromM)
  return { fromX: from.x, toX: from.x + (span.toM - span.fromM), floorY: from.y - RENDER.course.trenchDepthM }
}

/** The place a given distance along the line. Off either end it holds the end. */
export function pointAt(path: Path, s: number): Point {
  const points = path.points
  const first = points[0]!
  if (s <= first.s) return { x: first.x, y: first.y }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    if (s > b.s) continue
    const share = b.s === a.s ? 0 : (s - a.s) / (b.s - a.s)
    return { x: a.x + (b.x - a.x) * share, y: a.y + (b.y - a.y) * share }
  }
  const last = points.at(-1)!
  return { x: last.x, y: last.y }
}

/**
 * How a tank sits with its middle a given distance along the line: it rests
 * on the ground under the front and the back of its tracks, so it tilts
 * gently over a step and does not snap from flat to steep.
 */
export function poseAt(path: Path, s: number, footprintM: number): Pose {
  const rear = pointAt(path, s - footprintM / 2)
  const front = pointAt(path, s + footprintM / 2)
  return {
    x: (rear.x + front.x) / 2,
    y: (rear.y + front.y) / 2,
    pitchRad: Math.atan2(front.y - rear.y, front.x - rear.x),
  }
}
