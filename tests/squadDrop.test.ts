// The squad drop: carry the squad to a drop point, let it out, and cover it with the gun.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { MARKS_GEN1, type Marks } from '../src/data/range'
import { SQUAD_TRIAL } from '../src/data/squad'
import { STRINGS } from '../src/data/strings'
import { runProvingGround } from '../src/sim/trials'
import { sandboxLimits } from '../src/sim/vehicle/sandbox'
import { buildStatSheet, gunRingMm, type VehicleSpec } from '../src/sim/vehicle'

const SEEDS = [1, 2, 3, 4, 5]

/** A medium hull with the engine in front, six soldiers, the 30 mm cannon and a laser rangefinder with an electronic computer. */
function ifv(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.gun = 'autocannon30'
  spec.hull.engineAt = 'front'
  spec.crew.troops = 6
  spec.fireControl.rangefinder = 'laser'
  spec.fireControl.computer = 'electronic'
  change?.(spec)
  spec.turret.ringMm = Math.max(spec.turret.ringMm, gunRingMm(spec))
  return spec
}

const range = (spec: VehicleSpec, seed = 1, marks: Marks = MARKS_GEN1) =>
  runProvingGround(buildStatSheet(spec, sandboxLimits('none')), { seed, marks })

describe('the squad drop', () => {
  it('is run only for a vehicle that carries soldiers, or where the tender asks for it', () => {
    const tank = range(BASELINE_SPEC)
    expect(tank.squad).toBeNull()
    const carrier = range(ifv())
    expect(carrier.squad).not.toBeNull()
    expect(carrier.tests).toBe(tank.tests + 1)
    const asked = range(BASELINE_SPEC, 1, { ...MARKS_GEN1, squad: SQUAD_TRIAL.marks })
    expect(asked.squad?.troops).toBe(0)
    expect(asked.squad?.troopsPassed).toBe(false)
    expect(asked.squad?.outS).toBe(0)
  })

  it('gives the same result for the same vehicle and seed', () => {
    expect(range(ifv(), 7).squad).toEqual(range(ifv(), 7).squad)
  })

  it('times the run across country and the soldiers out of the door', () => {
    const run = range(ifv()).squad!
    expect(run.outS).toBeCloseTo(SQUAD_TRIAL.doorS + 6 * SQUAD_TRIAL.perSoldierS, 6)
    expect(run.dropS).toBeCloseTo(run.driveS! + run.outS, 6)
    const slower = range(ifv((spec) => { spec.powerpack.engine = 'diesel580' })).squad!
    expect(slower.driveS!).toBeGreaterThan(run.driveS!)
    const four = range(ifv((spec) => { spec.crew.troops = 4 })).squad!
    expect(four.outS).toBeLessThan(run.outS)
    expect(four.troopsPassed).toBe(false)
  })

  it('is passed by a cannon with good fire control, and not by a tank gun that loads slowly', () => {
    for (const seed of SEEDS) {
      const cannon = range(ifv(), seed).squad!
      expect(cannon.passed, `seed ${seed}`).toBe(true)
      expect(cannon.knocked).toBe(SQUAD_TRIAL.targets.length)
      const big = range(ifv((spec) => { spec.gun = BASELINE_SPEC.gun }), seed).squad!
      expect(big.coverPassed, `seed ${seed}`).toBe(false)
    }
  })

  it('shoots in order, within the time, and stops on a target once it is down', () => {
    const run = range(ifv(), 3).squad!
    let last = 0
    for (const target of run.targets) {
      for (const shot of target.shots) {
        expect(shot.atS).toBeGreaterThanOrEqual(last)
        expect(shot.atS).toBeLessThanOrEqual(SQUAD_TRIAL.coverS)
        last = shot.atS
      }
      const hits = target.shots.filter((shot) => shot.hit).length
      if (target.downS !== null) {
        expect(hits).toBe(target.hits)
        expect(target.shots.at(-1)!.hit).toBe(true)
      } else {
        expect(hits).toBeLessThan(target.hits)
      }
    }
    expect(run.roundsFired).toBe(run.targets.reduce((sum, target) => sum + target.shots.length, 0))
  })

  it('has words for every target and line', () => {
    const Q = STRINGS.range.squad
    expect(Q.targetNames.length).toBe(SQUAD_TRIAL.targets.length)
    for (const name of Q.targetNames) expect(name).not.toBe('')
    expect(Q.title).not.toBe('')
  })
})
