// The air defence trial as it happened, laid out in time for the replay in
// the report. The raiders come one after another: each is played from the
// moment it shows until it comes down or reaches its line, held a moment so
// the end shows, then the next. No DOM here, so it can be tested.
import { AIR_TRIAL } from '../data/airDefence'
import type { AirRaider, AirRun } from '../sim/trials/airDefence'

export interface AirLeg {
  /** Which raider, in the order they came. */
  raider: number
  /** Where it starts on the replay's own clock. */
  fromAt: number
  /** Seconds after it showed that it was over: brought down, or at its line. */
  endS: number
  /** Where the next raider starts on the replay's own clock. */
  toAt: number
}

export interface AirTimeline {
  legs: AirLeg[]
  /** The end of the replay on its own clock. */
  endAt: number
}

/** When a raider is over: brought down, or at its line. */
const overS = (raider: AirRaider): number => raider.downedS ?? raider.lineS

export function airTimeline(run: AirRun): AirTimeline {
  const R = AIR_TRIAL.replay
  let at = 0
  const legs = run.raiders.map((raider, n): AirLeg => {
    const endS = overS(raider)
    const leg = { raider: n, fromAt: at, endS, toAt: at + endS + R.holdS }
    at = leg.toAt
    return leg
  })
  return { legs, endAt: at + R.tailS }
}

/** What happened to a raider, in the order it happened. */
export type AirEventKind = 'shows' | 'found' | 'fires' | 'downed' | 'through'

export interface AirFrame {
  /** True once the last raider is over and held. */
  over: boolean
  /** The raider on the maps. The last once it is all over. */
  raider: number
  /** Seconds since it showed. */
  s: number
  /** How far off it is, metres. */
  rangeM: number
  found: boolean
  downed: boolean
  /** True once it has reached its line without coming down. */
  through: boolean
  /** Bursts fired at it so far, and whether the last one's tracer still shows. */
  bursts: number
  tracer: boolean
  /** The last thing that happened to it by now. */
  event: AirEventKind
  /** Over the whole trial so far: raiders brought down, and bursts fired. */
  downedSoFar: number
  burstsSoFar: number
}

/** How far off a raider is `s` seconds after it showed, metres: it stops where it came down, or at its line. */
export function rangeOf(raider: AirRaider, s: number): number {
  if (raider.downedS !== null && s >= raider.downedS) return raider.downedM!
  const kind = AIR_TRIAL.kinds[raider.kind]
  return kind.appearM - kind.speedMs * Math.min(s, raider.lineS)
}

/** Seconds after it showed that each burst was fired at a raider. */
export function burstTimes(run: AirRun, raider: AirRaider): number[] {
  if (raider.firstS === null) return []
  return Array.from({ length: raider.bursts }, (_, k) => raider.firstS! + k * run.everyS)
}

/** What the replay shows at `at` on its own clock. */
export function airFrame(run: AirRun, line: AirTimeline, at: number): AirFrame {
  const last = line.legs.at(-1)!
  const leg = line.legs.find((each) => at < each.toAt) ?? last
  const over = at >= last.toAt
  const raider = run.raiders[leg.raider]!
  // Held at its end: the raider's own clock stops there.
  const s = Math.max(0, Math.min(leg.endS, at - leg.fromAt))
  const times = burstTimes(run, raider).filter((t) => t <= s)
  const found = raider.foundS !== null && s >= raider.foundS
  const downed = raider.downedS !== null && s >= raider.downedS
  const through = raider.downedS === null && s >= raider.lineS
  const event: AirEventKind = downed ? 'downed' : through ? 'through' : times.length > 0 ? 'fires' : found ? 'found' : 'shows'
  const before = run.raiders.slice(0, leg.raider)
  return {
    over,
    raider: leg.raider,
    s,
    rangeM: rangeOf(raider, s),
    found,
    downed,
    through,
    bursts: times.length,
    tracer: times.length > 0 && s - times.at(-1)! < AIR_TRIAL.replay.tracerS && !through,
    event,
    downedSoFar: before.filter((each) => each.downedS !== null).length + (downed ? 1 : 0),
    burstsSoFar: before.reduce((n, each) => n + each.bursts, 0) + times.length,
  }
}
