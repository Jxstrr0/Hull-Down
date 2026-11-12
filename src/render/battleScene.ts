// The grey-box 3D battle. It only plays back a battle the sim has already
// fought: nothing here decides a result. This file and three.js are loaded
// when the player first asks to watch a battle, never before.
import {
  BoxGeometry, Color, ConeGeometry, DirectionalLight, Fog, Group, HemisphereLight, InstancedMesh, Mesh, PerspectiveCamera,
  PlaneGeometry, Scene, SphereGeometry, Vector3, WebGLRenderer, type Object3D,
} from 'three'
import { BATTLE } from '../data/battle'
import { TIERS, type TierId } from '../data/graphics'
import type { PaintId } from '../data/paint'
import { RENDER } from '../data/render'
import type { BattleResult } from '../sim/battle/battle'
import type { HitResult } from '../sim/hits/trace'
import type { Geometry, VehicleSpec } from '../sim/vehicle'
import { momentOf, type BattleMoment } from '../ui/battleReplay'
import { aimOf, cameraFor, cutAt, directorCuts, type Cut, type Look, type Spot } from './battleDirector'
import { createFrameMeter } from './frameMeter'
import { Dust, Kit, Marks, Sparks, Working, exhaustDeckX } from './rangeScene'
import { sparkCount, sparkFlights } from './sparks'
import { DustTrail, blastRing } from './dust'
import { THEIR_TONES, TURRET, buildTank, rollTracks, setMud, setRecoil, setScorch, setWear, tonesOf, type ScorchMark } from './tankModel'
import { recoilAt } from './recoil'
import { battleMud, battleWear } from './mud'
import { tankShapeOf } from './tankShape'

const K = RENDER.battle
const { widthM: W, depthM: H } = BATTLE.field

/** A design to draw: what it is built from and how big it came out. */
export interface TankLook {
  spec: VehicleSpec
  geometry: Geometry
  /** The paint it wears. The other side keeps its own colours whatever this says. */
  paint?: PaintId
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
  /** Where the tank stood last time it was posed, to run its links round by how far it has come. */
  last: { x: number; z: number } | null
  /** How far it has gone all told, either way, and the puffs that is owed. */
  travelledM: number
  trail: DustTrail
  /** The back of each track, from the middle of the tank. */
  rearM: number
  sideM: number
  /** Its exhaust: where it leaves the deck, how often, and whether the engine is working hard. */
  deck: { x: number; y: number; pipeM: number }
  fumes: DustTrail
  /** Its ruts: how often, and where under the track they are laid, from the middle of the tank. */
  ruts: DustTrail
  rutM: number
  rutWideM: number
  /** Where the turret turns, and how far out from there the muzzle is; and when it last threw a blast. */
  turretXM: number
  muzzleM: number
  blastS: number | null
  /** Half its length, and where the middle of each track is and how high, to find where a round struck. */
  halfM: number
  trackSideM: number
  trackUpM: number
  working: Working
  pipes: number
  lastS: number | null
}

export interface BattleStage {
  root: Group
  tanks: TankParts[]
  tracers: Mesh[]
  dust: Dust
  marks: Marks
  sparks: Sparks
}

/**
 * Everything in the picture: the ground, its ridges and woods, the tanks and
 * what they throw. `woodShare` thins the trees for a slow device.
 */
export function buildBattleStage(kit: Kit, battle: BattleResult, mine: TankLook, theirs: TankLook, woodShare = 1): BattleStage {
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
    const trees = Math.max(K.wood.fewestTrees, Math.round(K.wood.trees * woodShare))
    for (let i = 0; i < trees; i++) {
      const turn = (i / trees) * 2 * Math.PI
      const out = wood.r * (i % 2 === 0 ? 0.75 : 0.35)
      const tree = kit.mesh(new ConeGeometry(K.wood.radiusM, K.wood.heightM, K.wood.sides), K.wood.colour)
      tree.position.set(east(wood.x + Math.cos(turn) * out), K.wood.heightM / 2, south(wood.y + Math.sin(turn) * out))
      root.add(tree)
    }
  }

  const shapes = [tankShapeOf(mine.spec, mine.geometry), tankShapeOf(theirs.spec, theirs.geometry)] as const
  const tanks = battle.tanks.map((tank): TankParts => {
    const shape = shapes[tank.side]
    const group = tank.side === 0 ? buildTank(kit, shape, mine.paint ? tonesOf(mine.paint) : undefined) : buildTank(kit, shape, THEIR_TONES)
    // They have all come across the fields to get here.
    setMud(group, battleMud(battle.ground))
    setWear(group, battleWear())
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
    return {
      group, turret, flash, strike, screen, wreck, last: null,
      travelledM: 0, trail: new DustTrail(), rearM: -shape.lengthM / 2 - RENDER.dust.behindM, sideM: shape.track.centreZM,
      deck: {
        x: exhaustDeckX(shape, (tank.side === 0 ? mine : theirs).spec.hull.engineAt),
        y: shape.turret.baseM + RENDER.dust.exhaust.upM,
        pipeM: shape.track.centreZM * RENDER.dust.exhaust.pipeShare,
      },
      fumes: new DustTrail(), working: new Working(), pipes: 0, lastS: null,
      turretXM: shape.turret.xM, muzzleM: shape.gun.rootXM - shape.turret.xM + shape.gun.lengthM, blastS: null,
      halfM: shape.lengthM / 2, trackSideM: shape.track.centreZM, trackUpM: shape.track.topM / 2,
      ruts: new DustTrail(), rutM: -shape.track.lengthM / 2 + RENDER.marks.longM / 2, rutWideM: shape.track.widthM * RENDER.marks.widthShare,
    }
  })

  const tracers: Mesh[] = []
  for (let i = 0; i < BATTLE.mostTanks; i++) {
    const tracer = kit.glow(new BoxGeometry(K.tracerLongM, K.tracerThickM, K.tracerThickM), c.tracer)
    tracer.visible = false
    tracers.push(tracer)
    root.add(tracer)
  }
  const dust = new Dust(kit, RENDER.dust.battle)
  root.add(dust.mesh)
  const marks = new Marks(kit, RENDER.marks.battle)
  root.add(marks.mesh)
  const sparks = new Sparks(kit, RENDER.sparks.battle)
  root.add(sparks.mesh)
  return { root, tanks, tracers, dust, marks, sparks }
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
    // Every copy of an instanced shape is drawn, so each counts.
    const copies = node instanceof InstancedMesh ? node.count : 1
    triangles += (copies * (index ? index.count : geometry.getAttribute('position').count)) / 3
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

const UP = new Vector3(0, 1, 0)

/**
 * Where a round struck a tank, in the tank's own frame, and the way back off
 * the plate. The hit model measures back from the nose with the turret square;
 * here x runs forward from the middle and the turret has turned. A round that
 * only met the tracks struck the side it came from.
 */
export function struckAt(parts: Pick<TankParts, 'turret' | 'turretXM' | 'halfM' | 'trackSideM' | 'trackUpM'>, hit: Pick<HitResult, 'entry' | 'zone' | 'direction'>): { at: Vector3; out: Vector3 } {
  const d = hit.direction
  const out = new Vector3(d.x, -d.y, -d.z).normalize()
  if (!hit.entry) return { at: new Vector3(0, parts.trackUpM, (d.z > 0 ? -1 : 1) * parts.trackSideM), out }
  const mark = scorchOf(parts, { ...hit, entry: hit.entry, through: false })
  const at = new Vector3(mark.x, mark.y, mark.z)
  if (mark.onTurret && parts.turret) {
    const turn = parts.turret.rotation.y
    at.applyAxisAngle(UP, turn)
    at.x += parts.turretXM
    out.applyAxisAngle(UP, turn)
  } else if (mark.onTurret) at.x += parts.turretXM
  return { at, out }
}

/** The mark a round leaves where it struck, in the frame of the part it struck: the hull, or the turret as it turns. */
export function scorchOf(parts: Pick<TankParts, 'turretXM' | 'halfM'>, hit: { entry: { x: number; y: number; z: number }; zone: string | null; through: boolean }): ScorchMark {
  const onTurret = hit.zone !== null && (hit.zone === 'mantlet' || hit.zone.startsWith('turret'))
  return { onTurret, x: parts.halfM - hit.entry.x - (onTurret ? parts.turretXM : 0), y: hit.entry.y, z: hit.entry.z, through: hit.through }
}

/** Puts every piece where the battle has it at a moment. */
export function poseStage(stage: BattleStage, battle: BattleResult, moment: BattleMoment, guns: readonly number[]): void {
  const t = moment.atS
  // When each tank last fired, for its gun's kick.
  const fired: (number | null)[] = stage.tanks.map(() => null)
  for (const shot of battle.shots) {
    if (shot.atS > t) break
    fired[shot.by] = shot.atS
  }
  moment.tanks.forEach((tank, index) => {
    const parts = stage.tanks[index]
    if (!parts) return
    parts.group.position.set(east(tank.x), 0, south(tank.y))
    parts.group.rotation.y = rad(90 - tank.headingDeg)
    const firedAt = fired[index] ?? null
    parts.group.rotation.z = setRecoil(parts.group, recoilAt(firedAt === null ? null : (t - firedAt) / RENDER.battle.rate))
    // How far it has come along its own nose since last time: backing up runs the links the other way.
    const at = { x: parts.group.position.x, z: parts.group.position.z }
    const turn = parts.group.rotation.y
    let speedMs = 0
    if (parts.last) {
      rollTracks(parts.group, (at.x - parts.last.x) * Math.cos(turn) - (at.z - parts.last.z) * Math.sin(turn))
      const moved = Math.hypot(at.x - parts.last.x, at.z - parts.last.z)
      parts.travelledM += moved
      const passedS = parts.lastS === null ? 0 : t - parts.lastS
      if (passedS > 0) speedMs = moved / passedS
    }
    parts.last = at
    parts.lastS = t
    // Earth thrown up from the back of both tracks, turned the way the tank faces.
    const watchedS = t / RENDER.battle.rate
    const earth = RENDER.dust.kinds.earth
    const fighting = tank.state !== 'out'
    const puffs = fighting ? parts.trail.due(parts.travelledM, earth.everyM) : 0
    // A point on the tank, from its middle, out in the field.
    const place = (x: number, z: number): { x: number; z: number } => ({
      x: at.x + x * Math.cos(turn) + z * Math.sin(turn),
      z: at.z - x * Math.sin(turn) + z * Math.cos(turn),
    })
    for (let i = 0; i < puffs; i++) {
      for (const side of [-1, 1]) {
        const spot = place(parts.rearM, side * parts.sideM)
        stage.dust.kick(spot.x, 0, spot.z, earth, watchedS)
      }
    }
    // Ruts under the back of both tracks, running the way the tank faces.
    const laid = fighting ? parts.ruts.due(parts.travelledM, RENDER.marks.everyM) : 0
    for (let i = 0; i < laid; i++) {
      for (const side of [-1, 1]) {
        const spot = place(parts.rutM, side * parts.sideM)
        stage.marks.lay(spot.x, 0, spot.z, turn, 0, parts.rutWideM, RENDER.marks.colours.earth, watchedS)
      }
    }
    // Dust blown off the ground under the muzzle each time it fires; winding back forgets the last.
    if (firedAt === null || (parts.blastS !== null && firedAt < parts.blastS)) parts.blastS = firedAt
    else if (firedAt !== parts.blastS && t - firedAt < RENDER.dust.lifeS * RENDER.battle.rate) {
      parts.blastS = firedAt
      const way = rad(90 - (guns[index] ?? tank.headingDeg))
      const ring = place(parts.turretXM, 0)
      const muzzle = { x: ring.x + parts.muzzleM * Math.cos(way), z: ring.z - parts.muzzleM * Math.sin(way) }
      for (const puff of blastRing()) {
        stage.dust.kick(muzzle.x + puff.x, 0, muzzle.z + puff.z, RENDER.dust.blast.look, firedAt / RENDER.battle.rate, { x: puff.driftX, z: puff.driftZ })
      }
    }
    // Exhaust off the engine deck, blown back, thick and dark while it pulls away.
    const ex = RENDER.dust.exhaust
    const hard = fighting && parts.working.at(t, speedMs, 0)
    const fumes = fighting ? parts.fumes.due(watchedS, hard ? ex.hardEveryS : ex.everyS) : 0
    for (let i = 0; i < fumes; i++) {
      const spot = place(parts.deck.x, (parts.pipes++ % 2 === 0 ? 1 : -1) * parts.deck.pipeM)
      const back = place(-ex.driftM, 0)
      stage.dust.kick(spot.x, parts.deck.y, spot.z, hard ? ex.hard : ex.light, watchedS, { x: back.x - at.x, z: back.z - at.z })
    }
    if (parts.turret) parts.turret.rotation.y = -rad((guns[index] ?? tank.headingDeg) - tank.headingDeg)
    parts.screen.visible = tank.state === 'smoke'
    for (const puff of parts.wreck) puff.visible = tank.state === 'out'
    parts.flash.visible = false
    parts.strike.visible = false
  })
  stage.sparks.clear()
  const scorches: ScorchMark[][] = stage.tanks.map(() => [])
  for (const shot of battle.shots) {
    if (shot.atS > t) break
    if (t - shot.atS <= K.flashS) {
      const by = stage.tanks[shot.by]
      if (by) by.flash.visible = true
    }
    const hit = shot.hit
    const at = stage.tanks[shot.at]
    if (!hit || !at || (hit.zone === null && !hit.track) || t < shot.landS) continue
    const struck = struckAt(at, hit)
    if (hit.entry && hit.zone !== null) scorches[shot.at]?.push(scorchOf(at, { entry: hit.entry, zone: hit.zone, through: hit.through }))
    if (t - shot.landS <= K.strikeS) {
      at.strike.visible = true
      at.strike.position.copy(struck.at)
    }
    const ageS = (t - shot.landS) / RENDER.battle.rate
    if (ageS < RENDER.sparks.lifeS) {
      at.group.updateMatrixWorld()
      stage.sparks.throw(at.group.localToWorld(struck.at), struck.out.transformDirection(at.group.matrixWorld), sparkFlights(sparkCount(hit)), ageS)
    }
  }
  stage.sparks.show()
  stage.tanks.forEach((parts, index) => setScorch(parts.group, scorches[index] ?? []))
  stage.tracers.forEach((tracer, i) => {
    const round = moment.rounds[i]
    tracer.visible = round !== undefined
    if (!round) return
    const x = round.fromX + (round.toX - round.fromX) * round.along
    const y = round.fromY + (round.toY - round.fromY) * round.along
    tracer.position.set(east(x), 2, south(y))
    tracer.rotation.y = rad(90 - wayTo({ x: round.fromX, y: round.fromY }, { x: round.toX, y: round.toY }))
  })
  stage.dust.show(t / RENDER.battle.rate)
  stage.marks.show(t / RENDER.battle.rate)
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
  /** How finely to draw. */
  quality: TierId
  /** Called once the view has timed its frames, with the frame rate, frames a second. */
  onMeasured(fps: number): void
  onFrame(frame: BattleFrame): void
  onState(state: { playing: boolean; ended: boolean }): void
}

export interface BattleView {
  readonly lengthS: number
  play(): void
  pause(): void
  seek(timeS: number): void
  setFollow(tank: number | null): void
  /** Draw more or less finely from now on. The frames are timed again. */
  setQuality(tier: TierId): void
  dispose(): void
}

/**
 * Opens the 3D battle in `host` and starts playing. Throws when the device
 * cannot give it a 3D drawing surface.
 */
export function openBattleView(args: BattleViewArgs): BattleView {
  let tier = args.quality
  const renderer = new WebGLRenderer({ antialias: TIERS[tier].antialias, powerPreference: 'low-power' })
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

  const stage = buildBattleStage(kit, battle, args.mine, args.theirs, TIERS[tier].scenery)
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIERS[tier].pixelRatio))
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
  let meter = createFrameMeter()

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
    const fps = lastMs === 0 ? null : meter.add(nowMs - lastMs)
    lastMs = nowMs
    timeS = Math.min(timeS + passedS * K.rate, endS)
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
    if (!playing) draw()
  }

  function setQuality(next: TierId): void {
    if (disposed || next === tier) return
    tier = next
    meter = createFrameMeter()
    resize()
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
  return { lengthS: endS, play, pause, seek, setFollow, setQuality, dispose }
}
