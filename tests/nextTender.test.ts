// Moving the career on from one tender to the next.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BUREAU_IDS } from '../src/data/opponents'
import { MARKS_GEN2 } from '../src/data/range'
import { TENDER_IDS, TENDERS } from '../src/data/tenders'
import { cleanCareer } from '../src/persist/careerCodec'
import {
  buildBlock, buildPrototype, enterTender, newCareer, nextTender, tenderIdOf, tenderOf, tendersLeft, trialSeed, upgradeLimits,
} from '../src/sim/career/career'
import { rivalBid } from '../src/sim/career/rival'
import { buildStatSheet, type VehicleSpec } from '../src/sim/vehicle'

const SLOW = 60_000

function tank(change: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  change(spec)
  return spec
}
const NIGHT = tank((spec) => { spec.fireControl.night = 'imageIntensifier' })
const THERMAL = tank((spec) => { spec.fireControl.night = 'thermal' })

describe('the tender of 2001', () => {
  const T = TENDERS.tank2001

  it('comes after the first, twenty years on, with generation two allowed', () => {
    expect(TENDER_IDS).toEqual(['improvedType1', 'tank2001'])
    expect(T.year).toBe(2001)
    expect(T.limits.generation).toBe(2)
    expect(T.marks).toBe(MARKS_GEN2)
    expect(T.threats).toContain('palisadeB')
  })

  it('lets every rival bureau put in a legal bid', () => {
    for (const bureau of BUREAU_IDS) expect(rivalBid(bureau, T, 5).score.legal, bureau).toBe(true)
  }, SLOW)

  it('takes a thermal sight the first tender would not', () => {
    const late = (limits: typeof T.limits) => buildStatSheet(THERMAL, limits).issues.filter((issue) => issue.code === 'notYetAvailable')
    expect(late(TENDERS.improvedType1.limits)).toHaveLength(1)
    expect(late(T.limits)).toEqual([])
  })
})

describe('going on to the next tender', () => {
  const start = newCareer(7)
  const decided = enterTender(buildPrototype(start, NIGHT), 1)

  it('waits for the army to decide', () => {
    expect(() => nextTender(start)).toThrow()
    expect(tendersLeft(start)).toBe(true)
  })

  it('opens the next tender with the grant added to what is left', () => {
    const next = nextTender(decided)
    expect(tenderIdOf(next)).toBe('tank2001')
    expect(next.budgetKr).toBe(decided.budgetKr + TENDERS.tank2001.grantKr)
    expect(next.prototypes).toEqual([])
    expect(next.outcome).toBeNull()
    expect(next.reputation).toEqual(decided.reputation)
    expect(next.adopted).toEqual(decided.adopted)
    expect(trialSeed(next)).not.toBe(trialSeed(decided))
    // The career handed in is left as it was.
    expect(decided.tenderNo).toBe(0)
    expect(decided.outcome).not.toBeNull()
  }, SLOW)

  it('stops at the last tender', () => {
    const next = nextTender(decided)
    expect(tendersLeft(next)).toBe(false)
    const done = enterTender(buildPrototype(next, THERMAL), 1)
    expect(() => nextTender(done)).toThrow()
  }, SLOW)

  it('builds a generation-two prototype only once the tender allows it', () => {
    expect(buildBlock(start, THERMAL)).toBe('illegal')
    expect(buildBlock(nextTender(decided), THERMAL)).toBeNull()
  }, SLOW)

  it('survives a save and a load', () => {
    const next = buildPrototype(nextTender(decided), THERMAL)
    const back = cleanCareer(JSON.parse(JSON.stringify(next)))
    expect(back).toEqual(next)
    expect(back && tenderOf(back)).toBe(TENDERS.tank2001)
  }, SLOW)

  it('lets a tank in service take today\'s technology in a package, inside its own limits', () => {
    const next = nextTender(decided)
    const tank = { tender: 'improvedType1' } as Parameters<typeof upgradeLimits>[1]
    expect(upgradeLimits(decided, tank).generation ?? 1).toBe(1)
    expect(upgradeLimits(next, tank).generation).toBe(2)
    expect(upgradeLimits(next, tank).maxUnitCostKr).toBe(TENDERS.improvedType1.limits.maxUnitCostKr)
  }, SLOW)
})
