// The air defence trial: the vehicle stands on the range and raiders come at
// it one after another. Each is found first, by the search radar far out or
// by the crew's eyes much closer in; then the gun is laid on it, and opens
// fire once it is within range. Burst follows burst until it comes down,
// reaches its line, or the belts run dry. A burst's chance falls with range,
// and with how much of the lead the computer leaves uncorrected.
import { AIR_TRIAL, type AirKind, type AirKindId, type AirMarks } from '../../data/airDefence'
import { GUNNERY } from '../../data/gunnery'
import type { Fire } from '../gunnery/fire'
import { unit, unitWait } from '../rng'

export interface AirRaider {
  kind: AirKindId
  /** Seconds from it showing until it reaches its line. */
  lineS: number
  /** Seconds from it showing until the crew found it. Null when they never did before its line. */
  foundS: number | null
  /** How far off it was when found, metres. Null when it never was. */
  foundM: number | null
  /** True when the radar found it; false for the crew's eyes. */
  byRadar: boolean
  /** Seconds from it showing until it came within range. Null when it reached its line first. */
  openS: number | null
  /** Seconds from it showing until the first burst. Null when the gun never fired at it. */
  firstS: number | null
  /** Seconds from it coming within range to the first burst. Null when the gun never fired at it. */
  reactionS: number | null
  /** Bursts fired at it. */
  bursts: number
  /** Seconds from it showing until it came down, and how far off. Null when it got through. */
  downedS: number | null
  downedM: number | null
  /** True when the belts ran dry while it was coming. */
  dry: boolean
}

export interface AirRun {
  seed: number
  radar: boolean
  raiders: AirRaider[]
  /** Raiders brought down before their line. */
  downed: number
  /** Bursts fired in all, and how many the vehicle carried. */
  bursts: number
  carried: number
  /** True when the belts ran dry before the last raider. */
  ranOut: boolean
  /** Seconds from coming within range to the first burst, on average over the raiders fired at. Null when none were. */
  reactionS: number | null
}

// Names the rolls of the air defence trial apart from every other test's.
const AIR = 113
const ROLL = { search: 1, scan: 2, burst: 3 } as const

/** How far off the raider is `t` seconds after it shows, metres. */
function rangeAt(kind: AirKind, t: number): number {
  return kind.appearM - kind.speedMs * t
}

/** Seconds after it shows that the raider comes within `m` metres: nought when it shows inside, null when it never does before its line. */
function within(kind: AirKind, m: number, lineS: number): number | null {
  if (kind.appearM <= m) return 0
  if (kind.speedMs <= 0) return null
  const t = (kind.appearM - m) / kind.speedMs
  return t < lineS ? t : null
}

/** The chance one burst brings it down at this range. */
function burstChance(fire: Fire, kind: AirKind, rangeM: number): number {
  const A = AIR_TRIAL
  const rangeError = fire.air.radar ? A.radar.rangeError : fire.ranging.errorShare
  const error = kind.lead * fire.uncorrected + rangeError
  const km = rangeM / 1000
  const mount = fire.air.antiAir ? 1 : A.tankMount
  return (kind.hit * mount) / (1 + A.spread * error * km * km)
}

export function runAirDefence(fire: Fire, seed: number): AirRun {
  const A = AIR_TRIAL
  const radar = fire.air.radar
  // The commander's eyes are quicker with his own sight, slower when he is busy.
  const eyePace = (fire.times.findS / GUNNERY.find.plainS) * fire.pace.commander
  // Once found, the gunner lays on it; with no radar to give the range, it has to be taken first.
  const layS = fire.times.layS * fire.pace.gunner + (radar ? 0 : fire.times.rangeS * fire.pace.ranging)
  const reachM = fire.mission.reachKm * 1000
  let left = fire.carried
  let ranOut = false
  const raiders = A.raids.map((id, raidNo): AirRaider => {
    const kind: AirKind = A.kinds[id]
    const lineS = kind.speedMs > 0 ? (kind.appearM - kind.lineM) / kind.speedMs : kind.hoverS
    // Found by the radar as it comes round, or by eye once close enough and after a search.
    const seenFrom = within(kind, radar ? kind.radarM : kind.eyeM, lineS)
    const waitS = radar
      ? unitWait(seed, AIR, raidNo, ROLL.scan) * A.radar.scanS
      : unitWait(seed, AIR, raidNo, ROLL.search) * kind.searchS * eyePace
    const found = seenFrom === null ? null : seenFrom + waitS
    const foundS = found !== null && found < lineS ? found : null
    const openS = within(kind, Math.min(kind.openM, reachM), lineS)
    const foundM = foundS === null ? null : rangeAt(kind, foundS)
    const nothing = { kind: id, lineS, foundS, foundM, byRadar: radar, openS, firstS: null, reactionS: null, bursts: 0, downedS: null, downedM: null, dry: false }
    if (foundS === null || openS === null) return nothing
    const firstS = Math.max(foundS + layS, openS)
    if (firstS >= lineS) return nothing
    let bursts = 0
    let dry = false
    let downedS: number | null = null
    for (let t = firstS; t < lineS; t += fire.feed.freshS) {
      if (left <= 0) {
        ranOut = true
        dry = true
        break
      }
      left--
      bursts++
      if (unit(seed, AIR, raidNo, ROLL.burst, bursts) < burstChance(fire, kind, rangeAt(kind, t))) {
        downedS = t
        break
      }
    }
    if (bursts === 0) return { ...nothing, dry }
    return {
      ...nothing,
      dry,
      firstS,
      reactionS: firstS - openS,
      bursts,
      downedS,
      downedM: downedS === null ? null : rangeAt(kind, downedS),
    }
  })
  const fired = raiders.filter((raider) => raider.reactionS !== null)
  return {
    seed,
    radar,
    raiders,
    downed: raiders.filter((raider) => raider.downedS !== null).length,
    bursts: raiders.reduce((n, raider) => n + raider.bursts, 0),
    carried: fire.carried,
    ranOut,
    reactionS: fired.length > 0 ? fired.reduce((s, raider) => s + raider.reactionS!, 0) / fired.length : null,
  }
}

/** The run judged against the marks: each of the two, and the whole. */
export function judgeAirDefence(run: AirRun, marks: AirMarks): {
  downedPassed: boolean
  reactionPassed: boolean
  passed: boolean
} {
  const downedPassed = run.downed >= marks.downed
  const reactionPassed = run.reactionS !== null && run.reactionS <= marks.reactionS
  return { downedPassed, reactionPassed, passed: downedPassed && reactionPassed }
}
