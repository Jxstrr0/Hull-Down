import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { SECTION } from '../src/data/drawing'
import { MATERIALS, MATERIAL_IDS, ZONES, ZONE_FACING } from '../src/data/materials'
import { TURRETS } from '../src/data/parts'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1, TUNING } from '../src/data/tuning'
import {
  addLayer, canAddLayer, layerCost, layerRange, removeLayer, sectionOf, setLayerMaterial, setLayerMm,
} from '../src/office/armour'
import { cleanSpec } from '../src/persist/specCodec'
import { buildStatSheet, pathFactor, stackProtection, type VehicleSpec } from '../src/sim/vehicle'

function baseline(): VehicleSpec {
  return structuredClone(BASELINE_SPEC)
}

function sheetOf(spec: VehicleSpec) {
  return buildStatSheet(spec, PACT_LIMITS_GEN1)
}

function codes(spec: VehicleSpec): string[] {
  return sheetOf(spec).issues.map((issue) => `${issue.code}@${issue.part}`)
}

describe('materials and zones', () => {
  it('has text for every material and zone', () => {
    for (const id of MATERIAL_IDS) expect(STRINGS.materials[id].name).toBeTruthy()
    for (const zone of ZONES) {
      expect(STRINGS.zones[zone].name).toBeTruthy()
      expect(STRINGS.office.armour.from[ZONE_FACING[zone]]).toBeTruthy()
    }
  })

  it('keeps every material inside the overall layer limits', () => {
    for (const id of MATERIAL_IDS) {
      const range = layerRange(id)
      expect(range.min).toBe(TUNING.limits.minLayerMm)
      expect(range.max).toBeLessThanOrEqual(TUNING.limits.maxLayerMm)
      expect(range.max % range.step).toBe(0)
    }
  })

  it('gives each material its own strength', () => {
    expect(MATERIALS.highHardSteel.ke).toBeGreaterThan(MATERIALS.rolledSteel.ke)
    expect(MATERIALS.compositeInsert.ce).toBeGreaterThan(MATERIALS.compositeInsert.ke)
    // A composite insert stops more for its weight than plain plate does.
    expect(MATERIALS.compositeInsert.ke / MATERIALS.compositeInsert.densityTM3)
      .toBeGreaterThan(MATERIALS.rolledSteel.ke / MATERIALS.rolledSteel.densityTM3)
    expect(MATERIALS.airGap.ke).toBe(0)
  })
})

describe('what a stack stops', () => {
  it('is worth its own thickness for plain plate square to the shot', () => {
    const value = stackProtection([{ material: 'rolledSteel', mm: 100 }], 0)
    expect(value.keMm).toBeCloseTo(100, 9)
    expect(value.ceMm).toBeCloseTo(100, 9)
    expect(value.pathMm).toBeCloseTo(100, 9)
  })

  it('doubles at sixty degrees of slope', () => {
    expect(pathFactor(60)).toBeCloseTo(2, 6)
    const value = stackProtection([{ material: 'rolledSteel', mm: 100 }], 60)
    expect(value.keMm).toBeCloseTo(200, 4)
    expect(value.plateMm).toBe(100)
  })

  it('adds the layers up, each by its material', () => {
    const value = stackProtection([
      { material: 'rolledSteel', mm: 50 },
      { material: 'compositeInsert', mm: 100 },
      { material: 'airGap', mm: 100 },
      { material: 'highHardSteel', mm: 20 },
    ], 0)
    expect(value.plateMm).toBe(270)
    expect(value.keMm).toBeCloseTo(50 + 70 + 0 + 26, 9)
    expect(value.ceMm).toBeCloseTo(50 + 130 + 20 + 20, 9)
  })

  it('is nothing for no armour', () => {
    expect(stackProtection([], 68)).toMatchObject({ plateMm: 0, keMm: 0, ceMm: 0 })
  })
})

describe('protection on the stat sheet', () => {
  it('quotes every zone', () => {
    const sheet = sheetOf(baseline())
    for (const zone of ZONES) {
      expect(sheet.protection[zone].keMm).toBeGreaterThan(0)
      expect(sheet.protection[zone].slopeDeg).toBe(sheet.geometry.zoneSlopeDeg[zone])
    }
    // The composite glacis is better against shaped charges than kinetic rounds.
    expect(sheet.protection.upperGlacis.ceMm).toBeGreaterThan(sheet.protection.upperGlacis.keMm)
  })

  it('changes when a layer changes', () => {
    const spec = baseline()
    const before = sheetOf(spec)
    setLayerMm(spec, 'upperGlacis', 0, 100)
    const after = sheetOf(spec)
    expect(after.protection.upperGlacis.keMm).toBeGreaterThan(before.protection.upperGlacis.keMm)
    expect(after.massT).toBeGreaterThan(before.massT)
    expect(after.protection.lowerGlacis).toEqual(before.protection.lowerGlacis)
  })

  it('changes with the glacis angle: more slope stops more and weighs more', () => {
    const spec = baseline()
    const before = sheetOf(spec)
    spec.hull.glacisAngleDeg = 72
    const after = sheetOf(spec)
    expect(after.protection.upperGlacis.keMm).toBeGreaterThan(before.protection.upperGlacis.keMm)
    expect(after.rollup.zoneMassT.upperGlacis).toBeGreaterThan(before.rollup.zoneMassT.upperGlacis)
  })

  it('makes a sloped turret front pay for its slope in plate', () => {
    const spec = baseline()
    const dome = sheetOf(spec)
    spec.turret.shape = 'weldedWedge'
    const wedge = sheetOf(spec)
    expect(TURRETS.weldedWedge.frontSlopeDeg).toBeGreaterThan(TURRETS.castDome.frontSlopeDeg)
    expect(wedge.protection.turretFrontLeft.keMm).toBeGreaterThan(dome.protection.turretFrontLeft.keMm)
    expect(wedge.rollup.zoneMassT.turretFrontLeft).toBeGreaterThan(dome.rollup.zoneMassT.turretFrontLeft)
  })
})

describe('armour faults', () => {
  it('finds none on the baseline', () => {
    expect(sheetOf(baseline()).issues).toEqual([])
  })

  it('wants a plate on both sides of an insert or a gap', () => {
    const spec = baseline()
    spec.armour.hullRear = [{ material: 'compositeInsert', mm: 50 }, { material: 'rolledSteel', mm: 20 }]
    expect(codes(spec)).toContain('layerNeedsPlates@armour.hullRear')
    spec.armour.hullRear = [{ material: 'rolledSteel', mm: 20 }, { material: 'airGap', mm: 50 }]
    expect(codes(spec)).toContain('layerNeedsPlates@armour.hullRear')
    spec.armour.hullRear = [
      { material: 'rolledSteel', mm: 20 }, { material: 'airGap', mm: 50 },
      { material: 'compositeInsert', mm: 50 }, { material: 'rolledSteel', mm: 20 },
    ]
    expect(codes(spec)).toContain('layerNeedsPlates@armour.hullRear')
    spec.armour.hullRear = [
      { material: 'rolledSteel', mm: 20 }, { material: 'airGap', mm: 50 }, { material: 'rolledSteel', mm: 20 },
    ]
    expect(codes(spec)).not.toContain('layerNeedsPlates@armour.hullRear')
  })

  it('will not make a layer thicker than its material allows', () => {
    const spec = baseline()
    spec.armour.hullRear = [{ material: 'highHardSteel', mm: 100 }]
    const issue = sheetOf(spec).issues.find((item) => item.code === 'layerThicknessOutOfRange')
    expect(issue).toMatchObject({ part: 'armour.hullRear', value: 100, limit: MATERIALS.highHardSteel.maxMm })
  })

  it('warns about a zone with no armour', () => {
    const spec = baseline()
    spec.armour.belly = []
    const issue = sheetOf(spec).issues.find((item) => item.code === 'zoneUnarmoured')
    expect(issue).toMatchObject({ part: 'armour.belly', severity: 'warning' })
  })

  it('pulls a saved layer back to what its material allows', () => {
    const raw = baseline()
    raw.armour.hullRear = [{ material: 'highHardSteel', mm: 400 }, { material: 'rolledSteel', mm: 1 }]
    expect(cleanSpec(raw).armour.hullRear).toEqual([
      { material: 'highHardSteel', mm: MATERIALS.highHardSteel.maxMm },
      { material: 'rolledSteel', mm: TUNING.limits.minLayerMm },
    ])
  })
})

describe('editing a zone', () => {
  it('adds a steel plate on the inside until the zone is full', () => {
    const spec = baseline()
    spec.armour.hullRear = []
    for (let i = 0; i < TUNING.limits.maxLayersPerZone; i++) {
      expect(canAddLayer(spec, 'hullRear')).toBe(true)
      addLayer(spec, 'hullRear')
    }
    expect(canAddLayer(spec, 'hullRear')).toBe(false)
    addLayer(spec, 'hullRear')
    expect(spec.armour.hullRear).toHaveLength(TUNING.limits.maxLayersPerZone)
    expect(spec.armour.hullRear[0]).toEqual({ material: 'rolledSteel', mm: TUNING.limits.newLayerMm })
  })

  it('removes the layer asked for and ignores one that is not there', () => {
    const spec = baseline()
    removeLayer(spec, 'upperGlacis', 1)
    expect(spec.armour.upperGlacis.map((layer) => layer.mm)).toEqual([60, 20])
    removeLayer(spec, 'upperGlacis', 9)
    removeLayer(spec, 'upperGlacis', -1)
    expect(spec.armour.upperGlacis).toHaveLength(2)
  })

  it('snaps thickness to the step and keeps it in range', () => {
    const spec = baseline()
    setLayerMm(spec, 'lowerGlacis', 0, 83)
    expect(spec.armour.lowerGlacis[0]?.mm).toBe(85)
    setLayerMm(spec, 'lowerGlacis', 0, 99999)
    expect(spec.armour.lowerGlacis[0]?.mm).toBe(MATERIALS.rolledSteel.maxMm)
    setLayerMm(spec, 'lowerGlacis', 0, -4)
    expect(spec.armour.lowerGlacis[0]?.mm).toBe(TUNING.limits.minLayerMm)
    setLayerMm(spec, 'lowerGlacis', 0, Number.NaN)
    expect(spec.armour.lowerGlacis[0]?.mm).toBe(TUNING.limits.minLayerMm)
  })

  it('changes material and pulls the thickness into the new range', () => {
    const spec = baseline()
    setLayerMaterial(spec, 'turretFrontLeft', 0, 'highHardSteel')
    expect(spec.armour.turretFrontLeft[0]).toEqual({ material: 'highHardSteel', mm: MATERIALS.highHardSteel.maxMm })
    setLayerMaterial(spec, 'turretFrontLeft', 0, 'unobtainium')
    expect(spec.armour.turretFrontLeft[0]?.material).toBe('highHardSteel')
  })

  it('prices a layer the way the roll-up does', () => {
    const spec = baseline()
    const sheet = sheetOf(spec)
    for (const zone of ZONES) {
      let mass = 0
      for (const layer of spec.armour[zone]) mass += layerCost(sheet.geometry, zone, layer).massT
      expect(mass).toBeCloseTo(sheet.rollup.zoneMassT[zone], 9)
    }
  })
})

describe('the section view', () => {
  it('draws one slab a layer, outside first, touching each other', () => {
    const layers = baseline().armour.upperGlacis
    const section = sectionOf(layers, 68)
    expect(section.slabs.map((slab) => slab.material)).toEqual(layers.map((layer) => layer.material))
    for (let i = 1; i < section.slabs.length; i++) {
      expect(section.slabs[i]?.points[0]?.[0]).toBeCloseTo(section.slabs[i - 1]?.points[1]?.[0] ?? NaN, 1)
    }
  })

  it('is to scale: the shot crosses what the model says it does', () => {
    const layers = baseline().armour.upperGlacis
    const section = sectionOf(layers, 68)
    expect(section.pathMm).toBeCloseTo(stackProtection(layers, 68).pathMm, 3)
    expect(section.shot.exitX - section.shot.enterX).toBeCloseTo(section.pathMm, 1)
    expect(section.shot.startX).toBeLessThan(section.shot.enterX)
  })

  it('stands upright with no slope and leans with it', () => {
    const upright = sectionOf([{ material: 'rolledSteel', mm: 100 }], 0).slabs[0]
    expect(upright?.points[3]?.[0]).toBeCloseTo(upright?.points[0]?.[0] ?? NaN, 6)
    const leaning = sectionOf([{ material: 'rolledSteel', mm: 100 }], 60).slabs[0]
    expect((leaning?.points[3]?.[0] ?? 0) - (leaning?.points[0]?.[0] ?? 0)).toBeCloseTo(SECTION.stripMm * Math.tan(Math.PI / 3), 1)
  })

  it('keeps everything inside the drawing, even the thickest, steepest stack', () => {
    const thick = Array.from({ length: TUNING.limits.maxLayersPerZone }, () => ({ material: 'castSteel' as const, mm: 600 }))
    for (const [layers, slope] of [[thick, 75], [[], 0], [baseline().armour.belly, 0]] as const) {
      const { box, slabs, shot } = sectionOf(layers, slope)
      expect(box.w).toBeGreaterThanOrEqual(SECTION.minWidthMm)
      for (const x of [shot.startX, shot.endX, ...slabs.flatMap((slab) => slab.points.map((point) => point[0]))]) {
        expect(x).toBeGreaterThanOrEqual(box.x)
        expect(x).toBeLessThanOrEqual(box.x + box.w)
      }
    }
  })
})
