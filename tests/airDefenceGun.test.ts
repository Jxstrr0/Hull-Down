// The twin 35 mm cannon and its search radar: the gun for an anti-aircraft vehicle.
import { describe, expect, it } from 'vitest'
import { pactRounds } from '../src/data/ammo'
import { BASELINE_SPEC } from '../src/data/baseline'
import { ELECTRICS, GUNS, HULLS, SEARCH_RADAR, type GunId } from '../src/data/parts'
import { SKETCHES } from '../src/data/sketches'
import { STRINGS } from '../src/data/strings'
import { TENDERS, TENDER_IDS } from '../src/data/tenders'
import { CONTROLS } from '../src/office/controls'
import { drawingOf, type View } from '../src/office/drawing'
import { tankShapeOf } from '../src/render/tankShape'
import { fireOf } from '../src/sim/gunnery/fire'
import { electricsOf } from '../src/sim/vehicle/electrics'
import { sandboxLimits } from '../src/sim/vehicle/sandbox'
import { buildStatSheet, geometryOf, gunRingMm, type VehicleSpec } from '../src/sim/vehicle'

const GUN_IDS = Object.keys(GUNS) as GunId[]

/** A light tank with the twin cannon on a ring wide enough for it. */
function flak(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.gun = 'twin35'
  spec.hull.size = 'light'
  spec.loading = 'loader'
  change?.(spec)
  spec.turret.ringMm = gunRingMm(spec)
  return spec
}

const sandbox = sandboxLimits('none')
const lines = (spec: VehicleSpec, view: View): number => drawingOf(spec, geometryOf(spec), view).shapes.length
const issues = (spec: VehicleSpec, severity: 'error' | 'warning', limits = sandbox): string[] =>
  buildStatSheet(spec, limits).issues.filter((issue) => issue.severity === severity).map((issue) => issue.code)

describe('the twin 35 mm cannon', () => {
  it('is the only twin and the only anti-aircraft gun, with a name, a note, a sketch and its two bursts', () => {
    for (const id of GUN_IDS) {
      expect(GUNS[id].twin, id).toBe(id === 'twin35')
      expect(GUNS[id].antiAir, id).toBe(id === 'twin35')
    }
    expect(GUNS.twin35.beltFed).toBe(true)
    expect(STRINGS.parts.guns.twin35.name).not.toBe('')
    expect(SKETCHES['gun:twin35']).toBeDefined()
    expect(pactRounds('twin35')).toHaveLength(2)
    for (const { id } of pactRounds('twin35')) expect(STRINGS.rounds[id]).not.toBe('')
  })

  it('is heavier, dearer and wider in the ring than the 30 mm, and still fits the light hull', () => {
    expect(GUNS.twin35.massT).toBeGreaterThan(GUNS.autocannon30.massT)
    expect(GUNS.twin35.costKr).toBeGreaterThan(GUNS.autocannon30.costKr)
    expect(GUNS.twin35.minRingMm).toBeGreaterThan(GUNS.autocannon30.minRingMm)
    expect(gunRingMm(flak())).toBeLessThanOrEqual(HULLS.light.maxRingMm)
  })

  it('fires faster than the 30 mm and hits a little harder, but is no use against a tank', () => {
    expect(GUNS.twin35.loaderRof).toBeGreaterThan(GUNS.autocannon30.loaderRof)
    const own = pactRounds('twin35').map(({ round }) => round)
    const small = pactRounds('autocannon30').map(({ round }) => round)
    for (const [n, round] of own.entries()) {
      expect(round.kind).toBe(small[n]!.kind)
      expect(round.penMm).toBeGreaterThan(small[n]!.penMm)
      expect(round.penMm).toBeLessThan(100)
    }
  })

  it('feeds itself from its belts, a burst every second and a half, whatever loading is fitted', () => {
    const spec = flak()
    const fire = fireOf(spec)
    expect(fire.feed.auto).toBe(true)
    expect(fire.feed.readyRounds).toBe(spec.ammo.rounds)
    expect(60 / fire.feed.freshS).toBeCloseTo(GUNS.twin35.loaderRof, 9)
    expect(buildStatSheet(spec, sandbox).firepower.rateOfFireRpm).toBe(GUNS.twin35.loaderRof)
  })

  it('is refused on every tender so far, since 35 mm is not a tank calibre, and can be built in the sandbox', () => {
    for (const id of TENDER_IDS) expect(issues(flak(), 'error', TENDERS[id].limits), id).toContain('calibreNotStandard')
    expect(issues(flak(), 'error')).toEqual([])
  })

  it('shows two barrels from above and from the front, and two guns on the range', () => {
    const count = (spec: VehicleSpec): number => tankShapeOf(spec, geometryOf(spec)).parts.filter((part) => part.recoils).length
    expect(count(flak())).toBe(2)
    expect(count(structuredClone(BASELINE_SPEC))).toBe(1)
    // More lines for the second barrel than for one, from above and from the front; from the side one hides the other.
    const one = flak((s) => { s.gun = 'autocannon30' })
    expect(lines(flak(), 'top')).toBeGreaterThan(lines(one, 'top'))
    expect(lines(flak(), 'front')).toBeGreaterThan(lines(one, 'front'))
    expect(lines(flak(), 'side')).toBe(lines(one, 'side'))
  })
})

describe('the search radar', () => {
  it('is a switch on the fire control tab, with a name, a note and a sketch, and off on a new design', () => {
    const control = CONTROLS.find((each) => each.id === 'fireControl.searchRadar')
    expect(control?.kind).toBe('toggle')
    expect(control?.tab).toBe('fireControl')
    expect(STRINGS.parts.searchRadar.name).not.toBe('')
    expect(SKETCHES['fireControl.searchRadar']).toBeDefined()
    expect(BASELINE_SPEC.fireControl.searchRadar).toBe(false)
  })

  it('adds its weight, cost and the chance of a fault to the design', () => {
    const without = buildStatSheet(flak(), sandbox)
    const withIt = buildStatSheet(flak((s) => { s.fireControl.searchRadar = true }), sandbox)
    expect(withIt.massT - without.massT).toBeGreaterThan(SEARCH_RADAR.massT * 0.99)
    expect(withIt.unitCostKr).toBeGreaterThan(without.unitCostKr + SEARCH_RADAR.costKr * 0.99)
    expect(withIt.reliabilityIndex).toBeLessThan(without.reliabilityIndex)
  })

  it('draws on the electrics: it fits the generator alone, but not with an unmanned turret too', () => {
    const radar = flak((s) => { s.fireControl.searchRadar = true })
    expect(electricsOf(radar).drawKw).toBe(SEARCH_RADAR.drawKw)
    expect(SEARCH_RADAR.drawKw).toBeLessThanOrEqual(ELECTRICS.generatorKw)
    expect(issues(radar, 'error')).not.toContain('overPowerBudget')
    const crowded = flak((s) => {
      s.fireControl.searchRadar = true
      s.turret.shape = 'unmanned'
      s.hull.engineAt = 'rear'
      s.fireControl.computer = 'digital'
    })
    const fault = buildStatSheet(crowded, sandbox).issues.find((issue) => issue.code === 'overPowerBudget')
    expect(fault?.part).toBe('powerpack.apu')
    expect(issues({ ...crowded, powerpack: { ...crowded.powerpack, apu: true } }, 'error')).not.toContain('overPowerBudget')
  })

  it('is wasted on any gun but an anti-aircraft one, and says so', () => {
    expect(issues(flak((s) => { s.fireControl.searchRadar = true }), 'warning')).not.toContain('searchRadarWasted')
    const tank = structuredClone(BASELINE_SPEC)
    tank.fireControl.searchRadar = true
    expect(issues(tank, 'warning')).toContain('searchRadarWasted')
    expect(STRINGS.issues.searchRadarWasted).not.toBe('')
  })

  it('stands on the drawing and on the range when fitted', () => {
    const plain = flak()
    const radar = flak((s) => { s.fireControl.searchRadar = true })
    for (const view of ['side', 'top', 'front'] as const) expect(lines(radar, view), view).toBeGreaterThan(lines(plain, view))
    expect(tankShapeOf(radar, geometryOf(radar)).parts.length).toBe(tankShapeOf(plain, geometryOf(plain)).parts.length + 2)
  })
})
