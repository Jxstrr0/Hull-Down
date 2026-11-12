// The 30 mm cannon: the gun for an infantry fighting vehicle.
import { describe, expect, it } from 'vitest'
import { pactRounds } from '../src/data/ammo'
import { BASELINE_SPEC } from '../src/data/baseline'
import { GUNS, HULLS, type GunId } from '../src/data/parts'
import { SKETCHES } from '../src/data/sketches'
import { STRINGS } from '../src/data/strings'
import { TENDERS, TENDER_IDS } from '../src/data/tenders'
import { fireOf } from '../src/sim/gunnery/fire'
import { sandboxLimits } from '../src/sim/vehicle/sandbox'
import { buildStatSheet, gunRingMm, type VehicleSpec } from '../src/sim/vehicle'

const GUN_IDS = Object.keys(GUNS) as GunId[]

function cannon(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.gun = 'autocannon30'
  spec.hull.size = 'light'
  spec.loading = 'loader'
  change?.(spec)
  spec.turret.ringMm = gunRingMm(spec)
  return spec
}

const issues = (spec: VehicleSpec, severity: 'error' | 'warning', limits = sandboxLimits('none')): string[] =>
  buildStatSheet(spec, limits).issues.filter((issue) => issue.severity === severity).map((issue) => issue.code)

describe('the 30 mm cannon', () => {
  it('is belt-fed, like only the twin anti-aircraft cannon, with a name, a note and a sketch', () => {
    for (const id of GUN_IDS) expect(GUNS[id].beltFed, id).toBe(id === 'autocannon30' || id === 'twin35')
    expect(STRINGS.parts.guns.autocannon30.name).not.toBe('')
    expect(SKETCHES['gun:autocannon30']).toBeDefined()
    for (const { id } of pactRounds('autocannon30')) expect(STRINGS.rounds[id]).not.toBe('')
  })

  it('is lighter, smaller and cheaper than any other gun, and fits the smallest ring', () => {
    for (const id of GUN_IDS.filter((each) => each !== 'autocannon30')) {
      expect(GUNS.autocannon30.massT).toBeLessThan(GUNS[id].massT)
      expect(GUNS.autocannon30.costKr).toBeLessThan(GUNS[id].costKr)
      expect(GUNS.autocannon30.minRingMm).toBeLessThan(GUNS[id].minRingMm)
    }
    expect(gunRingMm(cannon())).toBeLessThanOrEqual(HULLS.light.maxRingMm)
  })

  it('bites light armour but not a tank\'s front', () => {
    for (const { round } of pactRounds('autocannon30')) {
      expect(round.penMm).toBeLessThan(100)
      for (const id of GUN_IDS.filter((each) => !GUNS[each].beltFed)) {
        for (const other of pactRounds(id)) expect(round.penMm).toBeLessThan(other.round.penMm)
      }
    }
  })

  it('is refused on every tank tender, since 30 mm is not a tank calibre, and taken on the infantry fighting vehicle\'s and the scout car\'s', () => {
    for (const id of TENDER_IDS) {
      if (id === 'ifv1996' || id === 'scout2004') expect(issues(cannon(), 'error', TENDERS[id].limits)).not.toContain('calibreNotStandard')
      else expect(issues(cannon(), 'error', TENDERS[id].limits), id).toContain('calibreNotStandard')
    }
  })

  it('can be built in the sandbox on the light hull, with a hand loader or in an unmanned turret', () => {
    expect(issues(cannon(), 'error')).toEqual([])
    expect(issues(cannon((s) => {
      s.turret.shape = 'unmanned'
      s.hull.engineAt = 'rear'
      s.fireControl.computer = 'digital'
    }), 'error')).not.toContain('turretNeedsAutoloader')
  })

  it('feeds itself from a belt holding every round, a burst every two seconds, whatever loading is fitted', () => {
    for (const loading of ['loader', 'bustleLoader'] as const) {
      const spec = cannon((s) => { s.loading = loading; s.turret.shape = 'bustle' })
      const fire = fireOf(spec)
      expect(fire.feed.auto).toBe(true)
      expect(fire.feed.readyRounds).toBe(spec.ammo.rounds)
      expect(fire.feed.freshS).toBeCloseTo(60 / GUNS.autocannon30.loaderRof, 9)
      expect(buildStatSheet(spec, sandboxLimits('none')).firepower.rateOfFireRpm).toBe(GUNS.autocannon30.loaderRof)
    }
  })

  it('warns that an autoloader is wasted on it', () => {
    expect(issues(cannon(), 'warning')).not.toContain('autoloaderWasted')
    expect(issues(cannon((s) => { s.loading = 'bustleLoader'; s.turret.shape = 'bustle' }), 'warning')).toContain('autoloaderWasted')
    expect(STRINGS.issues.autoloaderWasted).not.toBe('')
  })
})
