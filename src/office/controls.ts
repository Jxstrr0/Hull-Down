// The design office controls, as plain data: what each one is called, which
// tab it lives on, and how it reads and writes the spec. No DOM in here, so
// it can be tested. A control's id is the spec path the constraint checks use
// for `Issue.part`, which is how a fault finds its "fix it" link.
import {
  ACTIVE, BARRELS, COMFORT, COMPUTERS, COOLING, ENGINES, GUNS, HULLS, LAYOUTS, LOADING, NIGHT_SIGHTS, RANGEFINDERS, RECOILS, SIGHTS,
  STABILISERS, STOWAGE, SUSPENSIONS, TRANSMISSIONS, TURRETS,
} from '../data/parts'
import { STRINGS } from '../data/strings'
import { TUNING } from '../data/tuning'
import { buildStatSheet, type Issue, type Limits, type StatSheet, type VehicleSpec } from '../sim/vehicle'

export const PART_TABS = ['hull', 'turret', 'gun', 'fireControl', 'powerpack', 'runningGear', 'crew'] as const
export type PartTab = (typeof PART_TABS)[number]

export type ControlId = keyof typeof STRINGS.controls

export interface PartText {
  name: string
  note: string
}

interface ControlBase {
  id: ControlId
  tab: PartTab
}

export interface ChoiceControl extends ControlBase {
  kind: 'choice'
  options: readonly string[]
  text: Readonly<Record<string, PartText>>
  get(spec: VehicleSpec): string
  /** Ignores an option that is not on the list. */
  set(spec: VehicleSpec, option: string): void
}

export type NumberUnit = keyof typeof STRINGS.office.numberUnits

export interface NumberControl extends ControlBase {
  kind: 'number'
  min: number
  max: number
  step: number
  unit: NumberUnit
  get(spec: VehicleSpec): number
  /** Clamps to the range and snaps to the step. */
  set(spec: VehicleSpec, value: number): void
}

export interface ToggleControl extends ControlBase {
  kind: 'toggle'
  text: PartText
  get(spec: VehicleSpec): boolean
  set(spec: VehicleSpec, on: boolean): void
}

export type Control = ChoiceControl | NumberControl | ToggleControl

function choice<T extends string>(
  id: ControlId, tab: PartTab, text: Readonly<Record<T, PartText>>,
  get: (spec: VehicleSpec) => T, set: (spec: VehicleSpec, option: T) => void,
): ChoiceControl {
  const options = Object.keys(text) as T[]
  return {
    kind: 'choice', id, tab, options, text, get,
    set: (spec, option) => {
      const match = options.find((o) => o === option)
      if (match !== undefined) set(spec, match)
    },
  }
}

function number(
  id: ControlId, tab: PartTab, range: { min: number; max: number }, step: number, unit: NumberUnit,
  get: (spec: VehicleSpec) => number, set: (spec: VehicleSpec, value: number) => void,
): NumberControl {
  return {
    kind: 'number', id, tab, min: range.min, max: range.max, step, unit, get,
    set: (spec, value) => {
      if (!Number.isFinite(value)) return
      const snapped = range.min + Math.round((value - range.min) / step) * step
      set(spec, Math.min(range.max, Math.max(range.min, snapped)))
    },
  }
}

function toggle(
  id: ControlId, tab: PartTab, text: PartText,
  get: (spec: VehicleSpec) => boolean, set: (spec: VehicleSpec, on: boolean) => void,
): ToggleControl {
  return { kind: 'toggle', id, tab, text, get, set }
}

// The part tables and the strings must list the same ids. This fails the
// type check if a part is added without its text.
function texts<T extends string>(_table: Readonly<Record<T, unknown>>, text: Readonly<Record<T, PartText>>): Readonly<Record<T, PartText>> {
  return text
}

const P = STRINGS.parts
const L = TUNING.limits

export const CONTROLS: readonly Control[] = [
  choice('hull.size', 'hull', texts(HULLS, P.hulls), (s) => s.hull.size, (s, v) => { s.hull.size = v }),
  number('hull.glacisAngleDeg', 'hull', L.glacisAngleDeg, L.glacisStepDeg, 'degrees',
    (s) => s.hull.glacisAngleDeg, (s, v) => { s.hull.glacisAngleDeg = v }),
  choice('hull.engineAt', 'hull', P.engineAt, (s) => s.hull.engineAt, (s, v) => { s.hull.engineAt = v }),

  choice('turret.shape', 'turret', texts(TURRETS, P.turrets), (s) => s.turret.shape, (s, v) => { s.turret.shape = v }),
  number('turret.ringMm', 'turret', L.ringMm, L.ringStepMm, 'mm', (s) => s.turret.ringMm, (s, v) => { s.turret.ringMm = v }),

  choice('gun', 'gun', texts(GUNS, P.guns), (s) => s.gun, (s, v) => { s.gun = v }),
  choice('barrel', 'gun', texts(BARRELS, P.barrels), (s) => s.barrel, (s, v) => { s.barrel = v }),
  choice('recoil', 'gun', texts(RECOILS, P.recoils), (s) => s.recoil, (s, v) => { s.recoil = v }),
  choice('loading', 'gun', texts(LOADING, P.loading), (s) => s.loading, (s, v) => { s.loading = v }),
  number('ammo.rounds', 'gun', L.rounds, 1, 'rounds', (s) => s.ammo.rounds, (s, v) => { s.ammo.rounds = v }),
  choice('ammo.stowage', 'gun', texts(STOWAGE, P.stowage), (s) => s.ammo.stowage, (s, v) => { s.ammo.stowage = v }),
  choice('ammo.kinetic', 'gun', P.kineticIssues, (s) => s.ammo.kinetic, (s, v) => { s.ammo.kinetic = v }),
  choice('ammo.shaped', 'gun', P.shapedIssues, (s) => s.ammo.shaped, (s, v) => { s.ammo.shaped = v }),

  choice('fireControl.sight', 'fireControl', texts(SIGHTS, P.sights),
    (s) => s.fireControl.sight, (s, v) => { s.fireControl.sight = v }),
  choice('fireControl.rangefinder', 'fireControl', texts(RANGEFINDERS, P.rangefinders),
    (s) => s.fireControl.rangefinder, (s, v) => { s.fireControl.rangefinder = v }),
  choice('fireControl.stabiliser', 'fireControl', texts(STABILISERS, P.stabilisers),
    (s) => s.fireControl.stabiliser, (s, v) => { s.fireControl.stabiliser = v }),
  choice('fireControl.computer', 'fireControl', texts(COMPUTERS, P.computers),
    (s) => s.fireControl.computer, (s, v) => { s.fireControl.computer = v }),
  choice('fireControl.night', 'fireControl', texts(NIGHT_SIGHTS, P.nightSights),
    (s) => s.fireControl.night, (s, v) => { s.fireControl.night = v }),
  toggle('fireControl.commanderSight', 'fireControl', P.commanderSight,
    (s) => s.fireControl.commanderSight, (s, v) => { s.fireControl.commanderSight = v }),
  toggle('fireControl.searchRadar', 'fireControl', P.searchRadar,
    (s) => s.fireControl.searchRadar, (s, v) => { s.fireControl.searchRadar = v }),

  choice('powerpack.engine', 'powerpack', texts(ENGINES, P.engines),
    (s) => s.powerpack.engine, (s, v) => { s.powerpack.engine = v }),
  choice('powerpack.transmission', 'powerpack', texts(TRANSMISSIONS, P.transmissions),
    (s) => s.powerpack.transmission, (s, v) => { s.powerpack.transmission = v }),
  choice('powerpack.cooling', 'powerpack', texts(COOLING, P.cooling),
    (s) => s.powerpack.cooling, (s, v) => { s.powerpack.cooling = v }),
  number('powerpack.fuelL', 'powerpack', L.fuelL, L.fuelStepL, 'litres', (s) => s.powerpack.fuelL, (s, v) => { s.powerpack.fuelL = v }),
  toggle('powerpack.apu', 'powerpack', P.apu, (s) => s.powerpack.apu, (s, v) => { s.powerpack.apu = v }),

  choice('runningGear.layout', 'runningGear', texts(LAYOUTS, P.layouts),
    (s) => s.runningGear.layout, (s, v) => { s.runningGear.layout = v }),
  choice('runningGear.suspension', 'runningGear', texts(SUSPENSIONS, P.suspensions),
    (s) => s.runningGear.suspension, (s, v) => { s.runningGear.suspension = v }),
  number('runningGear.roadWheels', 'runningGear', L.roadWheels, 1, 'wheels',
    (s) => s.runningGear.roadWheels, (s, v) => { s.runningGear.roadWheels = v }),
  number('runningGear.trackWidthMm', 'runningGear', L.trackWidthMm, L.trackStepMm, 'mm',
    (s) => s.runningGear.trackWidthMm, (s, v) => { s.runningGear.trackWidthMm = v }),
  toggle('runningGear.skirts', 'runningGear', P.skirts,
    (s) => s.runningGear.skirts, (s, v) => { s.runningGear.skirts = v }),

  choice('crew.comfort', 'crew', texts(COMFORT, P.comfort), (s) => s.crew.comfort, (s, v) => { s.crew.comfort = v }),
  toggle('protection.smokeLaunchers', 'crew', P.smokeLaunchers,
    (s) => s.protection.smokeLaunchers, (s, v) => { s.protection.smokeLaunchers = v }),
  toggle('protection.fireSuppression', 'crew', P.fireSuppression,
    (s) => s.protection.fireSuppression, (s, v) => { s.protection.fireSuppression = v }),
  toggle('protection.spallLiner', 'crew', P.spallLiner,
    (s) => s.protection.spallLiner, (s, v) => { s.protection.spallLiner = v }),
  choice('protection.active', 'crew', texts(ACTIVE, P.active), (s) => s.protection.active, (s, v) => { s.protection.active = v }),
  number('crew.troops', 'crew', L.troops, 1, 'soldiers', (s) => s.crew.troops, (s, v) => { s.crew.troops = v }),
]

/** The control a fault points at, if the design office has one for it yet. */
export function fixTarget(part: string): Control | undefined {
  return CONTROLS.find((control) => control.id === part)
}

export interface Preview {
  massDeltaT: number
  costDeltaKr: number
  /** Faults the change would add that the design does not have now. */
  newErrors: Issue[]
}

/** What would happen to weight, cost and faults if `change` were made. The spec is left alone. */
export function preview(spec: VehicleSpec, limits: Limits, now: StatSheet, change: (copy: VehicleSpec) => void): Preview {
  const copy = structuredClone(spec)
  change(copy)
  const next = buildStatSheet(copy, limits)
  const had = new Set(now.issues.map((issue) => issue.code))
  return {
    massDeltaT: next.massT - now.massT,
    costDeltaKr: next.unitCostKr - now.unitCostKr,
    newErrors: next.issues.filter((issue) => issue.severity === 'error' && !had.has(issue.code)),
  }
}
