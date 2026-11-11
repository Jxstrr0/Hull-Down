// Where the camera stands and what it looks at. Plain numbers, no three.js,
// so the choice of view can be tested without a 3D surface.
import { RENDER } from '../data/render'
import { courseLayout } from '../sim/trials'
import { pointAt, type Path, type Pose } from './path'

/** The views a player can pick. The director picks for itself as the run goes on. */
export const VIEWS = ['director', 'side', 'behind', 'above'] as const
export type ViewId = (typeof VIEWS)[number]

export type RangeTest = 'acceleration' | 'obstacles'

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

/** The camera for a view, with the tank `s` metres into the run and sitting at `pose`. */
export function shotAt(test: RangeTest, view: ViewId, path: Path, pose: Pose, s: number): Shot {
  if (view !== 'director') return travelling(view, pose)
  return test === 'acceleration' ? travelling(stripSeat(s), pose) : courseShot(path, pose, s)
}
