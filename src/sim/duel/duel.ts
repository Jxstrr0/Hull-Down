// One duel: two tanks, a range, a piece of ground, and whatever the dice
// named by the seed give them. Each crew finds the other, ranges, lays and
// fires as it would on the range; each round that lands is followed through
// the armour and the inside of the tank it lands on. A simple gunner's
// sense decides where to aim and which round to use, and a hurt tank that
// has smoke uses it. Game-level abstractions, not engineering data.
import { THREATS, type Round, type RoundKind, type ThreatId } from '../../data/ammo'
import type { StationId } from '../../data/crew'
import { DUEL, type DuelGround, type DuelGroundId, type Posture } from '../../data/duel'
import { TUNING } from '../../data/tuning'
import { PI, detAtan } from '../det'
import {
  ballisticsOf, errorsOf, firstShotS, flightOf, jamS, loadS, machineFed, relayS, seenShare, type Ballistics, type Shoot,
} from '../gunnery/fire'
import { gunRounds } from '../gunnery/mount'
import { directionOf, traceShot, type HitResult } from '../hits/trace'
import type { Vec } from '../hits/shell'
import { bell, hash32, unit } from '../rng'
import { runBerm } from '../trials/berm'
import { buildStatSheet, type StatSheet } from '../vehicle/stats'
import type { Limits, VehicleSpec } from '../vehicle/spec'

/** A round in the rack: what it is called, what it does to armour, and how it flies. */
export interface Loaded {
  id: string
  round: Round
  flight: Ballistics
}

/** A tank ready for a duel. */
export interface Combatant {
  sheet: StatSheet
  /** What it fires, the round it reaches for first at the front. */
  rounds: Loaded[]
}

/** Makes a tank ready. A threat tank names the Accord rounds it fires in place of the Pact's. */
export function combatantOf(spec: VehicleSpec, limits: Limits, threatRounds?: readonly ThreatId[]): Combatant {
  const sheet = buildStatSheet(spec, limits)
  const rounds: Loaded[] = threatRounds
    ? threatRounds.map((id) => ({ id, round: THREATS[id], flight: ballisticsOf(THREATS[id]) }))
    : gunRounds(spec).map(({ id, round }) => ({ id, round, flight: ballisticsOf(round) }))
  if (rounds.length === 0) throw new Error('a tank with no rounds')
  return { sheet, rounds }
}

/** The two tanks: 0 is the one under test, 1 the one it meets. */
export type SideNo = 0 | 1

/** The part of the target the gunner lays on. */
export type AimAt = 'centre' | 'hull' | 'turret'

export interface DuelShot {
  by: SideNo
  /** When it was fired and when it landed, seconds. */
  atS: number
  landS: number
  roundId: string
  kind: RoundKind
  rangeM: number
  aimAt: AimAt
  /** Where it went from the point of aim, metres: right is positive, high is positive. */
  acrossM: number
  upM: number
  /** The line it came in on, in the frame of the tank it was fired at. */
  bearingDeg: number
  diveDeg: number
  aim: Vec
  /** True when it struck the ridge the target sits behind. */
  berm: boolean
  /** What it did. Null when it struck the ridge. */
  hit: HitResult | null
  /** True when the loader jammed getting this round up. */
  jammed: boolean
}

/** How a duel ended for the tank that lost it, or why nobody won. */
export type DuelEnd = 'destroyed' | 'burned' | 'silenced' | 'bothOut' | 'timeUp' | 'ammo'

export interface SideResult {
  /** False when it blew up or burned out. */
  alive: boolean
  burned: boolean
  canShoot: boolean
  canMove: boolean
  crewOut: StationId[]
  fired: number
  /** Rounds that struck the other tank, and those of them that got through. */
  hits: number
  through: number
  /** When it got its first round off, seconds. Null when it never did. */
  firstShotS: number | null
  /** When it fired its smoke. Null when it never did. */
  smokeS: number | null
  /** Metres of it showing over the ridge. Null when it was not behind one. */
  showsM: number | null
}

export interface DuelResult {
  ground: DuelGroundId
  seed: number
  shots: DuelShot[]
  /** Null for a draw. */
  winner: SideNo | null
  end: DuelEnd
  endS: number
  /** Metres between them at the end. */
  endRangeM: number
  firstShotBy: SideNo | null
  firstHitBy: SideNo | null
  sides: [SideResult, SideResult]
}

// What names a roll: the side, the shot or the target, then which roll it is.
const ROLL = { facing: 1, spot: 2, seen: 3, jam: 4, lay: 5, scatter: 6, drift: 7, ranging: 8, shake: 9, trace: 10 } as const
const ACROSS = 0
const UP = 1

interface Side {
  no: SideNo
  tank: Combatant
  posture: Posture
  /** Where the other tank stands, in degrees round from dead ahead of this one. */
  facingDeg: number
  /** The height hidden by the ridge, metres. Nought in the open. */
  hiddenM: number
  alive: boolean
  burned: boolean
  gunOut: boolean
  canMove: boolean
  crewOut: Set<StationId>
  /** Reactive tiles that have gone off. */
  spent: Set<string>
  fired: number
  hits: number
  through: number
  firstShotS: number | null
  smokeS: number | null
  /** True once it has picked the other tank out. */
  sees: boolean
  /** When it may next fire. Null until it has seen the other tank. */
  readyS: number | null
  /** The gunner's picture of the target. A new one is drawn each time he has to find it again. */
  engagement: number
  /** The share of the first misjudged range and wind still uncorrected. */
  left: number
  aimAt: AimAt
  loaded: number
  /** Hits that did nothing, by the part they landed on, since the aim or the round was last changed. */
  wasted: { hull: number; turret: number }
  wastedInAll: number
  jammedNext: boolean
}

function deg(rad: number): number {
  return (rad * 180) / PI
}

function shootOf(side: Side, ground: DuelGround): Shoot {
  return {
    moving: side.posture === 'advancing' && side.canMove,
    night: ground.night,
    crew: DUEL.crew,
    hours: DUEL.crewHours,
  }
}

/** A tank that can still fight: in one piece, with a gun that works and somebody to lay it. */
function fights(side: Side): boolean {
  return side.alive && !side.gunOut && !(side.crewOut.has('commander') && side.crewOut.has('gunner'))
}

/** How much longer the turret crew takes over everything, for the men it has lost. */
function turretPace(side: Side): number {
  const k = DUEL.crewOut
  return (side.crewOut.has('commander') ? k.commanderPace : 1) * (side.crewOut.has('gunner') ? k.gunnerPace : 1)
}

function loadPace(side: Side): number {
  return !side.tank.sheet.fire.feed.auto && side.crewOut.has('loader') ? DUEL.crewOut.loaderPace : 1
}

/** The heights of the target the gunner can choose between, and the one he is laying on. */
function aimHeight(target: Side, aimAt: AimAt): number {
  const f = target.tank.sheet.target.shell.frame
  const low = Math.max(target.hiddenM, f.belly)
  switch (aimAt) {
    case 'hull':
      return (low + f.roof) / 2
    case 'turret':
      return (Math.max(target.hiddenM, f.roof) + f.top) / 2
    case 'centre':
      return (low + f.top) / 2
  }
}

function hullShows(target: Side): boolean {
  return target.tank.sheet.target.shell.frame.roof - target.hiddenM >= DUEL.worthAimingM
}

/** After a hit that did nothing, the gunner tries the other part of the target, and then the other round. */
function rethink(shooter: Side, target: Side, hit: HitResult): void {
  if (hit.zone === null) return
  if (hit.through) {
    shooter.wasted = { hull: 0, turret: 0 }
    shooter.wastedInAll = 0
    return
  }
  const part = hit.zone === 'mantlet' || hit.zone.startsWith('turret') ? 'turret' : 'hull'
  shooter.wasted[part]++
  shooter.wastedInAll++
  const k = DUEL.ai
  if (shooter.wastedInAll >= k.switchRoundAfter && shooter.tank.rounds.length > 1) {
    shooter.loaded = (shooter.loaded + 1) % shooter.tank.rounds.length
    shooter.wasted = { hull: 0, turret: 0 }
    shooter.wastedInAll = 0
    shooter.aimAt = 'centre'
    return
  }
  if (shooter.wasted[part] >= k.switchAimAfter) {
    const other: AimAt = part === 'turret' ? 'hull' : 'turret'
    if (other === 'turret' || hullShows(target)) shooter.aimAt = other
  }
}

export function runDuel(a: Combatant, b: Combatant, groundId: DuelGroundId, seed: number): DuelResult {
  const ground: DuelGround = DUEL.grounds[groundId]
  const make = (no: SideNo, tank: Combatant): Side => {
    const posture = ground.postures[no]
    const frame = tank.sheet.target.shell.frame
    return {
      no,
      tank,
      posture,
      facingDeg: (2 * unit(seed, no, 0, ROLL.facing) - 1) * DUEL.facingDeg,
      hiddenM: posture === 'hullDown' ? runBerm(frame, tank.sheet.firepower.gunDepressionDeg).dropM : 0,
      alive: true,
      burned: false,
      gunOut: false,
      canMove: true,
      crewOut: new Set(),
      spent: new Set(),
      fired: 0,
      hits: 0,
      through: 0,
      firstShotS: null,
      smokeS: null,
      sees: false,
      readyS: null,
      engagement: 0,
      left: 1,
      aimAt: 'centre',
      loaded: 0,
      wasted: { hull: 0, turret: 0 },
      wastedInAll: 0,
      jammedNext: false,
    }
  }
  const sides: [Side, Side] = [make(0, a), make(1, b)]
  const other = (side: Side): Side => sides[side.no === 0 ? 1 : 0]

  const shots: DuelShot[] = []
  /** Rounds in the air, by their place in `shots`. */
  let flying: number[] = []
  let rangeM: number = ground.rangeM
  let blindUntilS = -1
  let firstShotBy: SideNo | null = null
  let firstHitBy: SideNo | null = null

  // By day both see each other at once. At night it turns on the sight.
  const seenAtStart = sides.map((side) =>
    unit(seed, side.no, 0, ROLL.seen) < seenShare(side.tank.sheet.fire, rangeM, shootOf(side, ground)))

  const land = (index: number): void => {
    const shot = shots[index]
    if (!shot) return
    const shooter = sides[shot.by]
    const target = other(shooter)
    if (shot.berm) return
    const loaded = shooter.tank.rounds.find((each) => each.id === shot.roundId)
    if (!loaded) return
    const hit = traceShot(target.tank.sheet.target, {
      round: loaded.round,
      rangeM: shot.rangeM,
      bearingDeg: shot.bearingDeg,
      diveDeg: shot.diveDeg,
      aim: shot.aim,
      seed: hash32(seed, shot.by, ROLL.trace),
      shotNo: index,
      luck: true,
    }, target.spent)
    shot.hit = hit
    if (hit.zone === null && !hit.track) return
    shooter.hits++
    if (firstHitBy === null) firstHitBy = shooter.no
    if (hit.through) shooter.through++
    if (shooter.alive) rethink(shooter, target, hit)

    for (const station of hit.crewOut) target.crewOut.add(station)
    if (hit.firepowerKill) target.gunOut = true
    if (hit.mobilityKill || target.crewOut.has('driver')) target.canMove = false
    if (hit.explosion === 'destroyed') target.alive = false
    if (hit.fire === 'burned') {
      target.alive = false
      target.burned = true
    }
    // A tank that has been holed and can still fight hides itself to get its breath back.
    if (hit.through && fights(target) && target.smokeS === null && hasSmoke(target)) {
      target.smokeS = shot.landS
      blindUntilS = shot.landS + DUEL.smoke.blindS
      for (const side of sides) {
        side.engagement++
        side.left = 1
        if (side.readyS !== null) {
          side.readyS = Math.max(side.readyS, blindUntilS + DUEL.smoke.refindS * turretPace(side))
        }
      }
    }
  }

  const fire = (shooter: Side, t: number): void => {
    const target = other(shooter)
    const sheet = shooter.tank.sheet
    const shoot = shootOf(shooter, ground)
    const loaded = shooter.tank.rounds[shooter.loaded] ?? shooter.tank.rounds[0]
    if (!loaded) return
    const errors = errorsOf(sheet.fire, loaded.flight, rangeM, shoot)
    const aimWorse = shooter.crewOut.has('gunner') ? DUEL.crewOut.gunnerAim : 1
    const shotNo = shooter.fired
    const once = (what: number, axis: number): number => bell(seed, shooter.no, 1000 + shooter.engagement, what, axis)
    const each = (what: number, axis: number): number => bell(seed, shooter.no, shotNo, what, axis)
    const acrossM =
      each(ROLL.lay, ACROSS) * errors.layM * aimWorse + each(ROLL.scatter, ACROSS) * errors.scatterM +
      once(ROLL.drift, ACROSS) * errors.driftAcrossM * shooter.left + each(ROLL.shake, ACROSS) * errors.shakeAcrossM
    const upM =
      each(ROLL.lay, UP) * errors.layM * aimWorse + each(ROLL.scatter, UP) * errors.scatterM +
      once(ROLL.drift, UP) * errors.driftUpM * shooter.left + once(ROLL.ranging, UP) * errors.rangingM * shooter.left +
      each(ROLL.shake, UP) * errors.shakeUpM
    shooter.left *= sheet.fire.missLeft

    // The line of the shot, in the frame of the tank it is fired at.
    const flight = flightOf(loaded.flight, rangeM)
    const bearingDeg = target.facingDeg
    const diveDeg = deg(detAtan((TUNING.mobility.gravityMs2 * flight.timeS) / flight.speedMs))
    const d = directionOf(bearingDeg, diveDeg)
    const flat = Math.sqrt(d.x * d.x + d.z * d.z)
    const f = target.tank.sheet.target.shell.frame
    const aim: Vec = {
      x: f.turretX + (-d.z / flat) * acrossM,
      y: aimHeight(target, shooter.aimAt) + upM,
      z: (d.x / flat) * acrossM,
    }
    const landS = t + flight.timeS
    shots.push({
      by: shooter.no, atS: t, landS, roundId: loaded.id, kind: loaded.round.kind, rangeM, aimAt: shooter.aimAt,
      acrossM, upM, bearingDeg, diveDeg, aim, berm: aim.y < target.hiddenM, hit: null, jammed: shooter.jammedNext,
    })
    flying.push(shots.length - 1)
    if (shooter.firstShotS === null) shooter.firstShotS = t
    if (firstShotBy === null) firstShotBy = shooter.no
    shooter.fired++

    // The next round.
    const jammed = machineFed(sheet.fire, shooter.fired) && unit(seed, shooter.no, shooter.fired, ROLL.jam) < sheet.fire.feed.jamPerRound
    shooter.jammedNext = jammed
    const load = loadS(sheet.fire, shooter.fired, shoot) * loadPace(shooter) + (jammed ? jamS(sheet.fire, shoot) : 0)
    shooter.readyS = t + Math.max(load, relayS(sheet.fire, shoot) * turretPace(shooter))
  }

  const steps = Math.round(DUEL.limitS / DUEL.stepS)
  let end: DuelEnd = 'timeUp'
  let endS: number = DUEL.limitS
  for (let step = 0; step <= steps; step++) {
    const t = step * DUEL.stepS

    // Rounds that have arrived.
    const arrived = flying.filter((index) => (shots[index]?.landS ?? 0) <= t)
    flying = flying.filter((index) => (shots[index]?.landS ?? 0) > t)
    for (const index of arrived) land(index)

    const standing = sides.filter(fights)
    const dry = sides.every((side) => side.fired >= side.tank.sheet.fire.carried)
    if (flying.length === 0 && (standing.length < 2 || dry)) {
      endS = t
      if (standing.length === 0) end = 'bothOut'
      else if (standing.length === 2) end = 'ammo'
      else {
        const loser = sides.find((side) => !fights(side))
        end = !loser || loser.alive ? 'silenced' : loser.burned ? 'burned' : 'destroyed'
      }
      break
    }

    // An advancing tank closes the range.
    for (const side of sides) {
      if (side.posture !== 'advancing' || !side.canMove || !side.alive) continue
      const speedMs = (side.tank.sheet.mobility.topSpeedKmh / 3.6) * DUEL.advanceShare
      rangeM = Math.max(DUEL.closestM, rangeM - speedMs * DUEL.stepS)
    }

    for (const side of sides) {
      if (!fights(side)) continue
      const sheet = side.tank.sheet
      const shoot = shootOf(side, ground)
      if (!side.sees) {
        const enemy = other(side)
        const flash = enemy.firstShotS !== null && t >= enemy.firstShotS + DUEL.flashS
        if (seenAtStart[side.no] || flash || rangeM <= sheet.fire.night.seeM) {
          side.sees = true
          const spot = 1 + (2 * unit(seed, side.no, 0, ROLL.spot) - 1) * DUEL.spotSpread
          side.readyS = t + firstShotS(sheet.fire, shoot) * spot * turretPace(side)
        }
      }
      if (side.readyS === null || t < side.readyS || t < blindUntilS) continue
      if (side.fired >= sheet.fire.carried) continue
      fire(side, t)
    }
  }

  const standing = sides.filter(fights)
  const winner = end === 'destroyed' || end === 'burned' || end === 'silenced' ? (standing[0]?.no ?? null) : null
  const resultOf = (side: Side): SideResult => ({
    alive: side.alive,
    burned: side.burned,
    canShoot: fights(side),
    canMove: side.canMove,
    crewOut: [...side.crewOut],
    fired: side.fired,
    hits: side.hits,
    through: side.through,
    firstShotS: side.firstShotS,
    smokeS: side.smokeS,
    showsM: side.posture === 'hullDown' ? side.tank.sheet.target.shell.frame.top - side.hiddenM : null,
  })
  return {
    ground: groundId, seed, shots, winner, end, endS, endRangeM: rangeM, firstShotBy, firstHitBy,
    sides: [resultOf(sides[0]), resultOf(sides[1])],
  }
}

function hasSmoke(side: Side): boolean {
  return side.tank.sheet.target.spec.protection.smokeLaunchers
}
