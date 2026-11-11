import { describe, expect, it } from 'vitest'
import { THREATS } from '../src/data/ammo'
import { BASELINE_SPEC } from '../src/data/baseline'
import { ZONES } from '../src/data/materials'
import { ACCORD_LIMITS, BUREAUS, BUREAU_IDS, THREAT_TANKS, THREAT_TANK_IDS } from '../src/data/opponents'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { designRival } from '../src/sim/ai/designer'
import { buildStatSheet, type StatSheet } from '../src/sim/vehicle'

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)
const LIMITS = PACT_LIMITS_GEN1

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function sheetsOf(bureau: (typeof BUREAU_IDS)[number]): StatSheet[] {
  return SEEDS.map((seed) => buildStatSheet(designRival(bureau, LIMITS, seed), LIMITS))
}

const frontOf = (sheet: StatSheet): number =>
  Math.min(sheet.protection.upperGlacis.keMm, sheet.protection.turretFrontLeft.keMm)

describe('the bot designers', () => {
  it('always enter a tank that can be built, with nothing overloaded', () => {
    for (const bureau of BUREAU_IDS) {
      for (const sheet of sheetsOf(bureau)) {
        expect(sheet.issues, `${bureau}: ${sheet.issues.map((issue) => issue.code).join(', ')}`).toEqual([])
        expect(sheet.massT).toBeLessThanOrEqual(LIMITS.maxMassT)
      }
    }
  })

  it('give the same tank for the same bureau and seed', () => {
    for (const bureau of BUREAU_IDS) {
      expect(designRival(bureau, LIMITS, 7)).toEqual(designRival(bureau, LIMITS, 7))
    }
  })

  it('do not all draw the same tank', () => {
    for (const bureau of BUREAU_IDS) {
      const drawn = new Set(SEEDS.map((seed) => JSON.stringify(designRival(bureau, LIMITS, seed))))
      expect(drawn.size).toBeGreaterThan(5)
    }
  })

  it('leave the baseline as it was', () => {
    const before = JSON.stringify(BASELINE_SPEC)
    for (const bureau of BUREAU_IDS) designRival(bureau, LIMITS, 3)
    expect(JSON.stringify(BASELINE_SPEC)).toBe(before)
  })

  it('build to the weight their bureau aims at', () => {
    for (const bureau of BUREAU_IDS) {
      const aim = LIMITS.maxMassT * BUREAUS[bureau].massShare
      for (const sheet of sheetsOf(bureau)) {
        expect(sheet.massT).toBeLessThanOrEqual(aim + 1e-9)
        expect(sheet.massT).toBeGreaterThan(aim - 2.5)
      }
    }
  })

  it('show their way of thinking in the tank', () => {
    const heavy = sheetsOf('heavy')
    const light = sheetsOf('light')
    const firepower = sheetsOf('firepower')
    // Heavy: the best protected front of the three.
    expect(mean(heavy.map(frontOf))).toBeGreaterThan(mean(light.map(frontOf)) + 30)
    expect(mean(heavy.map(frontOf))).toBeGreaterThan(mean(firepower.map(frontOf)) + 30)
    // Light: the lightest and the cheapest.
    expect(mean(light.map((sheet) => sheet.massT))).toBeLessThan(mean(firepower.map((sheet) => sheet.massT)) - 5)
    expect(mean(light.map((sheet) => sheet.unitCostKr))).toBeLessThan(mean(heavy.map((sheet) => sheet.unitCostKr)))
    // Firepower: first to shoot, and the likeliest to hit.
    const first = (sheet: StatSheet): number => sheet.gunnery.firstShotS
    const hit = (sheet: StatSheet): number => sheet.gunnery.byRound[0]?.chances[2] ?? 0
    expect(mean(firepower.map(first))).toBeLessThan(mean(heavy.map(first)) - 3)
    expect(mean(firepower.map(first))).toBeLessThan(mean(light.map(first)) - 3)
    expect(mean(firepower.map(hit))).toBeGreaterThan(mean(heavy.map(hit)))
    expect(mean(firepower.map(hit))).toBeGreaterThan(mean(light.map(hit)))
  })

  it('keep to tighter limits when a tender sets them', () => {
    const tight = { ...LIMITS, maxMassT: 38, allowedCalibresMm: [100, 115] }
    for (const bureau of BUREAU_IDS) {
      for (const seed of SEEDS.slice(0, 10)) {
        const sheet = buildStatSheet(designRival(bureau, tight, seed), tight)
        expect(sheet.issues.filter((issue) => issue.severity === 'error')).toEqual([])
      }
    }
  })
})

describe('the threat tanks', () => {
  it('can be built under the Accord\'s own limits, with nothing overloaded', () => {
    for (const id of THREAT_TANK_IDS) {
      const sheet = buildStatSheet(THREAT_TANKS[id].spec, ACCORD_LIMITS)
      expect(sheet.issues, id).toEqual([])
    }
  })

  it('are too heavy for a Pact bridge', () => {
    for (const id of THREAT_TANK_IDS) {
      expect(buildStatSheet(THREAT_TANKS[id].spec, ACCORD_LIMITS).massT).toBeGreaterThan(PACT_LIMITS_GEN1.maxMassT)
    }
  })

  it('fire Accord rounds, the first of them a dart', () => {
    for (const id of THREAT_TANK_IDS) {
      const rounds = THREAT_TANKS[id].rounds
      expect(rounds.length).toBeGreaterThan(0)
      expect(THREATS[rounds[0]!].kind).toBe('kinetic')
    }
  })

  it('have every zone armoured', () => {
    for (const id of THREAT_TANK_IDS) {
      for (const zone of ZONES) expect(THREAT_TANKS[id].spec.armour[zone].length, `${id} ${zone}`).toBeGreaterThan(0)
    }
  })

  it('make the Palisade the harder of the two to get through from the front', () => {
    const warden = buildStatSheet(THREAT_TANKS.warden.spec, ACCORD_LIMITS)
    const palisade = buildStatSheet(THREAT_TANKS.palisade.spec, ACCORD_LIMITS)
    expect(frontOf(palisade)).toBeGreaterThan(frontOf(warden) + 100)
  })
})

describe('opponent names', () => {
  it('has a name and a line for every bureau and threat tank', () => {
    for (const id of BUREAU_IDS) {
      expect(STRINGS.opponents.bureaus[id].name).not.toBe('')
      expect(STRINGS.opponents.bureaus[id].line).not.toBe('')
    }
    for (const id of THREAT_TANK_IDS) {
      expect(STRINGS.opponents.threats[id].name).not.toBe('')
      expect(STRINGS.opponents.threats[id].line).not.toBe('')
    }
  })
})
