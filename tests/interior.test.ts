import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { INTERIOR, LAYOUT } from '../src/data/layout'
import { HULLS, LOADING, STOWAGE, TURRETS, type HullId, type LoadingId, type StowageId, type TurretId } from '../src/data/parts'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1, TUNING } from '../src/data/tuning'
import { CUT_KINDS, VIEWS, drawingOf, layout } from '../src/office/drawing'
import { insideLines } from '../src/office/inside'
import {
  ITEM_IDS, buildStatSheet, frameOf, geometryOf, interiorOf, stationsOf,
  type Box, type Interior, type ItemId, type VehicleSpec,
} from '../src/sim/vehicle'

function specOf(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return spec
}

function inside(change?: (spec: VehicleSpec) => void): { spec: VehicleSpec; interior: Interior } {
  const spec = specOf(change)
  return { spec, interior: interiorOf(spec, geometryOf(spec)) }
}

const find = (interior: Interior, id: ItemId) => interior.items.find((item) => item.id === id)
const volume = (box: Box): number => (box.x1 - box.x0) * (box.y1 - box.y0) * (box.z1 - box.z0)
const overlap = (a: Box, b: Box): boolean =>
  a.x0 < b.x1 - 1e-9 && b.x0 < a.x1 - 1e-9 && a.y0 < b.y1 - 1e-9 && b.y0 < a.y1 - 1e-9 && a.z0 < b.z1 - 1e-9 && b.z0 < a.z1 - 1e-9

/** Every hull, turret, way of loading and engine place, at the ends of what the sliders allow. */
function everyDesign(): VehicleSpec[] {
  const out: VehicleSpec[] = []
  for (const hull of Object.keys(HULLS) as HullId[]) {
    for (const turret of Object.keys(TURRETS) as TurretId[]) {
      for (const loading of Object.keys(LOADING) as LoadingId[]) {
        for (const engineAt of ['rear', 'front'] as const) {
          for (const end of ['min', 'max'] as const) {
            out.push(specOf((s) => {
              s.hull.size = hull
              s.hull.engineAt = engineAt
              s.hull.glacisAngleDeg = TUNING.limits.glacisAngleDeg[end]
              s.turret.shape = turret
              s.turret.ringMm = end === 'min' ? TUNING.limits.ringMm.min : HULLS[hull].maxRingMm
              s.loading = loading
              s.ammo.rounds = TUNING.limits.rounds[end]
              s.powerpack.fuelL = TUNING.limits.fuelL[end]
            }))
          }
        }
      }
    }
  }
  return out
}

describe('the measurements every view shares', () => {
  it('are the ones the blueprint draws with', () => {
    for (const spec of everyDesign().slice(0, 24)) {
      const geo = geometryOf(spec)
      expect(layout(spec, geo)).toMatchObject(frameOf(spec, geo))
    }
  })

  it('put the turret and the engine where the layout table says', () => {
    const rear = frameOf(BASELINE_SPEC, geometryOf(BASELINE_SPEC))
    expect(rear.turretX).toBeCloseTo(rear.length * LAYOUT.turretCentre.rear, 9)
    expect(rear.bayStart).toBeGreaterThan(rear.turretX + rear.ringRadius)
    const spec = specOf((s) => { s.hull.engineAt = 'front' })
    const front = frameOf(spec, geometryOf(spec))
    expect(front.turretX).toBeGreaterThan(rear.turretX)
    expect(front.bayEnd).toBeLessThan(front.turretX)
  })

  it('give a bustle only to the turret that has one', () => {
    for (const shape of Object.keys(TURRETS) as TurretId[]) {
      const spec = specOf((s) => { s.turret.shape = shape })
      const frame = frameOf(spec, geometryOf(spec))
      expect(frame.bustle > 0).toBe(TURRETS[shape].hasBustle)
      expect(frame.bustleFloor).toBeGreaterThan(frame.roof)
      expect(frame.bustleFloor).toBeLessThan(frame.top)
    }
  })
})

describe('what is inside the armour', () => {
  it('is on the stat sheet', () => {
    const sheet = buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1)
    expect(sheet.interior).toEqual(interiorOf(BASELINE_SPEC, sheet.geometry))
  })

  it('seats every crewman once, and a loader only when the gun is loaded by hand', () => {
    for (const spec of everyDesign()) {
      const { items } = interiorOf(spec, geometryOf(spec))
      const seats = items.filter((item) => item.kind === 'crew').map((item) => item.station).sort()
      expect(seats).toEqual(stationsOf(spec).map((station) => station.id).sort())
      expect(seats.includes('loader')).toBe(spec.loading === 'loader')
    }
  })

  it('has one engine, one gearbox, one breech and one gunner\'s sight', () => {
    for (const spec of everyDesign()) {
      const { items } = interiorOf(spec, geometryOf(spec))
      for (const id of ['engine', 'transmission', 'breech', 'sight'] as const) {
        expect(items.filter((item) => item.id === id)).toHaveLength(1)
      }
      expect(new Set(items.map((item) => item.id)).size).toBe(items.length)
      for (const item of items) expect(ITEM_IDS).toContain(item.id)
    }
  })

  it('gives everything a size, inside the outline of the tank', () => {
    for (const spec of everyDesign()) {
      const { frame: f, items } = interiorOf(spec, geometryOf(spec))
      for (const item of items) {
        const { box } = item
        expect(box.x1 - box.x0, item.id).toBeGreaterThan(0.05)
        expect(box.y1 - box.y0, item.id).toBeGreaterThan(0.05)
        expect(box.z1 - box.z0, item.id).toBeGreaterThan(0.05)
        expect(box.x0, item.id).toBeGreaterThanOrEqual(0)
        expect(box.x1, item.id).toBeLessThanOrEqual(f.length + Math.max(0, f.turretX + f.radius + f.bustle - f.length))
        expect(box.y0, item.id).toBeGreaterThanOrEqual(f.belly)
        expect(box.y1, item.id).toBeLessThanOrEqual(item.part === 'turret' ? f.top : f.roof)
        const half = item.part === 'turret' ? f.radius : f.bodyHalf
        expect(box.z0, item.id).toBeGreaterThanOrEqual(-half)
        expect(box.z1, item.id).toBeLessThanOrEqual(half)
      }
    }
  })

  it('never sits two crewmen in the same place, or one in the breech, the sight or the machinery', () => {
    for (const spec of everyDesign()) {
      const { items } = interiorOf(spec, geometryOf(spec))
      const crew = items.filter((item) => item.kind === 'crew')
      const hard = items.filter((item) => ['gun', 'sight', 'engine', 'transmission', 'autoloader'].includes(item.kind))
      for (const man of crew) {
        for (const other of [...crew, ...hard]) {
          if (other === man) continue
          expect(overlap(man.box, other.box), `${man.id} in ${other.id}`).toBe(false)
        }
      }
    }
  })

  it('keeps the engine clear of the gearbox, with the gearbox at the end of the hull', () => {
    const rear = inside().interior
    expect(find(rear, 'transmission')!.box.x0).toBeGreaterThan(find(rear, 'engine')!.box.x1)
    const front = inside((s) => { s.hull.engineAt = 'front' }).interior
    expect(find(front, 'transmission')!.box.x1).toBeLessThan(find(front, 'engine')!.box.x0)
    // With the engine in front the driver sits beside it, not behind it.
    expect(find(front, 'driver')!.box.z1).toBeLessThan(find(front, 'engine')!.box.z0)
    expect(find(rear, 'driver')!.box.z0).toBeLessThan(0)
    expect(find(rear, 'driver')!.box.z1).toBeGreaterThan(0)
  })
})

describe('where the ammunition is kept', () => {
  it('accounts for every round carried, whatever the design', () => {
    for (const spec of everyDesign()) {
      for (const stowage of Object.keys(STOWAGE) as StowageId[]) {
        spec.ammo.stowage = stowage
        const { items } = interiorOf(spec, geometryOf(spec))
        expect(items.reduce((sum, item) => sum + item.rounds, 0)).toBe(spec.ammo.rounds)
        for (const item of items) {
          expect(Number.isInteger(item.rounds)).toBe(true)
          if (item.kind === 'ammo') expect(item.rounds, item.id).toBeGreaterThan(0)
        }
      }
    }
  })

  it('puts a carousel under the turret floor, full first, with the crew above it', () => {
    const { spec, interior } = inside((s) => { s.loading = 'carousel'; s.ammo.rounds = 39 })
    const carousel = find(interior, 'carousel')!
    expect(carousel.kind).toBe('autoloader')
    expect(carousel.part).toBe('hull')
    expect(carousel.rounds).toBe(LOADING.carousel.readyRounds)
    expect(carousel.box.y1).toBeLessThan(interior.frame.roof)
    expect(carousel.box.y1).toBeLessThanOrEqual(find(interior, 'gunner')!.box.y0)
    expect((carousel.box.x0 + carousel.box.x1) / 2).toBeCloseTo(interior.frame.turretX, 9)
    // Fewer rounds than the carousel holds: all of them are in it.
    spec.ammo.rounds = 20
    const few = interiorOf(spec, geometryOf(spec))
    expect(find(few, 'carousel')!.rounds).toBe(20)
    expect(few.items.filter((item) => item.kind === 'ammo')).toHaveLength(0)
  })

  it('puts a bustle autoloader and its spare rounds in the bustle, up in the turret', () => {
    const { interior } = inside((s) => { s.turret.shape = 'bustle'; s.loading = 'bustleLoader'; s.ammo.rounds = 40 })
    const loader = find(interior, 'bustleLoader')!
    const rack = find(interior, 'bustleRack')!
    expect(loader.rounds).toBe(LOADING.bustleLoader.readyRounds)
    expect(rack.rounds).toBe(INTERIOR.bustleSpareRounds)
    for (const item of [loader, rack]) {
      expect(item.part).toBe('turret')
      expect(item.box.x0).toBeGreaterThan(interior.frame.turretX + interior.frame.radius * 0.9)
      expect(item.box.y0).toBeGreaterThan(interior.frame.roof)
    }
    expect(overlap(loader.box, rack.box)).toBe(false)
  })

  it('gives a loader a rack to work from: in the bustle if there is one, on the turret wall if not', () => {
    const plain = inside((s) => { s.loading = 'loader'; s.turret.shape = 'weldedWedge'; s.ammo.rounds = 40 }).interior
    expect(find(plain, 'readyRack')!.rounds).toBe(INTERIOR.readyRackRounds)
    expect(find(plain, 'bustleRack')).toBeUndefined()
    const bustle = inside((s) => { s.loading = 'loader'; s.turret.shape = 'bustle'; s.ammo.rounds = 40 }).interior
    expect(find(bustle, 'bustleRack')!.rounds).toBe(INTERIOR.bustleRackRounds)
    expect(find(bustle, 'readyRack')).toBeUndefined()
  })

  it('counts only the rounds in the bustle as behind blow-out panels', () => {
    const { interior } = inside((s) => {
      s.turret.shape = 'bustle'; s.loading = 'bustleLoader'; s.ammo.stowage = 'blowOutPanels'; s.ammo.rounds = 45
    })
    for (const item of interior.items) {
      if (item.rounds === 0) continue
      const inBustle = item.id === 'bustleLoader' || item.id === 'bustleRack'
      expect(item.vented, item.id).toBe(inBustle)
      if (!inBustle) expect(item.stowage).toBe('plainRacks')
    }
    // Carry no more than the bustle holds and every round is behind the panels.
    const all = inside((s) => {
      s.turret.shape = 'bustle'; s.loading = 'bustleLoader'; s.ammo.stowage = 'blowOutPanels'
      s.ammo.rounds = LOADING.bustleLoader.readyRounds + INTERIOR.bustleSpareRounds
    }).interior
    expect(all.items.filter((item) => item.rounds > 0).every((item) => item.vented)).toBe(true)
    // A turret with no bustle has no panels to vent through.
    const none = inside((s) => { s.ammo.stowage = 'blowOutPanels' }).interior
    expect(none.items.some((item) => item.vented)).toBe(false)
  })

  it('keeps the kind of stowage chosen on the racks, and none on an autoloader', () => {
    for (const stowage of ['plainRacks', 'wetStowage', 'armouredBins'] as const) {
      const { interior } = inside((s) => { s.ammo.stowage = stowage })
      for (const item of interior.items) {
        if (item.kind === 'ammo') expect(item.stowage).toBe(stowage)
        if (item.kind === 'autoloader') expect(item.stowage).toBeNull()
      }
    }
  })

  it('needs a longer rack for more rounds, and for rounds that take more room', () => {
    const length = (change: (s: VehicleSpec) => void): number => {
      const rack = find(inside((s) => { s.hull.engineAt = 'front'; change(s) }).interior, 'tailRack')!
      return rack.box.x1 - rack.box.x0
    }
    expect(length((s) => { s.ammo.rounds = 40 })).toBeGreaterThan(length((s) => { s.ammo.rounds = 30 }))
    expect(length((s) => { s.ammo.rounds = 34; s.ammo.stowage = 'wetStowage' }))
      .toBeGreaterThan(length((s) => { s.ammo.rounds = 34 }))
  })
})

describe('where the fuel is kept', () => {
  it('accounts for every litre', () => {
    for (const spec of everyDesign()) {
      const { items } = interiorOf(spec, geometryOf(spec))
      expect(items.reduce((sum, item) => sum + item.litres, 0)).toBe(spec.powerpack.fuelL)
      for (const item of items) if (item.kind === 'fuel') expect(item.litres, item.id).toBeGreaterThan(0)
    }
  })

  it('makes a bigger target of a bigger load', () => {
    const tanks = (litres: number): number =>
      inside((s) => { s.hull.engineAt = 'front'; s.powerpack.fuelL = litres }).interior.items
        .filter((item) => item.kind === 'fuel').reduce((sum, item) => sum + volume(item.box), 0)
    expect(tanks(800)).toBeGreaterThan(tanks(400))
    expect(tanks(800)).toBeCloseTo(800 * TUNING.volume.fuelM3PerL, 6)
  })

  it('sits beside the driver and ahead of the engine when the engine is at the back', () => {
    const { interior } = inside()
    const front = find(interior, 'frontTank')!
    const cross = find(interior, 'crossTank')!
    expect(front.box.z1).toBeLessThan(find(interior, 'driver')!.box.z0)
    expect(cross.box.x1).toBeLessThanOrEqual(interior.frame.bayStart)
    expect(overlap(front.box, find(interior, 'frontRack')!.box)).toBe(false)
    expect(overlap(cross.box, find(interior, 'crossRack')!.box)).toBe(false)
  })
})

describe('the cutaway on the blueprint', () => {
  const { spec, interior } = inside()
  const geo = geometryOf(spec)

  it('draws nothing inside until it is asked for', () => {
    for (const view of VIEWS) {
      const plain = drawingOf(spec, geo, view)
      expect(plain.shapes.some((shape) => shape.item)).toBe(false)
      expect(plain.body).toEqual([])
    }
  })

  it('draws every kind of thing on the side and top views, and leaves the front view alone', () => {
    for (const view of ['side', 'top'] as const) {
      const kinds = new Set(drawingOf(spec, geo, view, interior).shapes.map((shape) => shape.item).filter(Boolean))
      expect([...kinds].sort()).toEqual([...CUT_KINDS].sort())
    }
    expect(drawingOf(spec, geo, 'front', interior).shapes).toEqual(drawingOf(spec, geo, 'front').shapes)
  })

  it('adds to the drawing without moving a line of it', () => {
    for (const view of ['side', 'top'] as const) {
      const plain = drawingOf(spec, geo, view)
      const cut = drawingOf(spec, geo, view, interior)
      expect(cut.shapes.filter((shape) => !shape.item)).toEqual(plain.shapes)
      expect(cut.zones).toEqual(plain.zones)
      expect(cut.box).toEqual(plain.box)
    }
  })

  it('keeps what is inside within the outline of the armour on the side view', () => {
    expect(drawingOf(spec, geo, 'side', interior).body).toHaveLength(2)
    expect(drawingOf(spec, geo, 'top', interior).body).toEqual([])
  })

  it('draws the crew last, so nothing covers them', () => {
    for (const view of ['side', 'top'] as const) {
      const marks = drawingOf(spec, geo, view, interior).shapes.filter((shape) => shape.item).map((shape) => shape.item)
      const firstCrew = marks.indexOf('crew')
      expect(marks.slice(firstCrew).every((kind) => kind === 'crew')).toBe(true)
    }
  })
})

describe('the cutaway in words', () => {
  it('says where every round and every litre is', () => {
    const lines = insideLines(inside().interior)
    expect(lines).toEqual([
      'Rounds: 22 in the autoloader under the turret, 6 beside the driver, 11 ahead of the engine.',
      'Fuel: 269 l beside the driver, 731 l ahead of the engine.',
    ])
  })

  it('says which rounds are behind blow-out panels', () => {
    const lines = insideLines(inside((s) => {
      s.turret.shape = 'bustle'; s.loading = 'bustleLoader'; s.ammo.stowage = 'blowOutPanels'; s.ammo.rounds = 30
    }).interior)
    expect(lines[0]).toContain('18 in the autoloader in the bustle (behind blow-out panels)')
    expect(lines[0]).toContain('6 in the bustle (behind blow-out panels)')
    expect(lines[0]).toContain('6 beside the driver.')
    expect(lines[0]).not.toContain('beside the driver (behind')
  })

  it('has words for every place rounds or fuel can be', () => {
    const C = STRINGS.office.cutaway
    for (const spec of everyDesign()) {
      for (const item of interiorOf(spec, geometryOf(spec)).items) {
        if (item.rounds > 0) expect(C.rounds, item.id).toHaveProperty(item.id)
        if (item.litres > 0) expect(C.fuel, item.id).toHaveProperty(item.id)
      }
    }
    for (const kind of CUT_KINDS) expect(C.kinds[kind].length).toBeGreaterThan(0)
  })
})
