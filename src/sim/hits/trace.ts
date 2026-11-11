// One shot, followed all the way: where it strikes, the angle it meets the
// plate at, each layer in its way, and then, if anything is left of it, on
// through the inside to whatever it reaches. Fire suppression, blow-out
// panels and the spall liner have their say at the end.
// Game-level abstractions, not engineering data.
import type { Round } from '../../data/ammo'
import type { StationId } from '../../data/crew'
import { HITS } from '../../data/hits'
import type { ZoneId } from '../../data/materials'
import { TUNING } from '../../data/tuning'
import { PI, detCos, detSin } from '../det'
import { unit } from '../rng'
import { hasTile } from '../vehicle/era'
import type { Geometry } from '../vehicle/geometry'
import { penetrationAt } from '../vehicle/protection'
import { shotThrough, type ShotResult } from '../vehicle/shot'
import type { VehicleSpec } from '../vehicle/spec'
import { ITEM_IDS, type Interior, type InteriorItem, type ItemId, type ItemKind } from './interior'
import { along, boxCrossing, crossing, dot, shellOf, tilePlaceAt, trackBox, vec, zoneAt, type Shell, type Vec } from './shell'

/** A tank as a target: its armour, its outside and its inside. */
export interface Target {
  spec: VehicleSpec
  shell: Shell
  interior: Interior
}

export function targetOf(spec: VehicleSpec, geo: Geometry, interior: Interior): Target {
  return { spec, shell: shellOf(interior.frame, geo), interior }
}

export interface Incoming {
  round: Round
  rangeM: number
  /** Where the shooter stands, in degrees round from dead ahead: 90 is off the tank's right side, 180 is behind. */
  bearingDeg: number
  /** How steeply the round comes down, degrees. Nought is level. */
  diveDeg: number
  /** A point the line of the shot passes through. */
  aim: Vec
  /** Names the luck of the shot. The same shot always comes out the same. */
  seed: number
  shotNo: number
  /** Leave out to meet whatever tiles the design has. Set to say whether the shot meets one. */
  tile?: boolean
  /** True to let what the round goes through vary within its margin of error. */
  luck?: boolean
  /**
   * True for a shot worked out on paper, as the design office does: the
   * tracks are not in the way, nothing catches fire or goes up, and the
   * chance that it would is listed for each thing reached.
   */
  onPaper?: boolean
}

/** What became of something the round reached. */
export type Effect =
  /** A crewman, out of action. */
  | 'crew'
  /** Rounds went up and took the tank with them. */
  | 'explosion'
  /** Rounds went up behind blow-out panels and the blast went outside. */
  | 'vented'
  /** A fire was started. */
  | 'fire'
  /** A working part put out of use. */
  | 'wrecked'
  /** Holed, and nothing worse came of it. */
  | 'holed'
  /** An armoured bin that kept the round out. */
  | 'binHeld'

export interface Reached {
  id: ItemId
  kind: ItemKind
  station?: StationId
  /** Where the round met it. */
  at: Vec
  /** The chance of a fire or an explosion here, when there was one. Null when there was not. */
  chance: number | null
  /** True for rounds behind blow-out panels, whose blast goes outside. */
  vented: boolean
  effect: Effect
}

/** The one-line result, least to worst. */
export const OUTCOMES = [
  'missed', 'track', 'skidded', 'stopped', 'noHarm', 'firepower', 'mobility', 'crew', 'burned', 'destroyed',
] as const
export type Outcome = (typeof OUTCOMES)[number]

export interface HitResult {
  /** The way the round was travelling. */
  direction: Vec
  /** Where it struck the armour. Null when it missed the hull and the turret. */
  entry: Vec | null
  zone: ZoneId | null
  /** True when it went through the tracks or wheels on its way, or hit nothing else. */
  track: boolean
  trackBroken: boolean
  /** True when it met a reactive tile, which is now used up. */
  tile: boolean
  /** The round against the plate, layer by layer. Null when it missed. */
  armour: ShotResult | null
  /** True when it got through the armour. */
  through: boolean
  /** Everything it reached inside, in order. */
  reached: Reached[]
  /** Where it stopped, or left by the far side. Null when it never got in. */
  end: Vec | null
  /** True when it still had something left and went out through the far side. */
  exits: boolean
  /** Crew caught by fragments off the inside of the plate. */
  spalled: StationId[]
  /** Everyone out of action from this shot, by any cause. */
  crewOut: StationId[]
  fire: 'none' | 'putOut' | 'burned'
  explosion: 'none' | 'vented' | 'destroyed'
  /** The tank can no longer move, or can no longer fight. */
  mobilityKill: boolean
  firepowerKill: boolean
  outcome: Outcome
}

function rad(deg: number): number {
  return (deg * PI) / 180
}

/** The way a round travels, from where the shooter stands. */
export function directionOf(bearingDeg: number, diveDeg: number): Vec {
  const bearing = rad(bearingDeg)
  const dive = rad(diveDeg)
  return { x: detCos(bearing) * detCos(dive), y: -detSin(dive), z: -detSin(bearing) * detCos(dive) }
}

// Names the draws of one shot apart.
const HIT = 66
const PEN = 0
const TRACK = 1
const SUPPRESSION = 2
const PER_ITEM = 10

const SIDE_ZONES: readonly ZoneId[] = ['hullSideFront', 'hullSideRear', 'turretSides']

/** The name of one tile place, so a tile that has gone off is not met twice. The two sides of the tank are kept apart. */
export function tileKey(zone: ZoneId, place: number, point: Vec): string {
  const side = SIDE_ZONES.includes(zone) ? (point.z >= 0 ? 'r' : 'l') : ''
  return `${zone}:${side}:${place}`
}

function missed(direction: Vec, track: boolean, trackBroken: boolean): HitResult {
  return {
    direction, entry: null, zone: null, track, trackBroken, tile: false, armour: null, through: false, reached: [], end: null, exits: false,
    spalled: [], crewOut: [], fire: 'none', explosion: 'none', mobilityKill: trackBroken, firepowerKill: false,
    outcome: trackBroken ? 'mobility' : track ? 'track' : 'missed',
  }
}

/**
 * Follows one shot. `spent` holds the tiles earlier shots set off; a tile
 * this shot meets is added to it.
 */
export function traceShot(target: Target, shot: Incoming, spent?: Set<string>): HitResult {
  const { spec, shell, interior } = target
  const f = shell.frame
  const d = directionOf(shot.bearingDeg, shot.diveDeg)
  const o = along(shot.aim, d, -HITS.standOffM)
  // On paper every chance comes out "no", so the whole path is listed.
  const roll = (...key: number[]): number => (shot.onPaper ? 1 : unit(shot.seed, HIT, shot.shotNo, ...key))

  const hull = crossing(shell.hull, o, d)
  const turret = crossing(shell.turret, o, d)
  const first = hull && turret ? (hull.tIn <= turret.tIn ? hull : turret) : hull ?? turret
  const firstT = first ? first.tIn : Infinity

  // Tracks and wheels stand outside the hull sides.
  let trackT = Infinity
  for (const side of shot.onPaper ? [] : ([1, -1] as const)) {
    const hit = boxCrossing(trackBox(f, side), o, d)
    if (hit && hit.tIn > 0) trackT = Math.min(trackT, hit.tIn)
  }
  const track = trackT < firstT
  const trackBroken = track && roll(TRACK) < HITS.trackBreak

  const entry = first ? along(o, d, first.tIn) : null
  const zone = first && entry ? zoneAt(shell, first.face, entry) : null
  if (!first || !entry || !zone) return missed(d, track, trackBroken)

  // What the round goes through when it arrives.
  const margin = shot.luck ? TUNING.protection.marginShare * (2 * roll(PEN) - 1) : 0
  const arrives = penetrationAt(shot.round, shot.rangeM) * (1 + margin)
  const penMm = Math.max(0, arrives - (track ? HITS.trackMm[shot.round.kind] : 0))

  const place = tilePlaceAt(shell, zone, entry)
  let tile = shot.tile ?? false
  if (shot.tile === undefined && place !== null && hasTile(spec.era[zone], place)) {
    const key = tileKey(zone, place, entry)
    tile = !spent?.has(key)
    if (tile) spent?.add(key)
  }

  // The mantlet is an upright casting set into the sloping turret front.
  const normal = zone === 'mantlet' ? vec(-1, 0, 0) : first.normal
  const armour = shotThrough(spec.armour[zone], { kind: shot.round.kind, penMm, cosine: -dot(d, normal), tile, tandem: shot.round.tandem })
  const through = !armour.ricochet && armour.leftMm > 0
  const result: HitResult = {
    direction: d, entry, zone, track, trackBroken, tile, armour, through, reached: [], end: null, exits: false,
    spalled: [], crewOut: [], fire: 'none', explosion: 'none', mobilityKill: trackBroken, firepowerKill: false,
    outcome: trackBroken ? 'mobility' : armour.ricochet ? 'skidded' : 'stopped',
  }
  if (!through) return result

  // The hull and the turret are one space inside: a line that runs from one into the other carries on.
  const other = first === hull ? turret : hull
  let tEnd = first.tOut
  if (other && other.tIn <= tEnd && other.tOut > tEnd) tEnd = other.tOut

  const inWay = interior.items
    .map((item) => ({ item, hit: boxCrossing(item.box, o, d) }))
    .filter((each): each is { item: InteriorItem; hit: { tIn: number; tOut: number } } =>
      each.hit !== null && each.hit.tOut > first.tIn && each.hit.tIn < tEnd)
    .sort((a, b) => a.hit.tIn - b.hit.tIn)

  let left = armour.leftMm
  let endT = tEnd
  let stopped = false
  let fireStarted = false
  let ventedHere = false
  const crewOut = new Set<StationId>()
  for (const { item, hit } of inWay) {
    const atT = Math.max(hit.tIn, first.tIn)
    const itemNo = PER_ITEM + ITEM_IDS.indexOf(item.id)
    const reach = (effect: Effect, chance: number | null = null): void => {
      result.reached.push({ id: item.id, kind: item.kind, station: item.station, at: along(o, d, atT), chance, vented: item.vented, effect })
    }
    if (item.stowage === 'armouredBins') {
      if (left <= HITS.binMm) {
        reach('binHeld')
        stopped = true
        endT = atT
        break
      }
      left -= HITS.binMm
    }
    switch (item.kind) {
      case 'crew':
        if (item.station) crewOut.add(item.station)
        reach('crew')
        break
      case 'ammo':
      case 'autoloader': {
        if (item.kind === 'autoloader') result.firepowerKill = true
        if (item.rounds === 0) {
          reach('wrecked')
          break
        }
        const chance = item.stowage ? HITS.cookOff[item.stowage] : HITS.autoloaderCookOff
        if (roll(itemNo) >= chance) {
          reach(item.kind === 'autoloader' ? 'wrecked' : 'holed', chance)
        } else if (item.vented) {
          ventedHere = true
          reach('vented', chance)
        } else {
          result.explosion = 'destroyed'
          reach('explosion', chance)
        }
        break
      }
      case 'fuel':
        if (roll(itemNo) < HITS.fuelFire) {
          fireStarted = true
          reach('fire', HITS.fuelFire)
        } else {
          reach('holed', HITS.fuelFire)
        }
        break
      case 'engine':
        result.mobilityKill = true
        if (roll(itemNo) < HITS.engineFire) {
          fireStarted = true
          reach('fire', HITS.engineFire)
        } else {
          reach('wrecked', HITS.engineFire)
        }
        break
      case 'transmission':
        result.mobilityKill = true
        reach('wrecked')
        break
      case 'gun':
      case 'sight':
        result.firepowerKill = true
        reach('wrecked')
        break
    }
    left -= HITS.stopMm[item.kind]
    // Nothing after an explosion matters.
    if (left <= 0 || result.explosion === 'destroyed') {
      stopped = true
      endT = Math.min(hit.tOut, tEnd)
      break
    }
  }
  result.end = along(o, d, endT)
  result.exits = !stopped

  // Fragments off the inside of the plate, about the line of the shot.
  const S = HITS.spall
  const reachM = spec.protection.spallLiner ? S.linerReachM : S.reachM
  const cone = detCos(rad(spec.protection.spallLiner ? S.linerConeDeg : S.coneDeg))
  for (const item of interior.items) {
    if (item.kind !== 'crew' || !item.station || crewOut.has(item.station)) continue
    const { box } = item
    const to = { x: (box.x0 + box.x1) / 2 - entry.x, y: (box.y0 + box.y1) / 2 - entry.y, z: (box.z0 + box.z1) / 2 - entry.z }
    const distance = Math.sqrt(dot(to, to))
    if (distance <= reachM && dot(to, d) >= distance * cone) {
      result.spalled.push(item.station)
      crewOut.add(item.station)
    }
  }

  // The protection systems.
  if (ventedHere && result.explosion === 'none') result.explosion = 'vented'
  if (fireStarted) {
    const putOut = spec.protection.fireSuppression && roll(SUPPRESSION) < HITS.suppression
    result.fire = putOut ? 'putOut' : 'burned'
  }
  if (result.explosion === 'destroyed') {
    for (const item of interior.items) if (item.station) crewOut.add(item.station)
  }
  result.crewOut = [...crewOut]
  result.outcome =
    result.explosion === 'destroyed' ? 'destroyed'
    : result.fire === 'burned' ? 'burned'
    : result.crewOut.length > 0 ? 'crew'
    : result.mobilityKill ? 'mobility'
    : result.firepowerKill || result.explosion === 'vented' ? 'firepower'
    : 'noHarm'
  return result
}
