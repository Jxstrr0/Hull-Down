import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { GUNS, HULLS, TURRETS } from '../src/data/parts'
import { fixTarget } from '../src/office/controls'
import { ZONES } from '../src/data/materials'
import { VIEWS, ZONE_VIEW, drawingOf, type Drawing, type View } from '../src/office/drawing'
import { geometryOf, type VehicleSpec } from '../src/sim/vehicle'

function draw(view: View, change?: (spec: VehicleSpec) => void): Drawing {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return drawingOf(spec, geometryOf(spec), view)
}

function keys<T extends object>(table: T): (keyof T)[] {
  return Object.keys(table) as (keyof T)[]
}

/** Every variant worth drawing: each hull, turret and gun, and the extremes of the sliders. */
const VARIANTS: ((spec: VehicleSpec) => void)[] = [
  () => undefined,
  ...keys(HULLS).map((id) => (s: VehicleSpec) => { s.hull.size = id }),
  ...keys(TURRETS).map((id) => (s: VehicleSpec) => { s.turret.shape = id }),
  ...keys(GUNS).map((id) => (s: VehicleSpec) => { s.gun = id }),
  (s) => { s.hull.glacisAngleDeg = 45 },
  (s) => { s.hull.glacisAngleDeg = 75 },
  (s) => { s.hull.engineAt = 'front' },
  (s) => { s.turret.ringMm = 1800 },
  (s) => { s.turret.ringMm = 2400 },
  (s) => { s.runningGear.trackWidthMm = 700 },
  (s) => { s.runningGear.roadWheels = 7 },
  (s) => { s.loading = 'loader'; s.fireControl.commanderSight = true },
]

function arcs(drawing: Drawing): number {
  return drawing.shapes.filter((shape) => shape.d.includes('A')).length
}

describe('blueprint drawing', () => {
  it('draws every view of every variant with real numbers, inside its box', () => {
    for (const view of VIEWS) {
      for (const change of VARIANTS) {
        const d = draw(view, change)
        expect(d.shapes.length).toBeGreaterThan(8)
        expect(d.box.w).toBeGreaterThan(0)
        expect(d.box.h).toBeGreaterThan(0)
        for (const shape of d.shapes) {
          expect(shape.d).not.toMatch(/NaN|Infinity|undefined/)
          expect(shape.d.startsWith('M')).toBe(true)
        }
        for (const zone of d.zones) {
          expect(zone.w).toBeGreaterThan(0)
          expect(zone.h).toBeGreaterThan(0)
          expect(zone.x).toBeGreaterThanOrEqual(d.box.x - 1e-6)
          expect(zone.y).toBeGreaterThanOrEqual(d.box.y - 1e-6)
          expect(zone.x + zone.w).toBeLessThanOrEqual(d.box.x + d.box.w + 1e-6)
          expect(zone.y + zone.h).toBeLessThanOrEqual(d.box.y + d.box.h + 1e-6)
        }
      }
    }
  })

  it('gives the same drawing every time', () => {
    for (const view of VIEWS) expect(draw(view)).toEqual(draw(view))
  })

  it('sends every tap zone to a real control', () => {
    for (const view of VIEWS) {
      for (const change of VARIANTS) {
        const d = draw(view, change)
        expect(d.zones.length).toBeGreaterThanOrEqual(4)
        for (const zone of d.zones) expect(fixTarget(zone.go)?.id, zone.go).toBe(zone.go)
      }
    }
  })

  // The rule is 44 px. The drawing is 16 px in from each edge of the screen
  // and at most 150 px tall (see .office-top and .bp-svg in style.css).
  it('keeps every tap zone at least 44 px on a 360 px wide phone', () => {
    for (const view of VIEWS) {
      for (const change of VARIANTS) {
        const d = draw(view, change)
        const scale = Math.min((360 - 32) / d.box.w, 150 / d.box.h)
        for (const zone of d.zones) {
          expect(Math.min(zone.w, zone.h) * scale, `${view} ${zone.go}`).toBeGreaterThanOrEqual(44)
        }
      }
    }
  })

  it('shows each armour zone as a face on the view that sees it square on', () => {
    for (const view of VIEWS) {
      const wanted = ZONES.filter((zone) => ZONE_VIEW[zone] === view).sort()
      for (const change of VARIANTS) {
        const faces = draw(view, change).shapes.filter((shape) => shape.zone !== undefined)
        expect(faces.map((face) => face.zone).sort(), view).toEqual(wanted)
        for (const face of faces) {
          expect(face.line).toBe('face')
          expect(face.d.endsWith('Z')).toBe(true)
        }
      }
    }
    // The rear plates and the belly are on none of the three views.
    expect(ZONES.filter((zone) => ZONE_VIEW[zone] === undefined)).toEqual(['hullRear', 'belly', 'turretRear'])
  })

  it('keeps every armour tap zone at least 44 px and on a zone that view shows', () => {
    for (const view of VIEWS) {
      for (const change of VARIANTS) {
        const d = draw(view, change)
        const scale = Math.min((360 - 32) / d.box.w, 150 / d.box.h)
        expect(d.armourTaps.length).toBeGreaterThan(0)
        for (const tap of d.armourTaps) {
          expect(ZONE_VIEW[tap.zone], `${view} ${tap.zone}`).toBe(view)
          expect(Math.min(tap.w, tap.h) * scale, `${view} ${tap.zone}`).toBeGreaterThanOrEqual(44)
          expect(tap.x).toBeGreaterThanOrEqual(d.box.x - 1e-6)
          expect(tap.x + tap.w).toBeLessThanOrEqual(d.box.x + d.box.w + 1e-6)
        }
      }
    }
  })

  it('draws one road wheel for each wheel in the spec', () => {
    const six = arcs(draw('side'))
    const seven = arcs(draw('side', (s) => { s.runningGear.roadWheels = 7 }))
    expect(seven - six).toBe(2)
  })

  it('shows the things the player changes', () => {
    const side = draw('side')
    expect(draw('side', (s) => { s.hull.glacisAngleDeg = 50 }).shapes).not.toEqual(side.shapes)
    expect(draw('side', (s) => { s.hull.engineAt = 'front' }).shapes).not.toEqual(side.shapes)
    expect(draw('side', (s) => { s.protection.smokeLaunchers = false }).shapes.length).toBeLessThan(side.shapes.length)
    expect(draw('side', (s) => { s.fireControl.commanderSight = true }).shapes.length).toBeGreaterThan(side.shapes.length)

    const shapes = keys(TURRETS).map((id) => JSON.stringify(draw('top', (s) => { s.turret.shape = id }).shapes))
    expect(new Set(shapes).size).toBe(shapes.length)

    // A fourth crewman gets a hatch of his own.
    expect(arcs(draw('top', (s) => { s.loading = 'loader' })) - arcs(draw('top'))).toBe(1)
  })

  it('measures the tank for the caption', () => {
    const base = draw('side')
    expect(base.hullLengthM).toBe(HULLS.medium.lengthM)
    expect(base.overallLengthM).toBeGreaterThan(base.hullLengthM)
    expect(draw('side', (s) => { s.gun = 'rifled100' }).overallLengthM).toBeLessThan(base.overallLengthM)
    const wide = draw('front', (s) => { s.runningGear.trackWidthMm = 700 })
    expect(wide.widthM).toBeGreaterThan(draw('front').widthM)
    expect(wide.box.w).toBeGreaterThan(draw('front').box.w)
    expect(draw('front', (s) => { s.loading = 'loader' }).heightM).toBeGreaterThan(base.heightM)
  })
})
