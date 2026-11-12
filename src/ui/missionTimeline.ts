// The fire mission as it happened, laid out in time for the replay in the
// report: when each grid was called for, when each shell landed, and what
// the crew was doing in between. No DOM here, so it can be tested.
import { FIRE_MISSION } from '../data/fireMission'
import type { FireMissionRun } from '../sim/trials'

export type MissionPhase = 'emplace' | 'plot' | 'fire' | 'out' | 'left' | 'done'

export interface TimedShell {
  grid: number
  /** Seconds from the halt to its landing. */
  landS: number
  acrossM: number
  beyondM: number
  missM: number
  /** True for the first round on its grid, before the observer's correction. */
  first: boolean
}

export interface TimedGrid {
  /** Seconds from the halt to the call for fire on this grid. */
  callS: number
  /** Seconds from the halt to the first round landing. Null when nothing was fired on it. */
  firstS: number | null
  /** Seconds from the halt to the end of its part of the mission. */
  endS: number
  /** Seconds of the call spent swinging the whole vehicle round. */
  turnS: number
  /** False when the grid was beyond the gun's reach. */
  reached: boolean
}

export interface MissionTimeline {
  grids: TimedGrid[]
  shells: TimedShell[]
  /** Seconds from the halt to the end of the mission. */
  endS: number
}

export function missionTimeline(run: FireMissionRun): MissionTimeline {
  const F = FIRE_MISSION
  const grids: TimedGrid[] = []
  const shells: TimedShell[] = []
  let callS = 0
  for (const [gridNo, grid] of run.grids.entries()) {
    if (grid.firstRoundS === null) {
      const endS = callS + F.replay.skipS
      grids.push({ callS, firstS: null, endS, turnS: 0, reached: grid.reached })
      callS = endS
      continue
    }
    const firstS = callS + grid.firstRoundS
    for (const [n, shell] of grid.shells.entries()) {
      shells.push({ grid: gridNo, landS: firstS + shell.atS, acrossM: shell.acrossM, beyondM: shell.beyondM, missM: shell.missM, first: n === 0 })
    }
    const last = grid.shells[grid.shells.length - 1]?.atS ?? 0
    const endS = firstS + Math.max(F.minuteS, last)
    grids.push({ callS, firstS, endS, turnS: grid.turnS, reached: true })
    callS = endS
  }
  return { grids, shells, endS: callS }
}

export interface MissionFrame {
  phase: MissionPhase
  /** The grid being called for or fired on. The last one once the mission is over. */
  grid: number
  /** Shells landed so far, on every grid. */
  landed: number
  /** Shells in flight, each with how far along its way it is, 0..1. */
  flying: { shell: TimedShell; along: number }[]
}

/** What the replay shows at `atS` seconds after the halt. */
export function missionFrame(line: MissionTimeline, atS: number): MissionFrame {
  const F = FIRE_MISSION
  const landed = line.shells.filter((shell) => shell.landS <= atS).length
  const flying = line.shells
    .filter((shell) => shell.landS > atS && shell.landS - F.replay.trailS <= atS)
    .map((shell) => ({ shell, along: 1 - (shell.landS - atS) / F.replay.trailS }))
  const grid = line.grids.findIndex((each) => atS < each.endS)
  if (grid < 0) return { phase: 'done', grid: Math.max(0, line.grids.length - 1), landed, flying }
  const now = line.grids[grid]!
  let phase: MissionPhase
  if (now.firstS === null) phase = now.reached ? 'left' : 'out'
  else if (grid === 0 && atS < F.emplaceS) phase = 'emplace'
  else if (atS < now.firstS) phase = 'plot'
  else phase = 'fire'
  return { phase, grid, landed, flying }
}
