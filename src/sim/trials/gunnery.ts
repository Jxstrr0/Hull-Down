// The firing tests: targets come up one at a time and the crew finds, ranges,
// lays and shoots at each. Every shot is rolled from the seeded dice, so the
// same tank and seed always shoot the same score.
import { GUNNERY } from '../../data/gunnery'
import { RANGE, type GunneryTestId } from '../../data/range'
import type { PactRoundId, RoundKind } from '../../data/ammo'
import {
  RANGE_DAY, errorsOf, firstShotS, jamS, loadS, machineFed, relayS, seenShare, type Fire, type FireRound, type Shoot,
} from '../gunnery/fire'
import { bell, unit } from '../rng'

/** What can put a shot off the board. */
export const MISS_CAUSES = ['lay', 'scatter', 'drift', 'ranging', 'shake'] as const
export type MissCause = (typeof MISS_CAUSES)[number]

export interface ShotRecord {
  /** Seconds after the target came up. */
  atS: number
  /** Where it landed from the middle of the board, metres: right is positive, high is positive. */
  acrossM: number
  upM: number
  hit: boolean
  /** What did most to put a miss off the board. Null for a hit. */
  cause: MissCause | null
  /** True when the loader jammed getting this round up. */
  jammed: boolean
}

export interface TargetResult {
  rangeM: number
  round: PactRoundId
  kind: RoundKind
  /** False when the gunner never picked it out: at night, past the reach of his sight. */
  seen: boolean
  shots: ShotRecord[]
  hit: boolean
}

export interface GunneryRun {
  test: GunneryTestId
  seed: number
  moving: boolean
  night: boolean
  /** True when the tank had to stop for every shot. */
  halted: boolean
  targets: TargetResult[]
  hits: number
  firstRoundHits: number
  roundsFired: number
  /** Targets the gunner never saw. */
  unseen: number
  /** Targets that went down again before the crew got a shot off. */
  tooSlow: number
  jams: number
  /** Seconds to the first shot, averaged over the targets that were shot at. Null when none was. */
  firstShotS: number | null
  /** What put most of the misses off the board. Null with no misses. */
  blame: MissCause | null
  /** True when most of the misses went over or under and not to the side. */
  missedHighLow: boolean
}

// What names a roll: the test, the target, the shot, then which roll it is.
const ROLL = { seen: 1, jam: 2, lay: 3, scatter: 4, drift: 5, ranging: 6, shake: 7 } as const
const ACROSS = 0
const UP = 1

function roundFor(fire: Fire, kind: RoundKind): FireRound {
  const round = fire.rounds.find((each) => each.kind === kind) ?? fire.rounds[0]
  if (!round) throw new Error('a gun with no rounds')
  return round
}

/** The biggest of the pushes that put this shot off the board, on the side it missed by most. */
function causeOf(parts: Record<MissCause, [number, number]>, acrossM: number, upM: number): MissCause {
  const axis = Math.abs(acrossM) / GUNNERY.target.widthM > Math.abs(upM) / GUNNERY.target.heightM ? ACROSS : UP
  const miss = axis === ACROSS ? acrossM : upM
  let worst: MissCause = 'lay'
  let most = -Infinity
  for (const cause of MISS_CAUSES) {
    // Only a push in the direction of the miss is to blame for it.
    const push = parts[cause][axis] * (miss < 0 ? -1 : 1)
    if (push > most) {
      most = push
      worst = cause
    }
  }
  return worst
}

export function runGunnery(fire: Fire, test: GunneryTestId, seed: number): GunneryRun {
  const layout = RANGE.gunnery.tests[test]
  const testNo = Object.keys(RANGE.gunnery.tests).indexOf(test)
  const shoot: Shoot = { ...RANGE_DAY, moving: layout.moving, night: layout.night, hours: RANGE.crewHours }
  const halfW = GUNNERY.target.widthM / 2
  const halfH = GUNNERY.target.heightM / 2
  const first = firstShotS(fire, shoot)

  const targets: TargetResult[] = []
  const blames: Record<MissCause, number> = { lay: 0, scatter: 0, drift: 0, ranging: 0, shake: 0 }
  let fired = 0
  let jams = 0
  let tooSlow = 0
  let highLow = 0
  let misses = 0

  layout.targets.forEach((target, targetNo) => {
    const round = roundFor(fire, target.load)
    const errors = errorsOf(fire, round, target.rangeM, shoot)
    const roll = (shotNo: number, what: number, axis: number): number => bell(seed, testNo, targetNo, shotNo, what, axis)
    const seen = unit(seed, testNo, targetNo, 0, ROLL.seen) < seenShare(fire, target.rangeM, shoot)
    const result: TargetResult = { rangeM: target.rangeM, round: round.id, kind: round.kind, seen, shots: [], hit: false }
    targets.push(result)
    if (!seen) return

    // The range and the wind are misjudged once for each target, then corrected shot by shot.
    let left = 1
    const ranging = roll(0, ROLL.ranging, UP) * errors.rangingM
    const drift: [number, number] = [roll(0, ROLL.drift, ACROSS) * errors.driftAcrossM, roll(0, ROLL.drift, UP) * errors.driftUpM]
    let atS = first
    for (let shotNo = 0; shotNo < RANGE.gunnery.shotsPerTarget; shotNo++) {
      let jammed = false
      if (shotNo > 0) {
        jammed = machineFed(fire, fired) && unit(seed, testNo, targetNo, shotNo, ROLL.jam) < fire.feed.jamPerRound
        atS += Math.max(loadS(fire, fired, shoot) + (jammed ? jamS(fire, shoot) : 0), relayS(fire, shoot))
      }
      if (atS > layout.exposureS) break
      if (jammed) jams++
      const parts: Record<MissCause, [number, number]> = {
        lay: [roll(shotNo, ROLL.lay, ACROSS) * errors.layM, roll(shotNo, ROLL.lay, UP) * errors.layM],
        scatter: [roll(shotNo, ROLL.scatter, ACROSS) * errors.scatterM, roll(shotNo, ROLL.scatter, UP) * errors.scatterM],
        drift: [drift[ACROSS] * left, drift[UP] * left],
        ranging: [0, ranging * left],
        shake: [roll(shotNo, ROLL.shake, ACROSS) * errors.shakeAcrossM, roll(shotNo, ROLL.shake, UP) * errors.shakeUpM],
      }
      let acrossM = 0
      let upM = 0
      for (const cause of MISS_CAUSES) {
        acrossM += parts[cause][ACROSS]
        upM += parts[cause][UP]
      }
      const hit = Math.abs(acrossM) <= halfW && Math.abs(upM) <= halfH
      const cause = hit ? null : causeOf(parts, acrossM, upM)
      result.shots.push({ atS, acrossM, upM, hit, cause, jammed })
      fired++
      if (cause) {
        blames[cause]++
        misses++
        if (Math.abs(upM) / halfH > Math.abs(acrossM) / halfW) highLow++
      }
      if (hit) {
        result.hit = true
        break
      }
      left *= fire.missLeft
    }
    if (result.shots.length === 0) tooSlow++
  })

  let blame: MissCause | null = null
  for (const cause of MISS_CAUSES) {
    if (blames[cause] > 0 && (blame === null || blames[cause] > blames[blame])) blame = cause
  }
  const shotAt = targets.filter((each) => each.shots.length > 0)
  return {
    test,
    seed,
    moving: layout.moving,
    night: layout.night,
    halted: layout.moving && fire.moving.halts,
    targets,
    hits: targets.filter((each) => each.hit).length,
    firstRoundHits: targets.filter((each) => each.shots[0]?.hit).length,
    roundsFired: fired,
    unseen: targets.filter((each) => !each.seen).length,
    tooSlow,
    jams,
    firstShotS: shotAt.length > 0 ? first : null,
    blame,
    missedHighLow: highLow * 2 > misses,
  }
}
