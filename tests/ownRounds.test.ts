// The bureau's own ammunition: long rod, tandem warhead, gun-launched missile.
import { describe, expect, it } from 'vitest'
import { KINETIC_ISSUES, OWN_ROUNDS, SHAPED_ISSUES } from '../src/data/ammo'
import { BASELINE_SPEC } from '../src/data/baseline'
import { RESEARCH } from '../src/data/research'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { CONTROLS } from '../src/office/controls'
import { cleanSpec } from '../src/persist/specCodec'
import { careerLimits, newCareer, research, type Career } from '../src/sim/career/career'
import { gunRounds } from '../src/sim/gunnery/mount'
import { buildStatSheet, penetrationAt, tileWorthMm, type Limits, type VehicleSpec } from '../src/sim/vehicle'

const GEN2: Limits = { ...PACT_LIMITS_GEN1, generation: 2 }

function tank(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return spec
}
const round = (spec: VehicleSpec, kind: 'kinetic' | 'shaped') => gunRounds(spec).find((each) => each.round.kind === kind)!
const codes = (spec: VehicleSpec, limits: Limits = GEN2) => buildStatSheet(spec, limits).issues.map((issue) => issue.code)

describe('the bureau\'s own rounds', () => {
  it('have a name, a control on the Gun tab and a research project each', () => {
    for (const id of KINETIC_ISSUES) expect(STRINGS.parts.kineticIssues[id].name).not.toBe('')
    for (const id of SHAPED_ISSUES) expect(STRINGS.parts.shapedIssues[id].name).not.toBe('')
    expect(CONTROLS.find((each) => each.id === 'ammo.kinetic')).toMatchObject({ kind: 'choice', tab: 'gun', options: KINETIC_ISSUES })
    expect(CONTROLS.find((each) => each.id === 'ammo.shaped')).toMatchObject({ kind: 'choice', tab: 'gun', options: SHAPED_ISSUES })
    const unlocked = Object.values(RESEARCH).map((project) => `${project.field}:${project.part}`)
    for (const id of Object.keys(OWN_ROUNDS)) expect(unlocked.some((key) => key.endsWith(`:${id}`))).toBe(true)
  })

  it('leave the baseline on the Pact\'s rounds, and an old save too', () => {
    expect(BASELINE_SPEC.ammo).toMatchObject({ kinetic: 'supplied', shaped: 'supplied' })
    const old = JSON.parse(JSON.stringify(BASELINE_SPEC)) as { ammo: Record<string, unknown> }
    delete old.ammo.kinetic
    delete old.ammo.shaped
    expect(cleanSpec(old).ammo).toMatchObject({ kinetic: 'supplied', shaped: 'supplied' })
    old.ammo.kinetic = 'deathRay'
    expect(cleanSpec(old).ammo.kinetic).toBe('supplied')
    expect(cleanSpec(tank((spec) => { spec.ammo.shaped = 'tandem' })).ammo.shaped).toBe('tandem')
  })

  it('make a long rod that goes through more, and more still at range', () => {
    const pact = round(tank(), 'kinetic')
    const rod = round(tank((spec) => { spec.ammo.kinetic = 'longRod' }), 'kinetic')
    expect(rod.issue).toBe('longRod')
    expect(rod.round.penMm).toBeGreaterThan(pact.round.penMm * 1.2)
    const gain = (rangeM: number) => penetrationAt(rod.round, rangeM) - penetrationAt(pact.round, rangeM)
    expect(gain(2000)).toBeGreaterThan(gain(0))
    // The shaped charge is left as it was.
    expect(round(tank((spec) => { spec.ammo.kinetic = 'longRod' }), 'shaped')).toEqual(round(tank(), 'shaped'))
  })

  it('make a tandem warhead that leaves a reactive tile little to do', () => {
    const pact = round(tank(), 'shaped').round
    const tandem = round(tank((spec) => { spec.ammo.shaped = 'tandem' }), 'shaped').round
    expect(tandem.tandem).toBe(true)
    expect(tandem.penMm).toBeGreaterThan(pact.penMm)
    expect(tileWorthMm(tandem)).toBeLessThan(tileWorthMm(pact))
  })

  it('make a missile that is slow, tight, and owes nothing to the barrel', () => {
    const missile = (barrel: VehicleSpec['barrel']) => round(tank((spec) => { spec.ammo.shaped = 'gunMissile'; spec.barrel = barrel }), 'shaped').round
    const pact = round(tank(), 'shaped').round
    expect(missile('standard').speedMs).toBeLessThan(pact.speedMs)
    expect(missile('standard').spreadM).toBeLessThan(pact.spreadM)
    expect(missile('standard').penMm).toBeGreaterThan(pact.penMm)
    expect(missile('long')).toEqual(missile('short'))
  })

  it('cost more to carry', () => {
    const cost = (change?: (spec: VehicleSpec) => void) => buildStatSheet(tank(change), GEN2).unitCostKr
    expect(cost((spec) => { spec.ammo.kinetic = 'longRod' })).toBeGreaterThan(cost())
    expect(cost((spec) => { spec.ammo.shaped = 'gunMissile' })).toBeGreaterThan(cost((spec) => { spec.ammo.shaped = 'tandem' }))
  })

  it('ask something of the tank that fires them', () => {
    expect(codes(tank((spec) => { spec.ammo.kinetic = 'longRod'; spec.loading = 'carousel' }))).toContain('rodTooLongForCarousel')
    expect(codes(tank((spec) => { spec.ammo.kinetic = 'longRod'; spec.loading = 'loader' }))).not.toContain('rodTooLongForCarousel')
    const rifled = codes(tank((spec) => { spec.ammo.shaped = 'gunMissile'; spec.gun = 'rifled100' }))
    expect(rifled).toContain('missileNeedsSmoothbore')
    expect(rifled).toContain('missileNeedsComputer')
    const right = codes(tank((spec) => { spec.ammo.shaped = 'gunMissile'; spec.gun = 'smooth125'; spec.fireControl.computer = 'digital' }))
    expect(right).not.toContain('missileNeedsSmoothbore')
    expect(right).not.toContain('missileNeedsComputer')
  })

  it('are generation two, and have to be researched', () => {
    const rod = tank((spec) => { spec.ammo.kinetic = 'longRod' })
    expect(codes(rod, PACT_LIMITS_GEN1)).toContain('notYetAvailable')
    const second: Career = { ...newCareer(2), tenderNo: 1, budgetKr: 40_000_000 }
    expect(codes(rod, careerLimits(second))).toContain('notResearched')
    expect(codes(rod, careerLimits(research(second, 'longRodRound')))).not.toContain('notResearched')
  })
})
