import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BATTLE, BATTLE_GROUND_IDS, PACE_ORDERS, RANGE_ORDERS, type BattleGroundId, type Orders } from '../src/data/battle'
import { ACCORD_LIMITS, THREAT_TANKS } from '../src/data/opponents'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { DEFAULT_ORDERS, runBattle, type BattleResult } from '../src/sim/battle/battle'
import { combatantOf, type Combatant } from '../src/sim/duel/duel'

const LIMITS = PACT_LIMITS_GEN1
const baseline = combatantOf(BASELINE_SPEC, LIMITS)
const warden = combatantOf(THREAT_TANKS.warden.spec, ACCORD_LIMITS, THREAT_TANKS.warden.rounds)
const palisade = combatantOf(THREAT_TANKS.palisade.spec, ACCORD_LIMITS, THREAT_TANKS.palisade.rounds)

const CAREFUL: Orders = { range: 'long', pace: 'careful' }
const ALL_ORDERS: Orders[] = RANGE_ORDERS.flatMap((range) => PACE_ORDERS.map((pace) => ({ range, pace })))

function series(a: Combatant, b: Combatant, ground: BattleGroundId, orders: Orders, count: number): BattleResult[] {
  return Array.from({ length: count }, (_, i) => runBattle(a, b, ground, orders, i + 1))
}

function won(results: BattleResult[], side: 0 | 1): number {
  return results.filter((each) => each.winner === side).length
}

/** Where a tank ended up: x and y. */
function lastPlace(result: BattleResult, tank: number): { x: number; y: number } {
  const track = result.tracks[tank] ?? []
  return { x: track[track.length - 3] ?? 0, y: track[track.length - 2] ?? 0 }
}

describe('the battle grounds', () => {
  it('never put more than eight tanks on the ground', () => {
    for (const id of BATTLE_GROUND_IDS) {
      const [mine, theirs] = BATTLE.grounds[id].platoons
      expect(mine.lanes.length + theirs.lanes.length).toBeLessThanOrEqual(BATTLE.mostTanks)
      for (const plan of [mine, theirs]) {
        expect(plan.lanes.length).toBeGreaterThanOrEqual(3)
        expect(plan.lanes.length).toBeLessThanOrEqual(4)
        for (const lane of plan.lanes) {
          // A holding tank has a second place to go to; an attacking one a start, a ridge and the open.
          expect(lane.length).toBe(plan.role === 'hold' ? 2 : 3)
          if (plan.role === 'attack') expect(lane[lane.length - 2]?.cover).toBe(true)
          else expect(lane.every((post) => post.cover)).toBe(true)
        }
      }
    }
  })
})

describe('a platoon battle', () => {
  it('comes out the same for the same tanks, ground, orders and seed', () => {
    for (const ground of BATTLE_GROUND_IDS) {
      expect(runBattle(baseline, warden, ground, CAREFUL, 7)).toEqual(runBattle(baseline, warden, ground, CAREFUL, 7))
    }
  })

  it('comes out differently for different seeds', () => {
    const ends = new Set(series(baseline, warden, 'meeting', CAREFUL, 30).map((each) => `${each.winner}:${each.shots.length}:${each.endS}`))
    expect(ends.size).toBeGreaterThan(15)
  })

  it('keeps its books straight on every ground and under every order', () => {
    for (const ground of BATTLE_GROUND_IDS) {
      for (const orders of ALL_ORDERS) {
        for (const result of series(baseline, warden, ground, orders, 8)) {
          const plans = BATTLE.grounds[ground].platoons
          expect(result.started).toEqual([plans[0].lanes.length, plans[1].lanes.length])
          expect(result.tanks.length).toBe(result.started[0] + result.started[1])
          expect(result.orders[0]).toEqual(orders)
          expect(result.endS).toBeLessThanOrEqual(BATTLE.limitS)

          result.tanks.forEach((tank, index) => {
            const fired = result.shots.filter((shot) => shot.by === index)
            expect(tank.fired).toBe(fired.length)
            expect(tank.fired).toBeLessThanOrEqual((tank.side === 0 ? baseline : warden).sheet.fire.carried)
            expect(tank.through).toBeLessThanOrEqual(tank.hits)
            expect(tank.hits).toBeLessThanOrEqual(tank.fired)
            expect(tank.canShoot).toBe(tank.outS === null)
            // What is written down is what first put it out; it may have burned later.
            if (tank.cause === 'destroyed' || tank.cause === 'burned') expect(tank.alive).toBe(false)
            expect(tank.cause === null).toBe(tank.outS === null)
            if (tank.brokeDown) expect(tank.canMove).toBe(false)
            // Tanks it is credited with are tanks that name it.
            expect(tank.kills).toBe(result.tanks.filter((each) => each.outBy === index).length)
          })
          for (const side of [0, 1] as const) {
            expect(result.fighting[side]).toBe(result.tanks.filter((tank) => tank.side === side && tank.canShoot).length)
          }

          // Shots are listed as they were fired, each at a tank of the other platoon.
          result.shots.forEach((shot, i) => {
            expect(shot.landS).toBeGreaterThan(shot.atS)
            if (i > 0) expect(shot.atS).toBeGreaterThanOrEqual(result.shots[i - 1]?.atS ?? 0)
            expect(result.tanks[shot.by]?.side).not.toBe(result.tanks[shot.at]?.side)
            expect(Math.abs(shot.bearingDeg)).toBeLessThanOrEqual(180)
          })

          // Every tank has a place for every moment kept.
          const length = result.tracks[0]?.length ?? 0
          expect(length % 3).toBe(0)
          expect(length).toBeGreaterThan(0)
          for (const track of result.tracks) expect(track.length).toBe(length)

          const outs = result.events.filter((event) => event.kind === 'out')
          expect(outs.length).toBe(result.tanks.filter((tank) => tank.outS !== null).length)

          if (result.end === 'wiped') expect(result.fighting[result.winner === 0 ? 1 : 0]).toBe(0)
          if (result.end === 'bothOut' || result.end === 'draw') expect(result.winner).toBeNull()
          else expect(result.winner).not.toBeNull()
        }
      }
    }
  })

  it('is fair: a tank meeting itself wins about as often as it loses', () => {
    const results = series(baseline, baseline, 'meeting', BATTLE.grounds.meeting.theirOrders, 200)
    expect(Math.abs(won(results, 0) - won(results, 1))).toBeLessThan(40)
  })

  it('goes better against a weaker tank than a stronger one', () => {
    const easy = series(baseline, warden, 'meeting', CAREFUL, 40)
    const hard = series(baseline, palisade, 'meeting', CAREFUL, 40)
    expect(won(easy, 0)).toBeGreaterThan(won(hard, 0) + 10)
  })

  it('lets a ridge stop rounds aimed at the tank behind it', () => {
    // Rounds that would have struck the tank low down and struck the ridge in front of it instead.
    const stopped = (results: BattleResult[]): number =>
      results.reduce((sum, each) => sum + each.shots.filter((shot) =>
        each.tanks[shot.at]?.side === 0 && shot.berm && shot.aim.y > 0).length, 0)
    expect(stopped(series(baseline, baseline, 'defend', CAREFUL, 20))).toBeGreaterThan(20)
    // Rushing across the open there is no ridge to stop anything.
    expect(stopped(series(baseline, baseline, 'advance', { range: 'close', pace: 'fast' }, 20))).toBe(0)
  })

  it('brings rounds in from the side as well as the front', () => {
    const results = series(baseline, baseline, 'advance', { range: 'close', pace: 'fast' }, 20)
    const bearings = results.flatMap((each) => each.shots.map((shot) => Math.abs(shot.bearingDeg)))
    expect(bearings.some((bearing) => bearing > 30)).toBe(true)
    expect(bearings.filter((bearing) => bearing < 30).length).toBeGreaterThan(bearings.length / 2)
  })
})

describe('the orders', () => {
  it('default to long range and careful', () => {
    expect(DEFAULT_ORDERS).toEqual(CAREFUL)
  })

  it('keep a careful crew from shooting on the move, and let a fast one', () => {
    const careful = series(baseline, baseline, 'advance', { range: 'close', pace: 'careful' }, 10)
    const fast = series(baseline, baseline, 'advance', { range: 'close', pace: 'fast' }, 10)
    const onTheMove = (results: BattleResult[]): number =>
      results.reduce((sum, each) => sum + each.shots.filter((shot) => each.tanks[shot.by]?.side === 0 && shot.moving).length, 0)
    expect(onTheMove(careful)).toBe(0)
    expect(onTheMove(fast)).toBeGreaterThan(20)
  })

  it('stop an attack at the ridge when told to stand off, and send it on when told to close', () => {
    const lanes = BATTLE.grounds.advance.platoons[0].lanes
    const ridgeY = Math.max(...lanes.map((lane) => lane[1]?.y ?? 0))
    const reach = (orders: Orders): number =>
      Math.max(...series(baseline, baseline, 'advance', orders, 10).flatMap((each) =>
        lanes.map((_, tank) => lastPlace(each, tank).y)))
    expect(reach({ range: 'long', pace: 'careful' })).toBeLessThanOrEqual(ridgeY + BATTLE.arriveM)
    expect(reach({ range: 'close', pace: 'careful' })).toBeGreaterThan(ridgeY + 100)
  })

  it('hold a defending platoon\'s fire until the range has closed', () => {
    for (const result of series(baseline, baseline, 'defend', { range: 'close', pace: 'careful' }, 20)) {
      const first = result.shots[0]
      if (!first || result.tanks[first.by]?.side !== 0) continue
      expect(first.rangeM).toBeLessThanOrEqual(BATTLE.holdFireM)
    }
    const eager = series(baseline, baseline, 'defend', CAREFUL, 20)
    const longShots = eager.filter((each) => (each.shots[0]?.rangeM ?? 0) > BATTLE.holdFireM)
    expect(longShots.length).toBeGreaterThan(10)
  })

  it('shift a defending tank along its ridge when told to move fast', () => {
    const still = series(baseline, baseline, 'defend', CAREFUL, 10)
    const shifting = series(baseline, baseline, 'defend', { range: 'long', pace: 'fast' }, 10)
    const travelled = (results: BattleResult[]): number =>
      results.reduce((sum, each) => sum + each.tanks.filter((tank) => tank.side === 0).reduce((s, tank) => s + tank.travelledM, 0), 0)
    expect(travelled(still)).toBe(0)
    expect(travelled(shifting)).toBeGreaterThan(1000)
  })
})

describe('the battle budget', () => {
  it('fights forty battles in well under a second or two', () => {
    const start = performance.now()
    for (const ground of BATTLE_GROUND_IDS) series(baseline, warden, ground, CAREFUL, 10)
    expect(performance.now() - start).toBeLessThan(4000)
  })
})
