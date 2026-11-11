import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { ZONES } from '../src/data/materials'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { CONTROLS } from '../src/office/controls'
import { READOUT_GROUPS, armourText, compareBuilds, controlText, type Build } from '../src/office/compare'
import { AREAS, allTiles, buildStatSheet, type VehicleSpec } from '../src/sim/vehicle'

function build(change?: (spec: VehicleSpec) => void): Build {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return { spec, sheet: buildStatSheet(spec, PACT_LIMITS_GEN1) }
}

const base = build()

describe('two builds side by side', () => {
  it('finds nothing between a build and itself', () => {
    const result = compareBuilds(base, build())
    expect(result.same).toBe(true)
    expect(result.parts).toEqual([])
    expect(result.armour).toEqual([])
    expect(result.weight.map((each) => each.area)).toEqual([...AREAS])
    for (const each of result.weight) expect(each.move).toBe('same')
    for (const each of result.readouts) {
      expect(each.move, each.key).toBe('same')
      expect(each.verdict).toBeNull()
      expect(each.before).toBe(each.after)
    }
  })

  it('does not count a new name as a change', () => {
    expect(compareBuilds(base, build((s) => { s.name = 'Bison' })).same).toBe(true)
  })

  it('names a part that changed, before and after, in words', () => {
    const more = build((s) => { s.powerpack.fuelL -= 300 })
    const result = compareBuilds(base, more)
    expect(result.same).toBe(false)
    expect(result.parts).toHaveLength(1)
    const part = result.parts[0]!
    expect(part.before).toBe(`${BASELINE_SPEC.powerpack.fuelL} L`)
    expect(part.after).toBe(`${BASELINE_SPEC.powerpack.fuelL - 300} L`)
    expect(part.label.length).toBeGreaterThan(0)
  })

  it('judges each readout by which way is better', () => {
    // Less fuel: a lighter tank that does not go as far.
    const result = compareBuilds(base, build((s) => { s.powerpack.fuelL -= 300 }))
    const by = (key: string) => result.readouts.find((each) => each.key === key)!
    expect(by('mass')).toMatchObject({ move: 'down', verdict: 'better' })
    expect(by('range')).toMatchObject({ move: 'down', verdict: 'worse' })
    expect(by('powerToWeight')).toMatchObject({ move: 'up', verdict: 'better' })
    const fuel = result.weight.find((each) => each.area === 'fuel')!
    expect(fuel.move).toBe('down')
    expect(fuel.afterT).toBeLessThan(fuel.beforeT)
    // And the other way about.
    const back = compareBuilds(build((s) => { s.powerpack.fuelL -= 300 }), base)
    expect(back.readouts.find((each) => each.key === 'mass')!).toMatchObject({ move: 'up', verdict: 'worse' })
    expect(back.readouts.find((each) => each.key === 'range')!).toMatchObject({ move: 'up', verdict: 'better' })
  })

  it('shows armour that changed, layer by layer and tile by tile', () => {
    const thick = build((s) => {
      s.armour.upperGlacis = [{ material: 'rolledSteel', mm: 120 }, { material: 'airGap', mm: 40 }]
      s.era.hullSideFront = allTiles('hullSideFront')
    })
    const result = compareBuilds(base, thick)
    expect(result.parts).toEqual([])
    expect(result.armour.map((each) => each.zone)).toEqual(['upperGlacis', 'hullSideFront'])
    expect(result.armour[0]!.after).toBe('120 mm Rolled steel + 40 mm Air gap')
    expect(result.armour[1]!.after).toMatch(/ \+ \d+ reactive tiles$/)
    expect(result.armour[1]!.before).not.toMatch(/tiles/)
    expect(result.weight.find((each) => each.area === 'armour')!.move).toBe('up')
    expect(result.readouts.find((each) => each.key === 'ke:upperGlacis')!.move).not.toBe('same')
  })

  it('does not call a number moved when it reads the same', () => {
    for (const each of compareBuilds(base, build((s) => { s.powerpack.fuelL += 1 })).readouts) {
      if (each.before === each.after) expect(each.move, each.key).toBe('same')
      else expect(each.move, each.key).not.toBe('same')
    }
  })

  it('has words for every control and every zone', () => {
    for (const control of CONTROLS) expect(controlText(control, base.spec).length, control.id).toBeGreaterThan(0)
    for (const zone of ZONES) expect(armourText(base, zone).length, zone).toBeGreaterThan(0)
    const bare = build((s) => { s.armour.belly = [] })
    expect(armourText(bare, 'belly')).toBe('No armour')
  })

  it('gives every readout a group and its own key', () => {
    const readouts = compareBuilds(base, base).readouts
    expect(new Set(readouts.map((each) => each.key)).size).toBe(readouts.length)
    for (const each of readouts) expect(READOUT_GROUPS).toContain(each.group)
  })
})
