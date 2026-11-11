import { describe, expect, it } from 'vitest'
import { ADVISOR, ADVISOR_MODES } from '../src/data/advisor'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BUREAU_IDS } from '../src/data/opponents'
import { TENDERS } from '../src/data/tenders'
import { CONTROLS } from '../src/office/controls'
import { ZONES } from '../src/data/materials'
import { designRival } from '../src/sim/ai/designer'
import { briefing, review, REMARK_KINDS, type Remark } from '../src/sim/career/advisor'
import { trialBid } from '../src/sim/career/score'
import type { VehicleSpec } from '../src/sim/vehicle/spec'

const T = TENDERS.improvedType1

function tank(change: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  change(spec)
  return spec
}
const kinds = (remarks: Remark[]): string[] => remarks.map((remark) => remark.kind)
const PARTS = new Set<string>([...CONTROLS.map((control) => control.id), ...ZONES.map((zone) => `armour.${zone}`), ''])

describe('the chief engineer', () => {
  it('defaults to looking over every change, and can be turned down or off', () => {
    expect(ADVISOR_MODES).toEqual(['off', 'ask', 'always'])
    expect(ADVISOR.defaultMode).toBe('always')
  })

  it('tells the Type 1 as issued one thing: it will fail the night shoot', () => {
    const remarks = review(BASELINE_SPEC, T)
    expect(kinds(remarks)).toEqual(['shoot'])
    expect(remarks[0]).toMatchObject({ test: 'night', part: 'fireControl.night', limit: T.marks.hits.night })
    expect(remarks[0]!.value).toBeLessThan(T.marks.hits.night)
  })

  it('has nothing to say once that is put right', () => {
    expect(review(tank((spec) => { spec.fireControl.night = 'imageIntensifier' }), T)).toEqual([])
  })

  it('says the same thing every time', () => {
    const spec = designRival('light', T.limits, 101)
    expect(review(spec, T)).toEqual(review(spec, T))
  })

  it('puts what cannot be built first', () => {
    const remarks = review(tank((spec) => { spec.turret.ringMm = 1500 }), T)
    expect(remarks[0]!.kind).toBe('fault')
    expect(remarks[0]!.issue!.severity).toBe('error')
    expect(remarks[0]!.part).toBe('turret.ringMm')
  })

  it('names a plate that will not hold at the armour trial, once, with the round that beats it', () => {
    const remarks = review(tank((spec) => { spec.armour.upperGlacis = [{ material: 'rolledSteel', mm: 60 }] }), T)
    const plates = remarks.filter((remark) => remark.kind === 'plate')
    expect(plates).toHaveLength(1)
    expect(plates[0]).toMatchObject({ part: 'armour.upperGlacis', zone: 'upperGlacis' })
    expect(plates[0]!.value).toBeLessThan(plates[0]!.limit!)
    expect(['accord105Sabot', 'accord105Shaped']).toContain(plates[0]!.threat)
  })

  it('agrees with the armour trial about the plates', () => {
    for (const bureau of BUREAU_IDS) {
      const spec = designRival(bureau, T.limits, 101)
      const said = new Set(review(spec, T).filter((remark) => remark.kind === 'plate').map((remark) => remark.zone))
      const failed = new Set<string>()
      for (const seed of [1, 2, 3]) for (const zone of trialBid(spec, T, seed).range.armour.failed) failed.add(zone)
      // A plate he passes on paper may still be holed off its middle; one he fails should fail somewhere.
      for (const zone of said) expect(failed.has(zone!)).toBe(true)
    }
  })

  it('points at the engine for a slow tank and the hull for a short one', () => {
    const slow = review(tank((spec) => { spec.powerpack.engine = 'diesel580' }), T)
    expect(slow.find((remark) => remark.kind === 'sprint' || remark.kind === 'top')?.part).toBe('powerpack.engine')
    const short = review(designRival('light', T.limits, 102), T)
    const trench = short.find((remark) => remark.kind === 'obstacle' && remark.obstacle === 'trench')
    if (trench) expect(trench.part).toBe('hull.size')
  })

  it('points at the next part to better, not one already the best', () => {
    const remarks = review(tank((spec) => {
      spec.fireControl.stabiliser = 'none'
      spec.fireControl.night = 'imageIntensifier'
    }), T)
    expect(remarks.find((remark) => remark.test === 'onTheMove')?.part).toBe('fireControl.stabiliser')
  })

  it('warns of a dear tank before it is over the ceiling, and of a fault once it is', () => {
    const near = { ...T, limits: { ...T.limits, maxUnitCostKr: 2_200_000 } }
    expect(kinds(review(BASELINE_SPEC, near))).toContain('cost')
    const over = { ...T, limits: { ...T.limits, maxUnitCostKr: 2_000_000 } }
    expect(kinds(review(BASELINE_SPEC, over))).toContain('fault')
    expect(kinds(review(BASELINE_SPEC, over))).not.toContain('cost')
  })

  it('only ever points at a control or a plate the design office has', () => {
    const specs = [BASELINE_SPEC, ...[101, 102, 103, 104].flatMap((seed) => BUREAU_IDS.map((bureau) => designRival(bureau, T.limits, seed)))]
    for (const spec of specs) {
      for (const remark of review(spec, T)) {
        expect(REMARK_KINDS).toContain(remark.kind)
        expect(PARTS.has(remark.part), remark.part).toBe(true)
      }
    }
  })

  it('says the worst few at once and counts the rest', () => {
    const mess = tank((spec) => {
      spec.fireControl = { sight: 'daySight', rangefinder: 'stadiametric', stabiliser: 'none', computer: 'none', night: 'none', commanderSight: false }
      spec.powerpack.engine = 'diesel580'
      for (const zone of ['upperGlacis', 'turretFrontLeft', 'turretFrontRight', 'hullSideFront', 'turretSides'] as const) {
        spec.armour[zone] = [{ material: 'rolledSteel', mm: 20 }]
      }
    })
    const all = review(mess, T)
    expect(all.length).toBeGreaterThan(ADVISOR.remarks)
    const brief = briefing(mess, T)
    expect(brief.remarks).toEqual(all.slice(0, ADVISOR.remarks))
    expect(brief.more).toBe(all.length - ADVISOR.remarks)
    expect(briefing(BASELINE_SPEC, T).more).toBe(0)
  })

  it('is quick enough to run after every change', () => {
    const started = performance.now()
    for (let i = 0; i < 10; i++) review(BASELINE_SPEC, T)
    expect((performance.now() - started) / 10).toBeLessThan(100)
  })
})

describe('the chief engineer\'s words', () => {
  it('says one clean sentence for every remark, and names a part where there is one', async () => {
    const { remarkLink, remarkPart, remarkText } = await import('../src/ui/advisorWords')
    const { STRINGS } = await import('../src/data/strings')
    const mess = tank((spec) => {
      spec.fireControl = { sight: 'daySight', rangefinder: 'stadiametric', stabiliser: 'none', computer: 'none', night: 'none', commanderSight: false }
      spec.powerpack.engine = 'diesel580'
      spec.turret.ringMm = 1500
      spec.armour.upperGlacis = [{ material: 'rolledSteel', mm: 20 }]
    })
    const near = { ...T, limits: { ...T.limits, maxUnitCostKr: 2_200_000 } }
    const remarks = [
      ...review(mess, T), ...review(BASELINE_SPEC, T), ...review(BASELINE_SPEC, near),
      ...[101, 102, 103].flatMap((seed) => BUREAU_IDS.flatMap((bureau) => review(designRival(bureau, T.limits, seed), T))),
    ]
    expect(new Set(kinds(remarks)).size).toBeGreaterThanOrEqual(6)
    for (const remark of remarks) {
      const text = remarkText(remark)
      expect(text, remark.kind).not.toBe('')
      expect(text, text).not.toMatch(/[{}]|undefined|NaN/)
      expect(text.endsWith('.')).toBe(true)
      if (remark.part) {
        expect(remarkPart(remark), remark.part).not.toBeNull()
        expect(remarkLink(remark)).toBe(`Look at: ${remarkPart(remark)}`)
      } else {
        expect(remarkLink(remark)).toBeNull()
      }
    }
    expect(remarkText(review(BASELINE_SPEC, T)[0]!)).toBe('It will fail the night shoot: about 3 targets hit where the tender asks 4.')
    expect(STRINGS.advisor.name).not.toBe('')
  })
})
