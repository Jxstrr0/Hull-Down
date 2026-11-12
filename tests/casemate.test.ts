import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { TURRETS, type TurretId } from '../src/data/parts'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { SANDBOX_LIMIT_IDS } from '../src/data/sandbox'
import { CONTROLS } from '../src/office/controls'
import { fireOf } from '../src/sim/gunnery/fire'
import { sandboxLimits } from '../src/sim/vehicle/sandbox'
import { buildStatSheet, gunRingMm, type Limits, type VehicleSpec } from '../src/sim/vehicle'

function spec(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const out = structuredClone(BASELINE_SPEC)
  change?.(out)
  return out
}

const casemate = (s: VehicleSpec): void => {
  s.turret.shape = 'casemate'
}

const codes = (s: VehicleSpec, limits: Limits = PACT_LIMITS_GEN1): string[] => buildStatSheet(s, limits).issues.map((issue) => issue.code)

describe('the casemate', () => {
  it('is a turret option with a name, a note and a reason it may be refused', () => {
    const control = CONTROLS.find((each) => each.id === 'turret.shape')
    expect(control?.kind === 'choice' && control.options.includes('casemate')).toBe(true)
    expect(STRINGS.parts.turrets.casemate.name).not.toBe('')
    expect(STRINGS.issues.casemateNotAllowed).not.toBe('')
  })

  it('is the only shape whose gun swings only a little, and every turret turns all the way round', () => {
    for (const id of Object.keys(TURRETS) as TurretId[]) {
      if (id === 'casemate') expect(TURRETS[id].swingDeg).toBeGreaterThan(0)
      else expect(TURRETS[id].swingDeg).toBeNull()
    }
  })

  it('is refused on a tender for a tank, and allowed on one for a tank destroyer', () => {
    expect(codes(spec(casemate))).toContain('casemateNotAllowed')
    expect(codes(spec(casemate), { ...PACT_LIMITS_GEN1, casemate: true })).not.toContain('casemateNotAllowed')
    expect(codes(spec(), { ...PACT_LIMITS_GEN1, casemate: true })).not.toContain('casemateNotAllowed')
  })

  it('is allowed in the sandbox, whatever the weight limit', () => {
    for (const id of SANDBOX_LIMIT_IDS) expect(sandboxLimits(id).casemate).toBe(true)
  })

  it('takes a big gun on a smaller ring, still on the ring step', () => {
    const turret = gunRingMm(spec())
    const box = gunRingMm(spec(casemate))
    expect(box).toBeLessThan(turret)
    expect(box % 50).toBe(0)
  })

  it('is lighter and cheaper than the turret it replaces, each on the smallest ring its gun allows', () => {
    const limits = { ...PACT_LIMITS_GEN1, casemate: true }
    const smallest = (change?: (s: VehicleSpec) => void): VehicleSpec =>
      spec((s) => {
        change?.(s)
        s.loading = 'loader'
        s.turret.ringMm = gunRingMm(s)
      })
    const turret = buildStatSheet(smallest(), limits)
    const box = buildStatSheet(smallest(casemate), limits)
    expect(box.issues.filter((issue) => issue.severity === 'error')).toEqual([])
    expect(box.massT).toBeLessThan(turret.massT)
    expect(box.unitCostKr).toBeLessThan(turret.unitCostKr)
  })

  it('is slower to lay the gun on each new target, since the whole tank turns', () => {
    const turret = fireOf(spec()).times.layS
    const box = fireOf(spec(casemate)).times.layS
    expect(box).toBeCloseTo(turret * TURRETS.casemate.layPace)
    expect(box).toBeGreaterThan(turret)
  })
})
