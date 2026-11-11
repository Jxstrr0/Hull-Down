// The grey-box 3D range. It only plays back a run the sim has already
// finished: nothing here decides a result. This file and three.js are loaded
// when the player first asks to watch a run, never before.
import {
  BoxGeometry, Color, CylinderGeometry, DirectionalLight, ExtrudeGeometry, Fog, Group, HemisphereLight, Mesh,
  MeshLambertMaterial, PerspectiveCamera, PlaneGeometry, Scene, Shape, WebGLRenderer,
  type BufferGeometry, type Material,
} from 'three'
import { RANGE } from '../data/range'
import { RENDER } from '../data/render'
import type { Geometry, VehicleSpec } from '../sim/vehicle'
import { courseOutline, coursePath, mudPatch, trenchPit, poseAt, stripPath, type Path, type Point } from './path'
import { frameAt, type RunRecord } from './playback'
import { tankShapeOf, type TankShape } from './tankShape'

export type RangeTest = 'acceleration' | 'obstacles'

export interface ViewFrame {
  /** Seconds into the run. */
  timeS: number
  speedKmh: number
  distanceM: number
}

export interface RangeViewArgs {
  /** The box the picture fills. It is resized with it. */
  host: HTMLElement
  /** Words for a screen reader, in place of the picture. */
  label: string
  test: RangeTest
  spec: VehicleSpec
  geometry: Geometry
  record: RunRecord
  onFrame(frame: ViewFrame): void
  onEnd(): void
}

export interface RangeView {
  /** Play the run again from the start. */
  replay(): void
  /** Stop and give back everything the picture was holding. */
  dispose(): void
}

/** Everything made for the scene, so it can all be given back. */
class Kit {
  private readonly geometries: BufferGeometry[] = []
  private readonly materials = new Map<string, Material>()

  paint(colour: string): Material {
    let material = this.materials.get(colour)
    if (!material) {
      material = new MeshLambertMaterial({ color: new Color(colour), flatShading: true })
      this.materials.set(colour, material)
    }
    return material
  }

  mesh(geometry: BufferGeometry, colour: string): Mesh {
    this.geometries.push(geometry)
    return new Mesh(geometry, this.paint(colour))
  }

  /** A shape seen from the side, given depth across the range and centred on the line. */
  slab(outline: Point[], widthM: number, colour: string): Mesh {
    const shape = new Shape()
    outline.forEach((point, index) => (index === 0 ? shape.moveTo(point.x, point.y) : shape.lineTo(point.x, point.y)))
    shape.closePath()
    const geometry = new ExtrudeGeometry(shape, { depth: widthM, bevelEnabled: false })
    geometry.translate(0, 0, -widthM / 2)
    return this.mesh(geometry, colour)
  }

  box(sizeX: number, sizeY: number, sizeZ: number, colour: string): Mesh {
    return this.mesh(new BoxGeometry(sizeX, sizeY, sizeZ), colour)
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials.values()) material.dispose()
  }
}

function buildTank(kit: Kit, shape: TankShape): Group {
  const c = RENDER.colours
  const t = RENDER.tank
  const tank = new Group()
  tank.add(kit.slab(shape.hullOutline, shape.hullWidthM, c.tank))

  for (const side of [-1, 1]) {
    const track = kit.box(shape.track.lengthM, shape.track.topM, shape.track.widthM, c.tankDark)
    track.position.set(0, shape.track.topM / 2, side * shape.track.centreZM)
    tank.add(track)
    for (const x of shape.wheels.xM) {
      const wheel = kit.mesh(new CylinderGeometry(shape.wheels.radiusM, shape.wheels.radiusM, t.wheelThickM, t.wheelSides), c.tank)
      wheel.rotation.x = Math.PI / 2
      wheel.position.set(x, shape.wheels.radiusM, side * (shape.track.centreZM + shape.track.widthM / 2 + t.wheelProudM))
      tank.add(wheel)
    }
  }

  const turret = kit.mesh(new CylinderGeometry(shape.turret.radiusM, shape.turret.radiusM, shape.turret.heightM, t.turretSides), c.tank)
  turret.position.set(shape.turret.xM, shape.turret.baseM + shape.turret.heightM / 2, 0)
  tank.add(turret)
  if (shape.turret.bustleM > 0) {
    const long = shape.turret.radiusM + shape.turret.bustleM
    const bustle = kit.box(long, shape.turret.heightM * t.bustleHeightShare, shape.turret.radiusM * t.bustleWidthShare, c.tank)
    bustle.position.set(shape.turret.xM - long / 2, shape.turret.baseM + shape.turret.heightM / 2, 0)
    tank.add(bustle)
  }

  const gun = kit.mesh(new CylinderGeometry(shape.gun.radiusM, shape.gun.radiusM, shape.gun.lengthM, t.gunSides), c.tankDark)
  gun.rotation.z = Math.PI / 2
  gun.position.set(shape.gun.rootXM + shape.gun.lengthM / 2, shape.gun.yM, 0)
  tank.add(gun)
  return tank
}

/** Open ground from `nearZ` to `farZ` across the range. */
function flatGround(kit: Kit, y: number, centreX: number, nearZ: number, farZ: number): Mesh {
  const ground = kit.mesh(new PlaneGeometry(RENDER.ground.sizeM * 2, nearZ - farZ), RENDER.colours.ground)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(centreX, y, (nearZ + farZ) / 2)
  return ground
}

function buildStrip(kit: Kit, scene: Scene): void {
  const s = RENDER.strip
  const long = RANGE.acceleration.stripM
  const reach = RENDER.ground.sizeM / 2
  scene.add(flatGround(kit, 0, long / 2, reach, -reach))
  const strip = kit.box(long + 2 * RENDER.course.leadM, s.thickM, s.widthM, RENDER.colours.concrete)
  strip.position.set(long / 2, 0, 0)
  scene.add(strip)
  for (let x = 0; x <= long; x += s.postEveryM) {
    for (const side of [-1, 1]) {
      const post = kit.box(s.postWidthM, s.postHeightM, s.postWidthM, RENDER.colours.post)
      post.position.set(x, s.postHeightM / 2, side * (s.widthM / 2 + s.postOffM))
      scene.add(post)
    }
  }
}

function buildCourse(kit: Kit, scene: Scene, path: Path): void {
  const c = RENDER.course
  // The open ground stops at the lane on both sides, so the trench stays an open cut.
  const reach = RENDER.ground.sizeM / 2
  const edge = c.widthM / 2
  scene.add(flatGround(kit, -RENDER.ground.underM, path.lengthM / 2, reach, edge))
  scene.add(flatGround(kit, -RENDER.ground.underM, path.lengthM / 2, -edge, -reach))
  scene.add(kit.slab(courseOutline(), c.widthM, RENDER.colours.earth))
  const mud = mudPatch()
  const pit = kit.box(mud.toX - mud.fromX, c.mudThickM, c.widthM - c.mudInsetM, RENDER.colours.mud)
  pit.position.set((mud.fromX + mud.toX) / 2, mud.y, 0)
  scene.add(pit)
  const trench = trenchPit()
  const wide = trench.toX - trench.fromX
  const floor = kit.box(wide, c.mudThickM, c.widthM, RENDER.colours.pit)
  floor.position.set((trench.fromX + trench.toX) / 2, trench.floorY, 0)
  scene.add(floor)
  const wall = kit.box(wide, c.trenchDepthM, c.pitWallM, RENDER.colours.pit)
  wall.position.set((trench.fromX + trench.toX) / 2, trench.floorY + c.trenchDepthM / 2, -edge)
  scene.add(wall)
}

/**
 * Opens the 3D view in `host` and starts playing. Throws when the device
 * cannot give it a 3D drawing surface.
 */
export function openRangeView(args: RangeViewArgs): RangeView {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
  const kit = new Kit()
  const scene = new Scene()
  scene.background = new Color(RENDER.colours.sky)
  scene.fog = new Fog(new Color(RENDER.colours.sky), RENDER.fog.nearM, RENDER.fog.farM)
  scene.add(new HemisphereLight(new Color(RENDER.colours.sky), new Color(RENDER.light.groundTint), RENDER.light.skyStrength))
  const sun = new DirectionalLight(new Color(RENDER.colours.sun), RENDER.light.sunStrength)
  sun.position.set(RENDER.light.sunFrom.x, RENDER.light.sunFrom.y, RENDER.light.sunFrom.z)
  scene.add(sun)

  const path = args.test === 'acceleration' ? stripPath() : coursePath()
  if (args.test === 'acceleration') buildStrip(kit, scene)
  else buildCourse(kit, scene, path)

  const shape = tankShapeOf(args.spec, args.geometry)
  const tank = buildTank(kit, shape)
  scene.add(tank)

  const cam = RENDER.camera
  const seat = cam[args.test]
  const camera = new PerspectiveCamera(cam.fovDeg, 1, cam.nearM, cam.farM)

  const canvas = renderer.domElement
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', args.label)
  args.host.append(canvas)

  const resize = (): void => {
    const width = args.host.clientWidth
    const height = args.host.clientHeight
    if (width === 0 || height === 0) return
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER.maxPixelRatio))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const watcher = new ResizeObserver(() => {
    resize()
    draw()
  })

  let timeS = 0
  let lastMs = 0
  let ticking = 0
  let disposed = false

  /** Put the tank and the camera where the run has them at `timeS`, and draw. */
  function draw(): boolean {
    const frame = frameAt(args.record, timeS)
    const pose = poseAt(path, frame.s, shape.footprintM)
    tank.position.set(pose.x, pose.y - frame.sinkM, 0)
    tank.rotation.z = pose.pitchRad
    camera.position.set(pose.x - seat.backM, pose.y + seat.upM, seat.sideM)
    camera.lookAt(pose.x, pose.y + cam.lookUpM, 0)
    renderer.render(scene, camera)
    args.onFrame({ timeS, speedKmh: frame.vMs * 3.6, distanceM: frame.s })
    return frame.done
  }

  function tick(nowMs: number): void {
    ticking = 0
    if (disposed) return
    // The screen it was on has gone: stop, and give everything back.
    if (!args.host.isConnected) {
      dispose()
      return
    }
    const passedS = lastMs === 0 ? 0 : Math.min((nowMs - lastMs) / 1000, RENDER.maxFrameS)
    lastMs = nowMs
    timeS += passedS * RENDER.playRate[args.test]
    if (draw()) args.onEnd()
    else ticking = requestAnimationFrame(tick)
  }

  function replay(): void {
    if (disposed) return
    timeS = 0
    lastMs = 0
    if (ticking === 0) ticking = requestAnimationFrame(tick)
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    if (ticking !== 0) cancelAnimationFrame(ticking)
    watcher.disconnect()
    kit.dispose()
    renderer.dispose()
    canvas.remove()
  }

  resize()
  watcher.observe(args.host)
  replay()
  return { replay, dispose }
}
