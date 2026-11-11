// The loading drill: the crew fires a long string of rounds as fast as the
// gun can be fed. A human loader tires; a machine keeps its pace, jams now
// and then, and has to be fed by hand once it is empty.
import { GUNNERY } from '../../data/gunnery'
import { RANGE_DAY, jamS, loadS, machineFed, relayS, type Fire } from '../gunnery/fire'
import { unit } from '../rng'

export interface DrillRound {
  /** Seconds from the round before to this one. */
  seconds: number
  jammed: boolean
  /** True when the crew fed this round by hand because the machine was empty. */
  byHand: boolean
}

export interface DrillRun {
  seed: number
  /** True when a machine feeds the gun. */
  auto: boolean
  rounds: DrillRound[]
  totalS: number
  /** Rounds a minute over the whole drill. */
  rpm: number
  jams: number
  /** Seconds lost to clearing jams. */
  clearingS: number
  /** Rounds the machine fed before it was empty. Null when it never ran out, or for a human loader. */
  emptyAfter: number | null
}

// Names the drill's rolls apart from every other test's.
const DRILL = 77

export function runLoadingDrill(fire: Fire, seed: number): DrillRun {
  const count = Math.min(GUNNERY.loading.drillRounds, fire.carried)
  const rounds: DrillRound[] = []
  let totalS = 0
  let jams = 0
  let clearingS = 0
  let emptyAfter: number | null = null
  for (let fired = 0; fired < count; fired++) {
    const machine = machineFed(fire, fired)
    const jammed = machine && unit(seed, DRILL, fired) < fire.feed.jamPerRound
    const byHand = fire.feed.auto && !machine
    if (byHand && emptyAfter === null) emptyAfter = fired
    const clearS = jammed ? jamS(fire, RANGE_DAY) : 0
    const seconds = Math.max(loadS(fire, fired, RANGE_DAY) + clearS, relayS(fire, RANGE_DAY))
    if (jammed) jams++
    clearingS += clearS
    totalS += seconds
    rounds.push({ seconds, jammed, byHand })
  }
  return { seed, auto: fire.feed.auto, rounds, totalS, rpm: totalS > 0 ? (count * 60) / totalS : 0, jams, clearingS, emptyAfter }
}
