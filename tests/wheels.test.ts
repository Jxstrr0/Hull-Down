import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { LAYOUTS, WHEELS, type LayoutId } from '../src/data/parts'
import { GROUNDS } from '../src/data/range'
import { RENDER } from '../src/data/render'
import { STRINGS } from '../src/data/strings'
import { TENDERS } from '../src/data/tenders'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { CONTROLS } from '../src/office/controls'
import { drawingOf } from '../src/office/drawing'
import { cleanSpec } from '../src/persist/specCodec'
import { review } from '../src/sim/career/advisor'
import { runObstacles } from '../src/sim/trials/obstacles'
import { footingOf } from '../src/sim/mobility/drive'
import { sandboxLimits } from '../src/sim/vehicle/sandbox'
import { buildStatSheet, footprintControl, frameOf, geometryOf, rollupOf, wheelsOf, type Limits, type VehicleSpec } from '../src/sim/vehicle'

/** A light scout car with thin plate, on whatever running gear is asked for. */
function car(layout: LayoutId, change?: (spec: VehicleSpec) => void): VehicleSpec {
  const out = structuredClone(BASELINE_SPEC)
  out.hull.size = 'light'
  out.gun = 'autocannon30'
  out.loading = 'loader'
  out.turret.ringMm = 1800
  out.powerpack.engine = 'diesel580'
  out.powerpack.transmission = 'manual38'
  out.powerpack.fuelL = 600
  for (const zone of Object.keys(out.armour) as (keyof typeof out.armour)[]) {
    out.armour[zone] = [{ material: 'rolledSteel', mm: 10 }]
    out.era[zone] = 0
  }
  out.runningGear.layout = layout
  change?.(out)
  return out
}

const WHEELED: Limits = { ...PACT_LIMITS_GEN1, wheels: true }
const sheetOf = (s: VehicleSpec, limits: Limits = WHEELED) => buildStatSheet(s, limits)
const codes = (s: VehicleSpec, limits: Limits = WHEELED): string[] => sheetOf(s, limits).issues.map((issue) => issue.code)

describe('tracks or wheels', () => {
  it('is a running-gear choice with a name and a note for every layout', () => {
    const control = CONTROLS.find((c) => c.id === 'runningGear.layout')
    expect(control?.kind).toBe('choice')
    expect(control?.tab).toBe('runningGear')
    for (const id of Object.keys(LAYOUTS)) expect(STRINGS.parts.layouts[id as LayoutId].name.length).toBeGreaterThan(0)
    expect(STRINGS.issues.wheelsNotAllowed.length).toBeGreaterThan(0)
    expect(STRINGS.issues.tyresOverloaded).toContain('{limit}')
  })

  it('leaves every design on tracks unless it says otherwise, old saves included', () => {
    expect(BASELINE_SPEC.runningGear.layout).toBe('tracks')
    const old = structuredClone(BASELINE_SPEC) as unknown as { runningGear: Record<string, unknown> }
    delete old.runningGear.layout
    expect(cleanSpec(old).runningGear.layout).toBe('tracks')
    expect(cleanSpec({ ...BASELINE_SPEC, runningGear: { ...BASELINE_SPEC.runningGear, layout: 'wheels6' } }).runningGear.layout).toBe('wheels6')
    expect(cleanSpec({ ...BASELINE_SPEC, runningGear: { ...BASELINE_SPEC.runningGear, layout: 'hovercraft' } }).runningGear.layout).toBe('tracks')
  })

  it('counts the wheels', () => {
    expect(wheelsOf(car('tracks'))).toBe(0)
    expect(wheelsOf(car('wheels4'))).toBe(4)
    expect(wheelsOf(car('wheels8'))).toBe(8)
    expect(sheetOf(car('wheels6')).rollup.stations).toBe(6)
  })

  it('refuses wheels where the tender is not for a wheeled vehicle, and allows them in the sandbox', () => {
    expect(codes(car('wheels6'), PACT_LIMITS_GEN1)).toContain('wheelsNotAllowed')
    expect(codes(car('wheels6'))).not.toContain('wheelsNotAllowed')
    expect(codes(car('wheels6'), sandboxLimits('none'))).not.toContain('wheelsNotAllowed')
    expect(codes(car('wheels6'), sandboxLimits('early'))).not.toContain('wheelsNotAllowed')
    expect(codes(car('tracks'), PACT_LIMITS_GEN1)).not.toContain('wheelsNotAllowed')
  })

  it('is lighter, cheaper and narrower on wheels than on tracks', () => {
    const tracks = sheetOf(car('tracks'))
    for (const layout of ['wheels4', 'wheels6', 'wheels8'] as const) {
      const wheels = sheetOf(car(layout))
      expect(wheels.rollup.massT.runningGear).toBeLessThan(tracks.rollup.massT.runningGear)
      expect(wheels.rollup.costKr.runningGear).toBeLessThan(tracks.rollup.costKr.runningGear)
      expect(wheels.geometry.widthM).toBeLessThan(tracks.geometry.widthM)
    }
    // More wheels weigh and cost more than fewer.
    expect(sheetOf(car('wheels8')).rollup.massT.runningGear).toBeGreaterThan(sheetOf(car('wheels4')).rollup.massT.runningGear)
    expect(sheetOf(car('wheels8')).rollup.costKr.runningGear).toBeGreaterThan(sheetOf(car('wheels6')).rollup.costKr.runningGear)
  })

  it('goes faster and further on wheels, and climbs less in bottom gear', () => {
    const tracks = sheetOf(car('tracks')).mobility
    const wheels = sheetOf(car('wheels6')).mobility
    expect(wheels.topSpeedKmh).toBeGreaterThan(tracks.topSpeedKmh * 1.3)
    expect(wheels.rangeKm).toBeGreaterThan(tracks.rangeKm * 1.3)
    expect(sheetOf(car('wheels6')).drive.pullN).toBeLessThan(sheetOf(car('tracks')).drive.pullN)
  })

  it('presses harder on the ground than tracks, and less with more wheels', () => {
    const p = (layout: LayoutId): number => sheetOf(car(layout)).mobility.groundPressureKgCm2
    expect(p('wheels4')).toBeGreaterThan(p('wheels6'))
    expect(p('wheels6')).toBeGreaterThan(p('wheels8'))
    expect(p('wheels8')).toBeGreaterThan(p('tracks'))
  })

  it('rolls easily on a road and drags in mud', () => {
    const tracks = sheetOf(car('tracks')).drive
    const wheels = sheetOf(car('wheels8')).drive
    expect(footingOf(wheels, GROUNDS.hard).drag).toBeLessThan(footingOf(tracks, GROUNDS.hard).drag)
    expect(footingOf(wheels, GROUNDS.mud).drag).toBeGreaterThan(footingOf(tracks, GROUNDS.mud).drag)
  })

  it('bridges a shorter trench and mounts a lower step, more wheels bridging more', () => {
    const m = (layout: LayoutId) => sheetOf(car(layout)).mobility
    expect(m('wheels4').trenchM).toBeLessThan(m('wheels6').trenchM)
    expect(m('wheels6').trenchM).toBeLessThan(m('wheels8').trenchM)
    expect(m('wheels8').trenchM).toBeLessThan(m('tracks').trenchM)
    expect(m('wheels8').stepM).toBeLessThan(m('tracks').stepM)
  })

  it('carries more weight on more wheels, and warns when the tyres are overloaded', () => {
    const heavy = (layout: LayoutId) => car(layout, (s) => {
      s.armour.upperGlacis = [{ material: 'rolledSteel', mm: 120 }]
      s.armour.hullSideFront = [{ material: 'rolledSteel', mm: 40 }]
    })
    const mass = sheetOf(heavy('wheels4')).massT
    expect(mass).toBeGreaterThan(4 * WHEELS.tyreRatedT)
    expect(codes(heavy('wheels4'))).toContain('tyresOverloaded')
    expect(codes(heavy('wheels8'))).not.toContain('tyresOverloaded')
    expect(sheetOf(heavy('wheels4')).reliabilityIndex).toBeLessThan(sheetOf(heavy('wheels8')).reliabilityIndex)
  })

  it('has no skirts on wheels, and no track checks', () => {
    const skirted = car('wheels6', (s) => { s.runningGear.skirts = true; s.runningGear.trackWidthMm = 1000; s.runningGear.roadWheels = 2 })
    const plain = car('wheels6')
    const geo = geometryOf(skirted)
    expect(rollupOf(skirted, geo).totalMassT).toBeCloseTo(rollupOf(plain, geometryOf(plain)).totalMassT, 9)
    const issues = codes(skirted)
    expect(issues).not.toContain('trackWidthOutOfRange')
    expect(issues).not.toContain('wheelsOutOfRange')
    expect(issues).not.toContain('tracksOverloaded')
  })

  it('draws a wheel under each axle on the blueprint, and no track', () => {
    for (const layout of ['wheels4', 'wheels6', 'wheels8'] as const) {
      const s = car(layout)
      const geo = geometryOf(s)
      expect(frameOf(s, geo).wheelX).toHaveLength(LAYOUTS[layout].wheels / 2)
      const side = drawingOf(s, geo, 'side')
      expect(side.zones.some((zone) => zone.go === 'runningGear.layout')).toBe(true)
      expect(side.zones.some((zone) => zone.go === 'runningGear.roadWheels')).toBe(false)
    }
    expect(frameOf(car('tracks'), geometryOf(car('tracks'))).wheelX).toHaveLength(0)
  })
})

describe('wheels at the trials', () => {
  it('builds a wheeled hull in 3D with spinning wheels and no track', async () => {
    const { Mesh } = await import('three')
    const { Kit } = await import('../src/render/rangeScene')
    const { buildTank, rollTracks, TRACKS, WHEELS: WHEEL_MESH } = await import('../src/render/tankModel')
    const { tankShapeOf } = await import('../src/render/tankShape')
    const s = car('wheels8')
    const geo = geometryOf(s)
    const shape = tankShapeOf(s, geo)
    expect(shape.parts.some((part) => part.kind === 'band')).toBe(false)
    const wheels = shape.parts.filter((part) => part.kind === 'drum' && part.wheelM !== undefined)
    // A tyre, a rim and a hub cap on each of eight wheels.
    expect(wheels).toHaveLength(8 * 3)
    for (const part of wheels) expect(part.kind === 'drum' && part.wheelM).toBeCloseTo(frameOf(s, geo).wheelR, 9)
    // Each wheel stands on the ground.
    for (const part of wheels) expect(part.kind === 'drum' && part.at.y).toBeCloseTo(frameOf(s, geo).wheelR, 9)

    const kit = new Kit()
    const tank = buildTank(kit, shape)
    expect(tank.getObjectByName(TRACKS)).toBeUndefined()
    const meshes = tank.children.filter((child): child is InstanceType<typeof Mesh> => child.name === WHEEL_MESH && child instanceof Mesh)
    expect(meshes.length).toBeGreaterThan(0)
    const rollOf = (mesh: InstanceType<typeof Mesh>): number => (mesh.material as unknown as { userData: { rollM: { value: number } } }).userData.rollM.value
    rollTracks(tank, RENDER.tank.trackLinks.linkM * 0.25)
    for (const mesh of meshes) expect(rollOf(mesh)).toBeCloseTo(RENDER.tank.trackLinks.linkM * 0.25, 9)
    kit.dispose()
  })

  it('says tyres where a tank has tracks', () => {
    const W = STRINGS.range.onWheels
    for (const [id, text] of Object.entries(W.obstacles)) {
      expect(Object.keys(STRINGS.range.obstacles)).toContain(id)
      expect(text).toMatch(/tyre/i)
      expect(text).not.toMatch(/track/i)
    }
    for (const text of [W.part, W.broke, W.overName, W.over, W.halt]) expect(text).not.toMatch(/track/i)
    expect(STRINGS.range.armour.wheel).toMatch(/wheel/i)
    expect(STRINGS.range.afterAction.results.wheel).toMatch(/wheel/i)
  })

  it('sends the mud and tyre fixes to the number of wheels, not the track width', () => {
    expect(footprintControl(true)).toBe('runningGear.layout')
    expect(footprintControl(false)).toBe('runningGear.trackWidthMm')
    // A heavy car on four wheels sticks in the mud and overloads its tyres.
    const heavy = car('wheels4', (s) => {
      s.armour.upperGlacis = [{ material: 'rolledSteel', mm: 160 }]
      s.armour.hullSideFront = [{ material: 'rolledSteel', mm: 60 }]
      s.armour.hullSideRear = [{ material: 'rolledSteel', mm: 60 }]
    })
    const sheet = sheetOf(heavy)
    expect(runObstacles(sheet.drive).results.find((r) => r.id === 'mud')?.passed).toBe(false)
    const tender = { ...TENDERS.tank2001, limits: { ...TENDERS.tank2001.limits, wheels: true } }
    const parts = review(heavy, tender).map((remark) => remark.part)
    expect(parts).toContain('runningGear.layout')
    expect(parts).not.toContain('runningGear.trackWidthMm')
  })
})
