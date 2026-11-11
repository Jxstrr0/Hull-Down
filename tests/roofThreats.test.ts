// Generation three: what drones and top-attack missiles do to a roof.
import { describe, expect, it } from 'vitest'
import { THREATS } from '../src/data/ammo'
import { BASELINE_SPEC } from '../src/data/baseline'
import { MARKS_GEN2, MARKS_GEN3 } from '../src/data/range'
import { STRINGS } from '../src/data/strings'
import { TENDERS } from '../src/data/tenders'
import { runProvingGround } from '../src/sim/trials'
import { allTiles, buildStatSheet, type VehicleSpec } from '../src/sim/vehicle'

const T = TENDERS.tank2016
const SEEDS = [1, 2, 3, 4]

/** The serials fired at the roofs, in the order the range fires them. */
function roofSerials(spec: VehicleSpec, seed: number) {
  const report = runProvingGround(buildStatSheet(spec, T.limits), { seed, marks: MARKS_GEN3 })
  return { report, roof: report.armour.serials.slice(MARKS_GEN2.armour.length) }
}

function withRoof(change: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  change(spec)
  return spec
}

const SANDWICH = [
  { material: 'rolledSteel', mm: 10 }, { material: 'layeredComposite', mm: 40 }, { material: 'rolledSteel', mm: 10 },
] as const

const composite = withRoof((spec) => {
  spec.armour.hullRoof = SANDWICH.map((layer) => ({ ...layer }))
  spec.armour.turretRoof = SANDWICH.map((layer) => ({ ...layer }))
})

describe('the marks of generation three', () => {
  it('are those of 2001 with three roof serials added', () => {
    expect(MARKS_GEN3.armour.slice(0, MARKS_GEN2.armour.length)).toEqual(MARKS_GEN2.armour)
    const added = MARKS_GEN3.armour.slice(MARKS_GEN2.armour.length)
    expect(added.map((serial) => `${serial.zone}:${serial.threat}:${serial.gate}`)).toEqual([
      'turretRoof:droneBomblet:true', 'hullRoof:droneBomblet:true', 'turretRoof:topAttackMissile:false',
    ])
    expect(T.marks).toBe(MARKS_GEN3)
    expect(TENDERS.tank2001.marks).toBe(MARKS_GEN2)
  })

  it('name both new threats, and the brief says what the range will do', () => {
    for (const id of ['droneBomblet', 'topAttackMissile'] as const) {
      expect(THREATS[id].kind).toBe('shaped')
      expect(STRINGS.threats[id].name).not.toBe('')
      expect(STRINGS.threats[id].note).not.toBe('')
    }
    expect(THREATS.droneBomblet.penMm).toBeLessThan(THREATS.topAttackMissile.penMm)
    expect(STRINGS.tenders.tank2016.brief).toContain('roof')
  })
})

describe('a roof under the drone', () => {
  it('lets every bomblet through the roof the Type 1 came with', () => {
    for (const seed of SEEDS) {
      const { report, roof } = roofSerials(BASELINE_SPEC, seed)
      expect(roof.map((serial) => serial.held)).toEqual([false, false, false])
      expect(report.armour.failed).toContain('turretRoof')
      expect(report.armour.failed).toContain('hullRoof')
    }
  })

  it('holds with a composite sandwich, inside the bridge class', () => {
    const sheet = buildStatSheet(composite, T.limits)
    expect(sheet.massT).toBeLessThan(T.limits.maxMassT)
    expect(sheet.massT).toBeGreaterThan(buildStatSheet(BASELINE_SPEC, T.limits).massT + 1)
    for (const seed of SEEDS) {
      const { report, roof } = roofSerials(composite, seed)
      expect(roof[0]?.held).toBe(true)
      expect(roof[1]?.held).toBe(true)
      expect(report.armour.failed).not.toContain('turretRoof')
      expect(report.armour.failed).not.toContain('hullRoof')
    }
  })

  it('is not saved by tiles alone: hatches and grilles stay bare', () => {
    const tiled = withRoof((spec) => {
      spec.era.hullRoof = allTiles('hullRoof')
      spec.era.turretRoof = allTiles('turretRoof')
    })
    const through = SEEDS.reduce((sum, seed) => {
      const { roof } = roofSerials(tiled, seed)
      return sum + (roof[0]?.through ?? 0) + (roof[1]?.through ?? 0)
    }, 0)
    const bare = SEEDS.reduce((sum, seed) => {
      const { roof } = roofSerials(BASELINE_SPEC, seed)
      return sum + (roof[0]?.through ?? 0) + (roof[1]?.through ?? 0)
    }, 0)
    expect(through).toBeGreaterThan(0)
    expect(through).toBeLessThan(bare)
  })
})

describe('a roof under the top-attack missile', () => {
  it('goes through any plate a tank can carry, and is not held against the design', () => {
    for (const seed of SEEDS) {
      const { roof } = roofSerials(composite, seed)
      expect(roof[2]?.gate).toBe(false)
      expect(roof[2]?.through).toBe(3)
    }
  })

  it('is stopped where a tile sits over a good plate', () => {
    const both = structuredClone(composite)
    both.era.turretRoof = allTiles('turretRoof')
    const through = SEEDS.reduce((sum, seed) => sum + (roofSerials(both, seed).roof[2]?.through ?? 0), 0)
    expect(through).toBeLessThan(SEEDS.length * 3)
  })
})
