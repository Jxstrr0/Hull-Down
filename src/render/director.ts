// Where the camera stands and what it looks at. Plain numbers, no three.js,
// so the choice of view can be tested without a 3D surface.
import type { GunneryTestId } from '../data/range'
import { RENDER } from '../data/render'
import { courseLayout } from '../sim/trials'
import { pointAt, type Path, type Pose } from './path'
import type { LegId } from './terrain'

/** The views a player can pick. The director picks for itself as the run goes on. */
export const VIEWS = ['director', 'side', 'behind', 'above'] as const
export type ViewId = (typeof VIEWS)[number]

export type RangeTest = 'acceleration' | 'obstacles' | 'endurance' | GunneryTestId

/** A place on the range: x along the run, y up, z across it towards the camera side. */
export interface Vec {
  x: number
  y: number
  z: number
}

/** Where the camera is and the point it looks at. */
export interface Shot {
  from: Vec
  to: Vec
}

type SeatId = keyof typeof RENDER.camera.seats

function lookAtTank(pose: Pose): Vec {
  return { x: pose.x, y: pose.y + RENDER.camera.lookUpM, z: 0 }
}

/** A camera that travels with the tank. */
function travelling(seat: SeatId, pose: Pose): Shot {
  const at = RENDER.camera.seats[seat]
  return { from: { x: pose.x - at.backM, y: pose.y + at.upM, z: at.sideM }, to: lookAtTank(pose) }
}

/** On the strip the director cuts between travelling cameras as the distance goes by. */
function stripSeat(s: number): SeatId {
  let seat: SeatId = 'behind'
  for (const cut of RENDER.camera.director.acceleration) if (s >= cut.fromM) seat = cut.seat
  return seat
}

/**
 * On the course a camera stands beside each obstacle and turns to follow the
 * tank, so the tank is seen to move over the ground and not the ground under
 * the tank. It hands over to the next camera a little after the obstacle.
 */
function courseShot(path: Path, pose: Pose, s: number): Shot {
  const d = RENDER.camera.director.obstacles
  for (const span of courseLayout()) {
    if (span.id === 'flat' || s > span.toM + d.holdM) continue
    const middle = pointAt(path, (span.fromM + span.toM) / 2)
    const sideM = d.sideM + (span.toM - span.fromM) * d.sidePerM
    return { from: { x: middle.x, y: middle.y + d.upM, z: sideM }, to: lookAtTank(pose) }
  }
  return travelling(d.after, pose)
}

/** Where the tank is, for the director to choose by. */
export type Scene =
  | { test: 'acceleration'; s: number }
  | { test: 'obstacles'; s: number; path: Path }
  /** The ground of an endurance leg repeats, so only a camera that travels with the tank will do. */
  | { test: 'endurance'; leg: LegId }
  /** A firing test: the middle of the board, and whether a round is near it or has just landed. */
  | { test: 'shoot'; board: Vec; onTarget: boolean }

/** The camera for a view, with the tank sitting at `pose`. */
export function shotAt(view: ViewId, scene: Scene, pose: Pose): Shot {
  if (view !== 'director') return travelling(view, pose)
  if (scene.test === 'acceleration') return travelling(stripSeat(scene.s), pose)
  if (scene.test === 'obstacles') return courseShot(scene.path, pose, scene.s)
  if (scene.test === 'shoot') {
    const d = RENDER.camera.director.shoot
    if (!scene.onTarget) return travelling(d.seat, pose)
    return { from: { x: scene.board.x - d.shortM, y: d.upM, z: d.sideM }, to: scene.board }
  }
  return travelling(RENDER.camera.director.endurance[scene.leg], pose)
}
