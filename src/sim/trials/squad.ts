// The squad drop: the vehicle carries its squad across country to a drop
// point, halts and opens the rear door. As it halts, light targets open up on
// the soldiers, and the gun has to put them out of action while the squad
// gets clear. Each round is laid, scattered and corrected as in the tank
// shoots; a cannon's round is a burst. It is the morning's first test, so
// the crew is fresh.
import { GROUNDS } from '../../data/range'
import { SQUAD_TRIAL, type SquadMarks } from '../../data/squad'
import { RANGE_DAY, errorsOf, firstShotS, jamS, loadS, machineFed, relayS, type Fire, type FireRound, type Shoot } from '../gunnery/fire'
import { topSpeedOf, type Drive } from '../mobility/drive'
import { bell, unit } from '../rng'

export interface CoverShot {
  /** Seconds after the halt. */
  atS: number
  /** Where it landed from the middle of the target, metres: right and high are positive. */
  acrossM: number
  upM: number
  hit: boolean
  jammed: boolean
}

export interface CoverTarget {
  rangeM: number
  /** Hits that put it out of action. */
  hits: number
  shots: CoverShot[]
  /** Seconds after the halt it was put out of action. Null when it was still firing at the end. */
  downS: number | null
}

export interface SquadRun {
  seed: number
  /** Soldiers carried. */
  troops: number
  /** Seconds across country to the drop point. Null when the vehicle cannot move on that ground. */
  driveS: number | null
  /** Seconds from the halt to the last soldier out. */
  outS: number
  /** Seconds from the start line to the last soldier out. Null when the vehicle never got there. */
  dropS: number | null
  targets: CoverTarget[]
  /** Targets put out of action within the time the squad needs covering. */
  knocked: number
  roundsFired: number
  /** True when the gun ran dry before every target was down. */
  ranOut: boolean
}

// Names the squad drop's rolls apart from every other test's.
const SQUAD = 93
const ROLL = { jam: 1, lay: 2, scatter: 3, drift: 4, ranging: 5, shake: 6 } as const

/** High explosive for soft targets, where the gun has it. */
function roundFor(fire: Fire): FireRound {
  const round = fire.rounds.find((each) => each.kind === 'shaped') ?? fire.rounds[0]
  if (!round) throw new Error('a gun with no rounds')
  return round
}

export function runSquadDrop(drive: Drive, fire: Fire, troops: number, seed: number): SquadRun {
  const S = SQUAD_TRIAL
  const speedMs = topSpeedOf(drive, GROUNDS[S.approach.ground]).speedMs * S.approach.pace
  const driveS = speedMs > 0 ? (S.approach.km * 1000) / speedMs : null
  const outS = troops > 0 ? S.doorS + troops * S.perSoldierS : 0
  // The drop is the first thing the crew does that day, and the vehicle shoots halted.
  const shoot: Shoot = RANGE_DAY
  const round = roundFor(fire)
  const targets: CoverTarget[] = []
  let fired = 0
  let atS = 0
  let ranOut = false
  for (const [targetNo, target] of S.targets.entries()) {
    const result: CoverTarget = { rangeM: target.rangeM, hits: target.hits, shots: [], downS: null }
    targets.push(result)
    if (fired >= fire.carried) {
      ranOut = true
      continue
    }
    const errors = errorsOf(fire, round, target.rangeM, shoot)
    const roll = (shotNo: number, what: number, axis: number): number => bell(seed, SQUAD, targetNo, shotNo, what, axis)
    // Picking out the first target and laying on it, with the gun already loaded; then switching to each next one as the gun is fed.
    atS = targetNo === 0 ? firstShotS(fire, shoot) : atS + Math.max(firstShotS(fire, shoot) * S.switchShare, loadS(fire, fired, shoot))
    const ranging = roll(0, ROLL.ranging, 1) * errors.rangingM
    const drift = [roll(0, ROLL.drift, 0) * errors.driftAcrossM, roll(0, ROLL.drift, 1) * errors.driftUpM] as const
    let left = 1
    let hits = 0
    for (let shotNo = 0; atS <= S.coverS; shotNo++) {
      let jammed = false
      if (shotNo > 0) {
        jammed = machineFed(fire, fired) && unit(seed, SQUAD, targetNo, shotNo, ROLL.jam) < fire.feed.jamPerRound
        atS += Math.max(loadS(fire, fired, shoot) + (jammed ? jamS(fire, shoot) : 0), relayS(fire, shoot))
        if (atS > S.coverS) break
      }
      const acrossM = roll(shotNo, ROLL.lay, 0) * errors.layM + roll(shotNo, ROLL.scatter, 0) * errors.scatterM +
        drift[0] * left + roll(shotNo, ROLL.shake, 0) * errors.shakeAcrossM
      const upM = roll(shotNo, ROLL.lay, 1) * errors.layM + roll(shotNo, ROLL.scatter, 1) * errors.scatterM +
        (drift[1] + ranging) * left + roll(shotNo, ROLL.shake, 1) * errors.shakeUpM
      const hit = Math.abs(acrossM) <= target.widthM / 2 && Math.abs(upM) <= target.heightM / 2
      result.shots.push({ atS, acrossM, upM, hit, jammed })
      fired++
      // The crew sees where it fell and corrects.
      left *= fire.missLeft
      if (hit) hits++
      if (hits >= target.hits) {
        result.downS = atS
        break
      }
      if (fired >= fire.carried) {
        ranOut = true
        break
      }
    }
    if (atS > S.coverS) break
  }
  // Targets the gun never turned to are still firing.
  for (const target of S.targets.slice(targets.length)) targets.push({ rangeM: target.rangeM, hits: target.hits, shots: [], downS: null })
  return {
    seed,
    troops,
    driveS,
    outS,
    dropS: driveS === null ? null : driveS + outS,
    targets,
    knocked: targets.filter((target) => target.downS !== null).length,
    roundsFired: fired,
    ranOut,
  }
}

/** The run judged against the marks: each of the three, and the whole. */
export function judgeSquadDrop(run: SquadRun, marks: SquadMarks): {
  troopsPassed: boolean
  dropPassed: boolean
  coverPassed: boolean
  passed: boolean
} {
  const troopsPassed = run.troops >= marks.troops
  const dropPassed = run.dropS !== null && run.dropS <= marks.dropS
  const coverPassed = run.knocked >= marks.targets
  return { troopsPassed, dropPassed, coverPassed, passed: troopsPassed && dropPassed && coverPassed }
}
