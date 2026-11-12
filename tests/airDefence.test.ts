// The air defence trial: raiders come at the vehicle one after another, and it is marked on how many
// it brings down before their line and how quickly it opens fire.
import { describe, expect, it } from 'vitest'
import { AIR_KIND_IDS, AIR_TRIAL } from '../src/data/airDefence'
import { BASELINE_SPEC } from '../src/data/baseline'
import { STRINGS } from '../src/data/strings'
import { fireOf } from '../src/sim/gunnery/fire'
import { judgeAirDefence, runAirDefence, runProvingGround, type AirRun } from '../src/sim/trials'
import { buildStatSheet, gunRingMm, type VehicleSpec } from '../src/sim/vehicle'
import { sandboxLimits } from '../src/sim/vehicle/sandbox'

const SEEDS = Array.from({ length: 40 }, (_, n) => n + 1)

/** A light tank with the twin cannon, 40 bursts, and whatever fire control the test gives it. */
function flak(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.gun = 'twin35'
  spec.hull.size = 'light'
  spec.loading = 'loader'
  spec.ammo.rounds = 40
  change?.(spec)
  spec.turret.ringMm = gunRingMm(spec)
  return spec
}

const radarDigital = (s: VehicleSpec): void => {
  s.fireControl.searchRadar = true
  s.fireControl.computer = 'digital'
  s.fireControl.rangefinder = 'laser'
}

/** Over many seeds: raiders brought down on average, and the share of runs that pass the range's marks. */
function over(spec: VehicleSpec): { downed: number; passes: number; runs: AirRun[] } {
  const fire = fireOf(spec)
  const runs = SEEDS.map((seed) => runAirDefence(fire, seed))
  return {
    downed: runs.reduce((n, run) => n + run.downed, 0) / runs.length,
    passes: runs.filter((run) => judgeAirDefence(run, AIR_TRIAL.marks).passed).length / runs.length,
    runs,
  }
}

describe('the air defence trial', () => {
  it('sends jets, helicopters and drones, each with a name on the card', () => {
    for (const id of AIR_KIND_IDS) {
      expect(AIR_TRIAL.raids).toContain(id)
      expect(STRINGS.range.air.names[id]).not.toBe('')
    }
    expect(AIR_TRIAL.marks.downed).toBeLessThanOrEqual(AIR_TRIAL.raids.length)
  })

  it('comes out the same for the same vehicle and seed', () => {
    const fire = fireOf(flak(radarDigital))
    expect(runAirDefence(fire, 7)).toEqual(runAirDefence(fire, 7))
  })

  it('tells each raider truly: found before the first burst, the first burst within range, and down before its line', () => {
    for (const run of over(flak(radarDigital)).runs) {
      expect(run.raiders).toHaveLength(AIR_TRIAL.raids.length)
      expect(run.bursts).toBeLessThanOrEqual(run.carried)
      for (const raider of run.raiders) {
        if (raider.firstS === null) continue
        expect(raider.foundS!).toBeLessThan(raider.firstS)
        expect(raider.firstS).toBeGreaterThanOrEqual(raider.openS!)
        expect(raider.firstS).toBeLessThan(raider.lineS)
        expect(raider.reactionS).toBeCloseTo(raider.firstS - raider.openS!, 9)
        if (raider.downedS !== null) {
          expect(raider.downedS).toBeLessThan(raider.lineS)
          expect(raider.downedM!).toBeGreaterThan(0)
        }
      }
    }
  })

  it('passes nearly always with the search radar and the digital computer', () => {
    const best = over(flak(radarDigital))
    expect(best.passes).toBeGreaterThanOrEqual(0.9)
    expect(best.downed).toBeGreaterThan(5)
  })

  it('reacts too slowly without the radar: the crew see a jet only as it clears the trees', () => {
    const eyes = over(flak((s) => {
      s.fireControl.computer = 'digital'
      s.fireControl.rangefinder = 'laser'
      s.fireControl.commanderSight = true
    }))
    expect(eyes.passes).toBe(0)
    for (const run of eyes.runs) {
      expect(run.radar).toBe(false)
      expect(run.reactionS === null || run.reactionS > AIR_TRIAL.marks.reactionS).toBe(true)
    }
  })

  it('brings down fewer with a worse computer, and leads a jet worst of all', () => {
    const digital = over(flak(radarDigital))
    const mechanical = over(flak((s) => {
      radarDigital(s)
      s.fireControl.computer = 'mechanical'
    }))
    expect(mechanical.downed).toBeLessThan(digital.downed - 1)
    const jets = (runs: AirRun[]): number => runs.flatMap((run) => run.raiders).filter((r) => r.kind === 'jet' && r.downedS !== null).length
    expect(jets(mechanical.runs)).toBeLessThan(jets(digital.runs) / 2)
  })

  it('runs dry with too few rounds, and says so', () => {
    const short = over(flak((s) => {
      radarDigital(s)
      s.ammo.rounds = 20
    }))
    expect(short.runs.some((run) => run.ranOut)).toBe(true)
    for (const run of short.runs.filter((each) => each.ranOut)) {
      expect(run.bursts).toBe(20)
      expect(run.raiders.some((raider) => raider.dry)).toBe(true)
    }
    expect(short.downed).toBeLessThan(over(flak(radarDigital)).downed)
  })

  it('is run on the proving ground for an anti-aircraft gun only, and counted with the rest', () => {
    const limits = sandboxLimits('none')
    const report = runProvingGround(buildStatSheet(flak(radarDigital), limits), { seed: 3 })
    expect(report.air).not.toBeNull()
    expect(report.air!.marks).toEqual(AIR_TRIAL.marks)
    const tank = runProvingGround(buildStatSheet(structuredClone(BASELINE_SPEC), limits), { seed: 3 })
    expect(tank.air).toBeNull()
    expect(report.tests).toBe(tank.tests + 1)
  })
})
