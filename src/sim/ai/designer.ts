// The bot designer: builds a rival bureau's tank the way the player builds
// theirs. It starts from the Radan baseline, reaches for the parts its
// bureau likes, puts right whatever cannot be built, and then spends the
// weight it has left on armour. Same parts list, same limits, same checks.
import { BASELINE_SPEC } from '../../data/baseline'
import { MATERIALS, ZONES, type ZoneId } from '../../data/materials'
import { BUREAUS, BUREAU_IDS, DESIGNER, type BureauId, type Philosophy, type Picks } from '../../data/opponents'
import {
  COOLING, ENGINES, GUNS, HULLS, LOADING, SUSPENSIONS, TRANSMISSIONS, type GunId, type TransmissionId,
} from '../../data/parts'
import { TUNING } from '../../data/tuning'
import { gunRingMm } from '../gunnery/mount'
import { unit } from '../rng'
import { checkSpec, type Issue } from '../vehicle/checks'
import { allTiles } from '../vehicle/era'
import { geometryOf } from '../vehicle/geometry'
import { rollupOf } from '../vehicle/rollup'
import type { ArmourLayer, Limits, VehicleSpec } from '../vehicle/spec'

const SLOTS = [
  'hull', 'turret', 'gun', 'barrel', 'recoil', 'loading', 'stowage', 'engine', 'suspension', 'sight', 'rangefinder',
  'stabiliser', 'computer', 'night', 'comfort', 'commanderSight', 'spallLiner', 'fireSuppression',
] as const satisfies readonly (keyof Picks)[]

// Names the roll that decides between a first and a second choice.
const CHOICE = 31

function copyOf(spec: VehicleSpec): VehicleSpec {
  const armour = {} as Record<ZoneId, ArmourLayer[]>
  for (const zone of ZONES) armour[zone] = spec.armour[zone].map((layer) => ({ ...layer }))
  return {
    ...spec,
    hull: { ...spec.hull },
    turret: { ...spec.turret },
    ammo: { ...spec.ammo },
    fireControl: { ...spec.fireControl },
    powerpack: { ...spec.powerpack },
    runningGear: { ...spec.runningGear },
    protection: { ...spec.protection },
    crew: { ...spec.crew },
    armour,
    era: { ...spec.era },
  }
}

function roundUp(value: number, step: number): number {
  return Math.ceil(value / step) * step
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

function errorsOf(spec: VehicleSpec, limits: Limits): Issue[] {
  const geo = geometryOf(spec)
  return checkSpec(spec, limits, geo, rollupOf(spec, geo)).filter((issue) => issue.severity === 'error')
}

function massOf(spec: VehicleSpec): number {
  return rollupOf(spec, geometryOf(spec)).totalMassT
}

function allowed(gun: GunId, limits: Limits): boolean {
  return limits.allowedCalibresMm.includes(GUNS[gun].calibreMm)
}

function biggestGun(limits: Limits): GunId | null {
  const guns = (Object.keys(GUNS) as GunId[]).filter((gun) => allowed(gun, limits))
  guns.sort((a, b) => GUNS[b].calibreMm - GUNS[a].calibreMm)
  return guns[0] ?? null
}

/** The lightest gearbox built for the weight, or the strongest there is. */
function gearboxFor(massT: number): TransmissionId {
  const ids = (Object.keys(TRANSMISSIONS) as TransmissionId[]).sort((a, b) => TRANSMISSIONS[a].ratedT - TRANSMISSIONS[b].ratedT)
  return ids.find((id) => TRANSMISSIONS[id].ratedT >= massT) ?? ids[ids.length - 1] ?? 'manual44'
}

/**
 * Sets the ring, wheels, tracks and cooling to suit the parts chosen and the
 * weight aimed at. Gives back the weight the running gear will then carry.
 */
function fit(spec: VehicleSpec, targetT: number, limits: Limits): number {
  const lim = TUNING.limits
  const hull = HULLS[spec.hull.size]
  const ring = roundUp(Math.max(gunRingMm(spec), LOADING[spec.loading].minRingMm, lim.ringMm.min), lim.ringStepMm)
  spec.turret.ringMm = ring

  spec.powerpack.transmission = gearboxFor(targetT)
  spec.powerpack.cooling = ENGINES[spec.powerpack.engine].powerHp > COOLING.standard.capacityHp ? 'heavyDuty' : 'standard'

  // Enough wheels to carry the weight, if the hull has room for them.
  const perStationT = SUSPENSIONS[spec.runningGear.suspension].ratedPerStationT
  spec.runningGear.roadWheels = clamp(Math.ceil(targetT / perStationT / 2), hull.minWheels, hull.maxWheels)

  // Tracks wide enough for the weight, and no wider than the railway takes.
  const g = TUNING.geometry
  const widest = g.standardTrackMm + Math.floor(((limits.maxWidthM - hull.widthM) * 1000) / 2 / lim.trackStepMm) * lim.trackStepMm
  const needed = roundUp(targetT / TUNING.tracks.ratedTPerMm, lim.trackStepMm)
  spec.runningGear.trackWidthMm = clamp(Math.min(needed, widest), lim.trackWidthMm.min, lim.trackWidthMm.max)

  return Math.min(
    targetT,
    TRANSMISSIONS[spec.powerpack.transmission].ratedT,
    spec.runningGear.roadWheels * 2 * perStationT,
    spec.runningGear.trackWidthMm * TUNING.tracks.ratedTPerMm,
  )
}

/** The bureau's armour pattern at one scale, every plate on the drawing-office step. */
function plated(philosophy: Philosophy, scale: number): Record<ZoneId, ArmourLayer[]> {
  const lim = TUNING.limits
  const out = {} as Record<ZoneId, ArmourLayer[]>
  for (const zone of ZONES) {
    out[zone] = BASELINE_SPEC.armour[zone].map((layer) => {
      const most = Math.min(lim.maxLayerMm, MATERIALS[layer.material].maxMm)
      const mm = Math.round((layer.mm * philosophy.armour[zone] * scale) / lim.layerStepMm) * lim.layerStepMm
      return { material: layer.material, mm: clamp(mm, lim.minLayerMm, most) }
    })
  }
  return out
}

/** Thickens the bureau's armour pattern as far as the weight aimed at allows. */
function armourUp(spec: VehicleSpec, philosophy: Philosophy, targetT: number): void {
  let low: number = DESIGNER.armourScale.min
  let high: number = DESIGNER.armourScale.max
  spec.armour = plated(philosophy, low)
  for (let step = 0; step < DESIGNER.armourSteps; step++) {
    const mid = (low + high) / 2
    spec.armour = plated(philosophy, mid)
    if (massOf(spec) <= targetT) low = mid
    else high = mid
  }
  spec.armour = plated(philosophy, low)
}

/** One thing done about one fault. False when the designer has nothing left to try. */
function repair(spec: VehicleSpec, issue: Issue): boolean {
  const lim = TUNING.limits
  switch (issue.code) {
    case 'ringTooBigForHull': {
      if (spec.recoil !== 'longStroke') {
        spec.recoil = 'longStroke'
        return true
      }
      const bigger = spec.hull.size === 'light' ? 'medium' : spec.hull.size === 'medium' ? 'heavy' : null
      if (bigger) {
        spec.hull.size = bigger
        return true
      }
      return false
    }
    case 'loaderNeedsBustle':
    case 'stowageNeedsBustle':
      spec.turret.shape = 'bustle'
      return true
    case 'outOfSpace': {
      if (spec.ammo.rounds - DESIGNER.shedRounds >= lim.rounds.min) {
        spec.ammo.rounds -= DESIGNER.shedRounds
        return true
      }
      if (spec.powerpack.fuelL - DESIGNER.shedFuelL >= lim.fuelL.min) {
        spec.powerpack.fuelL -= DESIGNER.shedFuelL
        return true
      }
      const bigger = spec.hull.size === 'light' ? 'medium' : spec.hull.size === 'medium' ? 'heavy' : null
      if (bigger) {
        spec.hull.size = bigger
        return true
      }
      return false
    }
    default:
      // Rings, wheels, tracks and weight are set by `fit` and `armourUp`, which run again after every repair.
      return false
  }
}

/**
 * The tank one bureau enters. The same bureau, limits and seed always give
 * the same tank. The name is left blank for the screen to fill in.
 */
export function designRival(bureau: BureauId, limits: Limits, seed: number): VehicleSpec {
  const philosophy: Philosophy = BUREAUS[bureau]
  const bureauNo = BUREAU_IDS.indexOf(bureau)
  const picks = philosophy.picks
  const pick = <K extends keyof Picks>(slot: K): Picks[K][number] => {
    const options: readonly Picks[K][number][] = picks[slot]
    const second = unit(seed, CHOICE, bureauNo, SLOTS.indexOf(slot)) < DESIGNER.secondChoiceShare
    const chosen = options[second ? 1 : 0] ?? options[0]
    if (chosen === undefined) throw new Error(`no choice for ${slot}`)
    return chosen
  }

  const spec = copyOf(BASELINE_SPEC)
  spec.name = ''
  spec.hull = { size: pick('hull'), glacisAngleDeg: philosophy.glacisAngleDeg, engineAt: 'rear' }
  spec.turret.shape = pick('turret')
  spec.gun = pick('gun')
  spec.barrel = pick('barrel')
  spec.recoil = pick('recoil')
  spec.loading = pick('loading')
  spec.ammo = { rounds: philosophy.rounds, stowage: pick('stowage') }
  spec.fireControl = {
    sight: pick('sight'),
    rangefinder: pick('rangefinder'),
    stabiliser: pick('stabiliser'),
    computer: pick('computer'),
    night: pick('night'),
    commanderSight: pick('commanderSight'),
  }
  spec.powerpack.engine = pick('engine')
  spec.powerpack.fuelL = philosophy.fuelL
  spec.runningGear.suspension = pick('suspension')
  spec.protection = { smokeLaunchers: true, fireSuppression: pick('fireSuppression'), spallLiner: pick('spallLiner') }
  spec.crew.comfort = pick('comfort')
  for (const zone of ZONES) spec.era[zone] = philosophy.tiles.includes(zone) ? allTiles(zone) : 0
  // A gun outside the tender's calibres is no use: the bureau takes the biggest gun that is allowed.
  if (!allowed(spec.gun, limits)) spec.gun = biggestGun(limits) ?? spec.gun

  const targetT = limits.maxMassT * philosophy.massShare
  for (let turn = 0; turn < DESIGNER.repairTurns; turn++) {
    armourUp(spec, philosophy, fit(spec, targetT, limits))
    const faults = errorsOf(spec, limits)
    if (faults.length === 0) return spec
    if (!faults.some((issue) => repair(spec, issue))) break
  }
  // Nothing the bureau wanted could be built: it enters the licence-built tank as it stands.
  const fallback = copyOf(BASELINE_SPEC)
  fallback.name = ''
  return fallback
}
