import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { GUNS } from '../src/data/parts'
import { RESEARCH, RESEARCH_IDS } from '../src/data/research'
import { SANDBOX, SANDBOX_LIMIT_IDS } from '../src/data/sandbox'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1, PACT_LIMITS_GEN3 } from '../src/data/tuning'
import { SANDBOX_KEY, loadSandbox, parseSandbox, saveSandbox } from '../src/persist/sandboxStore'
import { newCareer, careerLimits } from '../src/sim/career/career'
import { buildStatSheet } from '../src/sim/vehicle'
import { sandboxLimits } from '../src/sim/vehicle/sandbox'
import { partKey } from '../src/sim/vehicle/tech'

describe('the sandbox', () => {
  it('unlocks every part and every generation, with no cost ceiling', () => {
    for (const id of SANDBOX_LIMIT_IDS) {
      const limits = sandboxLimits(id)
      expect(limits.generation).toBe(3)
      expect(limits.locked).toEqual([])
      expect(limits.maxUnitCostKr).toBeUndefined()
    }
    // The career, by contrast, starts with research still to do.
    const career = careerLimits(newCareer(1))
    expect(career.locked).toContain(partKey(RESEARCH[RESEARCH_IDS[0]!].field, RESEARCH[RESEARCH_IDS[0]!].part))
  })

  it('works to the weight limit the player picked', () => {
    expect(sandboxLimits('early').maxMassT).toBe(PACT_LIMITS_GEN1.maxMassT)
    expect(sandboxLimits('today').maxMassT).toBe(PACT_LIMITS_GEN3.maxMassT)
    expect(sandboxLimits('none').maxMassT).toBe(Infinity)
    expect(sandboxLimits('none').maxWidthM).toBe(Infinity)
    for (const gun of Object.values(GUNS)) expect(sandboxLimits('none').allowedCalibresMm).toContain(gun.calibreMm)
  })

  it('builds a sound sheet with no limit at all', () => {
    const sheet = buildStatSheet(BASELINE_SPEC, sandboxLimits('none'))
    expect(Number.isFinite(sheet.massT)).toBe(true)
    expect(Number.isFinite(sheet.mobility.topSpeedKmh)).toBe(true)
    expect(sheet.issues.filter((issue) => issue.code === 'overMassLimit' || issue.code === 'overWidthLimit')).toEqual([])
    expect(SANDBOX.barT).toBeGreaterThan(PACT_LIMITS_GEN3.maxMassT)
  })

  it('has words for every limit', () => {
    for (const id of SANDBOX_LIMIT_IDS) expect(STRINGS.office.sandbox.limits[id].name.length).toBeGreaterThan(0)
  })

  it('is off until switched on, and remembers the switch and the limit', () => {
    expect(parseSandbox(null)).toEqual({ on: false, limit: SANDBOX.startLimit })
    expect(parseSandbox('on:none')).toEqual({ on: true, limit: 'none' })
    expect(parseSandbox('on:nonsense')).toEqual({ on: true, limit: SANDBOX.startLimit })
    expect(parseSandbox('rubbish')).toEqual({ on: false, limit: SANDBOX.startLimit })
    const kept = new Map<string, string>()
    const storage = { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => void kept.set(key, value) }
    expect(saveSandbox(storage, { on: true, limit: 'early' })).toBe(true)
    expect(SANDBOX_KEY.startsWith('hulldown.')).toBe(true)
    expect(loadSandbox(storage)).toEqual({ on: true, limit: 'early' })
  })

  it('does not throw when storage is blocked', () => {
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(loadSandbox(blocked)).toEqual({ on: false, limit: SANDBOX.startLimit })
    expect(saveSandbox(blocked, { on: true, limit: 'none' })).toBe(false)
  })
})
