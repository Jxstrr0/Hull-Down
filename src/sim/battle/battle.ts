// One platoon battle: three or four tanks a side on a piece of ground. Each
// crew finds, lays and fires as it does in a duel, and each round that lands
// is followed through the armour of the tank it lands on, from the side it
// really came from. A simple battle sense moves the tanks from ridge to
// ridge, shares the targets out, and holds fire or closes as the platoon was
// ordered. Game-level abstractions, not engineering data.
import type { RoundKind } from '../../data/ammo'
import { BATTLE, type BattleGround, type BattleGroundId, type Lane, type Orders, type Post } from '../../data/battle'
import type { StationId } from '../../data/crew'
import { DUEL } from '../../data/duel'
import { TUNING } from '../../data/tuning'
import { PI, detAtan, detAtan2, detLog } from '../det'
import {
  aimHeight, fights, hasSmoke, loadPace, rethink, turretPace, type AimAt, type Combatant, type Fighter, type SideNo,
} from '../duel/duel'
import { errorsOf, firstShotS, flightOf, jamS, loadS, machineFed, relayS, seenShare, type Shoot } from '../gunnery/fire'
import type { Vec } from '../hits/shell'
import { directionOf, traceShot, type HitResult } from '../hits/trace'
import { runLengthKm } from '../reliability/wear'
import { bell, hash32, unit, unitWait } from '../rng'
import { runBerm } from '../trials/berm'

export interface BattleShot {
  /** The tank that fired and the tank it fired at, by their place in `tanks`. */
  by: number
  at: number
  atS: number
  landS: number
  roundId: string
  kind: RoundKind
  rangeM: number
  aimAt: AimAt
  /** True when it was fired on the move. */
  moving: boolean
  /** The line it came in on, in the frame of the tank it was fired at. */
  bearingDeg: number
  diveDeg: number
  aim: Vec
  /** True when it struck the ridge the target sat behind. */
  berm: boolean
  /** What it did. Null when it struck the ridge. */
  hit: HitResult | null
}

/** What put a tank out of the fight. */
export type OutCause = 'destroyed' | 'burned' | 'silenced'

/**
 * How a battle ended. `wiped`: one platoon had nothing left that could
 * fight. `held`: the attack ran out of time and the ridge was still held.
 * `points`: time ran out with one platoon stronger. `draw` and `bothOut`
 * have no winner.
 */
export type BattleEnd = 'wiped' | 'bothOut' | 'held' | 'points' | 'draw'

export type BattleEventKind = 'out' | 'smoke' | 'brokeDown' | 'tracked'

export interface BattleEvent {
  atS: number
  kind: BattleEventKind
  tank: number
  /** The tank that did it, when one did. */
  by: number | null
}

export interface TankResult {
  side: SideNo
  /** Its number in its platoon, from nought. */
  no: number
  /** False when it blew up or burned out. */
  alive: boolean
  burned: boolean
  canShoot: boolean
  canMove: boolean
  brokeDown: boolean
  crewOut: StationId[]
  fired: number
  /** Rounds that struck a tank, and those of them that got through. */
  hits: number
  through: number
  /** Tanks it put out of the fight. */
  kills: number
  /** When it was put out of the fight, by which tank, and how. Null while it could still fight. */
  outS: number | null
  outBy: number | null
  cause: OutCause | null
  smokeS: number | null
  travelledM: number
}

export interface BattleResult {
  ground: BattleGroundId
  seed: number
  /** The orders each platoon fought by. */
  orders: [Orders, Orders]
  /** Every tank, the platoon under test first. */
  tanks: TankResult[]
  shots: BattleShot[]
  events: BattleEvent[]
  /**
   * Where each tank was, every `BATTLE.trackS` seconds: x, y and the way it
   * faced (degrees, nought up the ground, 90 to the right), one after another.
   */
  tracks: number[][]
  /** Null when nobody won. */
  winner: SideNo | null
  end: BattleEnd
  endS: number
  /** Tanks each platoon started with, and those still able to fight at the end. */
  started: [number, number]
  fighting: [number, number]
  firstShotBy: SideNo | null
}

// What names a roll: the tank, the shot or the other tank, then which roll it is.
const ROLL = { spot: 2, seen: 3, jam: 4, lay: 5, scatter: 6, drift: 7, ranging: 8, shake: 9, trace: 10, wear: 11 } as const
const ACROSS = 0
const UP = 1

interface Tank extends Fighter {
  index: number
  side: SideNo
  no: number
  lane: Lane
  orders: Orders
  role: 'hold' | 'attack'
  x: number
  y: number
  /** The way the hull faces, degrees: nought up the ground, 90 to the right. */
  heading: number
  /** The post it is at, or was last at. */
  at: number
  /** The post it is making for. Null when it is where it means to be. */
  going: number | null
  moving: boolean
  /** True while it is behind its ridge, going from one place on it to the other. */
  shifting: boolean
  /** When it stopped on its way to shoot. Null when it has not. */
  haltedS: number | null
  arrivedS: number
  shotsHere: number
  speedMs: number
  /** How much of it a ridge hides, metres. */
  dropM: number
  breakAtM: number
  travelledM: number
  brokeDown: boolean
  burned: boolean
  canMove: boolean
  spent: Set<string>
  fired: number
  hits: number
  through: number
  kills: number
  smokeS: number | null
  blindUntilS: number
  /** When each tank of the other platoon became known to this crew. Null while it is not. */
  known: (number | null)[]
  target: number | null
  /** When the round is in, and when the gun is on. */
  loadedS: number
  laidS: number
  engaged: number
  /** The share of the first misjudged range and wind still uncorrected. */
  left: number
  lastFiredS: number | null
  /** True once it has fired from where it stands. */
  revealed: boolean
  /** True once the other platoon has picked it out. A ridge does not hide it from them twice. */
  found: boolean
  jammedNext: boolean
  outS: number | null
  outBy: number | null
  cause: OutCause | null
}

function deg(rad: number): number {
  return (rad * 180) / PI
}

/** Turns an angle into one between -180 and 180. */
function wrap(degrees: number): number {
  let d = degrees % 360
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  return d
}

/** The way from one point to another, degrees: nought up the ground, 90 to the right. */
function wayTo(fromX: number, fromY: number, toX: number, toY: number): number {
  return deg(detAtan2(toX - fromX, toY - fromY))
}

function gap(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** The way a platoon faces: the one under test up the ground, the other down it. */
function facingOf(side: SideNo): number {
  return side === 0 ? 0 : 180
}

/** The orders a platoon is given when the player gives none. */
export const DEFAULT_ORDERS: Orders = { range: 'long', pace: 'careful' }

/**
 * Fights one battle. The platoon under test is all `mine`, the other all
 * `theirs`. The same tanks, ground, orders and seed always give the same battle.
 */
export function runBattle(
  mine: Combatant, theirs: Combatant, groundId: BattleGroundId, orders: Orders, seed: number,
): BattleResult {
  const ground: BattleGround = BATTLE.grounds[groundId]
  const bothOrders: [Orders, Orders] = [orders, ground.theirOrders]
  /** How likely a tank is to break down in each kilometre of the endurance run. */
  const wearOf = (tank: Combatant): number =>
    -detLog(Math.max(0.01, Math.min(1, tank.sheet.reliabilityIndex / 100))) / runLengthKm()

  const tanks: Tank[] = []
  for (const side of [0, 1] as const) {
    const plan = ground.platoons[side]
    const tank = side === 0 ? mine : theirs
    plan.lanes.forEach((lane, no) => {
      const start = lane[0]
      if (!start) return
      const index = tanks.length
      const hazard = wearOf(tank) * BATTLE.wearFactor
      tanks.push({
        index, side, no, lane, orders: bothOrders[side], role: plan.role, tank,
        x: start.x, y: start.y, heading: facingOf(side), at: 0, going: null, moving: false, shifting: false,
        haltedS: null, arrivedS: 0, shotsHere: 0,
        speedMs: (tank.sheet.mobility.topSpeedKmh / 3.6) * BATTLE.paceShare,
        dropM: runBerm(tank.sheet.target.shell.frame, tank.sheet.firepower.gunDepressionDeg).dropM,
        breakAtM: hazard > 0 ? (unitWait(seed, index, 0, ROLL.wear) / hazard) * 1000 : Infinity,
        travelledM: 0, brokeDown: false,
        hiddenM: 0, alive: true, burned: false, gunOut: false, canMove: true,
        crewOut: new Set(), spent: new Set(), fired: 0, hits: 0, through: 0, kills: 0,
        smokeS: null, blindUntilS: -1, known: [], target: null, loadedS: 0, laidS: 0, engaged: 0, left: 1,
        lastFiredS: null, revealed: false, found: false, aimAt: 'centre', loaded: 0, wasted: { hull: 0, turret: 0 }, wastedInAll: 0,
        jammedNext: false, outS: null, outBy: null, cause: null,
      })
    })
  }
  if (tanks.length > BATTLE.mostTanks) throw new Error('too many tanks for one battle')
  for (const tank of tanks) tank.known = tanks.map(() => null)

  const shots: BattleShot[] = []
  const events: BattleEvent[] = []
  const tracks: number[][] = tanks.map(() => [])
  /** Rounds in the air, by their place in `shots`. */
  let flying: number[] = []
  /** True once a platoon has had a round fired at it. */
  const shotAt: [boolean, boolean] = [false, false]
  let firstShotBy: SideNo | null = null
  let lastBusyS = 0
  let t = 0

  const postOf = (tank: Tank): Post => tank.lane[tank.at] ?? { x: tank.x, y: tank.y, cover: false }
  /** True while a tank sits behind a ridge. */
  const covered = (tank: Tank): boolean => tank.going === null && !tank.moving && postOf(tank).cover
  /** How much of a tank the ridge hides from a shooter: nothing when it is seen from the side. */
  const hiddenFrom = (target: Tank, shooter: Tank): number => {
    if (!covered(target)) return 0
    const off = wrap(wayTo(target.x, target.y, shooter.x, shooter.y) - facingOf(target.side))
    return Math.abs(off) <= BATTLE.coverArcDeg ? target.dropM : 0
  }
  const unseen = (tank: Tank): boolean => tank.shifting || t < tank.blindUntilS
  const clearLine = (a: Tank, b: Tank): boolean => {
    if (unseen(a) || unseen(b)) return false
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length2 = dx * dx + dy * dy
    for (const wood of ground.woods) {
      const along = length2 > 0 ? Math.max(0, Math.min(1, ((wood.x - a.x) * dx + (wood.y - a.y) * dy) / length2)) : 0
      const px = a.x + dx * along - wood.x
      const py = a.y + dy * along - wood.y
      if (px * px + py * py < wood.r * wood.r) return false
    }
    return true
  }
  const shootOf = (tank: Tank): Shoot => ({
    moving: tank.moving, night: ground.night, crew: DUEL.crew, hours: DUEL.crewHours,
  })
  const mates = (tank: Tank): Tank[] => tanks.filter((each) => each.side === tank.side && each !== tank)
  const enemies = (tank: Tank): Tank[] => tanks.filter((each) => each.side !== tank.side)

  /** Everyone loses sight of a tank, and it of them: it has fired its smoke, or gone back off its ridge. */
  const vanish = (tank: Tank): void => {
    tank.target = null
    tank.known = tank.known.map(() => null)
    for (const enemy of enemies(tank)) {
      enemy.known[tank.index] = null
      if (enemy.target === tank.index) enemy.target = null
    }
  }

  /** Notes a tank that has just been put out of the fight. */
  const putOut = (tank: Tank, by: number | null, cause: OutCause): void => {
    if (tank.outS !== null) return
    tank.outS = t
    tank.outBy = by
    tank.cause = cause
    tank.moving = false
    tank.shifting = false
    if (by !== null) {
      const shooter = tanks[by]
      if (shooter) shooter.kills++
    }
    events.push({ atS: t, kind: 'out', tank: tank.index, by })
  }

  const land = (index: number): void => {
    const shot = shots[index]
    if (!shot) return
    const shooter = tanks[shot.by]
    const target = tanks[shot.at]
    if (!shooter || !target) return
    shotAt[target.side] = true
    if (shot.berm) return
    const loaded = shooter.tank.rounds.find((each) => each.id === shot.roundId)
    if (!loaded) return
    const could = fights(target)
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
    if (hit.through) shooter.through++
    if (shooter.alive) {
      target.hiddenM = hiddenFrom(target, shooter)
      rethink(shooter, target, hit)
    }

    for (const station of hit.crewOut) target.crewOut.add(station)
    if (hit.firepowerKill) target.gunOut = true
    if ((hit.mobilityKill || target.crewOut.has('driver')) && target.canMove) {
      target.canMove = false
      target.moving = false
      target.shifting = false
      if (fights(target)) events.push({ atS: t, kind: 'tracked', tank: target.index, by: shooter.index })
    }
    if (hit.explosion === 'destroyed') target.alive = false
    if (hit.fire === 'burned') {
      target.alive = false
      target.burned = true
    }
    if (could && !fights(target)) {
      putOut(target, shooter.index, !target.alive ? (target.burned ? 'burned' : 'destroyed') : 'silenced')
    }
    // A tank that has been holed and can still fight hides itself to get its breath back.
    if (hit.through && fights(target) && target.smokeS === null && hasSmoke(target)) {
      target.smokeS = t
      target.blindUntilS = t + DUEL.smoke.blindS
      vanish(target)
      events.push({ atS: t, kind: 'smoke', tank: target.index, by: null })
    }
  }

  const fire = (shooter: Tank, target: Tank): void => {
    const sheet = shooter.tank.sheet
    const shoot = shootOf(shooter)
    const loaded = shooter.tank.rounds[shooter.loaded] ?? shooter.tank.rounds[0]
    if (!loaded) return
    const rangeM = Math.max(1, gap(shooter, target))
    const errors = errorsOf(sheet.fire, loaded.flight, rangeM, shoot)
    const layWorse = (shooter.crewOut.has('gunner') ? DUEL.crewOut.gunnerAim : 1) * (target.moving ? BATTLE.movingTargetLay : 1)
    const shotNo = shooter.fired
    const once = (what: number, axis: number): number => bell(seed, shooter.index, 1000 + shooter.engaged, what, axis)
    const each = (what: number, axis: number): number => bell(seed, shooter.index, shotNo, what, axis)
    const acrossM =
      each(ROLL.lay, ACROSS) * errors.layM * layWorse + each(ROLL.scatter, ACROSS) * errors.scatterM +
      once(ROLL.drift, ACROSS) * errors.driftAcrossM * shooter.left + each(ROLL.shake, ACROSS) * errors.shakeAcrossM
    const upM =
      each(ROLL.lay, UP) * errors.layM * layWorse + each(ROLL.scatter, UP) * errors.scatterM +
      once(ROLL.drift, UP) * errors.driftUpM * shooter.left + once(ROLL.ranging, UP) * errors.rangingM * shooter.left +
      each(ROLL.shake, UP) * errors.shakeUpM
    shooter.left *= sheet.fire.missLeft

    // The line of the shot, in the frame of the tank it is fired at.
    const flight = flightOf(loaded.flight, rangeM)
    const bearingDeg = wrap(wayTo(target.x, target.y, shooter.x, shooter.y) - target.heading)
    const diveDeg = deg(detAtan((TUNING.mobility.gravityMs2 * flight.timeS) / flight.speedMs))
    const d = directionOf(bearingDeg, diveDeg)
    const flat = Math.sqrt(d.x * d.x + d.z * d.z)
    const f = target.tank.sheet.target.shell.frame
    target.hiddenM = hiddenFrom(target, shooter)
    const aim: Vec = {
      x: f.turretX + (-d.z / flat) * acrossM,
      y: aimHeight(target, shooter.aimAt) + upM,
      z: (d.x / flat) * acrossM,
    }
    shots.push({
      by: shooter.index, at: target.index, atS: t, landS: t + flight.timeS, roundId: loaded.id, kind: loaded.round.kind,
      rangeM, aimAt: shooter.aimAt, moving: shooter.moving, bearingDeg, diveDeg, aim,
      berm: aim.y < target.hiddenM, hit: null,
    })
    flying.push(shots.length - 1)
    if (firstShotBy === null) firstShotBy = shooter.side
    shooter.fired++
    shooter.shotsHere++
    shooter.lastFiredS = t
    shooter.revealed = true
    lastBusyS = t

    // The next round.
    const jammed = machineFed(sheet.fire, shooter.fired) &&
      unit(seed, shooter.index, shooter.fired, ROLL.jam) < sheet.fire.feed.jamPerRound
    shooter.jammedNext = jammed
    shooter.loadedS = t + loadS(sheet.fire, shooter.fired, shoot) * loadPace(shooter) + (jammed ? jamS(sheet.fire, shoot) : 0)
    shooter.laidS = t + relayS(sheet.fire, shoot) * turretPace(shooter)
  }

  /** The post a tank should make for next. Null when it should stay where it is. */
  const nextPost = (tank: Tank): number | null => {
    if (tank.role === 'hold') {
      if (tank.orders.pace !== 'fast' || tank.shotsHere < BATTLE.shiftAfter || tank.lane.length < 2) return null
      return tank.at === 0 ? 1 : 0
    }
    const goal = tank.orders.range === 'long' ? tank.lane.length - 2 : tank.lane.length - 1
    if (tank.at >= goal) return null
    if (tank.orders.pace === 'fast' || !postOf(tank).cover) return tank.at + 1
    if (t - tank.arrivedS < BATTLE.boundHoldS) return null
    // Half the platoon goes on while the other half watches over it.
    if (tank.no % 2 === 0) return tank.at + 1
    const ahead = mates(tank).filter((mate) => mate.no % 2 === 0 && fights(mate) && mate.canMove)
    return ahead.every((mate) => mate.at > tank.at && mate.going === null) ? tank.at + 1 : null
  }

  const drive = (tank: Tank): void => {
    if (!fights(tank) || !tank.canMove) {
      tank.moving = false
      return
    }
    if (tank.going === null) {
      const next = nextPost(tank)
      if (next === null) return
      tank.going = next
      tank.moving = true
      tank.revealed = false
      if (tank.role === 'hold') {
        tank.shifting = true
        vanish(tank)
      }
    }
    const to = tank.lane[tank.going]
    if (!to) return
    lastBusyS = t
    // Stopped for a moment to shoot.
    tank.moving = tank.haltedS === null
    if (!tank.moving) return
    const left = gap(tank, to)
    const step = tank.speedMs * (tank.shifting ? BATTLE.shiftPaceShare : 1) * BATTLE.stepS
    if (left > BATTLE.arriveM) {
      const go = Math.min(step, left)
      tank.heading = wayTo(tank.x, tank.y, to.x, to.y)
      tank.x += ((to.x - tank.x) / left) * go
      tank.y += ((to.y - tank.y) / left) * go
      tank.travelledM += go
      if (tank.travelledM >= tank.breakAtM) {
        tank.canMove = false
        tank.moving = false
        tank.shifting = false
        tank.brokeDown = true
        events.push({ atS: t, kind: 'brokeDown', tank: tank.index, by: null })
      }
      return
    }
    tank.at = tank.going
    tank.going = null
    tank.moving = false
    tank.shifting = false
    tank.arrivedS = t
    tank.shotsHere = 0
    if (to.cover) tank.heading = facingOf(tank.side)
    // Anyone laid on it has to range it again.
    for (const enemy of enemies(tank)) {
      if (enemy.target !== tank.index) continue
      enemy.engaged++
      enemy.left = 1
    }
  }

  /** Each crew looks for tanks it has not found, and tells the platoon what it finds. */
  const look = (): void => {
    for (const tank of tanks) {
      if (!fights(tank)) continue
      const shoot = shootOf(tank)
      for (const enemy of enemies(tank)) {
        if (tank.known[enemy.index] !== null || !fights(enemy) || !clearLine(tank, enemy)) continue
        const rangeM = gap(tank, enemy)
        const roll = unit(seed, tank.index, enemy.index, ROLL.seen)
        const flash = enemy.revealed && enemy.lastFiredS !== null && t >= enemy.lastFiredS + BATTLE.flashS
        let seen: boolean
        if (flash) seen = true
        else if (ground.night) {
          seen = rangeM <= tank.tank.sheet.fire.night.seeM || roll < seenShare(tank.tank.sheet.fire, rangeM, shoot)
        } else {
          seen = enemy.found || hiddenFrom(enemy, tank) === 0 ||
            rangeM <= BATTLE.hiddenSeenM * (1 + (2 * roll - 1) * BATTLE.hiddenSpread)
        }
        if (!seen) continue
        tank.known[enemy.index] = t
        enemy.found = true
        for (const mate of mates(tank)) {
          if (mate.known[enemy.index] === null) mate.known[enemy.index] = t + BATTLE.radioS
        }
      }
    }
  }

  /** The tank a crew would rather shoot at. Null when there is nothing it can. */
  const choose = (tank: Tank): Tank | null => {
    let best: Tank | null = null
    let bestScore = Infinity
    for (const enemy of enemies(tank)) {
      const since = tank.known[enemy.index]
      if (since === null || since === undefined || t < since || !fights(enemy) || !clearLine(tank, enemy)) continue
      const k = BATTLE.choose
      let score = gap(tank, enemy)
      if (hiddenFrom(enemy, tank) > 0) score *= k.hidden
      for (const mate of mates(tank)) if (fights(mate) && mate.target === enemy.index) score *= k.shared
      if (enemy.target === tank.index) score *= k.threat
      if (score < bestScore) {
        best = enemy
        bestScore = score
      }
    }
    return best
  }

  const fight = (tank: Tank): void => {
    if (!fights(tank) || unseen(tank)) return
    const sheet = tank.tank.sheet
    let target = tank.target === null ? null : tanks[tank.target] ?? null
    if (target && (!fights(target) || !clearLine(tank, target))) target = null
    if (!target) {
      target = choose(tank)
      tank.target = target ? target.index : null
      if (!target) {
        tank.haltedS = null
        return
      }
      const spot = 1 + (2 * unit(seed, tank.index, tank.engaged, ROLL.spot) - 1) * DUEL.spotSpread
      const share = tank.engaged === 0 ? 1 : BATTLE.switchShare
      tank.laidS = t + firstShotS(sheet.fire, shootOf(tank)) * share * spot * turretPace(tank)
      tank.engaged++
      tank.left = 1
      tank.aimAt = 'centre'
      tank.wasted = { hull: 0, turret: 0 }
      tank.wastedInAll = 0
    }
    // A tank halted in the open turns its front to what it is shooting at.
    if (!tank.moving && !covered(tank)) tank.heading = wayTo(tank.x, tank.y, target.x, target.y)
    if (t < tank.loadedS || t < tank.laidS || tank.fired >= sheet.fire.carried) return
    // A platoon holding its fire waits for the range to close, or to be shot at.
    if (tank.role === 'hold' && tank.orders.range === 'close' && !shotAt[tank.side] &&
      gap(tank, target) > BATTLE.holdFireM) return
    // A careful crew does not shoot on the move: it stops, lets the tank settle, fires and goes on.
    if (tank.going !== null && tank.orders.pace === 'careful') {
      if (tank.haltedS === null) {
        tank.haltedS = t
        tank.moving = false
        return
      }
      if (t < tank.haltedS + BATTLE.settleS) return
      tank.haltedS = null
    }
    fire(tank, target)
  }

  const keep = (): void => {
    tanks.forEach((tank, index) => {
      tracks[index]?.push(Math.round(tank.x * 10) / 10, Math.round(tank.y * 10) / 10, Math.round(tank.heading))
    })
  }

  const steps = Math.round(BATTLE.limitS / BATTLE.stepS)
  const lookEvery = Math.max(1, Math.round(BATTLE.lookS / BATTLE.stepS))
  const keepEvery = Math.max(1, Math.round(BATTLE.trackS / BATTLE.stepS))
  const count = (side: SideNo): number => tanks.filter((tank) => tank.side === side && fights(tank)).length
  const started: [number, number] = [count(0), count(1)]
  let endS: number = BATTLE.limitS
  for (let step = 0; step <= steps; step++) {
    t = step * BATTLE.stepS

    const arrived = flying.filter((index) => (shots[index]?.landS ?? 0) <= t)
    flying = flying.filter((index) => (shots[index]?.landS ?? 0) > t)
    for (const index of arrived) land(index)

    if (step % keepEvery === 0) keep()
    if (flying.length === 0 && (count(0) === 0 || count(1) === 0 || t - lastBusyS >= BATTLE.stallS)) {
      endS = t
      break
    }

    for (const tank of tanks) drive(tank)
    if (step % lookEvery === 0) look()
    for (const tank of tanks) fight(tank)
  }
  keep()

  const fighting: [number, number] = [count(0), count(1)]
  const roles = [ground.platoons[0].role, ground.platoons[1].role]
  let end: BattleEnd
  let winner: SideNo | null
  if (fighting[0] === 0 && fighting[1] === 0) {
    end = 'bothOut'
    winner = null
  } else if (fighting[0] === 0 || fighting[1] === 0) {
    end = 'wiped'
    winner = fighting[0] === 0 ? 1 : 0
  } else if (roles[0] !== roles[1]) {
    end = 'held'
    winner = roles[0] === 'hold' ? 0 : 1
  } else if (fighting[0] !== fighting[1]) {
    end = 'points'
    winner = fighting[0] > fighting[1] ? 0 : 1
  } else {
    end = 'draw'
    winner = null
  }

  return {
    ground: groundId, seed, orders: bothOrders,
    tanks: tanks.map((tank) => ({
      side: tank.side, no: tank.no, alive: tank.alive, burned: tank.burned, canShoot: fights(tank),
      canMove: tank.canMove, brokeDown: tank.brokeDown, crewOut: [...tank.crewOut], fired: tank.fired,
      hits: tank.hits, through: tank.through, kills: tank.kills, outS: tank.outS, outBy: tank.outBy,
      cause: tank.cause, smokeS: tank.smokeS, travelledM: Math.round(tank.travelledM),
    })),
    shots, events, tracks, winner, end, endS, started, fighting, firstShotBy,
  }
}
