import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BATTLE, BATTLE_GROUND_IDS, type Orders } from '../src/data/battle'
import { ACCORD_LIMITS, THREAT_TANKS } from '../src/data/opponents'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { BATTLE_FINDING_KINDS, runBattleSeries } from '../src/sim/battle/series'
import { combatantOf } from '../src/sim/duel/duel'

const LIMITS = PACT_LIMITS_GEN1
const baseline = combatantOf(BASELINE_SPEC, LIMITS)
const warden = combatantOf(THREAT_TANKS.warden.spec, ACCORD_LIMITS, THREAT_TANKS.warden.rounds)
const palisade = combatantOf(THREAT_TANKS.palisade.spec, ACCORD_LIMITS, THREAT_TANKS.palisade.rounds)
const CAREFUL: Orders = { range: 'long', pace: 'careful' }

describe('a battle series', () => {
  it('comes out the same for the same tanks, ground, orders and seed', () => {
    expect(runBattleSeries(baseline, warden, 'meeting', CAREFUL, 5, 4)).toEqual(runBattleSeries(baseline, warden, 'meeting', CAREFUL, 5, 4))
  })

  it('fights a different set of battles on each ground and for each seed', () => {
    const a = runBattleSeries(baseline, baseline, 'meeting', CAREFUL, 1, 3).battles.map((each) => each.seed)
    const b = runBattleSeries(baseline, baseline, 'meeting', CAREFUL, 2, 3).battles.map((each) => each.seed)
    const c = runBattleSeries(baseline, baseline, 'night', CAREFUL, 1, 3).battles.map((each) => each.seed)
    expect(new Set([...a, ...b, ...c]).size).toBe(9)
  })

  it('fights the number of battles in the table unless told otherwise', () => {
    expect(runBattleSeries(baseline, warden, 'defend', CAREFUL, 1).battles.length).toBe(BATTLE.runs)
  })

  it('adds up', () => {
    for (const ground of BATTLE_GROUND_IDS) {
      const series = runBattleSeries(baseline, warden, ground, CAREFUL, 3)
      const n = series.battles.length
      expect(series.won + series.lost + series.drawn).toBe(n)
      expect(series.won).toBe(series.battles.filter((each) => each.winner === 0).length)
      expect(Object.values(series.wonBy).reduce((a, b) => a + b, 0)).toBe(series.won)
      expect(Object.values(series.lostBy).reduce((a, b) => a + b, 0)).toBe(series.lost)
      expect(series.shotFirst[0] + series.shotFirst[1]).toBeLessThanOrEqual(n)
      const plans = BATTLE.grounds[ground].platoons
      for (const side of [0, 1] as const) {
        const tally = series.tally[side]
        expect(tally.tanks).toBe(plans[side].lanes.length * n)
        expect(tally.lost).toBe(series.battles.reduce((sum, each) => sum + each.started[side] - each.fighting[side], 0))
        expect(tally.destroyed + tally.burned).toBeLessThanOrEqual(tally.lost)
        expect(tally.through).toBeLessThanOrEqual(tally.hits)
        expect(tally.hits + tally.berm).toBeLessThanOrEqual(tally.fired)
      }
      // Rounds through the platoon's tanks are the other platoon's rounds that got through.
      expect(series.holes.reduce((sum, each) => sum + each.count, 0)).toBeLessThanOrEqual(series.tally[1].through)
      for (let i = 1; i < series.holes.length; i++) {
        expect(series.holes[i - 1]?.count ?? 0).toBeGreaterThanOrEqual(series.holes[i]?.count ?? 0)
      }
    }
  })
})

describe('what decided a battle series', () => {
  it('names no more than the table allows, the heaviest first, each with a battle to look at', () => {
    for (const ground of BATTLE_GROUND_IDS) {
      for (const foe of [warden, palisade, baseline]) {
        const series = runBattleSeries(baseline, foe, ground, CAREFUL, 9)
        expect(series.findings.length).toBeLessThanOrEqual(BATTLE.report.findings)
        series.findings.forEach((finding, i) => {
          expect(BATTLE_FINDING_KINDS).toContain(finding.kind)
          expect(finding.count).toBeLessThanOrEqual(finding.of)
          expect(finding.battleIndex).toBeLessThan(series.battles.length)
          if (finding.good) expect(finding.fix).toBeNull()
          else expect(finding.fix).not.toBeNull()
          if (i > 0) expect(series.findings[i - 1]?.weight ?? 0).toBeGreaterThanOrEqual(finding.weight)
        })
      }
    }
  })

  it('says so when the platoon cannot get through the other tank', () => {
    const series = runBattleSeries(baseline, palisade, 'meeting', CAREFUL, 2)
    const bouncing = series.findings.find((finding) => finding.kind === 'bouncing')
    expect(bouncing?.fix).toEqual({ part: 'gun' })
  })

  it('counts breakdowns among tanks that drive, and none among tanks that sit still', () => {
    const driving = runBattleSeries(baseline, warden, 'advance', { range: 'close', pace: 'fast' }, 4, 40)
    expect(driving.tally[0].brokeDown).toBeGreaterThan(0)
    expect(driving.tally[1].brokeDown).toBe(0)
    for (const battle of driving.battles) {
      for (const tank of battle.tanks) if (tank.brokeDown) expect(tank.travelledM).toBeGreaterThan(0)
    }
  })

  it('finds something good to say about a platoon that wins easily', () => {
    const series = runBattleSeries(baseline, warden, 'defend', { range: 'long', pace: 'fast' }, 6)
    expect(series.won).toBeGreaterThan(series.lost)
    expect(series.findings.some((finding) => finding.good)).toBe(true)
  })
})
