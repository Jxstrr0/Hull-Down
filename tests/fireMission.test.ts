// The fire mission: a self-propelled gun drops shells on map grids beyond the hill.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { FIRE_MISSION } from '../src/data/fireMission'
import { MARKS_GEN1 } from '../src/data/range'
import { compareTrials } from '../src/office/compareTrials'
import { fireOf } from '../src/sim/gunnery/fire'
import { runFireMission, runProvingGround, type FireMissionRun } from '../src/sim/trials'
import { buildStatSheet, gunRingMm, type VehicleSpec } from '../src/sim/vehicle'
import { sandboxLimits } from '../src/sim/vehicle/sandbox'
import { failedTests } from '../src/ui/careerWords'

function howitzer(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.gun = 'howitzer155'
  spec.hull.size = 'heavy'
  spec.turret.shape = 'bustle'
  spec.loading = 'loader'
  change?.(spec)
  spec.turret.ringMm = gunRingMm(spec)
  return spec
}

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1)
const runs = (spec: VehicleSpec): FireMissionRun[] => SEEDS.map((seed) => runFireMission(fireOf(spec), seed))
const mean = (values: number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length
const meanOf = (spec: VehicleSpec, pick: (run: FireMissionRun) => number | null): number => mean(runs(spec).map((run) => pick(run) ?? Infinity))

describe('the fire mission', () => {
  it('comes out the same for the same gun and seed', () => {
    expect(runFireMission(fireOf(howitzer()), 7)).toEqual(runFireMission(fireOf(howitzer()), 7))
  })

  it('is out of reach of a tank gun, which fires nothing', () => {
    const run = runFireMission(fireOf(BASELINE_SPEC), 1)
    expect(run.grids.every((grid) => !grid.reached && grid.shells.length === 0)).toBe(true)
    expect(run.firstRoundS).toBeNull()
    expect(run.missM).toBeNull()
    expect(run.rpm).toBe(0)
  })

  it('reaches every grid with a howitzer, and fires only within the minute', () => {
    const run = runFireMission(fireOf(howitzer()), 1)
    expect(run.grids.every((grid) => grid.reached && grid.shells.length > 0)).toBe(true)
    for (const grid of run.grids) for (const shell of grid.shells) expect(shell.atS).toBeLessThan(FIRE_MISSION.minuteS)
  })

  it('reaches further with a longer barrel', () => {
    const reach = (barrel: VehicleSpec['barrel']): number => fireOf(howitzer((s) => { s.barrel = barrel })).mission.reachKm
    expect(reach('short')).toBeLessThan(reach('standard'))
    expect(reach('long')).toBeGreaterThan(reach('standard'))
  })

  it('gets the first round off sooner, and closer, with a better ballistic computer', () => {
    const order = ['none', 'mechanical', 'electronic', 'digital'] as const
    const first = order.map((computer) => meanOf(howitzer((s) => { s.fireControl.computer = computer }), (run) => run.firstRoundS))
    const miss = order.map((computer) => meanOf(howitzer((s) => { s.fireControl.computer = computer }), (run) => run.missM))
    for (let i = 1; i < order.length; i++) {
      expect(first[i]).toBeLessThan(first[i - 1] as number)
      expect(miss[i]).toBeLessThan(miss[i - 1] as number)
    }
  })

  it('lands closer once the observer has corrected the first round', () => {
    const all = runs(howitzer((s) => { s.fireControl.computer = 'none' })).flatMap((run) => run.grids)
    const firsts = mean(all.map((grid) => grid.shells[0]?.missM ?? 0))
    const rest = mean(all.flatMap((grid) => grid.shells.slice(1).map((shell) => shell.missM)))
    expect(rest).toBeLessThan(firsts * 0.6)
  })

  it('fires more rounds in the minute with an autoloader than with a man', () => {
    expect(meanOf(howitzer((s) => { s.loading = 'carousel' }), (run) => run.rpm)).toBeGreaterThan(meanOf(howitzer(), (run) => run.rpm) + 2)
  })

  it("swings a casemate's whole vehicle round to each grid, and not a turret", () => {
    const turns = (shape: VehicleSpec['turret']['shape']): number =>
      runFireMission(fireOf(howitzer((s) => { s.turret.shape = shape })), 1).grids.reduce((sum, grid) => sum + grid.turnS, 0)
    expect(turns('bustle')).toBe(0)
    expect(turns('casemate')).toBeGreaterThan(0)
  })

  it('stops when the rounds run out', () => {
    const run = runFireMission(fireOf(howitzer((s) => { s.ammo.rounds = 6 })), 1)
    expect(run.grids.reduce((sum, grid) => sum + grid.shells.length, 0)).toBe(6)
    expect(run.ranOut).toBe(true)
  })
})

describe('the fire mission at the proving ground', () => {
  const limits = sandboxLimits('none')

  it('is not run for a tank, so a tank report is as it was', () => {
    const report = runProvingGround(buildStatSheet(BASELINE_SPEC, limits), { seed: 1, marks: MARKS_GEN1 })
    expect(report.fireMission).toBeNull()
    expect(report.tests).toBe(9)
  })

  it('is run for a howitzer on the range marks, and counts as a test', () => {
    const report = runProvingGround(buildStatSheet(howitzer((s) => { s.fireControl.computer = 'digital' }), limits), { seed: 1, marks: MARKS_GEN1 })
    expect(report.fireMission?.marks).toEqual(FIRE_MISSION.marks)
    expect(report.tests).toBe(10)
    expect(report.fireMission?.passed).toBe(true)
  })

  it('is run on a tender that asks for one, even for a tank, which fails it', () => {
    const marks = { ...MARKS_GEN1, fireMission: { firstRoundS: 100, rpm: 4, missM: 50 } }
    const report = runProvingGround(buildStatSheet(BASELINE_SPEC, limits), { seed: 1, marks })
    expect(report.fireMission?.marks).toEqual(marks.fireMission)
    expect(report.fireMission?.reachPassed).toBe(false)
    expect(failedTests(report)).toContain('Fire mission')
  })

  it('is set side by side when both builds went through it', () => {
    const run = (computer: VehicleSpec['fireControl']['computer']) =>
      runProvingGround(buildStatSheet(howitzer((s) => { s.fireControl.computer = computer }), limits), { seed: 1, marks: MARKS_GEN1 })
    const moves = compareTrials(run('none'), run('digital'))
    expect(moves.find((move) => move.key === 'missionFirst')?.verdict).toBe('better')
    const tank = runProvingGround(buildStatSheet(BASELINE_SPEC, limits), { seed: 1, marks: MARKS_GEN1 })
    expect(compareTrials(tank, run('none')).some((move) => move.key.startsWith('mission'))).toBe(false)
  })
})
