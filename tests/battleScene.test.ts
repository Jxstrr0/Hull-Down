import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BATTLE, BATTLE_GROUND_IDS } from '../src/data/battle'
import { ACCORD_LIMITS, THREAT_TANKS } from '../src/data/opponents'
import { RENDER } from '../src/data/render'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { aimOf, cameraFor, cutAt, directorCuts } from '../src/render/battleDirector'
import { buildBattleStage, gunWays, poseStage, stageCost } from '../src/render/battleScene'
import { Kit } from '../src/render/rangeScene'
import { runBattle } from '../src/sim/battle/battle'
import { combatantOf } from '../src/sim/duel/duel'
import { momentOf } from '../src/ui/battleReplay'

const K = RENDER.battle
const me = combatantOf(BASELINE_SPEC, PACT_LIMITS_GEN1)
const warden = combatantOf(THREAT_TANKS.warden.spec, ACCORD_LIMITS, THREAT_TANKS.warden.rounds)
const look = (tank: typeof me) => ({ spec: tank.sheet.target.spec, geometry: tank.sheet.geometry })
const battles = BATTLE_GROUND_IDS.flatMap((ground) =>
  [1, 2, 3, 4, 5].map((seed) => runBattle(me, warden, ground, { range: 'close', pace: 'fast' }, seed)))

describe('the battle director', () => {
  it('starts at nought with one of your tanks and keeps its cuts in order', () => {
    for (const battle of battles) {
      const cuts = directorCuts(battle)
      expect(cuts[0]?.fromS).toBe(0)
      expect(cuts[0]?.look).toBe('chase')
      expect(battle.tanks[cuts[0]?.tank ?? -1]?.side).toBe(0)
      for (let i = 1; i < cuts.length; i++) {
        expect(cuts[i]?.fromS ?? 0).toBeGreaterThanOrEqual(cuts[i - 1]?.fromS ?? 0)
        expect(cuts[i]?.fromS ?? 0).toBeLessThanOrEqual(battle.endS)
      }
    }
  })

  it('only travels with your tanks, and only while they can fight', () => {
    for (const battle of battles) {
      const cuts = directorCuts(battle)
      cuts.forEach((cut, i) => {
        if (cut.look !== 'chase' || i === 0) return
        const tank = battle.tanks[cut.tank]
        expect(tank?.side).toBe(0)
        expect(tank?.outS === null || (tank?.outS ?? 0) > cut.fromS).toBe(true)
      })
    }
  })

  it('stands by every tank that is put out of the fight', () => {
    for (const battle of battles) {
      const cuts = directorCuts(battle)
      battle.tanks.forEach((tank, index) => {
        if (tank.outS === null) return
        const cut = cutAt(cuts, tank.outS)
        expect(cut.look).toBe('close')
        // Two going at the same moment: the camera is with one of them.
        const also = battle.tanks.some((other, i) => i !== index && other.outS !== null && Math.abs(other.outS - (tank.outS ?? 0)) < K.close.holdS)
        if (!also) expect(cut.tank).toBe(index)
      })
    }
  })

  it('does not jump from one of your tanks to another too often', () => {
    for (const battle of battles) {
      const cuts = directorCuts(battle)
      for (let i = 1; i < cuts.length; i++) {
        const before = cuts[i - 1]
        const cut = cuts[i]
        if (!before || !cut || before.look !== 'chase' || cut.look !== 'chase') continue
        expect(cut.fromS - before.fromS).toBeGreaterThanOrEqual(K.minCutS)
      }
    }
  })

  it('knows what a gun is laid on: the next tank it fires at, then the last', () => {
    const battle = battles[0]
    const shot = battle?.shots[0]
    if (!battle || !shot) throw new Error('no shot')
    expect(aimOf(battle, shot.by, 0)).toBe(shot.at)
    const last = [...battle.shots].reverse().find((each) => each.by === shot.by)
    expect(aimOf(battle, shot.by, battle.endS + 1)).toBe(last?.at)
    const silent = battle.tanks.findIndex((tank) => tank.fired === 0)
    if (silent >= 0) expect(aimOf(battle, silent, 10)).toBeNull()
  })

  it('puts the travelling camera behind the gun and the standing one off to the side, never on the tank', () => {
    for (const gun of [0, 90, 200, -45]) {
      const chase = cameraFor('chase', { x: 500, y: 800 }, gun)
      const r = (gun * Math.PI) / 180
      const back = (chase.from.x - 500) * Math.sin(r) + (chase.from.y - 800) * Math.cos(r)
      expect(back).toBeCloseTo(-K.chase.backM, 5)
      const fore = (chase.to.x - 500) * Math.sin(r) + (chase.to.y - 800) * Math.cos(r)
      expect(fore).toBeCloseTo(K.chase.aheadM, 5)
      const close = cameraFor('close', { x: 500, y: 800 }, gun)
      expect(Math.hypot(close.from.x - 500, close.from.y - 800)).toBeGreaterThan(K.close.awayM * 0.8)
      expect(close.to.x).toBe(500)
      expect(close.to.y).toBe(800)
    }
  })
})

describe('the eight-tank budget', () => {
  it('keeps every ground inside what a phone can draw', () => {
    for (const ground of BATTLE_GROUND_IDS) {
      const battle = battles.find((each) => each.ground === ground)
      if (!battle) throw new Error('no battle')
      const kit = new Kit()
      const stage = buildBattleStage(kit, battle, look(me), look(warden))
      const cost = stageCost(stage)
      expect(stage.tanks.length).toBeLessThanOrEqual(BATTLE.mostTanks)
      expect(cost.triangles).toBeLessThanOrEqual(K.maxTriangles)
      expect(cost.meshes).toBeLessThanOrEqual(K.maxMeshes)
      kit.dispose()
    }
  })

  it('has a tracer for every round that can be in the air at once', () => {
    for (const battle of battles) {
      for (let t = 0; t <= battle.endS; t += 0.25) {
        expect(momentOf(battle, t).rounds.length).toBeLessThanOrEqual(BATTLE.mostTanks)
      }
    }
  })
})

describe('the stage at a moment', () => {
  it('stands every tank on its place, turns the gun on its target, and smokes the wrecks', () => {
    const battle = battles.find((each) => each.tanks.some((tank) => tank.outS !== null))
    if (!battle) throw new Error('no battle')
    const kit = new Kit()
    const stage = buildBattleStage(kit, battle, look(me), look(warden))
    const end = momentOf(battle, battle.endS)
    poseStage(stage, battle, end, gunWays(battle, end))
    end.tanks.forEach((tank, index) => {
      const parts = stage.tanks[index]
      expect(parts?.group.position.x).toBeCloseTo(tank.x - BATTLE.field.widthM / 2, 3)
      expect(parts?.group.position.z).toBeCloseTo(-(tank.y - BATTLE.field.depthM / 2), 3)
      expect(parts?.wreck.every((puff) => puff.visible === (tank.state === 'out'))).toBe(true)
      expect(parts?.turret).not.toBeNull()
    })
    // At the moment a round is fired, its tank's muzzle flashes.
    const shot = battle.shots[0]
    if (!shot) throw new Error('no shot')
    const then = momentOf(battle, shot.atS + 0.05)
    poseStage(stage, battle, then, gunWays(battle, then))
    expect(stage.tanks[shot.by]?.flash.visible).toBe(true)
    expect(stage.tracers.filter((tracer) => tracer.visible).length).toBe(then.rounds.length)
    kit.dispose()
  })

  it("runs each tank's links round as it drives, and not while it stands", async () => {
    const { TRACKS } = await import('../src/render/tankModel')
    const battle = battles[0]!
    const kit = new Kit()
    const stage = buildBattleStage(kit, battle, look(me), look(warden))
    const offsets = (): number[] => stage.tanks.map((parts) => (parts.group.getObjectByName(TRACKS) as unknown as { material: { map: { offset: { x: number } } } }).material.map.offset.x)
    const at = (t: number): void => {
      const moment = momentOf(battle, t)
      poseStage(stage, battle, moment, gunWays(battle, moment))
    }
    at(0)
    at(0)
    expect(offsets().every((x) => x === 0)).toBe(true)
    for (let t = 0.1; t <= 3; t += 0.1) at(t)
    expect(offsets().some((x) => x !== 0)).toBe(true)
    kit.dispose()
  })

  it("kicks a tank's gun back just after it fires, and runs it out again", () => {
    const battle = battles.find((each) => each.shots.length > 0)!
    const shot = battle.shots[0]!
    const kit = new Kit()
    const stage = buildBattleStage(kit, battle, look(me), look(warden))
    const recoil = (): number => (stage.tanks[shot.by]!.group.userData as { mud: { recoilM: { value: number } } }).mud.recoilM.value
    const at = (t: number): void => {
      const moment = momentOf(battle, t)
      poseStage(stage, battle, moment, gunWays(battle, moment))
    }
    at(Math.max(0, shot.atS - 0.5))
    expect(recoil()).toBe(0)
    at(shot.atS + RENDER.tank.recoil.backS * RENDER.battle.rate)
    expect(recoil()).toBeGreaterThan(0)
    at(shot.atS + (RENDER.tank.recoil.backS + RENDER.tank.recoil.returnS) * RENDER.battle.rate + 0.01)
    // Unless it has fired again by then, it is run out.
    if (!battle.shots.some((other) => other.by === shot.by && other.atS > shot.atS && other.atS < shot.atS + 2)) expect(recoil()).toBe(0)
    kit.dispose()
  })

  it('leaves dust behind the tanks that move, and none on the first look', () => {
    const battle = battles[0]!
    const kit = new Kit()
    const stage = buildBattleStage(kit, battle, look(me), look(warden))
    const at = (t: number): void => {
      const moment = momentOf(battle, t)
      poseStage(stage, battle, moment, gunWays(battle, moment))
    }
    at(0)
    expect(stage.dust.showing).toBe(0)
    for (let t = 0.1; t <= 6; t += 0.1) at(t)
    expect(stage.dust.showing).toBeGreaterThan(0)
    expect(stage.dust.showing).toBeLessThanOrEqual(RENDER.dust.battle)
    kit.dispose()
  })
})

describe('a built tank', () => {
  it('is a handful of meshes, with exactly the triangles its parts list says', async () => {
    const { Mesh } = await import('three')
    const { buildTank, TURRET } = await import('../src/render/tankModel')
    const { tankShapeOf, tankTriangles } = await import('../src/render/tankShape')
    const { allTiles } = await import('../src/sim/vehicle/era')
    const { ZONES } = await import('../src/data/materials')
    const { buildStatSheet } = await import('../src/sim/vehicle')
    for (const tiles of [false, true]) {
      const spec = structuredClone(BASELINE_SPEC)
      if (tiles) for (const zone of ZONES) spec.era[zone] = allTiles(zone)
      spec.runningGear.skirts = tiles
      const shape = tankShapeOf(spec, buildStatSheet(spec, PACT_LIMITS_GEN1).geometry)
      const kit = new Kit()
      const tank = buildTank(kit, shape)
      let meshes = 0
      let triangles = 0
      tank.traverse((node) => {
        if (!(node instanceof Mesh)) return
        meshes++
        triangles += node.geometry.getAttribute('position').count / 3
      })
      expect(meshes).toBeLessThanOrEqual(9)
      expect(triangles).toBe(tankTriangles(shape))
      expect(tank.getObjectByName(TURRET)).toBeTruthy()
      kit.dispose()
    }
  })

  it('paints the links on the tracks: one bare steel mesh, the same for every paint', async () => {
    const { buildStatSheet } = await import('../src/sim/vehicle')
    const { trackLinkPixels } = await import('../src/render/trackLinks')
    const { Mesh } = await import('three')
    const { buildTank, tonesOf } = await import('../src/render/tankModel')
    const { tankShapeOf } = await import('../src/render/tankShape')
    const shape = tankShapeOf(BASELINE_SPEC, buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1).geometry)
    const kit = new Kit()
    const tracks = (tank: ReturnType<typeof buildTank>): InstanceType<typeof Mesh>[] => {
      const found: InstanceType<typeof Mesh>[] = []
      tank.traverse((node) => {
        if (node instanceof Mesh && (node.material as { map?: { image?: { width?: number } } | null }).map?.image?.width === RENDER.tank.trackLinks.alongPx) found.push(node)
      })
      return found
    }
    const plain = tracks(buildTank(kit, shape))
    const camo = tracks(buildTank(kit, shape, tonesOf('threeColour')))
    expect(plain.length).toBe(1)
    expect(camo.length).toBe(1)
    // Each tank has its own copy of the links, so each runs at its own pace, but the picture and the steel are the same.
    const mapOf = (mesh: InstanceType<typeof Mesh>) => (mesh.material as unknown as { map: { source: unknown }; color: { getHexString(): string } })
    expect(camo[0]!.material).not.toBe(plain[0]!.material)
    expect(mapOf(camo[0]!).map.source).toBe(mapOf(plain[0]!).map.source)
    expect(mapOf(camo[0]!).color.getHexString()).toBe(mapOf(plain[0]!).color.getHexString())
    const geometry = plain[0]!.geometry
    const corners = geometry.getAttribute('position').count
    expect(geometry.getAttribute('uv').count).toBe(corners)
    expect(shape.parts.filter((part) => part.kind === 'band').length).toBe(2)
    // Round a track the picture repeats once a link: about as many links as the loop is long.
    const u = geometry.getAttribute('uv')
    let most = 0
    for (let i = 0; i < u.count; i++) most = Math.max(most, u.getX(i))
    expect(most).toBeGreaterThan(20)
    // The picture: the steel itself, the gap between links darker.
    const pixels = trackLinkPixels()
    const k = RENDER.tank.trackLinks
    expect(pixels.length).toBe(k.alongPx * k.acrossPx * 4)
    expect(pixels[0]).toBe(Math.round(k.gapShade * 255))
    expect(Math.max(...pixels)).toBe(255)
    kit.dispose()
  })

  it('runs the links round as the tank moves: under the tank they go backwards, and never faster than the eye can follow', async () => {
    const { buildStatSheet } = await import('../src/sim/vehicle')
    const { trackStep } = await import('../src/render/trackLinks')
    const { buildTank, rollTracks, TRACKS } = await import('../src/render/tankModel')
    const { tankShapeOf } = await import('../src/render/tankShape')
    const k = RENDER.tank.trackLinks
    expect(trackStep(0)).toBe(0)
    expect(trackStep(k.linkM * 0.1)).toBeCloseTo(0.1, 9)
    expect(trackStep(-k.linkM * 0.1)).toBeCloseTo(-0.1, 9)
    expect(trackStep(50)).toBe(k.mostLinksPerFrame)
    expect(trackStep(-50)).toBe(-k.mostLinksPerFrame)

    const shape = tankShapeOf(BASELINE_SPEC, buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1).geometry)
    // The ground run of each loop goes forward (its first edge runs nose-wards along the ground), so a picture moved on along the loop moves back under the tank.
    for (const part of shape.parts) {
      if (part.kind !== 'band') continue
      const [a, b] = part.outline
      expect(a!.y).toBe(0)
      expect(b!.y).toBe(0)
      expect(b!.x).toBeGreaterThan(a!.x)
    }
    const kit = new Kit()
    const one = buildTank(kit, shape)
    const two = buildTank(kit, shape)
    const offset = (tank: typeof one): number => ((tank.getObjectByName(TRACKS) as unknown as { material: { map: { offset: { x: number } } } }).material.map.offset.x)
    rollTracks(one, k.linkM * 0.25)
    expect(offset(one)).toBeCloseTo(0.25, 9)
    expect(offset(two)).toBe(0)
    rollTracks(one, -k.linkM * 0.375)
    expect(offset(one)).toBeCloseTo(-0.125, 9)
    kit.dispose()
  })

  it("turns the wheels with the track: each corner knows its hub, and the tank's own wheels roll on as far as the links", async () => {
    const { buildStatSheet } = await import('../src/sim/vehicle')
    const { Mesh } = await import('three')
    const { buildTank, rollTracks, WHEELS } = await import('../src/render/tankModel')
    const { tankShapeOf } = await import('../src/render/tankShape')
    const k = RENDER.tank.trackLinks
    const shape = tankShapeOf(BASELINE_SPEC, buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1).geometry)
    const wheelParts = shape.parts.filter((part) => part.kind === 'piece' && part.wheelM !== undefined)
    // Road wheels, sprocket, idler and return rollers, on each side.
    expect(wheelParts.length).toBe(2 * (BASELINE_SPEC.runningGear.roadWheels + 2 + RENDER.tank.runningGear.returnRollers))
    const kit = new Kit()
    const one = buildTank(kit, shape)
    const two = buildTank(kit, shape)
    const wheelsOf = (tank: typeof one) => tank.children.filter((child): child is InstanceType<typeof Mesh> => child.name === WHEELS && child instanceof Mesh)
    const rollOf = (mesh: InstanceType<typeof Mesh>): number => (mesh.material as unknown as { userData: { rollM: { value: number } } }).userData.rollM.value
    expect(wheelsOf(one).length).toBeGreaterThan(0)
    expect(wheelsOf(one).length).toBeLessThanOrEqual(2)
    for (const mesh of wheelsOf(one)) {
      const hub = mesh.geometry.getAttribute('hub')
      expect(hub.count).toBe(mesh.geometry.getAttribute('position').count)
      // Every hub is a real wheel's, and its radius one of theirs.
      for (let i = 0; i < hub.count; i += 37) {
        expect(wheelParts.some((part) => part.kind === 'piece' && Math.abs(part.at.x - hub.getX(i)) < 1e-5 && Math.abs(part.at.y - hub.getY(i)) < 1e-5 && Math.abs(1 / part.wheelM! - hub.getZ(i)) < 1e-4)).toBe(true)
      }
    }
    rollTracks(one, k.linkM * 0.25)
    for (const mesh of wheelsOf(one)) expect(rollOf(mesh)).toBeCloseTo(k.linkM * 0.25, 9)
    for (const mesh of wheelsOf(two)) expect(rollOf(mesh)).toBe(0)
    kit.dispose()
  })
})
