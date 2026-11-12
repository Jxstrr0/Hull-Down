// The air defence replay: the raiders laid out in time, one after another, from the trial's own numbers.
import { describe, expect, it } from 'vitest'
import { AIR_TRIAL } from '../src/data/airDefence'
import { BASELINE_SPEC } from '../src/data/baseline'
import { STRINGS } from '../src/data/strings'
import { TENDERS } from '../src/data/tenders'
import { trialBid } from '../src/sim/career/score'
import type { AirResult } from '../src/sim/trials'
import { gunRingMm, type VehicleSpec } from '../src/sim/vehicle'
import { airFrame, airTimeline, burstTimes, rangeOf } from '../src/ui/airTimeline'

const T = TENDERS.aa2012
const R = AIR_TRIAL.replay

/** A light tracked vehicle with the twin cannon, the search radar and the digital computer. */
function flak(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.hull.size = 'light'
  spec.gun = 'twin35'
  spec.loading = 'loader'
  spec.ammo.rounds = 40
  spec.fireControl.searchRadar = true
  spec.fireControl.computer = 'digital'
  spec.fireControl.rangefinder = 'laser'
  for (const zone of Object.keys(spec.armour) as (keyof typeof spec.armour)[]) {
    spec.armour[zone] = [{ material: 'rolledSteel', mm: 40 }]
    spec.era[zone] = 0
  }
  change?.(spec)
  spec.turret.ringMm = gunRingMm(spec)
  return spec
}

const raid = (seed = 3, change?: (spec: VehicleSpec) => void): AirResult => trialBid(flak(change), T, seed).range.air!

describe('the air defence replay', () => {
  it('plays each raider in turn until it is down or at its line, held a moment, then the next', () => {
    const run = raid()
    const line = airTimeline(run)
    expect(line.legs.map((leg) => leg.raider)).toEqual(run.raiders.map((_, n) => n))
    expect(line.legs[0]!.fromAt).toBe(0)
    for (const [n, leg] of line.legs.entries()) {
      const raider = run.raiders[n]!
      expect(leg.endS).toBe(raider.downedS ?? raider.lineS)
      expect(leg.toAt - leg.fromAt).toBeCloseTo(leg.endS + R.holdS, 9)
      if (n > 0) expect(leg.fromAt).toBe(line.legs[n - 1]!.toAt)
    }
    expect(line.endAt).toBeCloseTo(line.legs.at(-1)!.toAt + R.tailS, 9)
  })

  it('takes under two minutes to watch', () => {
    for (const change of [undefined, (spec: VehicleSpec) => { spec.fireControl.searchRadar = false }]) {
      expect(airTimeline(raid(3, change)).endAt / R.speed).toBeLessThan(120)
    }
  })

  it('shows each raider coming in, found, fired at, and down where the trial says', () => {
    const run = raid()
    const line = airTimeline(run)
    const n = run.raiders.findIndex((raider) => raider.downedS !== null && raider.foundS! > 0.5 && raider.bursts > 1)
    expect(n).toBeGreaterThanOrEqual(0)
    const raider = run.raiders[n]!
    const leg = line.legs[n]!
    const at = (s: number) => airFrame(run, line, leg.fromAt + s)
    const kind = AIR_TRIAL.kinds[raider.kind]
    expect(at(0)).toMatchObject({ raider: n, event: 'shows', found: false, bursts: 0, rangeM: kind.appearM })
    expect(at(raider.foundS! + 0.01)).toMatchObject({ event: 'found', found: true, bursts: 0 })
    expect(at(raider.firstS! + 0.01)).toMatchObject({ event: 'fires', bursts: 1, tracer: true })
    const down = at(raider.downedS! + 0.01)
    expect(down).toMatchObject({ event: 'downed', downed: true, bursts: raider.bursts, rangeM: raider.downedM })
    // Held where it came down until the next raider shows.
    expect(at(leg.toAt - leg.fromAt - 0.01).rangeM).toBe(raider.downedM)
    expect(burstTimes(run, raider).at(-1)).toBeCloseTo(raider.downedS!, 9)
  })

  it('ends with every raider the trial brought down and every burst it fired', () => {
    const run = raid()
    const line = airTimeline(run)
    const end = airFrame(run, line, line.endAt)
    expect(end.over).toBe(true)
    expect(end.raider).toBe(run.raiders.length - 1)
    expect(end.downedSoFar).toBe(run.downed)
    expect(end.burstsSoFar).toBe(run.bursts)
    // And the tally only grows.
    let downed = 0
    let bursts = 0
    for (let s = 0; s <= line.endAt; s += 0.5) {
      const frame = airFrame(run, line, s)
      expect(frame.downedSoFar).toBeGreaterThanOrEqual(downed)
      expect(frame.burstsSoFar).toBeGreaterThanOrEqual(bursts)
      downed = frame.downedSoFar
      bursts = frame.burstsSoFar
    }
  })

  it('shows a raider that got through stopped at its line, with no tracer', () => {
    const run = raid(3, (spec) => { spec.fireControl.searchRadar = false; spec.fireControl.computer = 'mechanical' })
    const n = run.raiders.findIndex((raider) => raider.downedS === null)
    expect(n).toBeGreaterThanOrEqual(0)
    const raider = run.raiders[n]!
    const line = airTimeline(run)
    const frame = airFrame(run, line, line.legs[n]!.fromAt + raider.lineS + 1)
    expect(frame).toMatchObject({ event: 'through', through: true, downed: false, tracer: false })
    const kind = AIR_TRIAL.kinds[raider.kind]
    expect(rangeOf(raider, raider.lineS + 10)).toBeCloseTo(kind.speedMs > 0 ? kind.lineM : kind.appearM, 6)
  })

  it('brings each raider in on a bearing that keeps it on both maps', () => {
    expect(R.bearingsDeg).toHaveLength(AIR_TRIAL.raids.length)
    for (const deg of R.bearingsDeg) expect(Math.abs(deg)).toBeLessThanOrEqual(40)
    for (const kind of Object.values(AIR_TRIAL.kinds)) expect(kind.appearM).toBeLessThanOrEqual(R.farM)
    expect(STRINGS.range.air.replay.watch).toBeTruthy()
  })
})
