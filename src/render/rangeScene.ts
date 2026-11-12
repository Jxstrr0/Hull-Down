// The grey-box 3D range. It only plays back a run the sim has already
// finished: nothing here decides a result. This file and three.js are loaded
// when the player first asks to watch a run, never before.
import {
  BoxGeometry, BufferGeometry, Color, DataTexture, DirectionalLight, ExtrudeGeometry, Float32BufferAttribute, Fog,
  Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshLambertMaterial, PerspectiveCamera, PlaneGeometry, RepeatWrapping,
  Scene, Shape, SphereGeometry, SRGBColorSpace, WebGLRenderer, type Material, type Texture,
} from 'three'
import { GUNNERY } from '../data/gunnery'
import { RANGE, type GunneryTestId } from '../data/range'
import { RENDER } from '../data/render'
import { TIERS, type TierId } from '../data/graphics'
import type { PaintId } from '../data/paint'
import type { Fire } from '../sim/gunnery/fire'
import type { Geometry, VehicleSpec } from '../sim/vehicle'
import type { EnduranceRun, GunneryRun } from '../sim/trials'
import { shotAt, type RangeTest, type Scene as Where, type ViewId } from './director'
import { courseOutline, coursePath, mudPatch, trenchPit, poseAt, stripPath, type Path, type Point, type Pose } from './path'
import { frameAt, lengthS, type RunRecord } from './playback'
import { reelOf, type ReelFrame } from './shootReel'
import type { Camo } from './camo'
import { createFrameMeter } from './frameMeter'
import { rangeScenery } from './scenery'
import { buildSolids, buildTank, rollTracks, setMud, tonesOf } from './tankModel'
import { courseMud, enduranceMud } from './mud'
import { trackLinkPixels } from './trackLinks'
import { tankShapeOf, type TankShape } from './tankShape'
import { legGround, placeOnLeg, type LegGround } from './terrain'
import { puffAt, timelapseOf, type LapseFrame } from './timelapse'

export type { RangeTest, ViewId }

/**
 * The run to play: a recorded drive down the strip or over the course, the
 * endurance run as a time-lapse, or a firing test target by target. `fire`
 * is the tank as it shot, without any part that failed before the shoot.
 */
export type RunSource =
  | { test: 'acceleration' | 'obstacles'; record: RunRecord }
  | { test: 'endurance'; run: EnduranceRun }
  | { test: GunneryTestId; run: GunneryRun; fire: Fire }

export interface ViewFrame {
  /** Seconds into the run. For the endurance run, seconds into the time-lapse. */
  timeS: number
  speedKmh: number
  /** Metres from the start. */
  distanceM: number
  /** Where the endurance run has got to. Only set for that run. */
  lapse?: LapseFrame
  /** Where a firing test has got to. Only set for a shoot. */
  shoot?: ReelFrame
}

export interface RangeViewArgs {
  /** The box the picture fills. */
  host: HTMLElement
  /** What a screen reader says the picture is. */
  label: string
  source: RunSource
  view: ViewId
  spec: VehicleSpec
  geometry: Geometry
  /** The paint the tank wears. */
  paint: PaintId
  /** How finely to draw. */
  quality: TierId
  /** Called once the view has timed its frames, with the frame rate, frames a second. */
  onMeasured(fps: number): void
  /** Called with every picture drawn. */
  onFrame(frame: ViewFrame): void
  /** Called when the run starts playing, is paused, or reaches its end. */
  onState(state: ViewState): void
}

export interface ViewState {
  playing: boolean
  /** True when the run has played to its end. */
  ended: boolean
}

export interface RangeView {
  /** Seconds the run lasts. */
  readonly lengthS: number
  /** Play on from here, or from the start when the run has ended. */
  play(): void
  pause(): void
  /** Show the run at this many seconds in. Playing carries on from there. */
  seek(timeS: number): void
  setView(view: ViewId): void
  /** Draw more or less finely from now on. The frames are timed again. */
  setQuality(tier: TierId): void
  /** Stop and give back everything the picture was holding. */
  dispose(): void
}

/** Everything made for the scene, so it can all be given back. */
export class Kit {
  private readonly geometries: BufferGeometry[] = []
  private readonly materials = new Map<string, Material>()
  private readonly textures: Texture[] = []

  /** A flat colour. `opacity` under 1 makes it see-through, for smoke. */
  paint(colour: string, opacity = 1): Material {
    const key = `${colour}/${opacity}`
    let material = this.materials.get(key)
    if (!material) {
      material = new MeshLambertMaterial({
        color: new Color(colour), flatShading: true, transparent: opacity < 1, opacity, depthWrite: opacity === 1,
      })
      this.materials.set(key, material)
    }
    return material
  }

  mesh(geometry: BufferGeometry, colour: string, opacity = 1): Mesh {
    this.geometries.push(geometry)
    return new Mesh(geometry, this.paint(colour, opacity))
  }

  private links: Texture | null = null
  private trackCount = 0

  /**
   * A tank's tracks: bare steel with the links painted on. The shape says where on the links each corner
   * falls. Each tank gets its own copy of the picture, so its links run round at its own pace.
   */
  tracked(geometry: BufferGeometry): Mesh {
    this.geometries.push(geometry)
    const k = RENDER.tank.trackLinks
    if (!this.links) {
      const texture = new DataTexture(trackLinkPixels(), k.alongPx, k.acrossPx)
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.colorSpace = SRGBColorSpace
      texture.generateMipmaps = true
      texture.needsUpdate = true
      this.textures.push(texture)
      this.links = texture
    }
    const texture = this.links.clone()
    texture.needsUpdate = true
    this.textures.push(texture)
    const material = new MeshLambertMaterial({ map: texture, color: new Color(k.steel), flatShading: true })
    this.materials.set(`track/${this.trackCount++}`, material)
    return new Mesh(geometry, material)
  }

  private wheelCount = 0
  private mudCount = 0

  /**
   * A copy of `material` that takes mud: `mud.share` of the way to the mud colour up to `lineM` from the
   * tank's floor, fading out over `fadeM` above. The tank's parts share one `mud`, so one number dirties them all.
   */
  muddy(material: Material, mud: { share: { value: number }; lineM: { value: number } }): Material {
    const copy = material.clone()
    const before = material.onBeforeCompile.bind(material)
    const key = material.customProgramCacheKey()
    copy.userData = { ...material.userData }
    const k = RENDER.tank.mud
    copy.onBeforeCompile = (shader, renderer) => {
      before(shader, renderer)
      shader.uniforms.mudShare = mud.share
      shader.uniforms.mudLineM = mud.lineM
      shader.uniforms.mudFadeM = { value: k.fadeM }
      shader.uniforms.mudColour = { value: new Color(k.colour) }
      shader.vertexShader = `varying float vMudY;\n${shader.vertexShader}`.replace(
        '#include <project_vertex>',
        'vMudY = transformed.y;\n#include <project_vertex>',
      )
      shader.fragmentShader = `varying float vMudY;\nuniform float mudShare;\nuniform float mudLineM;\nuniform float mudFadeM;\nuniform vec3 mudColour;\n${shader.fragmentShader}`.replace(
        '#include <color_fragment>',
        // A painted picture (the links, the camouflage) still shows faintly through: its dark parts take darker mud.
        `#include <color_fragment>
        vec3 dirt = mudColour;
        #ifdef USE_MAP
          dirt *= mix(${k.underShade.toFixed(3)}, 1.0, sampledDiffuseColor.g);
        #endif
        diffuseColor.rgb = mix(diffuseColor.rgb, dirt, mudShare * clamp(1.0 - (vMudY - mudLineM) / mudFadeM, 0.0, 1.0));`,
      )
    }
    copy.customProgramCacheKey = () => `${key}+mud`
    this.materials.set(`mud/${this.mudCount++}`, copy)
    return copy
  }

  /**
   * A tank's wheels in one flat colour, each turned about its own hub as the tank rolls on. Every corner of
   * the shape carries its wheel's hub (x, y) and one over its radius; the material's `rollM` says how far
   * the tank has rolled, and each wheel turns that far round its rim. Each tank has its own material.
   */
  wheels(geometry: BufferGeometry, paint: string | Camo): Mesh {
    this.geometries.push(geometry)
    const rollM = { value: 0 }
    // A camouflaged tank's wheels carry the pattern too, and it turns with them.
    const material = typeof paint === 'string'
      ? new MeshLambertMaterial({ color: new Color(paint), flatShading: true })
      : new MeshLambertMaterial({ map: this.camoTexture(paint), flatShading: true })
    material.userData.rollM = rollM
    material.onBeforeCompile = (shader) => {
      shader.uniforms.rollM = rollM
      shader.vertexShader = `attribute vec3 hub;\nuniform float rollM;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float turn = -rollM * hub.z;
          vec2 arm = transformed.xy - hub.xy;
          transformed.xy = hub.xy + vec2(cos(turn) * arm.x - sin(turn) * arm.y, sin(turn) * arm.x + cos(turn) * arm.y);
        }`,
      )
    }
    material.customProgramCacheKey = () => 'wheels'
    this.materials.set(`wheels/${this.wheelCount++}`, material)
    const mesh = new Mesh(geometry, material)
    // Turned wheels stay inside their own rims, but the bounds are worked out from them standing still.
    mesh.frustumCulled = false
    return mesh
  }

  /** A shape painted with a pattern that repeats over it. The shape says where on the pattern each corner falls. */
  patterned(geometry: BufferGeometry, camo: Camo): Mesh {
    this.geometries.push(geometry)
    const key = `camo/${camo.key}`
    let material = this.materials.get(key)
    if (!material) {
      material = new MeshLambertMaterial({ map: this.camoTexture(camo), flatShading: true })
      this.materials.set(key, material)
    }
    return new Mesh(geometry, material)
  }

  private readonly camoTextures = new Map<string, Texture>()

  /** A pattern's picture, made once and shared by everything painted with it. */
  private camoTexture(camo: Camo): Texture {
    let texture = this.camoTextures.get(camo.key)
    if (!texture) {
      texture = new DataTexture(camo.pixels, camo.sizePx, camo.sizePx)
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.colorSpace = SRGBColorSpace
      texture.generateMipmaps = true
      texture.needsUpdate = true
      this.textures.push(texture)
      this.camoTextures.set(camo.key, texture)
    }
    return texture
  }

  /** A shape that shines by itself, whatever the light: a round in the air, the flash at the muzzle. */
  glow(geometry: BufferGeometry, colour: string): Mesh {
    this.geometries.push(geometry)
    const key = `glow/${colour}`
    let material = this.materials.get(key)
    if (!material) {
      material = new MeshBasicMaterial({ color: new Color(colour), fog: false })
      this.materials.set(key, material)
    }
    return new Mesh(geometry, material)
  }

  /** A strip of ground that follows a line seen from the side, this wide across the range. */
  ribbon(line: Point[], widthM: number, liftM: number, colour: string): Mesh {
    const places: number[] = []
    const corners: number[] = []
    line.forEach((point, index) => {
      places.push(point.x, point.y + liftM, -widthM / 2, point.x, point.y + liftM, widthM / 2)
      if (index === 0) return
      const a = 2 * (index - 1)
      // Two triangles to each piece, wound so they face up.
      corners.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    })
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(places, 3))
    geometry.setIndex(corners)
    geometry.computeVertexNormals()
    return this.mesh(geometry, colour)
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
    for (const texture of this.textures) texture.dispose()
  }
}

/** Open ground from `nearZ` to `farZ` across the range. */
function flatGround(kit: Kit, y: number, centreX: number, nearZ: number, farZ: number): Mesh {
  const ground = kit.mesh(new PlaneGeometry(RENDER.ground.sizeM * 2, nearZ - farZ), RENDER.colours.ground)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(centreX, y, (nearZ + farZ) / 2)
  return ground
}

function buildStrip(kit: Kit, scene: Scene, density: number): void {
  const s = RENDER.strip
  const long = RANGE.acceleration.stripM
  const reach = RENDER.ground.sizeM / 2
  scene.add(flatGround(kit, 0, long / 2, reach, -reach))
  const strip = kit.box(long + 2 * RENDER.course.leadM, s.thickM, s.widthM, RENDER.colours.concrete)
  strip.position.set(long / 2, 0, 0)
  scene.add(strip)
  scene.add(buildSolids(kit, rangeScenery({ fromX: -RENDER.course.leadM, toX: long + RENDER.course.leadM, laneHalfM: s.widthM / 2, density })))
  for (let x = 0; x <= long; x += s.postEveryM) {
    for (const side of [-1, 1]) {
      const post = kit.box(s.postWidthM, s.postHeightM, s.postWidthM, RENDER.colours.post)
      post.position.set(x, s.postHeightM / 2, side * (s.widthM / 2 + s.postOffM))
      scene.add(post)
    }
  }
}

function buildCourse(kit: Kit, scene: Scene, path: Path, density: number): void {
  const c = RENDER.course
  // The open ground stops at the lane on both sides, so the trench stays an open cut.
  const reach = RENDER.ground.sizeM / 2
  const edge = c.widthM / 2
  scene.add(flatGround(kit, -RENDER.ground.underM, path.lengthM / 2, reach, edge))
  scene.add(flatGround(kit, -RENDER.ground.underM, path.lengthM / 2, -edge, -reach))
  scene.add(kit.slab(courseOutline(), c.widthM, RENDER.colours.earth))
  scene.add(buildSolids(kit, rangeScenery({ fromX: 0, toX: path.lengthM, laneHalfM: edge, density })))
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

/** The ground of one leg of the endurance run: open country, the lane the tank keeps to, and marker posts. */
function buildLeg(kit: Kit, ground: LegGround): Group {
  const e = RENDER.endurance
  const leg = e.legs[ground.id]
  const post = RENDER.strip
  const group = new Group()
  const line = ground.path.points
  group.add(kit.ribbon(line, RENDER.ground.sizeM, 0, RENDER.colours.ground))
  group.add(kit.ribbon(line, e.laneWidthM, RENDER.ground.underM, RENDER.colours[leg.lane]))
  for (const x of ground.postsX) {
    const y = line.find((point) => point.x >= x)?.y ?? 0
    for (const side of [-1, 1]) {
      const mark = kit.box(post.postWidthM, post.postHeightM, post.postWidthM, RENDER.colours.post)
      mark.position.set(x, y + post.postHeightM / 2, side * (e.laneWidthM / 2 + post.postOffM))
      group.add(mark)
    }
  }
  return group
}

/** What a run puts on the range at one moment. */
interface Moment {
  pose: Pose
  sinkM: number
  /** How muddy the tank is by now, nought to one. */
  mudShare: number
  where: Where
  frame: Omit<ViewFrame, 'timeS'>
  done: boolean
}

/** A run laid out for watching: how long it lasts, and where everything is at each moment. */
interface Show {
  lengthS: number
  /** Seconds of the run played for each second watched. */
  rate: number
  at(timeS: number): Moment
}

/** A recorded drive down the strip or over the obstacle course. */
function driveShow(kit: Kit, scene: Scene, test: 'acceleration' | 'obstacles', record: RunRecord, shape: TankShape, density: number): Show {
  const path = test === 'acceleration' ? stripPath() : coursePath()
  const pit = test === 'obstacles' ? mudPatch() : null
  if (test === 'acceleration') buildStrip(kit, scene, density)
  else buildCourse(kit, scene, path, density)
  return {
    lengthS: lengthS(record),
    rate: RENDER.playRate[test],
    at(timeS) {
      const frame = frameAt(record, timeS)
      const pose = poseAt(path, frame.s, shape.footprintM)
      return {
        pose,
        sinkM: frame.sinkM,
        // The strip is concrete; the course is earth, and the pit leaves its mark.
        mudShare: pit ? courseMud(pose.x, pit) : 0,
        where: test === 'acceleration' ? { test, s: frame.s } : { test, s: frame.s, path },
        frame: { speedKmh: frame.vMs * 3.6, distanceM: frame.s },
        done: frame.done,
      }
    },
  }
}

/** The endurance run as a time-lapse: each leg has its own ground, and smoke rises when the powerpack is wrecked. */
function enduranceShow(kit: Kit, scene: Scene, run: EnduranceRun, shape: TankShape, engineAt: 'rear' | 'front'): Show {
  const k = RENDER.endurance.smoke
  const lapse = timelapseOf(run)
  const grounds = run.legs.map((leg) => legGround(leg.id))
  const legs = grounds.map((ground) => {
    const group = buildLeg(kit, ground)
    group.visible = false
    scene.add(group)
    return group
  })
  const ball = new SphereGeometry(1, k.sides, k.sides)
  const puffs = Array.from({ length: k.puffs }, () => {
    const puff = kit.mesh(ball, RENDER.colours.smoke, k.opacity)
    puff.visible = false
    scene.add(puff)
    return puff
  })
  const deckX = (engineAt === 'front' ? 1 : -1) * shape.lengthM * k.deckShare

  return {
    lengthS: lapse.lengthS,
    rate: RENDER.playRate.endurance,
    at(timeS) {
      const frame = lapse.at(timeS)
      const ground = grounds[frame.legIndex]!
      legs.forEach((group, index) => (group.visible = index === frame.legIndex))
      const pose = poseAt(ground.path, placeOnLeg(ground, frame.legM), shape.footprintM)
      const wrecked = frame.event?.ended === true
      puffs.forEach((puff, index) => {
        const at = wrecked ? puffAt(index, frame.heldS) : null
        puff.visible = at !== null
        if (!at) return
        puff.position.set(pose.x + deckX - at.driftM, pose.y + shape.turret.baseM + at.upM, 0)
        puff.scale.setScalar(at.sizeM)
      })
      return {
        pose,
        sinkM: 0,
        mudShare: enduranceMud(frame.km),
        where: { test: 'endurance', leg: ground.id },
        frame: { speedKmh: frame.speedKmh, distanceM: frame.km * 1000, lapse: frame },
        done: frame.done,
      }
    },
  }
}

/**
 * A firing test, target by target: the board comes up down the range, each
 * round is seen to leave the gun and land, and a board that is hit goes down.
 */
function shootShow(kit: Kit, scene: Scene, run: GunneryRun, fire: Fire, shape: TankShape, density: number): Show {
  const k = RENDER.shoot
  const c = RENDER.colours
  const reel = reelOf(run, fire)
  // The range is long: it is laid in short pieces, so no one piece reaches from behind a camera to far ahead of it.
  const line: Point[] = []
  for (let x = k.fromM; x <= k.toM; x += k.pieceM) line.push({ x, y: 0 })
  scene.add(
    kit.ribbon(line, RENDER.ground.sizeM, -RENDER.ground.underM, c.ground),
    kit.ribbon(line.filter((point) => point.x <= k.laneToM), k.laneWidthM, 0, run.moving ? c.earth : c.concrete),
  )

  scene.add(buildSolids(kit, rangeScenery({ fromX: k.sceneryFromM, toX: k.sceneryToM, laneHalfM: k.laneWidthM / 2, density })))

  // The posts keep pace with the tank a step at a time, so there are always some beside it to show it moving.
  const posts = new Group()
  const post = RENDER.strip
  for (let n = -k.postsEachWay; n <= k.postsEachWay; n++) {
    for (const side of [-1, 1]) {
      const mark = kit.box(post.postWidthM, post.postHeightM, post.postWidthM, c.post)
      mark.position.set(n * k.postEveryM, post.postHeightM / 2, side * (k.laneWidthM / 2 + post.postOffM))
      posts.add(mark)
    }
  }
  scene.add(posts)

  const wide = GUNNERY.target.widthM
  const high = GUNNERY.target.heightM
  const centreY = k.boardFootM + high / 2
  // The board turns about its foot, so it can be laid on its back when it is hit.
  const board = new Group()
  const face = kit.box(k.boardThickM, high, wide, c.board)
  face.position.set(0, high / 2, 0)
  const middle = kit.box(k.boardThickM, k.boardMarkM, k.boardMarkM, c.boardMark)
  middle.position.set(-k.boardThickM / 2, high / 2, 0)
  board.add(face, middle)
  scene.add(board)
  const dot = new SphereGeometry(k.markM, 8, 8)
  const marks = Array.from({ length: RANGE.gunnery.shotsPerTarget }, () => ({
    hit: kit.mesh(dot, c.strikeHit),
    miss: kit.mesh(dot, c.strikeMiss),
  }))
  for (const mark of marks) scene.add(mark.hit, mark.miss)
  const tracer = kit.glow(new BoxGeometry(k.tracerLongM, k.tracerThickM, k.tracerThickM), c.tracer)
  const flash = kit.glow(new SphereGeometry(1, 8, 8), c.flash)
  scene.add(tracer, flash)

  const reach = RANGE.gunnery.plotM
  const clamp = (m: number): number => Math.max(-reach, Math.min(reach, m))
  const muzzleX = shape.gun.rootXM + shape.gun.lengthM

  return {
    lengthS: reel.lengthS,
    rate: RENDER.playRate.shoot,
    at(timeS) {
      const frame = reel.at(timeS)
      const target = run.targets[frame.targetIndex]
      posts.position.x = Math.round(frame.tankM / k.postEveryM) * k.postEveryM

      board.position.set(frame.boardM, frame.fallen ? k.boardThickM : k.boardFootM, 0)
      board.rotation.z = frame.fallen ? -Math.PI / 2 : 0
      board.visible = target !== undefined

      // Where each round that has landed went. One that fell short is a mark on the ground in front of the board.
      const place = (index: number): { x: number; y: number; z: number } => {
        const shot = target?.shots[index]
        return {
          x: frame.boardM - k.boardThickM,
          y: Math.max(k.markFloorM, centreY + clamp(shot?.upM ?? 0)),
          z: clamp(shot?.acrossM ?? 0),
        }
      }
      marks.forEach((mark, index) => {
        const shot = target?.shots[index]
        const shown = shot !== undefined && index < frame.landed
        // The mark of a hit goes down with the board.
        mark.hit.visible = shown && shot.hit && !frame.fallen
        mark.miss.visible = shown && !shot.hit
        const at = place(index)
        mark.hit.position.set(at.x, at.y, at.z)
        mark.miss.position.set(at.x, at.y, at.z)
      })

      const muzzle = { x: frame.tankM + muzzleX, y: shape.gun.yM, z: 0 }
      tracer.visible = frame.flightShare !== null
      if (frame.flightShare !== null) {
        const to = place(frame.shotIndex)
        const share = frame.flightShare
        tracer.position.set(muzzle.x + (to.x - muzzle.x) * share, muzzle.y + (to.y - muzzle.y) * share, muzzle.z + (to.z - muzzle.z) * share)
      }
      const fresh = frame.sinceFiredS !== null && frame.sinceFiredS < k.flashS
      flash.visible = fresh
      if (fresh) {
        flash.position.set(muzzle.x, muzzle.y, muzzle.z)
        flash.scale.setScalar(k.flashM * (1 - frame.sinceFiredS! / k.flashS) + 0.01)
      }

      const cut = RENDER.camera.director.shoot.cutShare
      return {
        pose: { x: frame.tankM, y: 0, pitchRad: 0 },
        sinkM: 0,
        mudShare: 0,
        where: {
          test: 'shoot',
          board: { x: frame.boardM, y: centreY, z: 0 },
          onTarget: frame.phase === 'strike' || (frame.flightShare !== null && frame.flightShare >= cut),
        },
        frame: { speedKmh: frame.speedKmh, distanceM: frame.tankM, shoot: frame },
        done: frame.done,
      }
    },
  }
}

/**
 * Opens the 3D view in `host` and starts playing. Throws when the device
 * cannot give it a 3D drawing surface.
 */
export function openRangeView(args: RangeViewArgs): RangeView {
  let tier = args.quality
  const renderer = new WebGLRenderer({ antialias: TIERS[tier].antialias, powerPreference: 'low-power' })
  const kit = new Kit()
  const scene = new Scene()
  const source = args.source
  const density = TIERS[tier].scenery
  // The night shoot is lit by what little there is.
  const dark = source.test === 'night'
  const sky = dark ? RENDER.colours.nightSky : RENDER.colours.sky
  const light = dark ? RENDER.shoot.nightLight : 1
  scene.background = new Color(sky)
  scene.fog = new Fog(new Color(sky), RENDER.fog.nearM, RENDER.fog.farM)
  scene.add(new HemisphereLight(new Color(sky), new Color(RENDER.light.groundTint), RENDER.light.skyStrength * light))
  const sun = new DirectionalLight(new Color(RENDER.colours.sun), RENDER.light.sunStrength * light)
  sun.position.set(RENDER.light.sunFrom.x, RENDER.light.sunFrom.y, RENDER.light.sunFrom.z)
  scene.add(sun)

  const shape = tankShapeOf(args.spec, args.geometry)
  const tank = buildTank(kit, shape, tonesOf(args.paint))
  scene.add(tank)
  const show = source.test === 'endurance'
    ? enduranceShow(kit, scene, source.run, shape, args.spec.hull.engineAt)
    : 'record' in source
      ? driveShow(kit, scene, source.test, source.record, shape, density)
      : shootShow(kit, scene, source.run, source.fire, shape, density)

  const cam = RENDER.camera
  let view = args.view
  const camera = new PerspectiveCamera(cam.fovDeg, 1, cam.nearM, cam.farM)

  const canvas = renderer.domElement
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', args.label)
  args.host.append(canvas)

  const resize = (): void => {
    const width = args.host.clientWidth
    const height = args.host.clientHeight
    if (width === 0 || height === 0) return
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIERS[tier].pixelRatio))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const watcher = new ResizeObserver(() => {
    resize()
    draw()
  })

  const endS = show.lengthS
  let timeS = 0
  let lastMs = 0
  let ticking = 0
  let playing = false
  let disposed = false
  let meter = createFrameMeter()

  let lastDistanceM: number | null = null

  /** Put the tank and the camera where the run has them at `timeS`, and draw. */
  function draw(): boolean {
    const now = show.at(timeS)
    if (lastDistanceM !== null) rollTracks(tank, now.frame.distanceM - lastDistanceM)
    lastDistanceM = now.frame.distanceM
    setMud(tank, now.mudShare)
    tank.position.set(now.pose.x, now.pose.y - now.sinkM, 0)
    tank.rotation.z = now.pose.pitchRad
    const shot = shotAt(view, now.where, now.pose)
    camera.position.set(shot.from.x, shot.from.y, shot.from.z)
    camera.lookAt(shot.to.x, shot.to.y, shot.to.z)
    renderer.render(scene, camera)
    args.onFrame({ timeS, ...now.frame })
    return now.done
  }

  function stop(): void {
    if (ticking !== 0) cancelAnimationFrame(ticking)
    ticking = 0
    playing = false
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
    const fps = lastMs === 0 ? null : meter.add(nowMs - lastMs)
    lastMs = nowMs
    timeS = Math.min(timeS + passedS * show.rate, endS)
    if (fps !== null) args.onMeasured(fps)
    if (disposed) return
    if (draw()) {
      stop()
      args.onState({ playing: false, ended: true })
    } else {
      ticking = requestAnimationFrame(tick)
    }
  }

  function play(): void {
    if (disposed || playing) return
    if (timeS >= endS) timeS = 0
    lastMs = 0
    playing = true
    ticking = requestAnimationFrame(tick)
    args.onState({ playing: true, ended: false })
  }

  function pause(): void {
    if (disposed || !playing) return
    stop()
    args.onState({ playing: false, ended: false })
  }

  function seek(toS: number): void {
    if (disposed) return
    timeS = Math.min(Math.max(toS, 0), endS)
    // While it plays, the next picture is drawn from here anyway.
    if (!playing) draw()
  }

  function setView(next: ViewId): void {
    if (disposed) return
    view = next
    if (!playing) draw()
  }

  function setQuality(next: TierId): void {
    if (disposed || next === tier) return
    tier = next
    meter = createFrameMeter()
    resize()
    if (!playing) draw()
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    stop()
    watcher.disconnect()
    kit.dispose()
    renderer.dispose()
    canvas.remove()
  }

  resize()
  watcher.observe(args.host)
  play()
  return { lengthS: endS, play, pause, seek, setView, setQuality, dispose }
}
