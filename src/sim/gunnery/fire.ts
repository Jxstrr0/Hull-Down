// The gunnery model: how a design finds, ranges, lays and loads, boiled down
// to the few numbers a shot needs. The design office quotes from it and the
// range shoots by it. Game-level abstractions, not engineering data.
import { pactRounds, type PactRoundId, type RoundKind } from '../../data/ammo'
import { CREWS, GUNNERY, type CrewId } from '../../data/gunnery'
import { GUNS, LOADING } from '../../data/parts'
import { TUNING } from '../../data/tuning'
import { detExp } from '../det'
import type { VehicleSpec } from '../vehicle/spec'

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
  /** Shooting from a moving tank. The mils already allow for the ride. */
  moving: { halts: boolean; acrossMil: number; upMil: number; extraS: number }
  night: { seeM: number; layFactor: number }
  /** Seconds, for a fresh trained crew with nothing else to do. */
  times: { findS: number; rangeS: number; layS: number; relayS: number }
  /** How much slower the crew is for the work the design gives them. 1 is the reference. */
  pace: number
  feed: Feed
}

/** The conditions of a shot. */
export interface Shoot {
  moving: boolean
  night: boolean
  crew: CrewId
}

export const RANGE_DAY: Shoot = { moving: false, night: false, crew: 'cadre' }

const G = GUNNERY

export function fireOf(spec: VehicleSpec, crewWorkload: number): Fire {
  const fc = spec.fireControl
  const sight = G.sights[fc.sight]
  const rangefinder = G.rangefinders[fc.rangefinder]
  const stabiliser = G.stabilisers[fc.stabiliser]
  const computer = G.computers[fc.computer]
  const gun = GUNS[spec.gun]
  const loading = LOADING[spec.loading]
  // A halted tank rocks on its springs whatever they are; only a gun fired on the move feels the ride.
  const ride = stabiliser.halts ? 1 : G.ride[spec.runningGear.suspension]
  const L = G.loading
  const auto = loading.fixedRof !== null

  return {
    rounds: pactRounds(spec.gun).map(({ id, round }) => ({
      id,
      kind: round.kind,
      speedMs: round.speedMs,
      scatterMil: round.spreadM * G.scatterShare,
      dragM: G.dragM[round.kind],
    })),
    carried: spec.ammo.rounds,
    layMil: sight.layMil,
    ranging: { errorShare: rangefinder.errorShare, minErrorM: rangefinder.minErrorM, nightFactor: rangefinder.nightFactor },
    uncorrected: computer.uncorrected,
    moving: {
      halts: stabiliser.halts,
      acrossMil: stabiliser.acrossMil * ride,
      upMil: stabiliser.upMil * ride,
      extraS: stabiliser.moveS,
    },
    night: { ...G.nightSights[fc.night] },
    times: {
      findS: fc.commanderSight ? G.find.ownSightS : G.find.plainS,
      rangeS: rangefinder.rangeS,
      layS: sight.layS + computer.setS,
      relayS: stabiliser.relayS,
    },
    pace: 1 + (crewWorkload - G.pace.referenceWorkload) * G.pace.perPoint,
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

/** How long a round takes to reach a range, and how fast it is going when it gets there. */
export function flightOf(round: FireRound, rangeM: number): { timeS: number; speedMs: number } {
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

/** How far a first shot is likely to land from the middle of the target, metres: across, and up or down. */
export function missOf(fire: Fire, round: FireRound, rangeM: number, shoot: Shoot): { acrossM: number; upM: number } {
  const crew = CREWS[shoot.crew]
  const km = rangeM / 1000
  const flight = flightOf(round, rangeM)
  const lay = fire.layMil * crew.aim * (shoot.night ? fire.night.layFactor : 1) * km
  const scatter = round.scatterMil * km
  const drift = fire.uncorrected * G.driftMPerS2 * flight.timeS * flight.timeS
  // A range read wrong puts the shot over or under: by more, the steeper the round is falling.
  const rangeErrorM = Math.max(fire.ranging.errorShare * rangeM, fire.ranging.minErrorM) *
    crew.aim * (shoot.night ? fire.ranging.nightFactor : 1)
  const fall = (TUNING.mobility.gravityMs2 * flight.timeS) / flight.speedMs
  const shake = shoot.moving ? km : 0
  const base = lay * lay + scatter * scatter
  return {
    acrossM: Math.sqrt(base + sq(drift * (1 - G.driftUpShare)) + sq(fire.moving.acrossMil * shake)),
    upM: Math.sqrt(base + sq(drift * G.driftUpShare) + sq(rangeErrorM * fall) + sq(fire.moving.upMil * shake)),
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
export function hitChance(fire: Fire, round: FireRound, rangeM: number, shoot: Shoot): number {
  const miss = missOf(fire, round, rangeM, shoot)
  return seenShare(fire, rangeM, shoot) *
    within(G.target.widthM / 2, miss.acrossM) * within(G.target.heightM / 2, miss.upM)
}

/** Seconds from a target showing to the first shot, with a round already in the gun. */
export function firstShotS(fire: Fire, shoot: Shoot): number {
  const t = fire.times
  const still = (t.findS + t.rangeS + t.layS) * (shoot.night ? fire.night.layFactor : 1)
  return (still + (shoot.moving ? fire.moving.extraS : 0)) * fire.pace * CREWS[shoot.crew].pace
}

/**
 * Seconds from one shot to the next, when `fired` rounds have already gone.
 * A jam is counted at its average cost; the loading drill rolls for each one.
 */
export function cycleS(fire: Fire, fired: number, shoot: Shoot): number {
  const feed = fire.feed
  const crewPace = fire.pace * CREWS[shoot.crew].pace
  let load: number
  if (feed.readyRounds !== null) {
    load = fired < feed.readyRounds
      ? feed.freshS + feed.jamPerRound * feed.clearS * crewPace
      : feed.handFeedS * crewPace
  } else {
    const tired = Math.min(feed.tirePerRound * fired, feed.tireMax)
    load = feed.freshS * (1 + tired) * (shoot.moving ? feed.movingFactor : 1) * CREWS[shoot.crew].pace
  }
  return Math.max(load, fire.times.relayS * crewPace)
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
}

export function quoteOf(fire: Fire): GunneryQuote {
  const moving: Shoot = { ...RANGE_DAY, moving: true }
  const night: Shoot = { ...RANGE_DAY, night: true }
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
  }
}
