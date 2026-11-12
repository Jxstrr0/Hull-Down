// The gunnery model: how a design finds, ranges, lays and loads, boiled down
// to the few numbers a shot needs. The design office quotes from it and the
// range shoots by it. Game-level abstractions, not engineering data.
import type { PactRoundId, Round, RoundKind } from '../../data/ammo'
import { CREW, type StationId } from '../../data/crew'
import { CREWS, GUNNERY, type CrewId } from '../../data/gunnery'
import {
  BARRELS, COMMANDER_SIGHT, COMPUTERS, GUNS, LOADING, NIGHT_SIGHTS, RANGEFINDERS, RECOILS, SIGHTS, STABILISERS, TURRETS,
} from '../../data/parts'
import { RANGE } from '../../data/range'
import { TUNING } from '../../data/tuning'
import { fatigueAfter, slowOf, stationsOf, tiringAt, workloadAt } from '../crew/stations'
import { detExp } from '../det'
import type { VehicleSpec } from '../vehicle/spec'
import { gunRounds } from './mount'

/** One kind of round, as the gun throws it. */
export interface FireRound {
  id: PactRoundId
  kind: RoundKind
  speedMs: number
  /** One standard deviation of scatter, mils. */
  scatterMil: number
  /** Metres over which it loses about two thirds of its speed. */
  dragM: number
}

/** What the flight of a round turns on. */
export type Ballistics = Omit<FireRound, 'id'>

/** How the gun is fed. */
export interface Feed {
  /** True for a machine, false for a human loader. */
  auto: boolean
  /** Seconds a round, fresh and halted. */
  freshS: number
  /** Share a human loader slows for every round already thrown. Nought for a machine. */
  tirePerRound: number
  tireMax: number
  /** Multiplier on loading time in a moving tank. */
  movingFactor: number
  /** Rounds the machine holds. Past these the crew feeds the gun by hand. Null for a human loader. */
  readyRounds: number | null
  handFeedS: number
  /** Chance of a jam on any one round. */
  jamPerRound: number
  clearS: number
}

/** Everything the range needs to know to shoot the design. */
export interface Fire {
  rounds: FireRound[]
  /** Rounds on board. */
  carried: number
  /** Aiming error, halted, by day, mils. */
  layMil: number
  ranging: { errorShare: number; minErrorM: number; nightFactor: number }
  /** Share of wind, tilt and wear left uncorrected. */
  uncorrected: number
  /** Share of a misjudged range or wind still left after the crew sees a shot fall and corrects. */
  missLeft: number
  /** Shooting from a moving tank. The mils already allow for the ride. */
  moving: { halts: boolean; acrossMil: number; upMil: number; extraS: number }
  night: { seeM: number; layFactor: number }
  /** Seconds, for a fresh trained crew with nothing else to do. */
  times: { findS: number; rangeS: number; layS: number; relayS: number }
  /** How far the gun swings each way of the hull's front, degrees; null for a turret, which turns all the way round. */
  swingDeg: number | null
  /**
   * How much slower each crewman is for the work the design gives him. 1 is
   * the reference. The commander finds targets, and with no loader feeds the
   * gun by hand and clears jams; the gunner lays the gun; `ranging` is
   * whichever of the two works the rangefinder.
   */
  pace: { commander: number; gunner: number; ranging: number }
  /** Fatigue each of them gains for every hour in the tank. The loader's is nought when a machine loads. */
  tire: { commander: number; gunner: number; ranging: number; loader: number }
  feed: Feed
}

/** The conditions of a shot. */
export interface Shoot {
  moving: boolean
  night: boolean
  crew: CrewId
  /** Hours the crew has been in the tank. Nought is a fresh crew. */
  hours: number
}

/** Halted, by day, with a fresh trained crew: what the design office quotes. */
export const RANGE_DAY: Shoot = { moving: false, night: false, crew: 'cadre', hours: 0 }

const G = GUNNERY

/** A round as the gunnery model sees it in flight. */
export function ballisticsOf(round: Round): Ballistics {
  return { kind: round.kind, speedMs: round.speedMs, scatterMil: round.spreadM * G.scatterShare, dragM: G.dragM[round.kind] }
}

export function fireOf(spec: VehicleSpec): Fire {
  const fc = spec.fireControl
  const sight = G.sights[fc.sight]
  const rangefinder = G.rangefinders[fc.rangefinder]
  const stabiliser = G.stabilisers[fc.stabiliser]
  const computer = G.computers[fc.computer]
  const gun = GUNS[spec.gun]
  const loading = LOADING[spec.loading]
  // A halted tank rocks on its springs whatever they are; only a gun fired on the move feels the ride.
  const ride = stabiliser.halts ? 1 : G.ride[spec.runningGear.suspension]
  // A long barrel whips as the tank moves, and is still swinging just after a halt.
  const whip = BARRELS[spec.barrel].whip
  const L = G.loading
  const auto = loading.fixedRof !== null
  const stations = stationsOf(spec)
  const paceOf = (station: StationId): number =>
    1 + (workloadAt(stations, station) - G.pace.referenceWorkload) * G.pace.perPoint

  return {
    rounds: gunRounds(spec).map(({ id, round }) => ({ id, ...ballisticsOf(round) })),
    carried: spec.ammo.rounds,
    layMil: sight.layMil,
    ranging: { errorShare: rangefinder.errorShare, minErrorM: rangefinder.minErrorM, nightFactor: rangefinder.nightFactor },
    uncorrected: computer.uncorrected,
    // A gun that kicks the tank hard hides the fall of shot from the gunner.
    missLeft: Math.min(1, RANGE.gunnery.correction * RECOILS[spec.recoil].rock),
    moving: {
      halts: stabiliser.halts,
      acrossMil: stabiliser.acrossMil * ride * whip,
      upMil: stabiliser.upMil * ride * whip,
      extraS: stabiliser.moveS,
    },
    night: { ...G.nightSights[fc.night] },
    times: {
      findS: fc.commanderSight ? G.find.ownSightS : G.find.plainS,
      rangeS: rangefinder.rangeS,
      // A casemate's gunner waits for the driver to swing the hull round.
      layS: (sight.layS + computer.setS) * TURRETS[spec.turret.shape].layPace,
      relayS: stabiliser.relayS,
    },
    swingDeg: TURRETS[spec.turret.shape].swingDeg,
    pace: { commander: paceOf('commander'), gunner: paceOf('gunner'), ranging: paceOf(CREW.ranging[fc.rangefinder]) },
    tire: {
      commander: tiringAt(stations, 'commander'),
      gunner: tiringAt(stations, 'gunner'),
      ranging: tiringAt(stations, CREW.ranging[fc.rangefinder]),
      loader: tiringAt(stations, 'loader'),
    },
    feed: {
      auto,
      freshS: 60 / (loading.fixedRof ?? gun.loaderRof),
      tirePerRound: auto ? 0 : L.tirePerRound * (gun.roundMassT / L.referenceRoundT) * L.comfort[spec.crew.comfort],
      tireMax: L.tireMax,
      movingFactor: auto ? 1 : L.movingFactor,
      readyRounds: auto ? loading.readyRounds : null,
      handFeedS: L.handFeedS,
      jamPerRound: auto ? (1 - loading.reliability) * L.jamShare : 0,
      clearS: L.clearS,
    },
  }
}

/** The turret parts that can let the crew down during a shoot. */
export const TURRET_PARTS = ['sight', 'rangefinder', 'stabiliser', 'computer', 'night', 'commanderSight'] as const
export type TurretPartId = (typeof TURRET_PARTS)[number]

export interface TurretPart {
  id: TurretPartId
  /** 0..1 chance it gets through a long trial with no trouble. */
  reliability: number
  /** How the tank shoots with this part out of action. */
  without: Fire
}

/**
 * The design as it is left when each turret part fails: the crew falls back
 * on the plainest way of doing that part's job. A part that is already the
 * plainest has nothing to fail and is left out.
 */
export function turretFallbacks(spec: VehicleSpec): { id: TurretPartId; reliability: number; spec: VehicleSpec }[] {
  const fc = spec.fireControl
  const out: { id: TurretPartId; reliability: number; spec: VehicleSpec }[] = []
  const without = (id: TurretPartId, reliability: number, change: Partial<VehicleSpec['fireControl']>): void => {
    out.push({ id, reliability, spec: { ...spec, fireControl: { ...fc, ...change } } })
  }
  if (fc.sight !== 'daySight') without('sight', SIGHTS[fc.sight].reliability, { sight: 'daySight' })
  if (fc.rangefinder !== 'stadiametric') without('rangefinder', RANGEFINDERS[fc.rangefinder].reliability, { rangefinder: 'stadiametric' })
  if (fc.stabiliser !== 'none') without('stabiliser', STABILISERS[fc.stabiliser].reliability, { stabiliser: 'none' })
  if (fc.computer !== 'none') without('computer', COMPUTERS[fc.computer].reliability, { computer: 'none' })
  if (fc.night !== 'none') without('night', NIGHT_SIGHTS[fc.night].reliability, { night: 'none' })
  if (fc.commanderSight) without('commanderSight', COMMANDER_SIGHT.reliability, { commanderSight: false })
  return out
}

/** How long a round takes to reach a range, and how fast it is going when it gets there. */
export function flightOf(round: Ballistics, rangeM: number): { timeS: number; speedMs: number } {
  const share = detExp(rangeM / round.dragM)
  return { timeS: (round.dragM / round.speedMs) * (share - 1), speedMs: round.speedMs / share }
}

/** The error function, to about seven places (Abramowitz and Stegun 7.1.26). */
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * x)
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return 1 - poly * detExp(-x * x)
}

function sq(x: number): number {
  return x * x
}

/** Chance that an error with this spread lands within `half` either side of the mark. */
function within(half: number, sigma: number): number {
  return sigma <= 0 ? 1 : erf(half / (sigma * Math.SQRT2))
}

/** What pushes a shot off its mark, each as one standard deviation in metres at the target. */
export interface ShotErrors {
  /** The gunner's aim. Fresh for every shot, across and up alike. */
  layM: number
  /** The round's own scatter. Fresh for every shot, across and up alike. */
  scatterM: number
  /** Wind, tilt and wear the computer did not allow for. The same for every shot at one target. */
  driftAcrossM: number
  driftUpM: number
  /** A range read wrong, which puts the shot over or under. The same for every shot at one target. */
  rangingM: number
  /** The rocking of a moving tank. Fresh for every shot. */
  shakeAcrossM: number
  shakeUpM: number
}

export function errorsOf(fire: Fire, round: Ballistics, rangeM: number, shoot: Shoot): ShotErrors {
  const crew = CREWS[shoot.crew]
  const km = rangeM / 1000
  const flight = flightOf(round, rangeM)
  const drift = fire.uncorrected * G.driftMPerS2 * flight.timeS * flight.timeS
  // A range read wrong puts the shot over or under: by more, the steeper the round is falling.
  const rangeErrorM = Math.max(fire.ranging.errorShare * rangeM, fire.ranging.minErrorM) *
    crew.aim * (shoot.night ? fire.ranging.nightFactor : 1)
  const fall = (TUNING.mobility.gravityMs2 * flight.timeS) / flight.speedMs
  const shake = shoot.moving ? km : 0
  return {
    layM: fire.layMil * crew.aim * (shoot.night ? fire.night.layFactor : 1) * km,
    scatterM: round.scatterMil * km,
    driftAcrossM: drift * (1 - G.driftUpShare),
    driftUpM: drift * G.driftUpShare,
    rangingM: rangeErrorM * fall,
    shakeAcrossM: fire.moving.acrossMil * shake,
    shakeUpM: fire.moving.upMil * shake,
  }
}

/** How far a first shot is likely to land from the middle of the target, metres: across, and up or down. */
export function missOf(fire: Fire, round: Ballistics, rangeM: number, shoot: Shoot): { acrossM: number; upM: number } {
  const e = errorsOf(fire, round, rangeM, shoot)
  const base = sq(e.layM) + sq(e.scatterM)
  return {
    acrossM: Math.sqrt(base + sq(e.driftAcrossM) + sq(e.shakeAcrossM)),
    upM: Math.sqrt(base + sq(e.driftUpM) + sq(e.rangingM) + sq(e.shakeUpM)),
  }
}

/** Share of targets at this range the gunner can pick out at all. By day, all of them. */
export function seenShare(fire: Fire, rangeM: number, shoot: Shoot): number {
  if (!shoot.night) return 1
  const gone = fire.night.seeM * G.nightFade
  if (rangeM <= fire.night.seeM) return 1
  return rangeM >= gone ? 0 : (gone - rangeM) / (gone - fire.night.seeM)
}

/** Chance of a first-round hit on the range target, 0..1. */
export function hitChance(fire: Fire, round: Ballistics, rangeM: number, shoot: Shoot): number {
  const miss = missOf(fire, round, rangeM, shoot)
  return seenShare(fire, rangeM, shoot) *
    within(G.target.widthM / 2, miss.acrossM) * within(G.target.heightM / 2, miss.upM)
}

type Role = keyof Fire['tire']

/** How worn one of the crew is in this shoot, 0 (fresh) to 1 (worn out). */
export function fatigueOf(fire: Fire, role: Role, shoot: Shoot): number {
  return fatigueAfter(shoot.hours, fire.tire[role])
}

/** How much longer one of the crew takes over a job in this shoot: the work of his station, his training and how worn he is. */
function slow(fire: Fire, role: Role, shoot: Shoot): number {
  const busy = role === 'loader' ? 1 : fire.pace[role]
  return busy * CREWS[shoot.crew].pace * slowOf(fatigueOf(fire, role, shoot))
}

/** Seconds from a target showing to the first shot, with a round already in the gun. */
export function firstShotS(fire: Fire, shoot: Shoot): number {
  const t = fire.times
  const gunner = slow(fire, 'gunner', shoot)
  const still = (t.findS * slow(fire, 'commander', shoot) + t.rangeS * slow(fire, 'ranging', shoot) + t.layS * gunner) *
    (shoot.night ? fire.night.layFactor : 1)
  return still + (shoot.moving ? fire.moving.extraS * gunner : 0)
}

/**
 * Seconds to get the next round into the gun when `fired` rounds have already
 * gone, with no jam. Past its ready rounds a machine is fed by hand.
 */
export function loadS(fire: Fire, fired: number, shoot: Shoot): number {
  const feed = fire.feed
  if (feed.readyRounds !== null) {
    return fired < feed.readyRounds ? feed.freshS : feed.handFeedS * slow(fire, 'commander', shoot)
  }
  const tired = Math.min(feed.tirePerRound * fired, feed.tireMax)
  return feed.freshS * (1 + tired) * (shoot.moving ? feed.movingFactor : 1) * slow(fire, 'loader', shoot)
}

/** Seconds a jam costs: the crew has to clear it. */
export function jamS(fire: Fire, shoot: Shoot): number {
  return fire.feed.clearS * slow(fire, 'commander', shoot)
}

/** True while the machine, not the crew, is feeding the gun. Only then can it jam. */
export function machineFed(fire: Fire, fired: number): boolean {
  return fire.feed.readyRounds !== null && fired < fire.feed.readyRounds
}

/** Seconds to bring the gun back on to the target after a shot. */
export function relayS(fire: Fire, shoot: Shoot): number {
  return fire.times.relayS * slow(fire, 'gunner', shoot)
}

/**
 * Seconds from one shot to the next, when `fired` rounds have already gone.
 * A jam is counted at its average cost; the range rolls for each one.
 */
export function cycleS(fire: Fire, fired: number, shoot: Shoot): number {
  const jam = machineFed(fire, fired) ? fire.feed.jamPerRound * jamS(fire, shoot) : 0
  return Math.max(loadS(fire, fired, shoot) + jam, relayS(fire, shoot))
}

/** Rounds a minute kept up over the long shoot. */
export function sustainedRpm(fire: Fire, shoot: Shoot): number {
  const rounds = Math.min(G.loading.drillRounds, fire.carried)
  let seconds = 0
  for (let fired = 0; fired < rounds; fired++) seconds += cycleS(fire, fired, shoot)
  return seconds > 0 ? (rounds * 60) / seconds : 0
}

/** The numbers the design office quotes. */
export interface GunneryQuote {
  /** Seconds to the first shot: halted, by day. */
  firstShotS: number
  /** Seconds to the first shot from a moving tank. */
  firstShotMovingS: number
  /** Rounds a minute kept up over the long shoot. */
  sustainedRpm: number
  /** First-round hit chance, 0..1, for each round at each of `GUNNERY.rangesM`. */
  byRound: { id: PactRoundId; kind: RoundKind; chances: number[] }[]
  /** The first round's hit chance at the quoting range: on the move, and at night. */
  movingChance: number
  nightChance: number
  /** The same first shot and rate of fire after a day in the tank, and how long that day is. */
  tiredHours: number
  firstShotTiredS: number
  sustainedTiredRpm: number
}

export function quoteOf(fire: Fire): GunneryQuote {
  const moving: Shoot = { ...RANGE_DAY, moving: true }
  const night: Shoot = { ...RANGE_DAY, night: true }
  const tired: Shoot = { ...RANGE_DAY, hours: RANGE.crewHours }
  const first = fire.rounds[0]
  return {
    firstShotS: firstShotS(fire, RANGE_DAY),
    firstShotMovingS: firstShotS(fire, moving),
    sustainedRpm: sustainedRpm(fire, RANGE_DAY),
    byRound: fire.rounds.map((round) => ({
      id: round.id,
      kind: round.kind,
      chances: G.rangesM.map((rangeM) => hitChance(fire, round, rangeM, RANGE_DAY)),
    })),
    movingChance: first ? hitChance(fire, first, G.quoteRangeM, moving) : 0,
    nightChance: first ? hitChance(fire, first, G.quoteRangeM, night) : 0,
    tiredHours: tired.hours,
    firstShotTiredS: firstShotS(fire, tired),
    sustainedTiredRpm: sustainedRpm(fire, tired),
  }
}
