// The armour trial: a few rounds of a named kind at a named zone, serial by
// serial. Unlike the design office's test shot these are real shots: they
// land where they land on the plate, what a round goes through varies within
// its margin of error, and a reactive tile only works once.
import { THREATS } from '../../data/ammo'
import type { ZoneId } from '../../data/materials'
import { RANGE, type ArmourSerial } from '../../data/range'
import { lineAt, type Line } from '../hits/aim'
import { OUTCOMES, traceShot, type HitResult, type Outcome, type Target } from '../hits/trace'
import { unit } from '../rng'

export interface TrialShot {
  line: Line
  hit: HitResult
}

export interface SerialResult extends ArmourSerial {
  shots: TrialShot[]
  /** Rounds that got through the armour. */
  through: number
  held: boolean
  /** Rounds active protection dealt with before they struck. */
  defeated: number
  /** The worst that came of any round in the serial. */
  worst: Outcome
}

export interface ArmourRun {
  serials: SerialResult[]
  /** Zones that had to hold and did not, each once, in the order they were fired on. */
  failed: ZoneId[]
}

// Names the rolls that place a shot on the plate.
const PLACE = 77

/** Fires every serial. Each starts with fresh tiles; within one, a tile that has gone off stays gone. */
export function runArmourTrial(
  target: Target, slopeDeg: Record<ZoneId, number>, serials: readonly ArmourSerial[], seed: number,
): ArmourRun {
  const k = RANGE.armour
  const results = serials.map((serial, serialNo): SerialResult => {
    let spent = new Set<string>()
    const shots: TrialShot[] = []
    for (let shotNo = 0; shotNo < k.shots; shotNo++) {
      const fire = (across: number, along: number): { shot: TrialShot; spentAfter: Set<string> } => {
        const line = lineAt(target.shell, serial.zone, serial.angleDeg, slopeDeg, across, along)
        const spentAfter = new Set(spent)
        const hit = traceShot(target, {
          ...line, round: THREATS[serial.threat], rangeM: serial.rangeM, seed, shotNo: serialNo * k.shots + shotNo, luck: true,
        }, spentAfter)
        return { shot: { line, hit }, spentAfter }
      }
      // The range gunners lay each round on the named plate. A lay that strays off it is made again.
      let fired = fire(0, 0)
      for (let tryNo = 0; tryNo < k.tries; tryNo++) {
        const across = (2 * unit(seed, PLACE, serialNo, shotNo, tryNo, 0) - 1) * k.spread
        const along = (2 * unit(seed, PLACE, serialNo, shotNo, tryNo, 1) - 1) * k.spread
        const tried = fire(across, along)
        if (tried.shot.hit.zone === serial.zone) {
          fired = tried
          break
        }
      }
      spent = fired.spentAfter
      shots.push(fired.shot)
    }
    const through = shots.filter((shot) => shot.hit.through).length
    const worst = shots.reduce<Outcome>(
      (worstYet, shot) => (OUTCOMES.indexOf(shot.hit.outcome) > OUTCOMES.indexOf(worstYet) ? shot.hit.outcome : worstYet), 'missed')
    const defeated = shots.filter((shot) => shot.hit.defeated !== undefined).length
    return { ...serial, shots, through, held: through === 0, defeated, worst }
  })
  const failed: ZoneId[] = []
  for (const result of results) {
    if (result.gate && !result.held && !failed.includes(result.zone)) failed.push(result.zone)
  }
  return { serials: results, failed }
}
