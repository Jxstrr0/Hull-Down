// The fire mission replay: the mission laid out in time from the trial's own numbers.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { FIRE_MISSION } from '../src/data/fireMission'
import { TENDERS } from '../src/data/tenders'
import { trialBid } from '../src/sim/career/score'
import { gunRingMm, type VehicleSpec } from '../src/sim/vehicle'
import { missionFrame, missionTimeline } from '../src/ui/missionTimeline'

const T = TENDERS.spg2008

function spg(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.gun = 'howitzer155'
  spec.turret.shape = 'casemate'
  spec.loading = 'loader'
  spec.ammo.rounds = 30
  change?.(spec)
  spec.turret.ringMm = gunRingMm(spec)
  return spec
}

const mission = (change?: (spec: VehicleSpec) => void) => trialBid(spg(change), T, 7).range.fireMission!

describe('the fire mission replay', () => {
  it('lands the first round on the first grid when the trial says, and every shell in order', () => {
    const run = mission()
    const line = missionTimeline(run)
    expect(line.grids[0]!.firstS).toBeCloseTo(run.firstRoundS!, 9)
    expect(line.shells.length).toBe(run.grids.reduce((sum, grid) => sum + grid.shells.length, 0))
    for (let n = 1; n < line.shells.length; n++) expect(line.shells[n]!.landS).toBeGreaterThan(line.shells[n - 1]!.landS)
    expect(line.endS).toBeGreaterThan(line.shells.at(-1)!.landS)
  })

  it('calls each grid once the last has had its minute', () => {
    const line = missionTimeline(mission())
    for (let n = 1; n < line.grids.length; n++) {
      expect(line.grids[n]!.callS).toBeCloseTo(line.grids[n - 1]!.firstS! + FIRE_MISSION.minuteS, 6)
    }
  })

  it('gets into action, works out the data, fires, and ends', () => {
    const line = missionTimeline(mission())
    expect(missionFrame(line, 1).phase).toBe('emplace')
    expect(missionFrame(line, FIRE_MISSION.emplaceS + 1).phase).toBe('plot')
    expect(missionFrame(line, line.grids[0]!.firstS!).phase).toBe('fire')
    expect(missionFrame(line, line.grids[1]!.callS + 0.1).grid).toBe(1)
    const end = missionFrame(line, line.endS + 1)
    expect(end.phase).toBe('done')
    expect(end.landed).toBe(line.shells.length)
    expect(end.flying).toEqual([])
  })

  it('shows each shell in flight just before it lands', () => {
    const line = missionTimeline(mission())
    const first = line.shells[0]!
    const frame = missionFrame(line, first.landS - FIRE_MISSION.replay.trailS / 2)
    const seen = frame.flying.find((each) => each.shell === first)
    expect(seen?.along).toBeCloseTo(0.5, 9)
    expect(missionFrame(line, first.landS).landed).toBe(1)
  })

  it('passes over a grid out of reach in a moment', () => {
    const run = mission()
    const short = { ...run, grids: run.grids.map((grid, n) => n === 2 ? { ...grid, reached: false, firstRoundS: null, turnS: 0, shells: [] } : grid) }
    const line = missionTimeline(short)
    const last = line.grids[2]!
    expect(last.endS - last.callS).toBe(FIRE_MISSION.replay.skipS)
    expect(missionFrame(line, last.callS + 1).phase).toBe('out')
  })
})
