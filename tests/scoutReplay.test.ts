// The spot-and-report replay: the patrol laid out in time from the trial's own numbers.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { SCOUT_TRIAL } from '../src/data/scout'
import { STRINGS } from '../src/data/strings'
import { TENDERS } from '../src/data/tenders'
import { trialBid } from '../src/sim/career/score'
import type { ScoutResult } from '../src/sim/trials'
import type { VehicleSpec } from '../src/sim/vehicle'
import { eventsAt, scoutFrame, scoutTimeline } from '../src/ui/scoutTimeline'

const T = TENDERS.scout2004
const R = SCOUT_TRIAL.replay

/** A light car on eight wheels with the 30 mm cannon and the commander's own sight. */
function car(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.hull.size = 'light'
  spec.gun = 'autocannon30'
  spec.loading = 'loader'
  spec.turret.ringMm = 1400
  spec.powerpack.engine = 'diesel580'
  spec.powerpack.transmission = 'manual38'
  spec.powerpack.fuelL = 600
  spec.fireControl.commanderSight = true
  for (const zone of Object.keys(spec.armour) as (keyof typeof spec.armour)[]) {
    spec.armour[zone] = [{ material: 'rolledSteel', mm: 15 }]
    spec.era[zone] = 0
  }
  spec.runningGear.layout = 'wheels8'
  change?.(spec)
  return spec
}

const patrol = (seed = 3, change?: (spec: VehicleSpec) => void): ScoutResult => trialBid(car(change), T, seed).range.scout!

describe('the spot-and-report replay', () => {
  it('drives to each lookout, watches from it, and drives home, adding up to the trial\'s own time', () => {
    const run = patrol()
    const line = scoutTimeline(run)!
    expect(line.legs.map((leg) => leg.kind)).toEqual(['drive', 'watch', 'drive', 'watch', 'drive', 'watch', 'drive'])
    expect(line.legs.map((leg) => leg.stop)).toEqual([0, 0, 1, 1, 2, 2, 3])
    expect(line.totalS).toBeCloseTo(run.totalS!, 6)
    for (let n = 1; n < line.legs.length; n++) {
      expect(line.legs[n]!.fromAt).toBe(line.legs[n - 1]!.toAt)
      expect(line.legs[n]!.fromS).toBeCloseTo(line.legs[n - 1]!.toS, 9)
    }
    // Each drive is a time-lapse; each watch at its own length, held a moment at the end.
    for (const leg of line.legs) expect(leg.toAt - leg.fromAt).toBeCloseTo(leg.kind === 'drive' ? R.legS : leg.toS - leg.fromS + R.holdS, 9)
  })

  it('takes under two minutes to watch, though the patrol took the best part of an hour', () => {
    const run = patrol()
    const line = scoutTimeline(run)!
    expect(run.totalS!).toBeGreaterThan(20 * 60)
    expect(line.endAt / R.speed).toBeLessThan(120)
  })

  it('starts on the start line, and ends back on it with everything the trial found and every time the car was seen first', () => {
    const run = patrol()
    const line = scoutTimeline(run)!
    const start = scoutFrame(run, line, 0)
    expect(start).toMatchObject({ phase: 'drive', stop: 0, clockS: 0, found: 0, seen: 0, event: null })
    const end = scoutFrame(run, line, line.endAt)
    expect(end).toMatchObject({ phase: 'back', found: run.found, seen: run.seen })
    expect(end.clockS).toBeCloseTo(run.totalS!, 6)
    const home = scoutFrame(run, line, line.legs.at(-1)!.fromAt + 1)
    expect(home.phase).toBe('home')
    expect(home.found).toBe(run.found)
  })

  it('boxes in each hidden vehicle from the moment the commander found it', () => {
    const run = patrol()
    const line = scoutTimeline(run)!
    const watch = line.legs[1]!
    const sighting = run.stops![0]!.targets.find((target) => target.foundS !== null)!
    const which = run.stops![0]!.targets.indexOf(sighting)
    const before = scoutFrame(run, line, watch.fromAt + sighting.foundS! - 0.01)
    const after = scoutFrame(run, line, watch.fromAt + sighting.foundS! + 0.01)
    expect(before.phase).toBe('watch')
    expect(before.targetFound[which]).toBe(false)
    expect(after.targetFound[which]).toBe(true)
    expect(after.found).toBe(before.found + 1)
    expect(after.event).toMatchObject({ kind: 'found', target: which })
    // The last find at a lookout ends the watch, but stays on show a moment.
    const lastS = Math.max(...run.stops![0]!.targets.map((target) => target.foundS ?? 0))
    const held = scoutFrame(run, line, watch.fromAt + lastS + R.holdS / 2)
    expect(held.phase).toBe('watch')
    expect(held.watchS).toBeLessThanOrEqual(run.stops![0]!.watchS)
    expect(held.clockS).toBeCloseTo(watch.toS, 6)
    // On the drive to a lookout nothing there is found yet.
    expect(scoutFrame(run, line, line.legs[2]!.fromAt + 1).targetFound.every((found) => !found)).toBe(true)
    expect(scoutFrame(run, line, line.legs[2]!.fromAt + 1).found).toBe(run.stops![0]!.targets.filter((target) => target.foundS !== null).length)
  })

  it('tells when a hidden vehicle sees the car before it is found', () => {
    const run = patrol()
    const stop = run.stops![1]!
    // The second vehicle at the second lookout sees the car at once, before the commander finds it.
    const seen: ScoutResult = {
      ...run,
      seen: run.seen + 1,
      stops: run.stops!.map((each, n) => n !== 1 ? each : {
        ...each,
        targets: each.targets.map((target, t) => t !== 1 ? target : { ...target, noticedS: 1, seenFirst: true }),
      }),
    }
    const line = scoutTimeline(seen)!
    const at = line.legs[3]!.fromAt + 1.5
    const frame = scoutFrame(seen, line, at)
    expect(frame.targetNoticed[1]).toBe(true)
    expect(frame.event).toMatchObject({ kind: 'noticed', target: 1, first: true })
    expect(frame.seen).toBe(run.stops![0]!.targets.filter((target) => target.seenFirst).length + 1)
    expect(eventsAt(seen.stops![1]!).map((each) => each.s)).toEqual([...eventsAt(seen.stops![1]!).map((each) => each.s)].sort((a, b) => a - b))
    expect(stop.targets.length).toBe(2)
  })

  it('has nothing to play back when the car never got round', () => {
    const run = patrol()
    expect(scoutTimeline({ ...run, stops: null, homeS: null, totalS: null })).toBeNull()
  })

  it('places every hidden vehicle within the commander\'s sweep and the view', () => {
    for (const [stop, lookout] of SCOUT_TRIAL.lookouts.entries()) {
      expect(R.bearingsDeg[stop]).toHaveLength(lookout.targets.length)
      for (const [n, target] of lookout.targets.entries()) {
        expect(Math.abs(R.bearingsDeg[stop]![n]!)).toBeLessThanOrEqual(R.sweepDeg)
        expect(target.rangeM).toBeLessThan(R.viewM)
      }
    }
    expect(STRINGS.range.scout.replay.watch).toBeTruthy()
  })
})
