import { describe, expect, it } from 'vitest'
import { DEFAULT_THREAT, PACT_ROUNDS, THREATS, THREAT_IDS, pactRounds, type Round } from '../src/data/ammo'
import { BASELINE_SPEC } from '../src/data/baseline'
import { ZONES } from '../src/data/materials'
import { GUNS, type GunId } from '../src/data/parts'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1, TUNING } from '../src/data/tuning'
import { buildStatSheet, penetrationAt, verdictOf, verdictsAgainst, worthAgainst } from '../src/sim/vehicle'

const GUN_IDS = Object.keys(GUNS) as GunId[]

function sane(round: Round): void {
  expect(round.speedMs).toBeGreaterThan(0)
  expect(round.spreadM).toBeGreaterThan(0)
  expect(round.penMm).toBeGreaterThan(0)
  if (round.kind === 'kinetic') expect(round.lossPerKmMm).toBeGreaterThan(0)
  else expect(round.lossPerKmMm).toBe(0)
}

describe('ammunition tables', () => {
  it('gives every gun a kinetic round and a shaped charge, each with a name', () => {
    expect(Object.keys(PACT_ROUNDS).sort()).toEqual([...GUN_IDS].sort())
    for (const gun of GUN_IDS) {
      const rounds = pactRounds(gun)
      expect(rounds.map(({ round }) => round.kind).sort()).toEqual(['kinetic', 'shaped'])
      for (const { id, round } of rounds) {
        expect(STRINGS.rounds[id]).toContain(String(GUNS[gun].calibreMm))
        sane(round)
      }
    }
  })

  it('names every threat and starts the map on a real one', () => {
    for (const id of THREAT_IDS) {
      expect(STRINGS.threats[id].name).toBeTruthy()
      expect(STRINGS.threats[id].note).toBeTruthy()
      sane(THREATS[id])
    }
    expect(THREAT_IDS).toContain(DEFAULT_THREAT)
    expect(TUNING.protection.mapRangesM).toContain(TUNING.protection.defaultRangeM)
  })

  it('gives bigger Pact guns more punch', () => {
    const kinetic = (gun: GunId): number => pactRounds(gun).find(({ round }) => round.kind === 'kinetic')?.round.penMm ?? 0
    expect(kinetic('smooth115')).toBeGreaterThan(kinetic('rifled100'))
    expect(kinetic('smooth125')).toBeGreaterThan(kinetic('smooth115'))
  })
})

describe('what a round goes through', () => {
  it('falls with range for a kinetic round and never goes below nothing', () => {
    const round = THREATS.accord105Sabot
    expect(penetrationAt(round, 0)).toBe(round.penMm)
    expect(penetrationAt(round, 2000)).toBe(round.penMm - 2 * round.lossPerKmMm)
    expect(penetrationAt(round, 1000)).toBeLessThan(penetrationAt(round, 500))
    expect(penetrationAt(round, 1e9)).toBe(0)
    expect(penetrationAt(round, -50)).toBe(round.penMm)
  })

  it('is the same at any range for a shaped charge', () => {
    expect(penetrationAt(THREATS.guidedMissile, 3000)).toBe(THREATS.guidedMissile.penMm)
  })
})

describe('the verdict', () => {
  const margin = TUNING.protection.marginShare

  it('holds, fails, or is too close to call', () => {
    expect(verdictOf(100 * (1 + margin), 100)).toBe('holds')
    expect(verdictOf(100 * (1 + margin) - 0.01, 100)).toBe('marginal')
    expect(verdictOf(100, 100)).toBe('marginal')
    expect(verdictOf(100 * (1 - margin) + 0.01, 100)).toBe('marginal')
    expect(verdictOf(100 * (1 - margin), 100)).toBe('fails')
    expect(verdictOf(0, 100)).toBe('fails')
  })

  it('uses the number for the kind of round', () => {
    const sheet = buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1)
    const glacis = sheet.protection.upperGlacis
    expect(worthAgainst(glacis, 'kinetic')).toBe(glacis.keMm)
    expect(worthAgainst(glacis, 'shaped')).toBe(glacis.ceMm)
  })

  it('judges every zone of the baseline, and the front does better than the sides', () => {
    const sheet = buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1)
    const verdicts = verdictsAgainst(sheet.protection, THREATS[DEFAULT_THREAT], TUNING.protection.defaultRangeM)
    expect(Object.keys(verdicts).sort()).toEqual([...ZONES].sort())
    expect(verdicts.upperGlacis).not.toBe('fails')
    expect(verdicts.turretFrontLeft).not.toBe('fails')
    expect(verdicts.hullSideFront).toBe('fails')
    expect(verdicts.hullRoof).toBe('fails')
  })

  it('changes with the range, the round, a layer and the glacis angle', () => {
    const sheet = buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1)
    const at = (range: number) => verdictsAgainst(sheet.protection, THREATS.accord105Sabot, range).upperGlacis
    expect(at(500)).toBe('marginal')
    expect(at(3000)).toBe('holds')
    expect(verdictsAgainst(sheet.protection, THREATS.accord120Sabot, 1000).upperGlacis).toBe('fails')

    const thicker = structuredClone(BASELINE_SPEC)
    thicker.armour.upperGlacis[0] = { material: 'rolledSteel', mm: 90 }
    const better = buildStatSheet(thicker, PACT_LIMITS_GEN1)
    expect(verdictsAgainst(better.protection, THREATS.accord105Sabot, 500).upperGlacis).toBe('holds')

    const flatter = structuredClone(BASELINE_SPEC)
    flatter.hull.glacisAngleDeg = 55
    const worse = buildStatSheet(flatter, PACT_LIMITS_GEN1)
    expect(verdictsAgainst(worse.protection, THREATS.accord105Sabot, 500).upperGlacis).toBe('fails')
  })
})
