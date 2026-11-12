// Spot and report: the car drives a route of road and open country to three
// lookout points. At each it noses up to a crest and the commander searches
// the landscape for hidden vehicles, while they, without knowing it is
// coming, may notice whatever of it shows over the crest. It drives on once
// it has found everything there or its watch is up, and home at the end to
// report. Each search and each notice is a wait drawn at random around its
// average: the commander's quicker with his own sight and a thermal sight,
// and the car noticed sooner the more of it shows.
import { GROUNDS } from '../../data/range'
import { SCOUT_TRIAL, type ScoutMarks } from '../../data/scout'
import type { Fire } from '../gunnery/fire'
import { topSpeedOf, type Drive } from '../mobility/drive'
import { unitWait } from '../rng'

export interface ScoutSighting {
  rangeM: number
  areaM2: number
  /** Seconds into the watch the commander found it. Null when he never did. */
  foundS: number | null
  /** Seconds into the watch it noticed the car. Null when it never did while the car was there. */
  noticedS: number | null
  /** True when it noticed the car before the car found it. */
  seenFirst: boolean
}

export interface ScoutStop {
  /** Seconds driving from the last stop. */
  driveS: number
  /** Seconds watching from the lookout. */
  watchS: number
  targets: ScoutSighting[]
}

export interface ScoutRun {
  seed: number
  /** Square metres of the car that show over a crest. */
  showsM2: number
  /** Null when the car cannot move on the route's ground: it never got to a lookout. */
  stops: ScoutStop[] | null
  /** Seconds driving home to report. */
  homeS: number | null
  /** Seconds from the start line back to it. Null when the car never got round. */
  totalS: number | null
  /** Hidden vehicles found, and those that saw the car first. */
  found: number
  seen: number
  /** Hidden vehicles out there. */
  hidden: number
}

// Names the rolls of spot and report apart from every other test's.
const SCOUT = 97
const ROLL = { find: 1, notice: 2 } as const

/** Seconds to drive a stretch of road and open country at the route's pace. Null when the car cannot move on either. */
function legS(drive: Drive, roadKm: number, crossKm: number): number | null {
  const pace = SCOUT_TRIAL.pace
  const road = topSpeedOf(drive, GROUNDS.hard).speedMs * pace
  const cross = topSpeedOf(drive, GROUNDS.firm).speedMs * pace
  if (road <= 0 || cross <= 0) return null
  return (roadKm * 1000) / road + (crossKm * 1000) / cross
}

/**
 * `showsM` is the height of the car over the crest (the berm test's) and
 * `widthM` its width.
 */
export function runScoutPatrol(drive: Drive, fire: Fire, showsM: number, widthM: number, seed: number): ScoutRun {
  const S = SCOUT_TRIAL
  const showsM2 = Math.max(0, showsM) * widthM * S.showWidthShare
  const hidden = S.lookouts.reduce((n, lookout) => n + lookout.targets.length, 0)
  const legs = S.lookouts.map((lookout) => legS(drive, lookout.roadKm, lookout.crossKm))
  const homeS = legS(drive, S.home.roadKm, S.home.crossKm)
  if (homeS === null || legs.some((leg) => leg === null)) {
    return { seed, showsM2, stops: null, homeS: null, totalS: null, found: 0, seen: 0, hidden }
  }
  // Seconds the commander takes, on average, to find a square metre at 1000 m.
  const searchS = S.searchPerFindS * fire.times.findS * fire.pace.commander / fire.night.search
  const stops: ScoutStop[] = S.lookouts.map((lookout, stopNo) => {
    const seen = lookout.targets.map((target, targetNo) => {
      const km = target.rangeM / 1000
      const far = km * km
      const findS = unitWait(seed, SCOUT, stopNo, targetNo, ROLL.find) * searchS * far / target.areaM2
      const noticeS = showsM2 > 0 ? unitWait(seed, SCOUT, stopNo, targetNo, ROLL.notice) * S.noticeS * far / showsM2 : Infinity
      return { target, findS, noticeS }
    })
    // The car stays until it has found them all, or its watch is up.
    const watchS = Math.min(S.watchS, Math.max(...seen.map((each) => each.findS)))
    const targets = seen.map(({ target, findS, noticeS }): ScoutSighting => {
      const foundS = findS <= watchS ? findS : null
      const noticedS = noticeS <= watchS ? noticeS : null
      return {
        rangeM: target.rangeM,
        areaM2: target.areaM2,
        foundS,
        noticedS,
        seenFirst: noticedS !== null && (foundS === null || noticedS < foundS),
      }
    })
    return { driveS: legs[stopNo]!, watchS, targets }
  })
  const all = stops.flatMap((stop) => stop.targets)
  return {
    seed,
    showsM2,
    stops,
    homeS,
    totalS: stops.reduce((s, stop) => s + stop.driveS + stop.watchS, homeS),
    found: all.filter((each) => each.foundS !== null).length,
    seen: all.filter((each) => each.seenFirst).length,
    hidden,
  }
}

/** The run judged against the marks: each of the three, and the whole. */
export function judgeScoutPatrol(run: ScoutRun, marks: ScoutMarks): {
  timePassed: boolean
  foundPassed: boolean
  seenPassed: boolean
  passed: boolean
} {
  const timePassed = run.totalS !== null && run.totalS <= marks.timeS
  const foundPassed = run.found >= marks.found
  const seenPassed = run.stops !== null && run.seen <= marks.seen
  return { timePassed, foundPassed, seenPassed, passed: timePassed && foundPassed && seenPassed }
}
