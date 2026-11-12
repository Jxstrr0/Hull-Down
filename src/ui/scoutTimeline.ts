// Spot and report as it happened, laid out in time for the replay in the
// report: each drive, each watch from a lookout with every find and every
// time the car was seen, and the drive home. The drives are played as a
// time-lapse, each the same short time however long it took; the watches at
// the trial's own pace, each held a moment at its end so the last find shows.
// No DOM here, so it can be tested.
import { SCOUT_TRIAL } from '../data/scout'
import type { ScoutRun, ScoutStop } from '../sim/trials/scout'

export interface ScoutLeg {
  kind: 'drive' | 'watch'
  /** The lookout driven to or watched from; one past the last for the drive home. */
  stop: number
  /** Where the leg starts and ends on the replay's own clock. */
  fromAt: number
  toAt: number
  /** Where it starts and ends in the trial's seconds from the start line. */
  fromS: number
  toS: number
}

export interface ScoutTimeline {
  legs: ScoutLeg[]
  /** The end of the replay on its own clock. */
  endAt: number
  /** Seconds from the start line back to it. */
  totalS: number
}

/** Null when the car never got round: there is nothing to play back. */
export function scoutTimeline(run: ScoutRun): ScoutTimeline | null {
  if (run.stops === null || run.homeS === null) return null
  const R = SCOUT_TRIAL.replay
  const legs: ScoutLeg[] = []
  let at = 0
  let s = 0
  const add = (kind: ScoutLeg['kind'], stop: number, showS: number, trialS: number): void => {
    legs.push({ kind, stop, fromAt: at, toAt: at + showS, fromS: s, toS: s + trialS })
    at += showS
    s += trialS
  }
  for (const [n, stop] of run.stops.entries()) {
    add('drive', n, R.legS, stop.driveS)
    add('watch', n, stop.watchS + R.holdS, stop.watchS)
  }
  add('drive', run.stops.length, R.legS, run.homeS)
  return { legs, endAt: at + R.tailS, totalS: s }
}

export type ScoutPhase = 'drive' | 'watch' | 'home' | 'back'

/** Something seen at a lookout, in the order it happened. */
export interface ScoutEvent {
  kind: 'found' | 'noticed'
  /** Which of the lookout's hidden vehicles. */
  target: number
  /** Seconds into the watch. */
  s: number
  /** For a notice: true when the commander had not found it yet. */
  first: boolean
}

export interface ScoutFrame {
  phase: ScoutPhase
  /** The lookout being driven to or watched from. On the way home and back, the last. */
  stop: number
  /** How far through the drive or the watch, 0 to 1. */
  along: number
  /** Trial seconds since the start line. */
  clockS: number
  /** Seconds into the watch at this lookout. The whole watch once it is over; 0 before it starts. */
  watchS: number
  /** Hidden vehicles found so far, and those that saw the car first so far, over the whole route. */
  found: number
  seen: number
  /** At this lookout: each vehicle found by now, and each that has seen the car by now. */
  targetFound: boolean[]
  targetNoticed: boolean[]
  /** The last thing seen at this lookout by now. Null before anything is. */
  event: ScoutEvent | null
}

/** Everything seen at one lookout, in the order it happened. */
export function eventsAt(stop: ScoutStop): ScoutEvent[] {
  const events: ScoutEvent[] = []
  for (const [target, sighting] of stop.targets.entries()) {
    if (sighting.foundS !== null) events.push({ kind: 'found', target, s: sighting.foundS, first: false })
    if (sighting.noticedS !== null) events.push({ kind: 'noticed', target, s: sighting.noticedS, first: sighting.seenFirst })
  }
  return events.sort((a, b) => a.s - b.s || (a.kind === 'found' ? -1 : 1))
}

/** What the replay shows at `at` on its own clock. */
export function scoutFrame(run: ScoutRun, line: ScoutTimeline, at: number): ScoutFrame {
  const stops = run.stops ?? []
  const last = line.legs.at(-1)!
  const leg = line.legs.find((each) => at < each.toAt) ?? last
  // A watch is held at its end for a moment: the trial's clock stops there.
  const span = leg.kind === 'watch' ? leg.toS - leg.fromS : leg.toAt - leg.fromAt
  const along = span > 0 ? Math.max(0, Math.min(1, (at - leg.fromAt) / span)) : 1
  const home = leg.stop >= stops.length
  const stop = Math.min(leg.stop, stops.length - 1)
  // Before the watch at this lookout nothing is seen; after it, all of it.
  const watchS = leg.kind === 'watch' ? along * (stops[stop]?.watchS ?? 0) : home ? stops[stop]?.watchS ?? 0 : 0
  let found = 0
  let seen = 0
  for (const [n, each] of stops.entries()) {
    const upTo = n < stop || home ? Infinity : n === stop ? watchS : -1
    found += each.targets.filter((target) => target.foundS !== null && target.foundS <= upTo).length
    seen += each.targets.filter((target) => target.seenFirst && target.noticedS !== null && target.noticedS <= upTo).length
  }
  const here = stops[stop]
  const targetFound = here?.targets.map((target) => target.foundS !== null && target.foundS <= watchS && (leg.kind === 'watch' || home)) ?? []
  const targetNoticed = here?.targets.map((target) => target.noticedS !== null && target.noticedS <= watchS && (leg.kind === 'watch' || home)) ?? []
  const event = leg.kind === 'watch' && here ? eventsAt(here).filter((each) => each.s <= watchS).at(-1) ?? null : null
  const back = at >= last.toAt
  return {
    phase: back ? 'back' : home ? 'home' : leg.kind,
    stop,
    along,
    clockS: back ? line.totalS : leg.fromS + along * (leg.toS - leg.fromS),
    watchS,
    found,
    seen,
    targetFound,
    targetNoticed,
    event,
  }
}
