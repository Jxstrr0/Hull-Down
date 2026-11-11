// The grey-box 3D battle. It only plays back a battle the sim has already
// fought: nothing here decides a result. This file and three.js are loaded
// when the player first asks to watch a battle, never before.
import {
  BoxGeometry, Color, ConeGeometry, DirectionalLight, Fog, Group, HemisphereLight, Mesh, PerspectiveCamera,
  PlaneGeometry, Scene, SphereGeometry, WebGLRenderer, type Object3D,
} from 'three'
import { BATTLE } from '../data/battle'
import { RENDER } from '../data/render'
import type { BattleResult } from '../sim/battle/battle'
import type { Geometry, VehicleSpec } from '../sim/vehicle'
import { momentOf, type BattleMoment } from '../ui/battleReplay'
import { aimOf, cameraFor, cutAt, directorCuts, type Cut, type Look, type Spot } from './battleDirector'
import { Kit } from './rangeScene'
import { THEIR_TONES, TURRET, buildTank } from './tankModel'
import { tankShapeOf } from './tankShape'

const K = RENDER.battle
const { widthM: W, depthM: H } = BATTLE.field

/** A design to draw: what it is built from and how big it came out. */
export interface TankLook {
  spec: VehicleSpec
  geometry: Geometry
}

/** Across the ground is x; up the ground is away from the camera's start, so it is minus z. */
function east(x: number): number {
  return x - W / 2
}
function south(y: number): number {
  return -(y - H / 2)
}

function rad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** The way from one place to another, degrees: nought up the ground, 90 to the right. */
function wayTo(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI
}

interface TankParts {
  group: Group
  turret: Object3D | null
  flash: Mesh
  strike: Mesh
  screen: Mesh
  wreck: Mesh[]
}

export interface BattleStage {
  root: Group
  tanks: TankParts[]
  tracers: Mesh[]
}

/** Everything in the picture: the ground, its ridges and woods, the tanks and what they throw. */
export function buildBattleStage(kit: Kit, battle: BattleResult, mine: TankLook, theirs: TankLook): BattleStage {
  const c = RENDER.colours
  const ground = BATTLE.grounds[battle.ground]
  const root = new Group()

  const floor = kit.mesh(new PlaneGeometry(W + 2 * K.marginM, H + 2 * K.marginM), c.ground)
  floor.rotation.x = -Math.PI / 2
  root.add(floor)

  ground.platoons.forEach((plan, side) => {
    const ahead = side === 0 ? 1 : -1
    for (const lane of plan.lanes) {
      for (const post of lane) {
        if (!post.cover) continue
        const ridge = kit.mesh(new SphereGeometry(1, K.ridge.sides, 6), c.earth)
        ridge.scale.set(K.ridge.longM / 2, K.ridge.highM, K.ridge.deepM / 2)
        ridge.position.set(east(post.x), 0, south(post.y + ahead * K.ridge.aheadM))
        root.add(ridge)
      }
    }
  })

  for (const wood of ground.woods) {
    // Trees in two rings, the same every time.
    for (let i = 0; i < K.wood.trees; i++) {
      const turn = (i / K.wood.trees) * 2 * Math.PI
      const out = wood.r * (i % 2 === 0 ? 0.75 : 0.35)
      const tree = kit.mesh(new ConeGeometry(K.wood.radiusM, K.wood.heightM, K.wood.sides), K.wood.colour)
      tree.position.set(east(wood.x + Math.cos(turn) * out), K.wood.heightM / 2, south(wood.y + Math.sin(turn) * out))
      root.add(tree)
    }
  }

  const shapes = [tankShapeOf(mine.spec, mine.geometry), tankShapeOf(theirs.spec, theirs.geometry)] as const
  const tanks = battle.tanks.map((tank): TankParts => {
    const shape = shapes[tank.side]
    const group = tank.side === 0 ? buildTank(kit, shape) : buildTank(kit, shape, THEIR_TONES)
    const turret = group.getObjectByName(TURRET) ?? null
    const flash = kit.glow(new SphereGeometry(K.flashM, 6, 4), c.flash)
    flash.position.set(shape.gun.rootXM - shape.turret.xM + shape.gun.lengthM, shape.gun.yM, 0)
    flash.visible = false
    ;(turret ?? group).add(flash)
    const strike = kit.glow(new SphereGeometry(K.strikeM, 6, 4), c.tracer)
    strike.position.set(0, shape.gun.yM, 0)
    strike.visible = false
    const screen = kit.mesh(new SphereGeometry(K.screenM, 8, 6), c.post, 0.55)
    screen.position.set(0, K.screenM * 0.4, 0)
    screen.visible = false
    const wreck: Mesh[] = []
    for (let i = 0; i < K.wreckSmoke.puffs; i++) {
      const puff = kit.mesh(new SphereGeometry(K.wreckSmoke.sizeM * (1 + i * 0.35), 6, 4), c.smoke, 0.7)
      puff.position.set(-i * 1.2, shape.gun.yM + (i + 1) * K.wreckSmoke.riseM, i * 0.8)
      puff.visible = false
      wreck.push(puff)
      group.add(puff)
    }
    group.add(strike, screen)
    root.add(group)
    return { group, turret, flash, strike, screen, wreck }
  })

  const tracers: Mesh[] = []
  for (let i = 0; i < BATTLE.mostTanks; i++) {
    const tracer = kit.glow(new BoxGeometry(K.tracerLongM, K.tracerThickM, K.tracerThickM), c.tracer)
    tracer.visible = false
    tracers.push(tracer)
    root.add(tracer)
  }
  return { root, tanks, tracers }
}

/** How much the stage asks of a phone: triangles and separate pieces. */
export function stageCost(stage: BattleStage): { triangles: number; meshes: number } {
  let triangles = 0
  let meshes = 0
  stage.root.traverse((node) => {
    if (!(node instanceof Mesh)) return
    meshes++
    const geometry = node.geometry
    const index = geometry.getIndex()
    triangles += (index ? index.count : geometry.getAttribute('position').count) / 3
  })
  return { triangles, meshes }
}

/** The way each tank's gun points at a moment, degrees: at what it is shooting at, or dead ahead. */
export function gunWays(battle: BattleResult, moment: BattleMoment): number[] {
  return moment.tanks.map((tank, index) => {
    const at = aimOf(battle, index, moment.atS)
    const target = at === null ? undefined : moment.tanks[at]
    return target && tank.state !== 'out' ? wayTo(tank, target) : tank.headingDeg
  })
}

/** Puts every piece where the battle has it at a moment. */
export function poseStage(stage: BattleStage, battle: BattleResult, moment: BattleMoment, guns: readonly number[]): void {
  const t = moment.atS
  moment.tanks.forEach((tank, index) => {
    const parts = stage.tanks[index]
    if (!parts) return
    parts.group.position.set(east(tank.x), 0, south(tank.y))
    parts.group.rotation.y = rad(90 - tank.headingDeg)
    if (parts.turret) parts.turret.rotation.y = -rad((guns[index] ?? tank.headingDeg) - tank.headingDeg)
    parts.screen.visible = tank.state === 'smoke'
    for (const puff of parts.wreck) puff.visible = tank.state === 'out'
    parts.flash.visible = false
    parts.strike.visible = false
  })
  for (const shot of battle.shots) {
    if (shot.atS > t) break
    if (t - shot.atS <= K.flashS) {
      const by = stage.tanks[shot.by]
      if (by) by.flash.visible = true
    }
    const hit = shot.hit
    if (hit && (hit.zone !== null || hit.track) && t >= shot.landS && t - shot.landS <= K.strikeS) {
      const at = stage.tanks[shot.at]
      if (at) at.strike.visible = true
    }
  }
  stage.tracers.forEach((tracer, i) => {
    const round = moment.rounds[i]
    tracer.visible = round !== undefined
    if (!round) return
    const x = round.fromX + (round.toX - round.fromX) * round.along
    const y = round.fromY + (round.toY - round.fromY) * round.along
    tracer.position.set(east(x), 2, south(y))
    tracer.rotation.y = rad(90 - wayTo({ x: round.fromX, y: round.fromY }, { x: round.toX, y: round.toY }))
  })
}

export interface BattleFrame {
  timeS: number
  /** The tank the camera is with, and how. */
  tank: number
  look: Look
}

export interface BattleViewArgs {
  /** The box the picture fills. */
  host: HTMLElement
  /** What a screen reader says the picture is. */
  label: string
  battle: BattleResult
  mine: TankLook
  theirs: TankLook
  /** A tank to stay with. Null lets the director choose. */
  follow: number | null
  onFrame(frame: BattleFrame): void
  onState(state: { playing: boolean; ended: boolean }): void
}

export interface BattleView {
  readonly lengthS: number
  play(): void
  pause(): void
  seek(timeS: number): void
  setFollow(tank: number | null): void
  dispose(): void
}

/**
 * Opens the 3D battle in `host` and starts playing. Throws when the device
 * cannot give it a 3D drawing surface.
 */
export function openBattleView(args: BattleViewArgs): BattleView {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
  const kit = new Kit()
  const scene = new Scene()
  const battle = args.battle
  const dark = BATTLE.grounds[battle.ground].night
  const sky = dark ? RENDER.colours.nightSky : RENDER.colours.sky
  const light = dark ? K.nightLight : 1
  scene.background = new Color(sky)
  scene.fog = new Fog(new Color(sky), K.fog.nearM, K.fog.farM)
  scene.add(new HemisphereLight(new Color(sky), new Color(RENDER.light.groundTint), RENDER.light.skyStrength * light))
  const sun = new DirectionalLight(new Color(RENDER.colours.sun), RENDER.light.sunStrength * light)
  sun.position.set(RENDER.light.sunFrom.x, RENDER.light.sunFrom.y, RENDER.light.sunFrom.z)
  scene.add(sun)

  const stage = buildBattleStage(kit, battle, args.mine, args.theirs)
  scene.add(stage.root)
  const cuts = directorCuts(battle)
  let follow = args.follow

  const camera = new PerspectiveCamera(RENDER.camera.fovDeg, 1, RENDER.camera.nearM, K.farM)
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

  const endS = battle.endS
  let timeS = 0
  let lastMs = 0
  let ticking = 0
  let playing = false
  let disposed = false

  const place = (spot: Spot): [number, number, number] => [east(spot.x), spot.up, south(spot.y)]

  function draw(): boolean {
    const moment = momentOf(battle, timeS)
    const guns = gunWays(battle, moment)
    poseStage(stage, battle, moment, guns)
    const cut: Cut = follow === null ? cutAt(cuts, timeS) : { fromS: 0, tank: follow, look: 'chase' }
    const tank = moment.tanks[cut.tank]
    if (tank) {
      const shot = cameraFor(cut.look, tank, guns[cut.tank] ?? tank.headingDeg)
      camera.position.set(...place(shot.from))
      camera.lookAt(...place(shot.to))
    }
    renderer.render(scene, camera)
    args.onFrame({ timeS, tank: cut.tank, look: cut.look })
    return timeS >= endS
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
    lastMs = nowMs
    timeS = Math.min(timeS + passedS * K.rate, endS)
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
    if (!playing) draw()
  }

  function setFollow(tank: number | null): void {
    if (disposed) return
    follow = tank
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
  return { lengthS: endS, play, pause, seek, setFollow, dispose }
}
