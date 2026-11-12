// The 155 mm howitzer: the gun for a self-propelled gun.
import { describe, expect, it } from 'vitest'
import { pactRounds } from '../src/data/ammo'
import { BASELINE_SPEC } from '../src/data/baseline'
import { GUNS, HULLS, type GunId } from '../src/data/parts'
import { SKETCHES } from '../src/data/sketches'
import { STRINGS } from '../src/data/strings'
import { TENDERS, TENDER_IDS } from '../src/data/tenders'
import { cycleS, fireOf, RANGE_DAY } from '../src/sim/gunnery/fire'
import { sandboxLimits } from '../src/sim/vehicle/sandbox'
import { buildStatSheet, gunRingMm, type VehicleSpec } from '../src/sim/vehicle'

const GUN_IDS = Object.keys(GUNS) as GunId[]

function howitzer(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.gun = 'howitzer155'
  spec.hull.size = 'heavy'
  spec.turret.shape = 'bustle'
  change?.(spec)
  spec.turret.ringMm = gunRingMm(spec)
  return spec
}

const errors = (spec: VehicleSpec, limits = sandboxLimits('none')): string[] =>
  buildStatSheet(spec, limits).issues.filter((issue) => issue.severity === 'error').map((issue) => issue.code)

describe('the howitzer', () => {
  it('is the only gun that is a howitzer, with a name, a note and a sketch', () => {
    for (const id of GUN_IDS) expect(GUNS[id].howitzer, id).toBe(id === 'howitzer155')
    expect(STRINGS.parts.guns.howitzer155.name).not.toBe('')
    expect(SKETCHES['gun:howitzer155']).toBeDefined()
  })

  it('reaches a map grid 10 km off, and no tank gun does', () => {
    for (const id of GUN_IDS) {
      if (GUNS[id].howitzer) expect(GUNS[id].reachKm, id).toBeGreaterThanOrEqual(20)
      else expect(GUNS[id].reachKm, id).toBeLessThan(10)
    }
  })

  it('fires a heavier, slower shell than any tank gun, and fewer of them a minute', () => {
    const tank = GUN_IDS.filter((id) => !GUNS[id].howitzer)
    const shells = pactRounds('howitzer155')
    expect(shells.map((each) => each.round.kind).sort()).toEqual(['kinetic', 'shaped'])
    for (const id of tank) {
      expect(GUNS.howitzer155.roundMassT).toBeGreaterThan(GUNS[id].roundMassT)
      expect(GUNS.howitzer155.loaderRof).toBeLessThanOrEqual(GUNS[id].loaderRof)
      for (const { round } of pactRounds(id)) {
        for (const shell of shells) if (shell.round.kind === round.kind) expect(shell.round.speedMs).toBeLessThan(round.speedMs)
      }
    }
  })

  it('is refused on every tank tender, since 155 mm is not a calibre the Pact supplies for tanks', () => {
    for (const id of TENDER_IDS) {
      if (id === 'spg2008') expect(errors(howitzer(), TENDERS[id].limits)).not.toContain('calibreNotStandard')
      else expect(errors(howitzer(), TENDERS[id].limits), id).toContain('calibreNotStandard')
    }
  })

  it('can be built in the sandbox, in a turret on the heavy hull or in a casemate on any hull', () => {
    expect(errors(howitzer())).toEqual([])
    expect(gunRingMm(howitzer())).toBeLessThanOrEqual(HULLS.heavy.maxRingMm)
    expect(gunRingMm(howitzer())).toBeGreaterThan(HULLS.medium.maxRingMm)
    for (const size of Object.keys(HULLS) as (keyof typeof HULLS)[]) {
      expect(errors(howitzer((s) => { s.hull.size = size; s.turret.shape = 'casemate'; s.loading = 'loader' })), size).not.toContain('ringTooSmall')
    }
  })

  it('lays and fires like any other gun, only slower', () => {
    const shoot = RANGE_DAY
    const loaded = (change?: (s: VehicleSpec) => void): VehicleSpec => howitzer((s) => { s.loading = 'loader'; change?.(s) })
    expect(cycleS(fireOf(loaded()), 0, shoot)).toBeCloseTo(60 / GUNS.howitzer155.loaderRof, 9)
    expect(cycleS(fireOf(loaded()), 0, shoot)).toBeGreaterThan(cycleS(fireOf(loaded((s) => { s.gun = 'smooth125' })), 0, shoot))
  })
})
