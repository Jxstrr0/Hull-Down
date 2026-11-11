import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { CONTROLS, PART_TABS, fixTarget, preview } from '../src/office/controls'
import { buildStatSheet, type VehicleSpec } from '../src/sim/vehicle'

function fresh(): VehicleSpec {
  return structuredClone(BASELINE_SPEC)
}

describe('design office controls', () => {
  it('have one control for each label, with no repeats', () => {
    const ids = CONTROLS.map((control) => control.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(Object.keys(STRINGS.controls).sort())
  })

  it('give every tab a name and at least one control', () => {
    const tabs: Record<string, string> = STRINGS.office.tabs
    for (const tab of PART_TABS) {
      expect(tabs[tab], tab).toBeTruthy()
      expect(CONTROLS.some((control) => control.tab === tab), tab).toBe(true)
    }
  })

  it('read the baseline as one of their own options', () => {
    const spec = fresh()
    for (const control of CONTROLS) {
      if (control.kind === 'choice') expect(control.options, control.id).toContain(control.get(spec))
      if (control.kind === 'number') {
        expect(control.get(spec), control.id).toBeGreaterThanOrEqual(control.min)
        expect(control.get(spec), control.id).toBeLessThanOrEqual(control.max)
      }
    }
  })

  it('set every choice, and name and describe every option', () => {
    for (const control of CONTROLS) {
      if (control.kind !== 'choice') continue
      expect(control.options.length, control.id).toBeGreaterThan(1)
      for (const option of control.options) {
        const spec = fresh()
        control.set(spec, option)
        expect(control.get(spec), `${control.id}:${option}`).toBe(option)
        expect(control.text[option]?.name, `${control.id}:${option}`).toBeTruthy()
        expect(control.text[option]?.note, `${control.id}:${option}`).toBeTruthy()
        const sheet = buildStatSheet(spec, PACT_LIMITS_GEN1)
        expect(Number.isFinite(sheet.massT)).toBe(true)
      }
    }
  })

  it('ignore a choice that is not on the list', () => {
    const spec = fresh()
    for (const control of CONTROLS) if (control.kind === 'choice') control.set(spec, 'no-such-part')
    expect(spec).toEqual(BASELINE_SPEC)
  })

  it('clamp numbers to their range and snap them to their step', () => {
    for (const control of CONTROLS) {
      if (control.kind !== 'number') continue
      const spec = fresh()
      control.set(spec, control.max + 10 * control.step)
      expect(control.get(spec), control.id).toBe(control.max)
      control.set(spec, control.min - 10 * control.step)
      expect(control.get(spec), control.id).toBe(control.min)
      control.set(spec, control.min + control.step * 1.4)
      expect(control.get(spec), control.id).toBe(control.min + control.step)
      control.set(spec, Number.NaN)
      expect(control.get(spec), control.id).toBe(control.min + control.step)
      expect((control.max - control.min) % control.step, control.id).toBe(0)
    }
  })

  it('flip every toggle', () => {
    for (const control of CONTROLS) {
      if (control.kind !== 'toggle') continue
      const spec = fresh()
      const before = control.get(spec)
      control.set(spec, !before)
      expect(control.get(spec), control.id).toBe(!before)
      expect(control.text.name).toBeTruthy()
    }
  })
})

describe('fix links', () => {
  it('lead from each fault to a control, except armour until PR 3', () => {
    const broken = fresh()
    broken.turret.ringMm = 1850
    broken.loading = 'bustleLoader'
    broken.ammo.stowage = 'blowOutPanels'
    broken.gun = 'rifled120'
    broken.powerpack.engine = 'turbine1000'
    broken.powerpack.transmission = 'manual38'
    broken.runningGear.roadWheels = 7
    broken.runningGear.trackWidthMm = 700
    broken.armour.belly.push({ material: 'rolledSteel', mm: 300 })
    const sheet = buildStatSheet(broken, PACT_LIMITS_GEN1)
    expect(sheet.issues.length).toBeGreaterThan(8)
    for (const issue of sheet.issues) {
      const target = fixTarget(issue.part)
      if (issue.part.startsWith('armour')) expect(target).toBeUndefined()
      else expect(target?.id, issue.code).toBe(issue.part)
    }
  })
})

describe('option previews', () => {
  const spec = fresh()
  const now = buildStatSheet(spec, PACT_LIMITS_GEN1)

  it('show no change for a change that does nothing, and leave the design alone', () => {
    const same = preview(spec, PACT_LIMITS_GEN1, now, () => undefined)
    expect(same.massDeltaT).toBe(0)
    expect(same.costDeltaKr).toBe(0)
    expect(same.newErrors).toEqual([])
    preview(spec, PACT_LIMITS_GEN1, now, (copy) => { copy.hull.size = 'heavy' })
    expect(spec).toEqual(BASELINE_SPEC)
  })

  it('show the weight and cost of a change', () => {
    const liner = preview(spec, PACT_LIMITS_GEN1, now, (copy) => { copy.protection.spallLiner = true })
    expect(liner.massDeltaT).toBeGreaterThan(0)
    expect(liner.costDeltaKr).toBeGreaterThan(0)
    const light = preview(spec, PACT_LIMITS_GEN1, now, (copy) => { copy.powerpack.fuelL = 600 })
    expect(light.massDeltaT).toBeLessThan(0)
  })

  it('warn about a fault the change would cause, but not one already there', () => {
    const bustle = preview(spec, PACT_LIMITS_GEN1, now, (copy) => { copy.loading = 'bustleLoader' })
    expect(bustle.newErrors.map((issue) => issue.code)).toEqual(['loaderNeedsBustle'])

    const already = fresh()
    already.loading = 'bustleLoader'
    const sheet = buildStatSheet(already, PACT_LIMITS_GEN1)
    const again = preview(already, PACT_LIMITS_GEN1, sheet, (copy) => { copy.powerpack.fuelL = 1100 })
    expect(again.newErrors).toEqual([])
  })
})
