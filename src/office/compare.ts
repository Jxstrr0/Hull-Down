// Two builds of a design side by side, as plain data: the parts and armour
// that changed, where the weight went, and how every readout moved. No DOM
// in here, so it can be tested.
import { GUNNERY } from '../data/gunnery'
import { ZONES, type ZoneId } from '../data/materials'
import { STRINGS, fill } from '../data/strings'
import { AREAS, type Area, type StatSheet, type VehicleSpec } from '../sim/vehicle'
import { fixed, money } from '../ui/format'
import { CONTROLS, type Control, type ControlId } from './controls'

const C = STRINGS.office.compare
const D = STRINGS.dataSheet

/** One build: the design and the numbers it works out to. */
export interface Build {
  spec: VehicleSpec
  sheet: StatSheet
}

export interface PartChange {
  id: ControlId
  label: string
  before: string
  after: string
}

export interface ArmourChange {
  zone: ZoneId
  label: string
  before: string
  after: string
}

export type Move = 'up' | 'down' | 'same'

export interface AreaMove {
  area: Area
  label: string
  beforeT: number
  afterT: number
  move: Move
}

export const READOUT_GROUPS = ['general', 'mobility', 'firepower', 'gunnery', 'condition', 'growth', 'protection'] as const
export type ReadoutGroup = (typeof READOUT_GROUPS)[number]

export interface ReadoutMove {
  key: string
  group: ReadoutGroup
  label: string
  before: string
  after: string
  /** Which way the number went. `same` when it reads the same as before. */
  move: Move
  /** Whether that is good news. Null for a number that is neither better nor worse for being bigger. */
  verdict: 'better' | 'worse' | null
}

export interface Comparison {
  parts: PartChange[]
  armour: ArmourChange[]
  weight: AreaMove[]
  readouts: ReadoutMove[]
  /** True when nothing at all differs. */
  same: boolean
}

/** What a control is set to, in words. */
export function controlText(control: Control, spec: VehicleSpec): string {
  if (control.kind === 'choice') {
    const option = control.get(spec)
    return control.text[option]?.name ?? option
  }
  if (control.kind === 'number') return fill(STRINGS.office.numberUnits[control.unit], { n: String(control.get(spec)) })
  return control.get(spec) ? STRINGS.office.fitted : STRINGS.office.notFitted
}

/** One zone's armour in words, outside layer first, then its reactive tiles. */
export function armourText(build: Build, zone: ZoneId): string {
  const layers = build.spec.armour[zone].map((layer) => fill(C.layer, { mm: String(layer.mm), material: STRINGS.materials[layer.material].name }))
  const tiles = build.sheet.rollup.era[zone].tiles
  const words = layers.length > 0 ? layers.join(C.layerJoin) : C.noLayers
  return tiles > 0 ? `${words}${C.layerJoin}${fill(C.tiles, { n: String(tiles) })}` : words
}

type Better = 'more' | 'less' | null

interface Readout {
  key: string
  group: ReadoutGroup
  label: string
  value(sheet: StatSheet): number
  text(value: number, sheet: StatSheet): string
  better: Better
}

function unit(template: string, places: number): (value: number) => string {
  return (value) => fill(template, { n: fixed(value, places) })
}

const R = D.rows
const U = D.units
const percent = (value: number): string => fill(U.percent, { n: fixed(value * 100, 0) })

const READOUTS: readonly Readout[] = [
  { key: 'mass', group: 'general', label: R.mass, value: (s) => s.massT, text: unit(U.tonnes, 1), better: 'less' },
  { key: 'cost', group: 'general', label: R.cost, value: (s) => s.unitCostKr, text: money, better: 'less' },
  { key: 'crew', group: 'general', label: R.crew, value: (s) => s.crewCount, text: String, better: null },
  { key: 'width', group: 'general', label: R.width, value: (s) => s.geometry.widthM, text: unit(U.metres, 2), better: 'less' },
  { key: 'height', group: 'general', label: R.height, value: (s) => s.geometry.heightM, text: unit(U.metres, 2), better: 'less' },

  { key: 'powerToWeight', group: 'mobility', label: R.powerToWeight, value: (s) => s.mobility.powerToWeightHpT, text: unit(U.hpPerTonne, 1), better: 'more' },
  { key: 'topSpeed', group: 'mobility', label: R.topSpeed, value: (s) => s.mobility.topSpeedKmh, text: unit(U.kmh, 0), better: 'more' },
  { key: 'range', group: 'mobility', label: R.range, value: (s) => s.mobility.rangeKm, text: unit(U.km, 0), better: 'more' },
  { key: 'groundPressure', group: 'mobility', label: R.groundPressure, value: (s) => s.mobility.groundPressureKgCm2, text: unit(U.kgCm2, 2), better: 'less' },
  { key: 'maxSlope', group: 'mobility', label: R.maxSlope, value: (s) => Math.floor(s.mobility.maxSlopeDeg), text: unit(U.degrees, 0), better: 'more' },
  { key: 'trench', group: 'mobility', label: R.trench, value: (s) => s.mobility.trenchM, text: unit(U.metres, 2), better: 'more' },
  { key: 'step', group: 'mobility', label: R.step, value: (s) => s.mobility.stepM, text: unit(U.metres, 2), better: 'more' },
  { key: 'clearance', group: 'mobility', label: R.clearance, value: (s) => s.mobility.clearanceM, text: unit(U.metres, 2), better: 'more' },

  { key: 'gun', group: 'firepower', label: R.gun, value: (s) => s.firepower.calibreMm, text: unit(U.mm, 0), better: null },
  { key: 'rounds', group: 'firepower', label: R.rounds, value: (s) => s.firepower.rounds, text: String, better: 'more' },
  { key: 'depression', group: 'firepower', label: R.depression, value: (s) => s.firepower.gunDepressionDeg, text: unit(U.degrees, 1), better: 'more' },

  { key: 'firstShot', group: 'gunnery', label: R.firstShot, value: (s) => s.gunnery.firstShotS, text: unit(U.seconds, 0), better: 'less' },
  {
    key: 'firstShotMoving', group: 'gunnery', label: R.firstShotMoving, value: (s) => s.gunnery.firstShotMovingS,
    text: (value, sheet) => fill(sheet.fire.moving.halts ? U.secondsHalted : U.seconds, { n: fixed(value, 0) }), better: 'less',
  },
  { key: 'rateOfFire', group: 'gunnery', label: R.rateOfFire, value: (s) => s.firepower.rateOfFireRpm, text: unit(U.perMinute, 1), better: 'more' },
  {
    key: 'sustained', group: 'gunnery', label: fill(R.sustained, { n: String(GUNNERY.loading.drillRounds) }),
    value: (s) => s.gunnery.sustainedRpm, text: unit(U.perMinute, 1), better: 'more',
  },
  {
    key: 'hitMoving', group: 'gunnery', label: fill(R.hitMoving, { range: String(GUNNERY.quoteRangeM) }), value: (s) => s.gunnery.movingChance,
    text: (value, sheet) => fill(sheet.fire.moving.halts ? U.percentHalted : U.percent, { n: fixed(value * 100, 0) }), better: 'more',
  },
  { key: 'hitNight', group: 'gunnery', label: fill(R.hitNight, { range: String(GUNNERY.quoteRangeM) }), value: (s) => s.gunnery.nightChance, text: percent, better: 'more' },

  { key: 'reliability', group: 'condition', label: R.reliability, value: (s) => s.reliabilityIndex, text: unit(U.outOf100, 0), better: 'more' },
  { key: 'workload', group: 'condition', label: R.workload, value: (s) => s.crewWorkload, text: unit(U.outOf100, 0), better: 'less' },
  { key: 'comfort', group: 'condition', label: D.stations.comfort, value: (s) => s.comfort.score, text: unit(U.outOf100, 0), better: 'more' },

  { key: 'spareMass', group: 'growth', label: R.spareMass, value: (s) => s.growth.massT, text: unit(U.tonnes, 1), better: 'more' },
  { key: 'spareVolume', group: 'growth', label: R.spareVolume, value: (s) => s.growth.volumeM3, text: unit(U.cubicMetres, 1), better: 'more' },
  { key: 'spareCooling', group: 'growth', label: R.spareCooling, value: (s) => s.growth.coolingHp, text: unit(U.hp, 0), better: 'more' },

  ...ZONES.flatMap((zone): Readout[] => [
    {
      key: `ke:${zone}`, group: 'protection', label: fill(C.kinetic, { zone: STRINGS.zones[zone].name }),
      value: (s) => s.protection[zone].keMm, text: unit(U.mm, 0), better: 'more',
    },
    {
      key: `ce:${zone}`, group: 'protection', label: fill(C.shaped, { zone: STRINGS.zones[zone].name }),
      value: (s) => s.protection[zone].ceMm, text: unit(U.mm, 0), better: 'more',
    },
  ]),
]

/** Which way a number went, judged by how it reads: two numbers that print the same have not moved. */
function moveOf(before: number, after: number, same: boolean): Move {
  if (same || before === after) return 'same'
  return after > before ? 'up' : 'down'
}

/** Sets `b` against `a`: `a` is the earlier build, `b` the later. */
export function compareBuilds(a: Build, b: Build): Comparison {
  const parts: PartChange[] = []
  for (const control of CONTROLS) {
    if (control.get(a.spec) === control.get(b.spec)) continue
    parts.push({ id: control.id, label: STRINGS.controls[control.id].label, before: controlText(control, a.spec), after: controlText(control, b.spec) })
  }

  const armour: ArmourChange[] = []
  for (const zone of ZONES) {
    const same = JSON.stringify(a.spec.armour[zone]) === JSON.stringify(b.spec.armour[zone]) && a.spec.era[zone] === b.spec.era[zone]
    if (!same) armour.push({ zone, label: STRINGS.zones[zone].name, before: armourText(a, zone), after: armourText(b, zone) })
  }

  const weight = AREAS.map((area): AreaMove => {
    const beforeT = a.sheet.rollup.massT[area]
    const afterT = b.sheet.rollup.massT[area]
    return { area, label: D.areas[area], beforeT, afterT, move: moveOf(beforeT, afterT, fixed(beforeT, 2) === fixed(afterT, 2)) }
  })

  const readouts = READOUTS.map((readout): ReadoutMove => {
    const beforeValue = readout.value(a.sheet)
    const afterValue = readout.value(b.sheet)
    const before = readout.text(beforeValue, a.sheet)
    const after = readout.text(afterValue, b.sheet)
    const move = moveOf(beforeValue, afterValue, before === after)
    const verdict = move === 'same' || readout.better === null ? null : (move === 'up') === (readout.better === 'more') ? 'better' : 'worse'
    return { key: readout.key, group: readout.group, label: readout.label, before, after, move, verdict }
  })

  return {
    parts, armour, weight, readouts,
    same: parts.length === 0 && armour.length === 0,
  }
}
