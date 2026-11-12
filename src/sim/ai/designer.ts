// The bot designer: builds a rival bureau's tank the way the player builds
// theirs. It starts from the Radan baseline, reaches for the parts its
// bureau likes, puts right whatever cannot be built, and then spends the
// weight it has left on armour. Same parts list, same limits, same checks.
import { BASELINE_SPEC } from '../../data/baseline'
import { MATERIALS, ZONES, type MaterialId, type ZoneId } from '../../data/materials'
import { BUREAUS, BUREAU_IDS, DESIGNER, IFV_ARMOUR, SCOUT_ARMOUR, SPG_ARMOUR, type BureauId, type LaterPicks, type Philosophy, type Picks } from '../../data/opponents'
import {
  COMPUTERS, COOLING, ENGINES, GUNS, HULLS, LOADING, NIGHT_SIGHTS, RANGEFINDERS, SIGHTS, STABILISERS, SUSPENSIONS,
  TRANSMISSIONS, TURRETS, type EngineId, type GunId, type TransmissionId, type TurretId,
} from '../../data/parts'
import { GENERATIONS, type Generation } from '../../data/tech'
import { TUNING } from '../../data/tuning'
import { gunRingMm } from '../gunnery/mount'
import { unit } from '../rng'
import { checkSpec, type Issue } from '../vehicle/checks'
import { allTiles } from '../vehicle/era'
import { geometryOf } from '../vehicle/geometry'
import { rollupOf } from '../vehicle/rollup'
import type { ArmourLayer, Limits, VehicleSpec } from '../vehicle/spec'
import { available } from '../vehicle/tech'

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

/** True when the tender takes only howitzers: it wants a self-propelled gun. */
export function wantsHowitzer(limits: Limits): boolean {
  const guns = (Object.keys(GUNS) as GunId[]).filter((gun) => allowed(gun, limits))
  return guns.length > 0 && guns.every((gun) => GUNS[gun].howitzer)
}

/** True when the tender takes only belt-fed cannon built for ground targets: it wants an infantry fighting vehicle. */
export function wantsCannon(limits: Limits): boolean {
  const guns = (Object.keys(GUNS) as GunId[]).filter((gun) => allowed(gun, limits))
  return guns.length > 0 && guns.every((gun) => GUNS[gun].beltFed && !GUNS[gun].antiAir)
}

/** True when the tender takes only anti-aircraft guns: it wants an anti-aircraft gun vehicle. */
export function wantsAirDefence(limits: Limits): boolean {
  const guns = (Object.keys(GUNS) as GunId[]).filter((gun) => allowed(gun, limits))
  return guns.length > 0 && guns.every((gun) => GUNS[gun].antiAir)
}

/** True when the tender takes only wheels and belt-fed cannon: it wants a scout car. */
export function wantsScout(limits: Limits): boolean {
  return limits.wheelsOnly === true && wantsCannon(limits)
}

/** The share of the weight limit the bureau builds up to on this tender. */
function massShareOf(philosophy: Philosophy, limits: Limits): number {
  if (wantsHowitzer(limits)) return philosophy.spg.massShare
  if (wantsScout(limits)) return philosophy.scout.massShare
  if (wantsCannon(limits) || wantsAirDefence(limits)) return philosophy.ifv.massShare
  return philosophy.massShare
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

type Swaps = Partial<Record<MaterialId, MaterialId>>

/** The newer parts a bureau has moved on to by a tender of this generation, the latest word on each. */
function laterPicks(philosophy: Philosophy, generation: Generation): LaterPicks {
  let picks: LaterPicks = {}
  for (const g of GENERATIONS) {
    const more: LaterPicks | undefined = philosophy.later[g]
    if (g <= generation && more) picks = { ...picks, ...more, materials: { ...picks.materials, ...more.materials } }
  }
  return picks
}

/** Fits each part the picks name in place of the bureau's first choice. Materials are laid by `plated`. */
function fitPicks(spec: VehicleSpec, picks: LaterPicks): void {
  if (picks.loading) spec.loading = picks.loading
  if (picks.computer) spec.fireControl.computer = picks.computer
  if (picks.night) spec.fireControl.night = picks.night
  if (picks.kinetic) spec.ammo.kinetic = picks.kinetic
  if (picks.shaped) spec.ammo.shaped = picks.shaped
  if (picks.turret) spec.turret.shape = picks.turret
  if (picks.active) spec.protection.active = picks.active
  if (picks.apu) spec.powerpack.apu = true
  if (picks.skirts) spec.runningGear.skirts = true
}

/** The bureau's armour pattern at one scale, every plate on the drawing-office step. */
function plated(pattern: Record<ZoneId, number>, scale: number, swaps: Swaps): Record<ZoneId, ArmourLayer[]> {
  const lim = TUNING.limits
  const out = {} as Record<ZoneId, ArmourLayer[]>
  for (const zone of ZONES) {
    out[zone] = BASELINE_SPEC.armour[zone].map((layer) => {
      const material = swaps[layer.material] ?? layer.material
      const most = Math.min(lim.maxLayerMm, MATERIALS[material].maxMm)
      const mm = Math.round((layer.mm * pattern[zone] * scale) / lim.layerStepMm) * lim.layerStepMm
      return { material, mm: clamp(mm, lim.minLayerMm, most) }
    })
  }
  return out
}

/** Thickens the bureau's armour pattern as far as the weight aimed at allows. */
function armourUp(spec: VehicleSpec, pattern: Record<ZoneId, number>, targetT: number, swaps: Swaps): void {
  let low: number = DESIGNER.armourScale.min
  let high: number = DESIGNER.armourScale.max
  spec.armour = plated(pattern, low, swaps)
  for (let step = 0; step < DESIGNER.armourSteps; step++) {
    const mid = (low + high) / 2
    spec.armour = plated(pattern, mid, swaps)
    if (massOf(spec) <= targetT) low = mid
    else high = mid
  }
  spec.armour = plated(pattern, low, swaps)
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
    // A round the tank cannot fire goes back to the Pact's issue.
    case 'rodTooLongForCarousel':
      spec.ammo.kinetic = 'supplied'
      return true
    case 'missileNeedsSmoothbore':
    case 'missileNeedsComputer':
      spec.ammo.shaped = 'supplied'
      return true
    // More drawn than made: the auxiliary power unit first, and failing that the active protection comes off.
    case 'overPowerBudget':
      if (!spec.powerpack.apu) {
        spec.powerpack.apu = true
        return true
      }
      if (spec.protection.active !== 'none') {
        spec.protection.active = 'none'
        return true
      }
      return false
    // Dearer than the army will pay: the next cheaper engine, and failing that the commander's sight comes off.
    case 'overCostLimit': {
      const now = ENGINES[spec.powerpack.engine].costKr
      const cheaper = (Object.keys(ENGINES) as EngineId[])
        .filter((id) => ENGINES[id].costKr < now)
        .sort((a, b) => ENGINES[b].costKr - ENGINES[a].costKr)[0]
      if (cheaper) {
        spec.powerpack.engine = cheaper
        return true
      }
      if (spec.fireControl.commanderSight) {
        spec.fireControl.commanderSight = false
        return true
      }
      return false
    }
    case 'turretNeedsAutoloader':
      spec.loading = 'carousel'
      return true
    case 'turretNeedsComputer':
      spec.fireControl.computer = 'digital'
      return true
    default:
      // Rings, wheels, tracks and weight are set by `fit` and `armourUp`, which run again after every repair.
      return false
  }
}

/** A bureau's tank on the drawing board, with the armour pattern it is being built to. */
export interface Draft {
  spec: VehicleSpec
  /** The bureau's pattern as it now stands: its own, with whatever the trials have taught it. */
  pattern: Record<ZoneId, number>
}

/**
 * Fits the running gear, armours up to the bureau's weight and puts right
 * whatever cannot be built. False when the tank cannot be built at all.
 */
function settle(spec: VehicleSpec, pattern: Record<ZoneId, number>, philosophy: Philosophy, limits: Limits): boolean {
  const targetT = limits.maxMassT * massShareOf(philosophy, limits)
  const swaps = laterPicks(philosophy, limits.generation ?? 1).materials ?? {}
  for (let turn = 0; turn < DESIGNER.repairTurns; turn++) {
    armourUp(spec, pattern, fit(spec, targetT, limits), swaps)
    const faults = errorsOf(spec, limits)
    if (faults.length === 0) return true
    if (!faults.some((issue) => repair(spec, issue))) break
  }
  return false
}

/**
 * The tank one bureau first draws up. The same bureau, limits and seed
 * always give the same tank. The name is left blank for the screen to fill in.
 */
export function draftRival(bureau: BureauId, limits: Limits, seed: number): Draft {
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
  spec.ammo = { rounds: philosophy.rounds, stowage: pick('stowage'), kinetic: 'supplied', shaped: 'supplied' }
  spec.fireControl = {
    sight: pick('sight'),
    rangefinder: pick('rangefinder'),
    stabiliser: pick('stabiliser'),
    computer: pick('computer'),
    night: pick('night'),
    commanderSight: pick('commanderSight'),
    searchRadar: false,
  }
  spec.powerpack.engine = pick('engine')
  spec.powerpack.fuelL = philosophy.fuelL
  spec.runningGear.suspension = pick('suspension')
  spec.protection = { smokeLaunchers: true, fireSuppression: pick('fireSuppression'), spallLiner: pick('spallLiner'), active: 'none' }
  spec.crew.comfort = pick('comfort')
  for (const zone of ZONES) spec.era[zone] = philosophy.tiles.includes(zone) ? allTiles(zone) : 0
  // What the bureau has moved on to by the tender's year, and what it fits for a tank destroyer.
  fitPicks(spec, laterPicks(philosophy, limits.generation ?? 1))
  if (wantsHowitzer(limits)) {
    fitPicks(spec, philosophy.spg)
    spec.ammo.rounds = philosophy.spg.rounds
  } else if (wantsScout(limits)) {
    // A scout car: on wheels, with no squad, the engine at the back, and no tiles.
    const scout = philosophy.scout
    fitPicks(spec, scout)
    spec.hull.size = scout.hull
    spec.runningGear.layout = scout.layout
    spec.ammo.rounds = scout.rounds
    spec.fireControl.commanderSight = scout.commanderSight
    if (scout.engine) spec.powerpack.engine = scout.engine
    for (const zone of ZONES) spec.era[zone] = 0
  } else if (wantsAirDefence(limits)) {
    // An anti-aircraft gun vehicle. For now each bureau builds it as its carrier, with no squad, the engine at the back,
    // the search radar and no tiles.
    const ifv = philosophy.ifv
    fitPicks(spec, ifv)
    spec.hull.size = ifv.hull
    spec.ammo.rounds = ifv.rounds
    spec.fireControl.searchRadar = true
    if (ifv.engine) spec.powerpack.engine = ifv.engine
    for (const zone of ZONES) spec.era[zone] = 0
  } else if (wantsCannon(limits)) {
    // A carrier for a squad: the engine goes in front to leave the back for the soldiers, and no tiles.
    const ifv = philosophy.ifv
    fitPicks(spec, ifv)
    spec.hull.size = ifv.hull
    spec.hull.engineAt = 'front'
    spec.crew.troops = ifv.troops
    spec.ammo.rounds = ifv.rounds
    if (ifv.engine) spec.powerpack.engine = ifv.engine
    if (ifv.rangefinder) spec.fireControl.rangefinder = ifv.rangefinder
    for (const zone of ZONES) spec.era[zone] = 0
  } else if (limits.casemate && philosophy.destroyer) fitPicks(spec, philosophy.destroyer)
  // A gun outside the tender's calibres is no use: the bureau takes the biggest gun that is allowed.
  if (!allowed(spec.gun, limits)) spec.gun = biggestGun(limits) ?? spec.gun

  const pattern = { ...philosophy.armour }
  const lean = wantsHowitzer(limits) || wantsAirDefence(limits) ? SPG_ARMOUR : wantsScout(limits) ? SCOUT_ARMOUR : wantsCannon(limits) ? IFV_ARMOUR : {}
  for (const [zone, share] of Object.entries(lean) as [ZoneId, number][]) pattern[zone] *= share
  if (settle(spec, pattern, philosophy, limits)) return { spec, pattern }
  // Nothing the bureau wanted could be built: it enters the licence-built tank as it stands.
  const fallback = copyOf(BASELINE_SPEC)
  fallback.name = ''
  return { spec: fallback, pattern }
}

/** The tank one bureau enters before any trial: its first draft. */
export function designRival(bureau: BureauId, limits: Limits, seed: number): VehicleSpec {
  return draftRival(bureau, limits, seed).spec
}

/**
 * What a trial can teach a bureau. A word names a test its tank failed; a
 * zone names a plate that let a round through.
 */
export const LESSONS = ['night', 'onTheMove', 'halted', 'drill', 'power', 'trench', 'berm', 'fireData', 'search', 'mud'] as const
export type Lesson = (typeof LESSONS)[number] | { zone: ZoneId }

/** The part after this one in its table, which lists them plainest first. Null at the end. */
function nextOf<K extends string>(table: Record<K, unknown>, current: K, allowed: (id: K) => boolean = () => true): K | null {
  const ids = Object.keys(table) as K[]
  const next = ids[ids.indexOf(current) + 1]
  return next !== undefined && allowed(next) ? next : null
}

/** One thing done about one lesson. False when the bureau has nothing better to fit. */
function learn(draft: Draft, lesson: Lesson, generation: Generation): boolean {
  const { spec } = draft
  const fc = spec.fireControl
  // A bureau fits nothing newer than the tender's year allows.
  const nightOk = (id: string): boolean => available('fireControl.night', id, generation)
  const computerOk = (id: string): boolean => available('fireControl.computer', id, generation)
  if (typeof lesson !== 'string') {
    draft.pattern[lesson.zone] *= DESIGNER.lessonArmour
    return true
  }
  switch (lesson) {
    case 'search': {
      // Hidden vehicles missed: the commander's own sight first, then a better night sight, whose heat picture finds them by day.
      if (!fc.commanderSight) {
        fc.commanderSight = true
        return true
      }
      return learn(draft, 'night', generation)
    }
    case 'mud': {
      // Bogged in the mud on wheels: more wheels to spread the weight. On tracks, or on eight wheels already, a stronger engine.
      const more = spec.runningGear.layout === 'wheels4' ? 'wheels6' : spec.runningGear.layout === 'wheels6' ? 'wheels8' : null
      if (more) {
        spec.runningGear.layout = more
        return true
      }
      return learn(draft, 'power', generation)
    }
    case 'night': {
      const night = nextOf(NIGHT_SIGHTS, fc.night, nightOk)
      if (night) fc.night = night
      return night !== null
    }
    case 'onTheMove': {
      const stabiliser = nextOf(STABILISERS, fc.stabiliser)
      if (stabiliser) {
        fc.stabiliser = stabiliser
        return true
      }
      const computer = nextOf(COMPUTERS, fc.computer, computerOk)
      if (computer) fc.computer = computer
      return computer !== null
    }
    case 'halted': {
      const rangefinder = nextOf(RANGEFINDERS, fc.rangefinder)
      if (rangefinder) {
        fc.rangefinder = rangefinder
        return true
      }
      const computer = nextOf(COMPUTERS, fc.computer, computerOk)
      if (computer) {
        fc.computer = computer
        return true
      }
      const sight = nextOf(SIGHTS, fc.sight)
      if (sight) fc.sight = sight
      return sight !== null
    }
    case 'drill': {
      // A casemate has no bustle for a loader to sit in, and the bureau keeps its casemate.
      const casemate = TURRETS[spec.turret.shape].swingDeg !== null
      const loading = nextOf(LOADING, spec.loading, (id) => !(casemate && LOADING[id].needsBustle))
      if (loading) spec.loading = loading
      return loading !== null
    }
    case 'power': {
      const now = ENGINES[spec.powerpack.engine].powerHp
      const stronger = (Object.keys(ENGINES) as EngineId[])
        .filter((id) => ENGINES[id].powerHp > now)
        .sort((a, b) => ENGINES[a].powerHp - ENGINES[b].powerHp)[0]
      if (stronger) spec.powerpack.engine = stronger
      return stronger !== undefined
    }
    case 'trench': {
      const longer = spec.hull.size === 'light' ? 'medium' : spec.hull.size === 'medium' ? 'heavy' : null
      if (longer) spec.hull.size = longer
      return longer !== null
    }
    case 'fireData': {
      // A fire mission's first round came late or wide: a better computer works out the data quicker and truer.
      const computer = nextOf(COMPUTERS, fc.computer, computerOk)
      if (computer) fc.computer = computer
      return computer !== null
    }
    case 'berm': {
      // A turret that lets the gun dip further shows less of the tank over a crest. A casemate stays a casemate.
      if (TURRETS[spec.turret.shape].swingDeg !== null) return false
      const now = TURRETS[spec.turret.shape].depressionDeg
      const deeper = (Object.keys(TURRETS) as TurretId[])
        .filter((id) => TURRETS[id].depressionDeg > now && TURRETS[id].crewed && TURRETS[id].swingDeg === null && available('turret.shape', id, generation))
        .sort((a, b) => TURRETS[a].depressionDeg - TURRETS[b].depressionDeg)[0]
      if (deeper) spec.turret.shape = deeper
      return deeper !== undefined
    }
  }
}

/**
 * The bureau's next revision: the draft with something done about each
 * lesson, rebuilt to its weight. The draft handed in is left as it was.
 * Null when nothing could be changed or the result cannot be built.
 */
export function reviseRival(draft: Draft, bureau: BureauId, limits: Limits, lessons: readonly Lesson[]): Draft | null {
  const next: Draft = { spec: copyOf(draft.spec), pattern: { ...draft.pattern } }
  let changed = false
  for (const lesson of lessons) changed = learn(next, lesson, limits.generation ?? 1) || changed
  if (!changed) return null
  return settle(next.spec, next.pattern, BUREAUS[bureau], limits) ? next : null
}
