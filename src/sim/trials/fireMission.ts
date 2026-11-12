// The fire mission: an observer calls for fire on map grids beyond the hill.
// The gun halts, gets into action, works out its fire data, turns to each
// grid and fires as fast as it can be fed for a minute. The first shell lands
// off by whatever the fire data got wrong; once the observer has seen it fall
// and called a correction, the rest land closer.
import { BATTLE } from '../../data/battle'
import { FIRE_MISSION, type FireMissionMarks } from '../../data/fireMission'
import { RANGE } from '../../data/range'
import { RANGE_DAY, jamS, loadS, machineFed, missionLayS, relayS, type Fire, type Shoot } from '../gunnery/fire'
import { bell, unit } from '../rng'

export interface MissionShell {
  /** Seconds after the gun's first round on this grid. */
  atS: number
  /** Where it landed from the middle of the grid, metres: across to the right, and beyond. */
  acrossM: number
  beyondM: number
  missM: number
}

export interface MissionGrid {
  rangeKm: number
  bearingDeg: number
  /** False when the grid is beyond the gun's reach: it fires nothing there. */
  reached: boolean
  /** Seconds from the call for fire (from the halt, for the first grid) to the first round. Null when out of reach. */
  firstRoundS: number | null
  /** Seconds spent turning the whole vehicle to bring the gun to bear. */
  turnS: number
  shells: MissionShell[]
}

export interface FireMissionRun {
  seed: number
  grids: MissionGrid[]
  /** Seconds from the halt to the first round on the first grid. Null when the gun cannot reach it. */
  firstRoundS: number | null
  /** Rounds fired in the minute from the first, on average over the grids. Out-of-reach grids count nought. */
  rpm: number
  /** Average distance of every shell from the middle of its grid, metres. Null when none was fired. */
  missM: number | null
  /** Rounds there were none left to fire. */
  ranOut: boolean
}

// Names the mission's rolls apart from every other test's.
const MISSION = 91

/** Degrees from `from` to `to`, the short way round. */
function turnDeg(from: number, to: number): number {
  let d = (to - from) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

export function runFireMission(fire: Fire, seed: number): FireMissionRun {
  const shoot: Shoot = { ...RANGE_DAY, hours: RANGE.crewHours }
  const F = FIRE_MISSION
  const grids: MissionGrid[] = []
  let fired = 0
  let heading = 0
  let ranOut = false
  for (const [gridNo, target] of F.targets.entries()) {
    const reached = target.rangeKm <= fire.mission.reachKm
    if (!reached || fired >= fire.carried) {
      if (reached) ranOut = true
      grids.push({ rangeKm: target.rangeKm, bearingDeg: target.bearingDeg, reached, firstRoundS: null, turnS: 0, shells: [] })
      continue
    }
    // A turret swings round as the data is worked out. A casemate's whole vehicle turns, as far as its gun cannot.
    let turnS = 0
    if (fire.swingDeg !== null) {
      const off = turnDeg(heading, target.bearingDeg)
      const turn = Math.max(0, Math.abs(off) - fire.swingDeg)
      turnS = turn / BATTLE.hullTurnDegS
      heading += Math.sign(off) * turn
    }
    const firstRoundS = (gridNo === 0 ? F.emplaceS : 0) + missionLayS(fire, shoot) + turnS + loadS(fire, fired, shoot)
    // The fire data is wrong by the same amount for every shell, until the observer corrects it.
    const errorM = F.dataErrorMPerKm * target.rangeKm * fire.uncorrected
    const dataAcross = errorM * bell(seed, MISSION, gridNo, 0)
    const dataBeyond = errorM * bell(seed, MISSION, gridNo, 1)
    const scatterM = F.scatterMPerKm * target.rangeKm
    const shells: MissionShell[] = []
    let atS = 0
    for (let n = 0; atS < F.minuteS && fired < fire.carried; n++) {
      const left = n === 0 ? 1 : F.observedLeft
      const acrossM = dataAcross * left + scatterM * bell(seed, MISSION, gridNo, 2, n)
      const beyondM = dataBeyond * left + scatterM * bell(seed, MISSION, gridNo, 3, n)
      shells.push({ atS, acrossM, beyondM, missM: Math.hypot(acrossM, beyondM) })
      fired++
      if (fired >= fire.carried) break
      const jammed = machineFed(fire, fired) && unit(seed, MISSION, gridNo, 4, n) < fire.feed.jamPerRound
      atS += Math.max(loadS(fire, fired, shoot) + (jammed ? jamS(fire, shoot) : 0), relayS(fire, shoot))
    }
    if (fired >= fire.carried && gridNo < F.targets.length - 1) ranOut = true
    grids.push({ rangeKm: target.rangeKm, bearingDeg: target.bearingDeg, reached, firstRoundS, turnS, shells })
  }
  const all = grids.flatMap((grid) => grid.shells)
  return {
    seed,
    grids,
    firstRoundS: grids[0]?.firstRoundS ?? null,
    rpm: grids.reduce((sum, grid) => sum + grid.shells.length, 0) / grids.length,
    missM: all.length > 0 ? all.reduce((sum, shell) => sum + shell.missM, 0) / all.length : null,
    ranOut,
  }
}

/** The run judged against the marks: each of the three, and the whole. */
export function judgeFireMission(run: FireMissionRun, marks: FireMissionMarks): {
  reachPassed: boolean
  timePassed: boolean
  ratePassed: boolean
  closePassed: boolean
  passed: boolean
} {
  const reachPassed = run.grids.every((grid) => grid.reached)
  const timePassed = run.firstRoundS !== null && run.firstRoundS <= marks.firstRoundS
  const ratePassed = run.rpm >= marks.rpm
  const closePassed = run.missM !== null && run.missM <= marks.missM
  return { reachPassed, timePassed, ratePassed, closePassed, passed: reachPassed && timePassed && ratePassed && closePassed }
}
