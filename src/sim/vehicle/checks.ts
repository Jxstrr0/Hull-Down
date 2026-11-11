// Constraint checks. Each issue names the part to fix, so the design office
// can show it in red with a "fix it" link.
import { MATERIALS, ZONES } from '../../data/materials'
import { COOLING, ENGINES, GUNS, HULLS, LOADING, STOWAGE, SUSPENSIONS, TRANSMISSIONS, TURRETS } from '../../data/parts'
import { TUNING } from '../../data/tuning'
import { gunRingMm } from '../gunnery/mount'
import type { Geometry } from './geometry'
import type { Rollup } from './rollup'
import type { Limits, VehicleSpec } from './spec'
import { tooNew } from './tech'

export const ISSUE_CODES = [
  'ringTooSmallForGun',
  'ringTooBigForHull',
  'ringTooSmallForLoader',
  'ringOffStep',
  'loaderNeedsBustle',
  'stowageNeedsBustle',
  'outOfSpace',
  'overMassLimit',
  'overWidthLimit',
  'overCostLimit',
  'calibreNotStandard',
  'transmissionOverloaded',
  'suspensionOverloaded',
  'coolingOverloaded',
  'tracksOverloaded',
  'wheelsOutOfRange',
  'glacisAngleOutOfRange',
  'trackWidthOutOfRange',
  'fuelOutOfRange',
  'roundsOutOfRange',
  'tooManyLayers',
  'layerThicknessOutOfRange',
  'layerNeedsPlates',
  'zoneUnarmoured',
  'tilesNeedPlate',
  'notYetAvailable',
] as const
export type IssueCode = (typeof ISSUE_CODES)[number]

/** An error means the design cannot be built or entered. A warning means it will suffer at trial. */
export type Severity = 'error' | 'warning'

export interface Issue {
  code: IssueCode
  severity: Severity
  /** Path of the spec field to change, such as `turret.ringMm` or `armour.upperGlacis`. */
  part: string
  /** The offending value and the limit it broke, when there is a number to show. */
  value?: number
  limit?: number
}

function outside(value: number, range: { min: number; max: number }): boolean {
  return !(value >= range.min && value <= range.max)
}

export function checkSpec(spec: VehicleSpec, limits: Limits, geo: Geometry, rollup: Rollup): Issue[] {
  const issues: Issue[] = []
  const error = (code: IssueCode, part: string, value?: number, limit?: number): void => {
    issues.push({ code, severity: 'error', part, value, limit })
  }
  const warn = (code: IssueCode, part: string, value?: number, limit?: number): void => {
    issues.push({ code, severity: 'warning', part, value, limit })
  }

  const lim = TUNING.limits
  const hull = HULLS[spec.hull.size]
  const turret = TURRETS[spec.turret.shape]
  const gun = GUNS[spec.gun]
  const loading = LOADING[spec.loading]
  const ring = spec.turret.ringMm

  // Parts newer than the tender's year allows
  const generation = limits.generation ?? 1
  for (const late of tooNew(spec, generation)) error('notYetAvailable', late.part, late.generation, generation)

  // Turret ring
  const gunRing = gunRingMm(spec)
  if (ring < gunRing) error('ringTooSmallForGun', 'turret.ringMm', ring, gunRing)
  if (ring > hull.maxRingMm) error('ringTooBigForHull', 'turret.ringMm', ring, hull.maxRingMm)
  if (ring < loading.minRingMm) error('ringTooSmallForLoader', 'turret.ringMm', ring, loading.minRingMm)
  if (ring % lim.ringStepMm !== 0) error('ringOffStep', 'turret.ringMm', ring, lim.ringStepMm)

  // Things that need a bustle turret
  if (loading.needsBustle && !turret.hasBustle) error('loaderNeedsBustle', 'loading')
  if (STOWAGE[spec.ammo.stowage].needsBustle && !turret.hasBustle) error('stowageNeedsBustle', 'ammo.stowage')

  // Ranges
  if (outside(spec.hull.glacisAngleDeg, lim.glacisAngleDeg)) {
    error('glacisAngleOutOfRange', 'hull.glacisAngleDeg', spec.hull.glacisAngleDeg)
  }
  if (outside(spec.runningGear.trackWidthMm, lim.trackWidthMm)) {
    error('trackWidthOutOfRange', 'runningGear.trackWidthMm', spec.runningGear.trackWidthMm)
  }
  if (outside(spec.powerpack.fuelL, lim.fuelL)) error('fuelOutOfRange', 'powerpack.fuelL', spec.powerpack.fuelL)
  if (outside(spec.ammo.rounds, lim.rounds) || !Number.isInteger(spec.ammo.rounds)) {
    error('roundsOutOfRange', 'ammo.rounds', spec.ammo.rounds)
  }
  const wheels = spec.runningGear.roadWheels
  if (wheels < hull.minWheels || wheels > hull.maxWheels || !Number.isInteger(wheels)) {
    error('wheelsOutOfRange', 'runningGear.roadWheels', wheels, wheels < hull.minWheels ? hull.minWheels : hull.maxWheels)
  }

  // Armour stacks
  for (const zone of ZONES) {
    const layers = spec.armour[zone]
    if (layers.length > lim.maxLayersPerZone) {
      error('tooManyLayers', `armour.${zone}`, layers.length, lim.maxLayersPerZone)
    }
    if (layers.length === 0) warn('zoneUnarmoured', `armour.${zone}`)
    for (const layer of layers) {
      const most = Math.min(lim.maxLayerMm, MATERIALS[layer.material].maxMm)
      if (!(layer.mm >= lim.minLayerMm && layer.mm <= most)) {
        error('layerThicknessOutOfRange', `armour.${zone}`, layer.mm, most)
      }
    }
    // An insert or a gap must have a solid plate on each side of it.
    const loose = layers.some((layer, index) => {
      if (!MATERIALS[layer.material].needsPlates) return false
      const outer = layers[index - 1]
      const inner = layers[index + 1]
      return !outer || !inner || MATERIALS[outer.material].needsPlates || MATERIALS[inner.material].needsPlates
    })
    if (loose) error('layerNeedsPlates', `armour.${zone}`)
    // Reactive tiles bolt on to a plate.
    if (rollup.era[zone].tiles > 0 && layers.length === 0) error('tilesNeedPlate', `armour.${zone}`)
  }

  // Space
  if (rollup.usedM3 > rollup.capacityM3) error('outOfSpace', 'hull.size', rollup.usedM3, rollup.capacityM3)

  // Hard limits
  if (rollup.totalMassT > limits.maxMassT) error('overMassLimit', 'armour', rollup.totalMassT, limits.maxMassT)
  if (geo.widthM > limits.maxWidthM) error('overWidthLimit', 'runningGear.trackWidthMm', geo.widthM, limits.maxWidthM)
  if (limits.maxUnitCostKr !== undefined && rollup.unitCostKr > limits.maxUnitCostKr) {
    error('overCostLimit', 'hull.size', rollup.unitCostKr, limits.maxUnitCostKr)
  }
  if (!limits.allowedCalibresMm.includes(gun.calibreMm)) error('calibreNotStandard', 'gun', gun.calibreMm)

  // Overloaded parts: buildable, but they will break at trial
  const transmission = TRANSMISSIONS[spec.powerpack.transmission]
  if (rollup.totalMassT > transmission.ratedT) {
    warn('transmissionOverloaded', 'powerpack.transmission', rollup.totalMassT, transmission.ratedT)
  }
  const suspensionRatedT = rollup.stations * SUSPENSIONS[spec.runningGear.suspension].ratedPerStationT
  if (rollup.totalMassT > suspensionRatedT) {
    warn('suspensionOverloaded', 'runningGear.suspension', rollup.totalMassT, suspensionRatedT)
  }
  const engine = ENGINES[spec.powerpack.engine]
  const cooling = COOLING[spec.powerpack.cooling]
  if (engine.powerHp > cooling.capacityHp) {
    warn('coolingOverloaded', 'powerpack.cooling', engine.powerHp, cooling.capacityHp)
  }
  const trackRatedT = spec.runningGear.trackWidthMm * TUNING.tracks.ratedTPerMm
  if (rollup.totalMassT > trackRatedT) {
    warn('tracksOverloaded', 'runningGear.trackWidthMm', rollup.totalMassT, trackRatedT)
  }

  return issues
}
