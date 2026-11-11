// Technology generations: what a tender's year allows.
import { describe, expect, it } from 'vitest'
import { OWN_ROUNDS, THREATS } from '../src/data/ammo'
import { BASELINE_SPEC } from '../src/data/baseline'
import { ERA_TILE } from '../src/data/era'
import { GUNNERY } from '../src/data/gunnery'
import { MATERIALS } from '../src/data/materials'
import { ACCORD_LIMITS, BUREAU_IDS, THREAT_TANKS } from '../src/data/opponents'
import { ACTIVE, COMPUTERS, NIGHT_SIGHTS } from '../src/data/parts'
import { LATER_PARTS, TECH_FIELDS } from '../src/data/tech'
import { TENDERS } from '../src/data/tenders'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { draftRival, reviseRival } from '../src/sim/ai/designer'
import { buildStatSheet, testShot, tiledWorth, tileWorthMm, worthAgainst, type Limits, type VehicleSpec } from '../src/sim/vehicle'
import { available, generationOf, tooNew } from '../src/sim/vehicle/tech'
import { opponentsFor } from '../src/ui/duelWords'
import { slowFix } from '../src/ui/gunneryAdvice'

const GEN2: Limits = { ...PACT_LIMITS_GEN1, generation: 2 }

function build(change: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  change(spec)
  return spec
}

const late = (spec: VehicleSpec, limits: Limits) =>
  buildStatSheet(spec, limits).issues.filter((issue) => issue.code === 'notYetAvailable')

describe('technology generations', () => {
  it('lists only parts that exist', () => {
    const tables = {
      'fireControl.computer': COMPUTERS, 'fireControl.night': NIGHT_SIGHTS, material: MATERIALS,
      'ammo.kinetic': OWN_ROUNDS, 'ammo.shaped': OWN_ROUNDS, 'protection.active': ACTIVE,
    }
    for (const field of TECH_FIELDS) {
      for (const id of Object.keys(LATER_PARTS[field])) expect(Object.keys(tables[field])).toContain(id)
    }
  })

  it('puts everything else in generation one', () => {
    expect(generationOf('fireControl.night', 'imageIntensifier')).toBe(1)
    expect(generationOf('fireControl.night', 'thermal')).toBe(2)
    expect(available('material', 'layeredComposite', 1)).toBe(false)
    expect(available('material', 'layeredComposite', 2)).toBe(true)
    expect(available('material', 'compositeInsert', 1)).toBe(true)
  })

  it('finds nothing too new in the baseline', () => {
    expect(tooNew(BASELINE_SPEC, 1)).toEqual([])
    expect(late(BASELINE_SPEC, PACT_LIMITS_GEN1)).toEqual([])
  })

  it('will not build a later part for an early tender', () => {
    const spec = build((s) => {
      s.fireControl.night = 'thermal'
      s.fireControl.computer = 'digital'
    })
    const issues = late(spec, PACT_LIMITS_GEN1)
    expect(issues.map((issue) => issue.part).sort()).toEqual(['fireControl.computer', 'fireControl.night'])
    expect(issues.every((issue) => issue.severity === 'error' && issue.value === 2 && issue.limit === 1)).toBe(true)
    expect(late(spec, GEN2)).toEqual([])
  })

  it('names the zone a later material is in, once', () => {
    const spec = build((s) => {
      s.armour.upperGlacis = [
        { material: 'rolledSteel', mm: 40 }, { material: 'layeredComposite', mm: 60 },
        { material: 'layeredComposite', mm: 40 }, { material: 'rolledSteel', mm: 40 },
      ]
    })
    expect(late(spec, PACT_LIMITS_GEN1).map((issue) => issue.part)).toEqual(['armour.upperGlacis'])
    expect(late(spec, GEN2)).toEqual([])
  })

  it('makes the later parts better, and dearer', () => {
    expect(GUNNERY.nightSights.thermal.seeM).toBeGreaterThan(GUNNERY.nightSights.imageIntensifier.seeM)
    expect(NIGHT_SIGHTS.thermal.costKr).toBeGreaterThan(NIGHT_SIGHTS.imageIntensifier.costKr)
    expect(GUNNERY.computers.digital.uncorrected).toBeLessThan(GUNNERY.computers.electronic.uncorrected)
    expect(COMPUTERS.digital.costKr).toBeGreaterThan(COMPUTERS.electronic.costKr)
    expect(MATERIALS.layeredComposite.ke).toBeGreaterThan(MATERIALS.compositeInsert.ke)
    expect(MATERIALS.layeredComposite.ce).toBeGreaterThan(MATERIALS.compositeInsert.ce)
    expect(MATERIALS.layeredComposite.costPerTKr).toBeGreaterThan(MATERIALS.compositeInsert.costPerTKr)
  })

  it('keeps the rival bureaus to what the tender allows', () => {
    const limits = TENDERS.improvedType1.limits
    for (const bureau of BUREAU_IDS) {
      let draft = draftRival(bureau, limits, 7)
      for (let i = 0; i < 6; i++) {
        expect(tooNew(draft.spec, 1)).toEqual([])
        const next = reviseRival(draft, bureau, limits, ['night', 'onTheMove', 'halted'])
        if (!next) break
        draft = next
      }
      expect(tooNew(draft.spec, 1)).toEqual([])
    }
  })

  it('lets a rival reach for a thermal sight once the tender allows it', () => {
    const limits = { ...TENDERS.improvedType1.limits, generation: 2 as const }
    let draft = draftRival('firepower', limits, 7)
    for (let i = 0; i < 4; i++) draft = reviseRival(draft, 'firepower', limits, ['night']) ?? draft
    expect(draft.spec.fireControl.night).toBe('thermal')
  })

  it('does not send the player to a computer the tender cannot have', () => {
    const spec = build((s) => {
      s.fireControl.rangefinder = 'laser'
      s.fireControl.commanderSight = true
      s.fireControl.computer = 'electronic'
    })
    expect(slowFix(buildStatSheet(spec, PACT_LIMITS_GEN1), spec)).toBe('crew.comfort')
    expect(slowFix(buildStatSheet(spec, GEN2), spec, 2)).toBe('fireControl.computer')
  })
})

describe('generation two threats', () => {
  it('lets a tandem warhead through a tile that stops a plain one', () => {
    const side = buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1).protection.hullSideFront
    const plain = tiledWorth(side, THREATS.infantryRocket)
    const tandem = tiledWorth(side, THREATS.tandemRocket)
    expect(plain - worthAgainst(side, 'shaped')).toBe(ERA_TILE.ceMm)
    expect(tandem - worthAgainst(side, 'shaped')).toBeCloseTo(ERA_TILE.ceMm * ERA_TILE.tandemShare)
    expect(tileWorthMm(THREATS.accord120LongRod)).toBe(ERA_TILE.keMm)
  })

  it('counts the tile the same way shot by shot', () => {
    const layers = [{ material: 'rolledSteel' as const, mm: 150 }]
    const shot = (threat: 'infantryRocket' | 'tandemRocket') =>
      testShot(layers, 0, { round: { ...THREATS[threat], penMm: 350 }, rangeM: 200, angleDeg: 0, tile: true })
    expect(shot('infantryRocket').verdict).toBe('holds')
    expect(shot('tandemRocket').verdict).toBe('fails')
  })

  it('makes the new rounds worse to meet than the old', () => {
    expect(THREATS.accord120LongRod.penMm).toBeGreaterThan(THREATS.accord120Sabot.penMm)
    expect(THREATS.tandemMissile.penMm).toBeGreaterThan(THREATS.guidedMissile.penMm)
    expect(THREATS.tandemRocket.penMm).toBeGreaterThan(THREATS.infantryRocket.penMm)
  })

  it('shows a tender only the Accord tanks of its own time', () => {
    const ids = (limits: Limits) => opponentsFor(limits, 1).filter((o) => o.kind === 'threat').map((o) => o.id)
    expect(ids(PACT_LIMITS_GEN1)).toEqual(['warden', 'palisade'])
    expect(ids(GEN2)).toEqual(['warden', 'palisade', 'palisadeB'])
    for (const tender of Object.values(TENDERS)) {
      for (const threat of tender.threats) expect(THREAT_TANKS[threat].generation).toBeLessThanOrEqual(tender.limits.generation ?? 1)
    }
  })

  it('makes the Palisade B harder all round than the Palisade', () => {
    const a = buildStatSheet(THREAT_TANKS.palisade.spec, ACCORD_LIMITS)
    const b = buildStatSheet(THREAT_TANKS.palisadeB.spec, ACCORD_LIMITS)
    expect(b.protection.turretFrontLeft.keMm).toBeGreaterThan(a.protection.turretFrontLeft.keMm)
    expect(b.protection.upperGlacis.ceMm).toBeGreaterThan(a.protection.upperGlacis.ceMm)
    expect(THREATS[THREAT_TANKS.palisadeB.rounds[0]!].penMm).toBeGreaterThan(THREATS[THREAT_TANKS.palisade.rounds[0]!].penMm)
  })
})
