// The squad drop as it happened, laid out in time for the replay in the
// report: the door going down, each soldier out, and each round the gun put
// on each target. No DOM here, so it can be tested.
import { SQUAD_TRIAL } from '../data/squad'
import type { SquadRun } from '../sim/trials/squad'

export type SquadPhase = 'halt' | 'fire' | 'down' | 'clear' | 'dry' | 'time'

export interface TimedRound {
  target: number
  /** Seconds from the halt. */
  atS: number
  acrossM: number
  upM: number
  hit: boolean
}

export interface SquadTimeline {
  rounds: TimedRound[]
  /** Seconds from the halt each soldier is out of the door. */
  outS: number[]
  /** Seconds from the halt to the end of the replay. */
  endS: number
}

export function squadTimeline(run: SquadRun): SquadTimeline {
  const S = SQUAD_TRIAL
  const rounds: TimedRound[] = []
  for (const [target, each] of run.targets.entries()) {
    for (const shot of each.shots) rounds.push({ target, atS: shot.atS, acrossM: shot.acrossM, upM: shot.upM, hit: shot.hit })
  }
  rounds.sort((a, b) => a.atS - b.atS)
  const outS = Array.from({ length: run.troops }, (_, n) => S.doorS + (n + 1) * S.perSoldierS)
  // Over as soon as there is nothing left to see; otherwise the whole time the squad needs covering.
  const over = run.knocked === run.targets.length || run.ranOut
  const lastS = rounds.at(-1)?.atS ?? 0
  const endS = over ? Math.max(run.outS, lastS) + S.replay.tailS : Math.max(S.coverS, run.outS)
  return { rounds, outS, endS }
}

export interface SquadFrame {
  phase: SquadPhase
  /** The target being laid on or fired at. The last one fired at once the gun has finished. */
  target: number
  /** Soldiers out of the door so far. */
  out: number
  /** Rounds fired so far, and each target's hits so far. */
  fired: number
  hits: number[]
  /** True for each target out of action by now. */
  down: boolean[]
}

/** What the replay shows at `atS` seconds after the halt. */
export function squadFrame(run: SquadRun, line: SquadTimeline, atS: number): SquadFrame {
  const fired = line.rounds.filter((round) => round.atS <= atS)
  const hits = run.targets.map((_, n) => fired.filter((round) => round.target === n && round.hit).length)
  const down = run.targets.map((target) => target.downS !== null && target.downS <= atS)
  const out = line.outS.filter((s) => s <= atS).length
  const frame = (phase: SquadPhase, target: number): SquadFrame => ({ phase, target, out, fired: fired.length, hits, down })
  const last = fired.at(-1)
  if (!last) return frame(atS >= line.endS ? 'time' : 'halt', 0)
  const target = last.target
  if (down.every(Boolean)) return frame('clear', target)
  const more = line.rounds.length > fired.length
  if (!more && run.ranOut) return frame('dry', target)
  if (atS >= line.endS) return frame('time', target)
  return frame(down[target] ? 'down' : 'fire', target)
}
