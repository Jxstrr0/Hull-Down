// A casemate in a platoon battle: the whole tank turns to bring its gun round.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BATTLE, BATTLE_GROUND_IDS, PACE_ORDERS, type Orders } from '../src/data/battle'
import { ACCORD_LIMITS, THREAT_TANKS } from '../src/data/opponents'
import { TURRETS } from '../src/data/parts'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { runBattle } from '../src/sim/battle/battle'
import { combatantOf } from '../src/sim/duel/duel'
import { gunRingMm, type VehicleSpec } from '../src/sim/vehicle'

const LIMITS = { ...PACT_LIMITS_GEN1, casemate: true }
const spec: VehicleSpec = structuredClone(BASELINE_SPEC)
spec.turret.shape = 'casemate'
spec.turret.ringMm = gunRingMm(spec)
const casemate = combatantOf(spec, LIMITS)
const turret = combatantOf(BASELINE_SPEC, LIMITS)
const warden = combatantOf(THREAT_TANKS.warden.spec, ACCORD_LIMITS, THREAT_TANKS.warden.rounds)

/** Each pair of samples a second apart where the tank stayed put: how far its hull turned, degrees. */
function turnsOnTheSpot(track: readonly number[]): number[] {
  const turns: number[] = []
  for (let i = 3; i + 2 < track.length; i += 3) {
    const [ax, ay, ah, bx, by, bh] = track.slice(i - 3, i + 3) as [number, number, number, number, number, number]
    if (ax !== bx || ay !== by) continue
    let d = Math.abs(bh - ah) % 360
    if (d > 180) d = 360 - d
    turns.push(d)
  }
  return turns
}

describe('a casemate in battle', () => {
  it('knows how far its gun swings, and a turret that it turns all the way', () => {
    expect(casemate.sheet.fire.swingDeg).toBe(TURRETS.casemate.swingDeg)
    expect(turret.sheet.fire.swingDeg).toBeNull()
  })

  it('fights on every ground under every pace of orders, the same way for the same seed', () => {
    for (const ground of BATTLE_GROUND_IDS) {
      for (const pace of PACE_ORDERS) {
        const orders: Orders = { range: 'long', pace }
        const result = runBattle(casemate, warden, ground, orders, 3)
        expect(result).toEqual(runBattle(casemate, warden, ground, orders, 3))
        // The player's platoon comes first.
        expect(result.shots.some((shot) => shot.by < result.started[0]), `${ground} ${pace}`).toBe(true)
      }
    }
  })

  it('swings its hull round on the spot, and no faster than the hull turns', () => {
    let turned = 0
    for (const ground of BATTLE_GROUND_IDS) {
      for (let seed = 1; seed <= 4; seed++) {
        const result = runBattle(casemate, warden, ground, { range: 'long', pace: 'careful' }, seed)
        for (let i = 0; i < result.started[0]; i++) {
          for (const d of turnsOnTheSpot(result.tracks[i] ?? [])) {
            // A second between samples, and each heading rounded to the degree.
            expect(d).toBeLessThanOrEqual(BATTLE.hullTurnDegS * BATTLE.trackS + 1)
            if (d > 0) turned++
          }
        }
      }
    }
    expect(turned).toBeGreaterThan(0)
  })
})
