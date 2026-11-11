import { describe, expect, it } from 'vitest'
import { battleCuesBetween, battleSpeedKmh, battleStrikeOf, loudnessAt } from '../src/audio/battleCues'
import { AUDIO } from '../src/data/audio'
import { BASELINE_SPEC } from '../src/data/baseline'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { runBattle, type BattleShot } from '../src/sim/battle/battle'
import { combatantOf } from '../src/sim/duel/duel'

const me = combatantOf(BASELINE_SPEC, PACT_LIMITS_GEN1)
const battles = [1, 2, 3, 4, 5, 6].map((seed) => runBattle(me, me, 'advance', { range: 'close', pace: 'fast' }, seed))
const shots = battles.flatMap((battle) => battle.shots)
const calibres = [100, 125] as const

describe('battle sound', () => {
  it('gives every way a round can land its own sound', () => {
    const heard = new Set(shots.map(battleStrikeOf))
    expect(shots.length).toBeGreaterThan(10)
    for (const shot of shots) {
      const cue = battleStrikeOf(shot)
      if (shot.berm) expect(cue).toBe('short')
      else if (shot.hit?.through) expect(cue).toBe('pierce')
      else if (cue === 'ricochet') expect(shot.hit?.armour?.ricochet).toBe(true)
      expect(cue).not.toBe('gun')
    }
    expect(heard.size).toBeGreaterThan(1)
  })

  it('tells a ricochet, a hit that holds and a penetration apart', () => {
    const base = shots.find((shot) => shot.hit?.armour && !shot.berm)
    expect(base).toBeDefined()
    const make = (through: boolean, ricochet: boolean): BattleShot => ({
      ...base!,
      hit: { ...base!.hit!, through, armour: { ...base!.hit!.armour!, ricochet } },
    })
    expect(battleStrikeOf(make(true, false))).toBe('pierce')
    expect(battleStrikeOf(make(false, true))).toBe('ricochet')
    expect(battleStrikeOf(make(false, false))).toBe('held')
    expect(battleStrikeOf({ ...base!, hit: null })).toBe('miss')
    expect(battleStrikeOf({ ...base!, berm: true })).toBe('short')
  })

  it('is quieter from further away, but never silent', () => {
    expect(loudnessAt(0)).toBe(1)
    expect(loudnessAt(AUDIO.battle.halfM)).toBeCloseTo(0.5)
    expect(loudnessAt(100)).toBeGreaterThan(loudnessAt(800))
    expect(loudnessAt(1e6)).toBe(AUDIO.battle.floorGain)
  })

  it('hears each gun and each strike once as the battle plays', () => {
    for (const battle of battles) {
      let guns = 0
      let strikes = 0
      const step = 0.05
      for (let t = 0; t < battle.endS + 5; t += step) {
        const cues = battleCuesBetween(battle, t, t + step, 0, calibres)
        expect(cues.length).toBeLessThanOrEqual(AUDIO.battle.mostAtOnce)
        for (const cue of cues) {
          expect(cue.gain).toBeGreaterThan(0)
          expect(cue.gain).toBeLessThanOrEqual(1)
          if (cue.id === 'gun') {
            guns++
            expect(calibres).toContain(cue.calibreMm)
          } else strikes++
        }
      }
      expect(guns).toBeGreaterThan(0)
      expect(guns).toBeLessThanOrEqual(battle.shots.length)
      expect(strikes).toBeLessThanOrEqual(battle.shots.length)
      expect(guns + strikes).toBeGreaterThan(battle.shots.length)
    }
  })

  it('hears its own gun loudest, with its own calibre', () => {
    const battle = battles[0]!
    const shot = battle.shots.find((each) => each.by === 0) ?? battle.shots[0]!
    const cues = battleCuesBetween(battle, shot.atS - 0.01, shot.atS, shot.by, calibres)
    const gun = cues.find((cue) => cue.id === 'gun')
    expect(gun?.gain).toBe(1)
    expect(gun?.calibreMm).toBe(calibres[battle.tanks[shot.by]!.side])
  })

  it('plays nothing when the bar is dragged or run backwards', () => {
    const battle = battles[0]!
    expect(battleCuesBetween(battle, 0, battle.endS, 0, calibres)).toEqual([])
    expect(battleCuesBetween(battle, battle.endS, 0, 0, calibres)).toEqual([])
    expect(battleCuesBetween(battle, 5, 5, 0, calibres)).toEqual([])
  })

  it('reads a sensible speed off the tracks, and none for a tank that is out', () => {
    const battle = battles[0]!
    let fastest = 0
    for (let t = 0; t < battle.endS; t += 0.5) {
      for (let tank = 0; tank < battle.tanks.length; tank++) {
        const kmh = battleSpeedKmh(battle, tank, t)
        expect(kmh).toBeGreaterThanOrEqual(0)
        expect(kmh).toBeLessThan(120)
        fastest = Math.max(fastest, kmh)
        const out = battle.tanks[tank]!.outS
        if (out !== null && t >= out) expect(kmh).toBe(0)
      }
    }
    expect(fastest).toBeGreaterThan(5)
  })
})
