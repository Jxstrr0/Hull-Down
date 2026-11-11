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
})
