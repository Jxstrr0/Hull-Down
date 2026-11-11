import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BATTLE } from '../src/data/battle'
import { DUEL } from '../src/data/duel'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { runBattle } from '../src/sim/battle/battle'
import { combatantOf } from '../src/sim/duel/duel'
import { momentOf } from '../src/ui/battleReplay'

const me = combatantOf(BASELINE_SPEC, PACT_LIMITS_GEN1)
const battles = [1, 2, 3, 4, 5, 6].map((seed) => runBattle(me, me, 'advance', { range: 'close', pace: 'fast' }, seed))

describe('a battle at one moment', () => {
  it('starts with every tank at its first post, fighting, and nothing in the air', () => {
    for (const battle of battles) {
      const start = momentOf(battle, 0)
      expect(start.rounds).toEqual([])
      const lanes = BATTLE.grounds.advance.platoons.flatMap((plan) => plan.lanes)
      start.tanks.forEach((tank, index) => {
        expect(tank.state).toBe('fighting')
        expect(tank.x).toBeCloseTo(lanes[index]?.[0]?.x ?? -1, 0)
        expect(tank.y).toBeCloseTo(lanes[index]?.[0]?.y ?? -1, 0)
      })
    }
  })

  it('ends with the tanks that were put out marked out, and no others', () => {
    for (const battle of battles) {
      const end = momentOf(battle, battle.endS)
      end.tanks.forEach((tank, index) => {
        expect(tank.state === 'out').toBe(battle.tanks[index]?.outS !== null)
      })
      // Asking for a time past the end gives the end.
      expect(momentOf(battle, battle.endS + 100)).toEqual(end)
    }
  })

  it('keeps every tank on the ground and moves it no faster than it can go', () => {
    for (const battle of battles) {
      let before = momentOf(battle, 0)
      for (let t = 0.5; t <= battle.endS; t += 0.5) {
        const now = momentOf(battle, t)
        now.tanks.forEach((tank, index) => {
          expect(tank.x).toBeGreaterThanOrEqual(0)
          expect(tank.x).toBeLessThanOrEqual(BATTLE.field.widthM)
          expect(tank.y).toBeGreaterThanOrEqual(0)
          expect(tank.y).toBeLessThanOrEqual(BATTLE.field.depthM)
          const was = before.tanks[index]
          if (!was) return
          const moved = Math.hypot(tank.x - was.x, tank.y - was.y)
          expect(moved).toBeLessThanOrEqual((me.sheet.mobility.topSpeedKmh / 3.6) * 0.5 + 0.2)
        })
        before = now
      }
    }
  })

  it('shows a round in the air between the moment it is fired and the moment it lands', () => {
    const battle = battles[0]
    const shot = battle?.shots[0]
    if (!battle || !shot) throw new Error('no shot')
    const mid = (shot.atS + shot.landS) / 2
    const round = momentOf(battle, mid).rounds.find((each) => each.by === shot.by)
    expect(round).toBeDefined()
    expect(round?.along).toBeGreaterThan(0)
    expect(round?.along).toBeLessThan(1)
    expect(momentOf(battle, shot.atS - 0.05).rounds.length).toBe(0)
  })

  it('shows a tank in its smoke for as long as the smoke lasts', () => {
    const found = battles.flatMap((battle) => battle.tanks.map((tank, index) => ({ battle, tank, index })))
      .find(({ battle, tank }) => tank.smokeS !== null && (tank.outS === null || tank.outS > tank.smokeS + 2) && battle.endS > tank.smokeS + 2)
    if (!found || found.tank.smokeS === null) throw new Error('nobody fired smoke')
    const { battle, tank, index } = found
    const smokeS = tank.smokeS ?? 0
    expect(momentOf(battle, smokeS + 1).tanks[index]?.state).toBe('smoke')
    expect(momentOf(battle, Math.max(0, smokeS - 1)).tanks[index]?.state).toBe('fighting')
    const after = smokeS + DUEL.smoke.blindS + 1
    if (after < battle.endS && (tank.outS === null || tank.outS > after)) {
      expect(momentOf(battle, after).tanks[index]?.state).toBe('fighting')
    }
  })
})
