// The squad drop replay: the drop laid out in time from the trial's own numbers.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { SQUAD_TRIAL } from '../src/data/squad'
import { TENDERS } from '../src/data/tenders'
import { TUNING } from '../src/data/tuning'
import { trialBid } from '../src/sim/career/score'
import type { VehicleSpec } from '../src/sim/vehicle'
import { squadFrame, squadTimeline } from '../src/ui/squadTimeline'

const T = TENDERS.ifv1996

function ifv(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.gun = 'autocannon30'
  spec.hull.engineAt = 'front'
  spec.loading = 'loader'
  spec.crew.troops = 6
  spec.fireControl.rangefinder = 'laser'
  spec.fireControl.computer = 'electronic'
  spec.turret.ringMm = TUNING.limits.ringMm.min
  change?.(spec)
  return spec
}

const drop = (change?: (spec: VehicleSpec) => void) => trialBid(ifv(change), T, 7).range.squad!

describe('the squad drop replay', () => {
  it('fires every round the trial fired, in order, and lets each soldier out after the door', () => {
    const run = drop()
    const line = squadTimeline(run)
    expect(line.rounds.length).toBe(run.roundsFired)
    for (let n = 1; n < line.rounds.length; n++) expect(line.rounds[n]!.atS).toBeGreaterThanOrEqual(line.rounds[n - 1]!.atS)
    expect(line.outS.length).toBe(run.troops)
    expect(line.outS[0]).toBeCloseTo(SQUAD_TRIAL.doorS + SQUAD_TRIAL.perSoldierS, 9)
    expect(line.outS.at(-1)).toBeCloseTo(run.outS, 9)
  })

  it('halts, fires, puts every target down, and stops soon after when the gun is quick', () => {
    const run = drop()
    expect(run.knocked).toBe(run.targets.length)
    const line = squadTimeline(run)
    expect(squadFrame(run, line, 0).phase).toBe('halt')
    const second = run.targets[1]!.shots[0]!.atS
    expect(squadFrame(run, line, second).phase).toBe(run.targets[1]!.downS === second ? 'down' : 'fire')
    expect(squadFrame(run, line, second).target).toBe(1)
    expect(squadFrame(run, line, second - 0.01).phase).toBe('down')
    const end = squadFrame(run, line, line.endS)
    expect(end.phase).toBe('clear')
    expect(end.fired).toBe(run.roundsFired)
    expect(end.out).toBe(run.troops)
    expect(end.down.every(Boolean)).toBe(true)
    expect(line.endS).toBeLessThan(SQUAD_TRIAL.coverS)
  })

  it('crosses each target out from the moment the trial says it went down', () => {
    const run = drop()
    const line = squadTimeline(run)
    const first = run.targets[0]!
    expect(squadFrame(run, line, first.downS! - 0.01).down[0]).toBe(false)
    expect(squadFrame(run, line, first.downS!).down[0]).toBe(true)
    expect(squadFrame(run, line, first.downS!).hits[0]).toBe(first.hits)
  })

  it('runs the whole minute when a target is left standing', () => {
    const run = drop()
    const standing = { ...run, ranOut: false, knocked: run.targets.length - 1, targets: run.targets.map((target, n) => n === 3 ? { ...target, downS: null } : target) }
    const line = squadTimeline(standing)
    expect(line.endS).toBe(SQUAD_TRIAL.coverS)
    expect(squadFrame(standing, line, line.endS).phase).toBe('time')
  })

  it('says the gun ran dry once its last round is gone', () => {
    const run = drop()
    const last = run.targets[3]!
    const dry = { ...run, ranOut: true, knocked: run.targets.length - 1, targets: run.targets.map((target, n) => n === 3 ? { ...target, downS: null } : target) }
    const line = squadTimeline(dry)
    expect(squadFrame(dry, line, last.shots.at(-1)!.atS).phase).toBe('dry')
  })
})
