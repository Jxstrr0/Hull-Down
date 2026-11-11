import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { DUEL, DUEL_GROUND_IDS, type DuelGroundId } from '../src/data/duel'
import { ACCORD_LIMITS, THREAT_TANKS } from '../src/data/opponents'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { designRival } from '../src/sim/ai/designer'
import { combatantOf, runDuel, type Combatant, type DuelResult } from '../src/sim/duel/duel'
import type { VehicleSpec } from '../src/sim/vehicle'

const LIMITS = PACT_LIMITS_GEN1
const baseline = combatantOf(BASELINE_SPEC, LIMITS)
const warden = combatantOf(THREAT_TANKS.warden.spec, ACCORD_LIMITS, THREAT_TANKS.warden.rounds)
const palisade = combatantOf(THREAT_TANKS.palisade.spec, ACCORD_LIMITS, THREAT_TANKS.palisade.rounds)
const firepower = combatantOf(designRival('firepower', LIMITS, 1), LIMITS)

function series(a: Combatant, b: Combatant, ground: DuelGroundId, count: number): DuelResult[] {
  return Array.from({ length: count }, (_, i) => runDuel(a, b, ground, i + 1))
}

function tally(results: DuelResult[]): { won: number; lost: number; drawn: number } {
  return {
    won: results.filter((each) => each.winner === 0).length,
    lost: results.filter((each) => each.winner === 1).length,
    drawn: results.filter((each) => each.winner === null).length,
  }
}

function withSpec(change: (spec: VehicleSpec) => void): Combatant {
  const spec = JSON.parse(JSON.stringify(BASELINE_SPEC)) as VehicleSpec
  change(spec)
  return combatantOf(spec, LIMITS)
}

describe('a duel', () => {
  it('comes out the same for the same tanks, ground and seed', () => {
    for (const ground of DUEL_GROUND_IDS) {
      expect(runDuel(baseline, warden, ground, 11)).toEqual(runDuel(baseline, warden, ground, 11))
    }
  })

  it('comes out differently for different seeds', () => {
    const ends = new Set(series(baseline, warden, 'meeting', 30).map((each) => `${each.winner}:${each.shots.length}:${each.endS}`))
    expect(ends.size).toBeGreaterThan(10)
  })

  it('keeps its books straight', () => {
    for (const ground of DUEL_GROUND_IDS) {
      for (const result of series(baseline, firepower, ground, 60)) {
        const [mine, theirs] = result.sides
        for (const no of [0, 1] as const) {
          const side = result.sides[no]
          const fired = result.shots.filter((shot) => shot.by === no)
          expect(side.fired).toBe(fired.length)
          expect(side.fired).toBeLessThanOrEqual(no === 0 ? baseline.sheet.fire.carried : firepower.sheet.fire.carried)
          expect(side.firstShotS).toBe(fired[0]?.atS ?? null)
          expect(side.through).toBeLessThanOrEqual(side.hits)
          expect(side.hits).toBeLessThanOrEqual(side.fired)
        }
        // Shots are listed as they were fired.
        for (let i = 1; i < result.shots.length; i++) {
          expect(result.shots[i]!.atS).toBeGreaterThanOrEqual(result.shots[i - 1]!.atS)
        }
        expect(result.firstShotBy).toBe(result.shots[0]?.by ?? null)
        expect(result.endS).toBeLessThanOrEqual(DUEL.limitS)
        // Who won matches the state each tank was left in.
        if (result.winner === null) {
          expect(['bothOut', 'timeUp', 'ammo']).toContain(result.end)
          expect(mine.canShoot).toBe(theirs.canShoot)
        } else {
          const loser = result.sides[result.winner === 0 ? 1 : 0]
          expect(result.sides[result.winner].canShoot).toBe(true)
          expect(loser.canShoot).toBe(false)
          if (result.end === 'destroyed') expect(loser.alive).toBe(false)
          if (result.end === 'burned') expect(loser.burned).toBe(true)
          if (result.end === 'silenced') expect(loser.alive).toBe(true)
        }
        // A tank that blew up or burned cannot still be shooting.
        for (const side of result.sides) if (!side.alive) expect(side.canShoot).toBe(false)
      }
    }
  })

  it('is even between a tank and its twin', () => {
    const { won, lost } = tally(series(baseline, baseline, 'meeting', 400))
    expect(won / (won + lost)).toBeGreaterThan(0.42)
    expect(won / (won + lost)).toBeLessThan(0.58)
  })

  it('favours the tank behind the ridge', () => {
    const attack = tally(series(baseline, baseline, 'attack', 300))
    const defend = tally(series(baseline, baseline, 'defend', 300))
    expect(attack.lost).toBeGreaterThan(attack.won * 1.2)
    expect(defend.won).toBeGreaterThan(defend.lost * 1.2)
  })

  it('never lets a round through the ridge', () => {
    let berms = 0
    for (const result of series(baseline, baseline, 'attack', 80)) {
      const hidden = baseline.sheet.target.shell.frame.top - (result.sides[1].showsM ?? 0)
      expect(hidden).toBeGreaterThan(0)
      expect(result.sides[0].showsM).toBeNull()
      for (const shot of result.shots.filter((each) => each.by === 0)) {
        if (shot.berm) {
          berms++
          expect(shot.hit).toBeNull()
        } else if (shot.hit?.entry) {
          expect(shot.hit.entry.y).toBeGreaterThan(hidden - 0.15)
        }
      }
    }
    expect(berms).toBeGreaterThan(0)
  })

  it('closes the range as the attacker comes on, and no nearer than allowed', () => {
    const results = series(baseline, baseline, 'attack', 60)
    for (const result of results) {
      expect(result.endRangeM).toBeLessThanOrEqual(DUEL.grounds.attack.rangeM)
      expect(result.endRangeM).toBeGreaterThanOrEqual(DUEL.closestM)
      const ranges = result.shots.map((shot) => shot.rangeM)
      for (let i = 1; i < ranges.length; i++) expect(ranges[i]!).toBeLessThanOrEqual(ranges[i - 1]!)
    }
    expect(results.some((result) => result.endRangeM < DUEL.grounds.attack.rangeM - 100)).toBe(true)
    for (const result of series(baseline, baseline, 'meeting', 20)) expect(result.endRangeM).toBe(DUEL.grounds.meeting.rangeM)
  })

  it('lets the tank with the better sights shoot first', () => {
    const results = series(baseline, firepower, 'meeting', 100)
    expect(results.filter((each) => each.firstShotBy === 1).length).toBeGreaterThan(80)
  })

  it('makes the Warden beatable and the Palisade hard', () => {
    const againstWarden = tally(series(baseline, warden, 'meeting', 150))
    const againstPalisade = tally(series(baseline, palisade, 'meeting', 150))
    expect(againstWarden.won).toBeGreaterThan(againstWarden.lost)
    expect(againstPalisade.lost).toBeGreaterThan(againstPalisade.won * 2)
  })

  it('fires the rounds each tank carries', () => {
    const result = runDuel(baseline, warden, 'meeting', 5)
    for (const shot of result.shots) {
      if (shot.by === 0) expect(['sabot125', 'shaped125']).toContain(shot.roundId)
      else expect(THREAT_TANKS.warden.rounds).toContain(shot.roundId)
    }
  })

  it('rewards a night sight in the dark', () => {
    const blind = withSpec((spec) => { spec.fireControl.night = 'none' })
    const sighted = withSpec((spec) => { spec.fireControl.night = 'imageIntensifier' })
    const blindRun = tally(series(blind, baseline, 'night', 200))
    const sightedRun = tally(series(sighted, baseline, 'night', 200))
    expect(sightedRun.won).toBeGreaterThan(blindRun.won + 20)
  })

  it('rewards thicker armour', () => {
    const thin = withSpec((spec) => {
      for (const zone of ['upperGlacis', 'turretFrontLeft', 'turretFrontRight', 'mantlet'] as const) {
        spec.armour[zone] = spec.armour[zone].map((layer) => ({ ...layer, mm: Math.max(5, Math.round(layer.mm * 0.5)) }))
      }
    })
    const thinRun = tally(series(thin, warden, 'meeting', 200))
    const stockRun = tally(series(baseline, warden, 'meeting', 200))
    expect(stockRun.won).toBeGreaterThan(thinRun.won + 15)
  })

  it('only fires smoke from a tank that has it', () => {
    const none = withSpec((spec) => { spec.protection.smokeLaunchers = false })
    for (const result of series(none, warden, 'meeting', 80)) expect(result.sides[0].smokeS).toBeNull()
    expect(series(baseline, warden, 'meeting', 80).some((result) => result.sides[0].smokeS !== null)).toBe(true)
  })

  it('holds fire while the smoke hangs', () => {
    for (const result of series(baseline, warden, 'meeting', 80)) {
      for (const side of result.sides) {
        if (side.smokeS === null) continue
        const from = side.smokeS
        const blind = result.shots.filter((shot) => shot.atS > from && shot.atS < from + DUEL.smoke.blindS)
        // Only the first smoke of a duel is certain to have nothing over it.
        const first = Math.min(...result.sides.map((each) => each.smokeS ?? Infinity))
        if (from === first) expect(blind).toEqual([])
      }
    }
  })

  it('calls the fight off when nobody is out of it in time', () => {
    const results = DUEL_GROUND_IDS.flatMap((ground) => series(baseline, baseline, ground, 100))
    const timedOut = results.filter((each) => each.end === 'timeUp')
    for (const result of timedOut) {
      expect(result.endS).toBe(DUEL.limitS)
      expect(result.winner).toBeNull()
    }
  })

  it('changes the aim or the round when hits do nothing', () => {
    // The 100 mm gun cannot get through the Palisade's front, so its crew has to try something else.
    const weak = withSpec((spec) => {
      spec.gun = 'rifled100'
      spec.turret.ringMm = 2100
    })
    const results = series(weak, palisade, 'meeting', 60)
    const mine = results.flatMap((result) => result.shots.filter((shot) => shot.by === 0))
    expect(new Set(mine.map((shot) => shot.aimAt)).size).toBeGreaterThan(1)
    expect(new Set(mine.map((shot) => shot.roundId)).size).toBeGreaterThan(1)
  })
})
