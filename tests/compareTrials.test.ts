import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { compareTrials } from '../src/office/compareTrials'
import { runRangeJob } from '../src/sim/trials'
import type { VehicleSpec } from '../src/sim/vehicle'

function visit(change?: (spec: VehicleSpec) => void) {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return runRangeJob({ spec, limits: PACT_LIMITS_GEN1, setup: { seed: 101 } })
}

const base = visit()

describe('two visits to the range side by side', () => {
  it('finds nothing between a visit and itself', () => {
    const rows = compareTrials(base, visit())
    expect(rows.length).toBeGreaterThan(10)
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
    for (const row of rows) {
      expect(row.move, row.key).toBe('same')
      expect(row.verdict).toBeNull()
      expect(row.before).toBe(row.after)
      expect(row.label.length).toBeGreaterThan(0)
    }
  })

  it('opens with the count of tests passed', () => {
    const first = compareTrials(base, base)[0]!
    expect(first.key).toBe('passes')
    expect(first.after).toBe(`${base.passes} of ${base.tests}`)
  })

  it('calls fewer rounds through the armour better, and marks who met the mark', () => {
    const thin = visit((s) => { s.armour.upperGlacis = [{ material: 'rolledSteel', mm: 40 }] })
    const worse = compareTrials(base, thin).find((row) => row.key === 'armour')!
    expect(worse).toMatchObject({ move: 'up', verdict: 'worse', beforePassed: true, afterPassed: false })
    const better = compareTrials(thin, base).find((row) => row.key === 'armour')!
    expect(better).toMatchObject({ move: 'down', verdict: 'better', beforePassed: false, afterPassed: true })
    expect(compareTrials(base, thin)[0]!).toMatchObject({ key: 'passes', move: 'down', verdict: 'worse' })
  })

  it('does not call a number moved when it reads the same', () => {
    const light = visit((s) => { s.powerpack.fuelL -= 300 })
    for (const row of compareTrials(base, light)) {
      if (row.before === row.after) expect(row.move, row.key).toBe('same')
    }
  })
})
