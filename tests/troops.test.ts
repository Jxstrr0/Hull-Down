// The troop compartment: soldiers carried in the back of an infantry fighting vehicle.
import { describe, expect, it } from 'vitest'
import { THREATS } from '../src/data/ammo'
import { BASELINE_SPEC } from '../src/data/baseline'
import { TROOPS } from '../src/data/parts'
import { STRINGS } from '../src/data/strings'
import { TUNING } from '../src/data/tuning'
import { cleanSpec } from '../src/persist/specCodec'
import { sandboxLimits } from '../src/sim/vehicle/sandbox'
import { buildStatSheet, gunRingMm, targetOf, traceShot, type Box, type VehicleSpec } from '../src/sim/vehicle'

const LIMITS = sandboxLimits('none')

/** A medium hull with the 30 mm cannon, the engine in front and six soldiers in the back. */
function ifv(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.gun = 'autocannon30'
  spec.hull.engineAt = 'front'
  spec.loading = 'loader'
  spec.crew.troops = 6
  change?.(spec)
  spec.turret.ringMm = gunRingMm(spec)
  return spec
}

const errors = (spec: VehicleSpec): string[] =>
  buildStatSheet(spec, LIMITS).issues.filter((issue) => issue.severity === 'error').map((issue) => issue.code)

const apart = (a: Box, b: Box): boolean => a.z1 <= b.z0 || b.z1 <= a.z0 || a.x1 <= b.x0 || b.x1 <= a.x0

describe('the troop compartment', () => {
  it('is empty on a tank, and old saves load with nobody in the back', () => {
    expect(BASELINE_SPEC.crew.troops).toBe(0)
    const sheet = buildStatSheet(BASELINE_SPEC, LIMITS)
    expect(sheet.interior.items.some((item) => item.kind === 'troops')).toBe(false)
    const old = structuredClone(BASELINE_SPEC) as unknown as { crew: Record<string, unknown> }
    delete old.crew.troops
    expect(cleanSpec(old).crew.troops).toBe(0)
    expect(cleanSpec(ifv()).crew.troops).toBe(6)
    expect(cleanSpec(ifv((spec) => { spec.crew.troops = 99 })).crew.troops).toBe(TUNING.limits.troops.max)
  })

  it('takes room, weight and money for every soldier and the door', () => {
    const none = buildStatSheet(ifv((spec) => { spec.crew.troops = 0 }), LIMITS)
    const six = buildStatSheet(ifv(), LIMITS)
    expect(six.rollup.volumeM3.crew - none.rollup.volumeM3.crew).toBeCloseTo(6 * TROOPS.perSoldierM3 + TROOPS.door.volumeM3, 6)
    expect(six.rollup.massT.crew - none.rollup.massT.crew).toBeCloseTo(6 * TROOPS.perSoldierT + TROOPS.door.massT, 6)
    expect(six.rollup.costKr.crew - none.rollup.costKr.crew).toBeCloseTo(6 * TROOPS.perSoldierKr + TROOPS.door.costKr, 6)
  })

  it('fits six in a medium hull, eight only with a smaller engine and less fuel, and no squad in a light hull', () => {
    expect(errors(ifv())).toEqual([])
    const trimmed = (spec: VehicleSpec): void => {
      spec.powerpack.engine = 'diesel580'
      spec.powerpack.fuelL = 600
    }
    expect(errors(ifv((spec) => { spec.crew.troops = 8 }))).toContain('outOfSpace')
    expect(errors(ifv((spec) => { spec.crew.troops = 8; trimmed(spec) }))).toEqual([])
    expect(errors(ifv((spec) => { spec.hull.size = 'light'; spec.crew.troops = 4; trimmed(spec) }))).toContain('outOfSpace')
  })

  it('needs the engine in front, and a whole squad or nobody', () => {
    expect(errors(ifv((spec) => { spec.hull.engineAt = 'rear' }))).toContain('troopsNeedFrontEngine')
    expect(errors(ifv((spec) => { spec.crew.troops = 2 }))).toContain('squadTooSmall')
    expect(errors(ifv((spec) => { spec.crew.troops = TROOPS.minSquad }))).toEqual([])
    expect(errors(ifv((spec) => { spec.crew.troops = 9 }))).toContain('troopsOutOfRange')
    for (const code of ['troopsNeedFrontEngine', 'squadTooSmall', 'troopsOutOfRange'] as const) expect(STRINGS.issues[code]).not.toBe('')
  })

  it('puts the soldiers in the back, between the racks and the fuel along the walls', () => {
    const { interior } = buildStatSheet(ifv(), LIMITS)
    const squad = interior.items.find((item) => item.kind === 'troops')
    expect(squad?.troops).toBe(6)
    expect(squad!.box.x1).toBeGreaterThan(interior.frame.length * 0.7)
    for (const item of interior.items.filter((each) => each.part === 'hull' && each !== squad)) {
      expect(apart(item.box, squad!.box), item.id).toBe(true)
    }
    // More soldiers sit further forward.
    const four = buildStatSheet(ifv((spec) => { spec.crew.troops = 4 }), LIMITS).interior.items.find((item) => item.kind === 'troops')
    expect(four!.box.x0).toBeGreaterThan(squad!.box.x0)
  })

  it('loses soldiers to a round through the side of the compartment', () => {
    const spec = ifv((spec) => { spec.armour.hullSideRear = [] })
    const sheet = buildStatSheet(spec, LIMITS)
    const squad = sheet.interior.items.find((item) => item.kind === 'troops')!
    const target = targetOf(spec, sheet.geometry, sheet.interior)
    const aim = { x: (squad.box.x0 + squad.box.x1) / 2, y: (squad.box.y0 + squad.box.y1) / 2, z: 0 }
    const hit = traceShot(target, { round: THREATS.accord105Sabot, rangeM: 1000, bearingDeg: 90, diveDeg: 0, aim, seed: 3, shotNo: 1 })
    expect(hit.through).toBe(true)
    expect(hit.squadOut).toBe(true)
    expect(hit.reached.some((each) => each.id === 'troops' && each.effect === 'crew')).toBe(true)
    expect(['squad', 'crew', 'burned', 'destroyed']).toContain(hit.outcome)
    expect(STRINGS.office.armour.behind.items.troops).not.toBe('')
  })
})
