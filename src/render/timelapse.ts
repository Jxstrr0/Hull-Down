// The endurance run as a time-lapse. The sim gives the legs, their speeds and
// what broke where; this lays that out against the seconds a player watches.
// Plain numbers, no three.js.
import { RENDER } from '../data/render'
import type { EnduranceEvent, EnduranceRun } from '../sim/trials'

export interface LapseFrame {
  /** Kilometres of the run behind the tank. */
  km: number
  /** Hours since the start, with time lost to repairs counted. */
  hours: number
  /** Which leg it is on, counting from nought. */
  legIndex: number
  /** Nought while it is stopped. */
  speedKmh: number
  /** Metres of this leg's ground that have gone by in the picture. */
  legM: number
  /** The breakdown it is stopped for, or null while it is driving. */
  event: EnduranceEvent | null
  /** Seconds it has been stopped for that breakdown. */
  heldS: number
  /** True once the time-lapse has run out. */
  done: boolean
}

interface Piece {
  fromS: number
  toS: number
  legIndex: number
  speedKmh: number
  event: EnduranceEvent | null
  fromKm: number
  toKm: number
  fromH: number
  toH: number
  fromM: number
  toM: number
}

export interface Timelapse {
  /** Seconds it takes to watch. */
  lengthS: number
  /** The second each breakdown begins at, in the order they happened. */
  stops: { atS: number; event: EnduranceEvent }[]
  at(timeS: number): LapseFrame
}

export function timelapseOf(run: EnduranceRun): Timelapse {
  const e = RENDER.endurance
  const pieces: Piece[] = []
  const stops: Timelapse['stops'] = []
  let atS = 0
  let atH = 0

  run.legs.forEach((leg, legIndex) => {
    if (leg.fromKm >= run.reachedKm) return
    let km = leg.fromKm
    let m = 0
    const drive = (toKm: number): void => {
      if (toKm <= km) return
      const seconds = (toKm - km) * e.secondsPerKm
      const hours = (toKm - km) / leg.speedKmh
      const metres = seconds * (leg.speedKmh / 3.6) * e.showRate
      pieces.push({
        fromS: atS, toS: atS + seconds, legIndex, speedKmh: leg.speedKmh, event: null,
        fromKm: km, toKm, fromH: atH, toH: atH + hours, fromM: m, toM: m + metres,
      })
      atS += seconds
      atH += hours
      m += metres
      km = toKm
    }
    // The sim counts a breakdown in the kilometre it happened in, so one at the very end of a leg belongs to that leg.
    for (const event of run.events.filter((each) => each.km > leg.fromKm && each.km <= leg.toKm)) {
      drive(event.km)
      const seconds = event.ended ? e.endHoldS : e.holdS
      stops.push({ atS, event })
      pieces.push({
        fromS: atS, toS: atS + seconds, legIndex, speedKmh: 0, event,
        fromKm: km, toKm: km, fromH: atH, toH: atH + event.haltH, fromM: m, toM: m,
      })
      atS += seconds
      atH += event.haltH
    }
    drive(Math.min(leg.toKm, run.reachedKm))
  })

  const lengthS = atS
  const first = pieces[0]!
  const last = pieces.at(-1)!

  function at(timeS: number): LapseFrame {
    if (!(timeS > 0)) {
      return { km: first.fromKm, hours: 0, legIndex: first.legIndex, speedKmh: first.speedKmh, legM: 0, event: first.event, heldS: 0, done: false }
    }
    if (timeS >= lengthS) {
      return {
        km: last.toKm, hours: last.toH, legIndex: last.legIndex, speedKmh: last.speedKmh, legM: last.toM,
        event: last.event, heldS: last.event ? last.toS - last.fromS : 0, done: true,
      }
    }
    // Few pieces: a walk is quick enough.
    const piece = pieces.find((each) => timeS < each.toS) ?? last
    const share = (timeS - piece.fromS) / (piece.toS - piece.fromS)
    const between = (from: number, to: number): number => from + (to - from) * share
    return {
      km: between(piece.fromKm, piece.toKm),
      hours: between(piece.fromH, piece.toH),
      legIndex: piece.legIndex,
      speedKmh: piece.speedKmh,
      legM: between(piece.fromM, piece.toM),
      event: piece.event,
      heldS: piece.event ? timeS - piece.fromS : 0,
      done: false,
    }
  }

  return { lengthS, stops, at }
}

/**
 * One puff of the smoke from a wrecked engine or transmission, `heldS`
 * seconds after it broke: how far it has risen and drifted, and how big it
 * has grown. Null until that puff has left the engine deck.
 */
export function puffAt(index: number, heldS: number): { upM: number; driftM: number; sizeM: number } | null {
  const k = RENDER.endurance.smoke
  const age = heldS / k.everyS - index / k.puffs
  if (age < 0) return null
  const life = age % 1
  return { upM: life * k.riseM, driftM: life * k.driftM, sizeM: k.fromM + (k.toM - k.fromM) * life }
}
