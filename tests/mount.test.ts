import { describe, expect, it } from 'vitest'
import { pactRounds } from '../src/data/ammo'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BARRELS, GUNS, HULLS, RECOILS, type BarrelId, type GunId, type RecoilId } from '../src/data/parts'
import { RANGE } from '../src/data/range'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { CONTROLS } from '../src/office/controls'
import { layout } from '../src/office/drawing'
import { cleanSpec } from '../src/persist/specCodec'
import { RANGE_DAY, hitChance } from '../src/sim/gunnery/fire'
import { runProvingGround } from '../src/sim/trials'
import {
  buildStatSheet, geometryOf, gunRingMm, gunRounds, penetrationAt, type StatSheet, type VehicleSpec,
} from '../src/sim/vehicle'

const BARREL_IDS = Object.keys(BARRELS) as BarrelId[]
const RECOIL_IDS = Object.keys(RECOILS) as RecoilId[]

function spec(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const out = structuredClone(BASELINE_SPEC)
  change?.(out)
  return out
}

function build(change?: (spec: VehicleSpec) => void): StatSheet {
  return buildStatSheet(spec(change), PACT_LIMITS_GEN1)
}

const kinetic = (s: VehicleSpec) => gunRounds(s).find(({ round }) => round.kind === 'kinetic')!.round
const shaped = (s: VehicleSpec) => gunRounds(s).find(({ round }) => round.kind === 'shaped')!.round

describe('barrel length', () => {
  it('has a name for every barrel and a control on the Gun tab', () => {
    for (const id of BARREL_IDS) expect(STRINGS.parts.barrels[id].name).not.toBe('')
    const control = CONTROLS.find((each) => each.id === 'barrel')
    expect(control).toMatchObject({ kind: 'choice', tab: 'gun', options: BARREL_IDS })
  })

  it('leaves every gun as the Pact quotes it with the standard barrel', () => {
    for (const gun of Object.keys(GUNS) as GunId[]) {
      expect(gunRounds({ gun, barrel: 'standard' })).toEqual(pactRounds(gun))
    }
    expect(BASELINE_SPEC.barrel).toBe('standard')
  })

  it('throws every round faster from a longer barrel', () => {
    const speeds = BARREL_IDS.map((barrel) => kinetic(spec((s) => { s.barrel = barrel })).speedMs)
    expect(speeds).toEqual([...speeds].sort((a, b) => a - b))
    expect(new Set(speeds).size).toBe(BARREL_IDS.length)
    expect(shaped(spec((s) => { s.barrel = 'long' })).speedMs).toBeGreaterThan(shaped(spec()).speedMs)
  })

  it('gives a kinetic round more punch and leaves a shaped charge as it was', () => {
    const long = spec((s) => { s.barrel = 'long' })
    const short = spec((s) => { s.barrel = 'short' })
    expect(kinetic(long).penMm).toBeGreaterThan(kinetic(spec()).penMm * 1.05)
    expect(kinetic(short).penMm).toBeLessThan(kinetic(spec()).penMm * 0.95)
    expect(penetrationAt(kinetic(long), 2000)).toBeGreaterThan(penetrationAt(kinetic(spec()), 2000))
    expect(shaped(long).penMm).toBe(shaped(spec()).penMm)
    expect(shaped(short).penMm).toBe(shaped(spec()).penMm)
  })

  it('costs weight and money by its length', () => {
    const [short, standard, long] = BARREL_IDS.map((barrel) => build((s) => { s.barrel = barrel }))
    expect(short!.massT).toBeLessThan(standard!.massT - 0.1)
    expect(long!.massT).toBeGreaterThan(standard!.massT + 0.1)
    expect(short!.unitCostKr).toBeLessThan(standard!.unitCostKr)
    expect(long!.unitCostKr).toBeGreaterThan(standard!.unitCostKr)
  })

  it('helps a slow round at long range when the range is badly judged', () => {
    const far = 2000
    const chance = (barrel: BarrelId): number => {
      const sheet = build((s) => { s.barrel = barrel; s.fireControl.rangefinder = 'stadiametric' })
      const round = sheet.fire.rounds.find((each) => each.kind === 'shaped')!
      return hitChance(sheet.fire, round, far, RANGE_DAY)
    }
    expect(chance('long')).toBeGreaterThan(chance('standard'))
    expect(chance('standard')).toBeGreaterThan(chance('short'))
  })

  it('whips on the move: a long barrel wanders more, a short one less', () => {
    const moving = (barrel: BarrelId) => build((s) => { s.barrel = barrel }).fire.moving
    expect(moving('long').acrossMil).toBeGreaterThan(moving('standard').acrossMil)
    expect(moving('short').upMil).toBeLessThan(moving('standard').upMil)
    const chance = (barrel: BarrelId): number => build((s) => { s.barrel = barrel }).gunnery.movingChance
    expect(chance('short')).toBeGreaterThan(chance('standard'))
    expect(chance('standard')).toBeGreaterThan(chance('long'))
    // Halted and by day the barrel only changes the flight of the round.
    expect(build((s) => { s.barrel = 'long' }).fire.layMil).toBe(build().fire.layMil)
  })

  it('is drawn to its length', () => {
    const reach = (barrel: BarrelId): number => {
      const s = spec((each) => { each.barrel = barrel })
      const m = layout(s, geometryOf(s))
      return m.gunRootX - m.muzzleX
    }
    expect(reach('standard')).toBeCloseTo(0.125 * BARRELS.standard.calibres, 9)
    expect(reach('long')).toBeGreaterThan(reach('standard'))
    expect(reach('short')).toBeLessThan(reach('standard'))
  })
})

describe('recoil mount', () => {
  it('has a name for every mount and a control on the Gun tab', () => {
    for (const id of RECOIL_IDS) expect(STRINGS.parts.recoils[id].name).not.toBe('')
    const control = CONTROLS.find((each) => each.id === 'recoil')
    expect(control).toMatchObject({ kind: 'choice', tab: 'gun', options: RECOIL_IDS })
  })

  it('changes nothing when it is the standard mount', () => {
    expect(RECOILS.standard).toEqual({ extraMassT: 0, extraVolumeM3: 0, extraCostKr: 0, reliability: 1, ringMm: 0, rock: 1 })
    expect(gunRingMm(BASELINE_SPEC)).toBe(GUNS.smooth125.minRingMm)
    expect(build().fire.missLeft).toBe(RANGE.gunnery.correction)
  })

  it('sets the turret ring the gun needs', () => {
    const ring = (recoil: RecoilId): number => gunRingMm({ gun: 'smooth125', recoil })
    expect(ring('longStroke')).toBeLessThan(ring('standard'))
    expect(ring('stiff')).toBeGreaterThan(ring('standard'))

    const stiff = build((s) => { s.recoil = 'stiff' })
    const issue = stiff.issues.find((each) => each.code === 'ringTooSmallForGun')
    expect(issue).toMatchObject({ severity: 'error', part: 'turret.ringMm', value: 2100, limit: ring('stiff') })
    expect(build((s) => { s.recoil = 'stiff'; s.turret.ringMm = 2150 }).issues.some((each) => each.code === 'ringTooSmallForGun')).toBe(false)
  })

  it('lets the long-stroke mount put the 125 mm gun on the light hull', () => {
    const fits = (recoil: RecoilId): boolean => {
      const sheet = build((s) => {
        s.hull.size = 'light'
        s.turret.ringMm = HULLS.light.maxRingMm
        s.loading = 'loader'
        s.recoil = recoil
      })
      return !sheet.issues.some((each) => each.code === 'ringTooSmallForGun' || each.code === 'ringTooBigForHull')
    }
    expect(fits('standard')).toBe(false)
    expect(fits('longStroke')).toBe(true)
  })

  it('gives the gun more room to dip when the mount leaves ring to spare', () => {
    expect(build((s) => { s.recoil = 'longStroke' }).firepower.gunDepressionDeg)
      .toBeGreaterThan(build((s) => { s.recoil = 'stiff'; s.turret.ringMm = 2150 }).firepower.gunDepressionDeg)
  })

  it('costs weight, room, money and reliability for the long stroke, and saves them for the short', () => {
    const [stiff, standard, long] = RECOIL_IDS.map((recoil) => build((s) => { s.recoil = recoil }))
    expect(long!.massT).toBeGreaterThan(standard!.massT)
    expect(stiff!.massT).toBeLessThan(standard!.massT)
    expect(long!.rollup.usedM3).toBeGreaterThan(standard!.rollup.usedM3)
    expect(stiff!.rollup.usedM3).toBeLessThan(standard!.rollup.usedM3)
    expect(long!.unitCostKr).toBeGreaterThan(standard!.unitCostKr)
    expect(stiff!.unitCostKr).toBeLessThan(standard!.unitCostKr)
    expect(long!.reliabilityIndex).toBeLessThan(standard!.reliabilityIndex)
    expect(stiff!.reliabilityIndex).toBeLessThan(standard!.reliabilityIndex)
  })

  it('hides the fall of shot when it kicks hard, so a miss is corrected less well', () => {
    const left = (recoil: RecoilId): number => build((s) => { s.recoil = recoil; s.turret.ringMm = 2150 }).fire.missLeft
    expect(left('stiff')).toBeGreaterThan(left('standard'))
    expect(left('longStroke')).toBeLessThan(left('standard'))
    for (const id of RECOIL_IDS) expect(left(id)).toBeLessThanOrEqual(1)
  })

  it('shows on the range when the first range is rough: more targets hit with the softer mount', () => {
    const hits = (recoil: RecoilId): number => {
      const sheet = build((s) => { s.recoil = recoil; s.turret.ringMm = 2150; s.fireControl.rangefinder = 'stadiametric' })
      let total = 0
      for (let seed = 101; seed < 301; seed++) total += runProvingGround(sheet, { seed }).gunnery.halted.hits
      return total / 200
    }
    const [stiff, standard, long] = RECOIL_IDS.map(hits)
    expect(standard!).toBeGreaterThan(stiff! + 0.1)
    expect(long!).toBeGreaterThan(standard! + 0.05)
  })
})

describe('old saves', () => {
  it('loads a design saved before barrels and mounts as the standard ones', () => {
    const old = structuredClone(BASELINE_SPEC) as Partial<VehicleSpec>
    delete old.barrel
    delete old.recoil
    const loaded = cleanSpec({ ...old, name: 'Old one', gun: 'rifled100' })
    expect(loaded.gun).toBe('rifled100')
    expect(loaded.barrel).toBe('standard')
    expect(loaded.recoil).toBe('standard')
  })

  it('keeps a saved barrel and mount, and drops ones it does not know', () => {
    const kept = cleanSpec({ ...structuredClone(BASELINE_SPEC), barrel: 'long', recoil: 'longStroke' })
    expect([kept.barrel, kept.recoil]).toEqual(['long', 'longStroke'])
    const odd = cleanSpec({ ...structuredClone(BASELINE_SPEC), barrel: 'enormous', recoil: 7 })
    expect([odd.barrel, odd.recoil]).toEqual(['standard', 'standard'])
  })
})
