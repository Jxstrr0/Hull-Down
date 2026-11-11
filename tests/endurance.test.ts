import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { COOLING, ENGINES, TRANSMISSIONS } from '../src/data/parts'
import { MARKS_GEN1, RANGE, RUN_PARTS, RUN_PART_IDS } from '../src/data/range'
import { PACT_LIMITS_GEN1, TUNING } from '../src/data/tuning'
import { legLoad, legSpans, runLengthKm, survivalOf, type PartWear } from '../src/sim/reliability/wear'
import { hash32, unit, unitWait } from '../src/sim/rng'
import { runEndurance, runProvingGround, type EnduranceRun } from '../src/sim/trials'
import { buildStatSheet, type StatSheet, type VehicleSpec } from '../src/sim/vehicle'

function build(change?: (spec: VehicleSpec) => void): StatSheet {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return buildStatSheet(spec, PACT_LIMITS_GEN1)
}

function endure(sheet: StatSheet, seed: number, climate?: 'temperate' | 'desert'): EnduranceRun {
  return runEndurance(sheet.drive, sheet.wear, { seed, climate })
}

const SEEDS = Array.from({ length: 300 }, (_, index) => index + 1)
const smallGearbox = (s: VehicleSpec): void => { s.powerpack.transmission = 'manual38' }
const narrowTracks = (s: VehicleSpec): void => { s.runningGear.trackWidthMm = 480 }

describe('the seeded draws', () => {
  it('gives the same number for the same name, on any device', () => {
    expect(hash32(1, 2, 3)).toBe(hash32(1, 2, 3))
    // Pinned, so a change to the mixing (or a device that disagrees) shows up.
    expect([hash32(0), hash32(1, 3, 0), hash32(2026, 4, 7)]).toEqual([1860555753, 1880894712, 2416348327])
  })

  it('tells draws apart by every part of the name, and by their order', () => {
    const seen = new Set([hash32(1, 2, 3), hash32(1, 3, 2), hash32(2, 1, 3), hash32(1, 2), hash32(1, 2, 3, 0)])
    expect(seen.size).toBe(5)
  })

  it('spreads its numbers evenly between 0 and 1', () => {
    const buckets = new Array<number>(10).fill(0)
    let sum = 0
    for (let seed = 0; seed < 200; seed++) {
      for (let draw = 0; draw < 50; draw++) {
        const u = unit(seed, 3, draw)
        expect(u).toBeGreaterThan(0)
        expect(u).toBeLessThan(1)
        buckets[Math.floor(u * 10)]! += 1
        sum += u
      }
    }
    expect(sum / 10_000).toBeCloseTo(0.5, 1)
    for (const count of buckets) expect(Math.abs(count - 1000)).toBeLessThan(120)
  })

  it('draws waits that average 1', () => {
    let sum = 0
    for (let draw = 0; draw < 10_000; draw++) sum += unitWait(9, draw)
    expect(sum / 10_000).toBeGreaterThan(0.95)
    expect(sum / 10_000).toBeLessThan(1.05)
  })
})

describe('wear on a part', () => {
  const part = (ratio: number): PartWear => ({ reliability: 0.95, have: 40 * ratio, rated: 40 })

  it('leaves a part at or under its rating with its plain reliability', () => {
    expect(survivalOf('transmission', part(0.6))).toBeCloseTo(0.95, 9)
    expect(survivalOf('transmission', part(1))).toBeCloseTo(0.95, 9)
    expect(survivalOf('tracks', part(1))).toBeCloseTo(0.95, 9)
  })

  it('wears an overloaded part faster the further over it is', () => {
    const chances = [1.02, 1.05, 1.1, 1.2, 1.4].map((ratio) => survivalOf('transmission', part(ratio)))
    expect(chances[0]).toBeLessThan(0.95)
    for (let i = 1; i < chances.length; i++) expect(chances[i]!).toBeLessThan(chances[i - 1]!)
    expect(chances.at(-1)!).toBeLessThan(0.01)
  })

  it('works the drive hardest in the hills and the running gear hardest on rough ground', () => {
    const hardest = (id: 'transmission' | 'tracks'): string => {
      let best = legSpans()[0]!.leg
      for (const { leg } of legSpans()) if (legLoad(id, part(1), leg, 'temperate') > legLoad(id, part(1), best, 'temperate')) best = leg
      return best.id
    }
    expect(hardest('transmission')).toBe('hills')
    expect(hardest('tracks')).toBe('rough')
  })

  it('never asks more of a part on any leg than its rating says it can take', () => {
    for (const leg of RANGE.endurance.legs) {
      expect(leg.drive).toBeLessThanOrEqual(1)
      expect(leg.ride).toBeLessThanOrEqual(1)
      expect(leg.km % RANGE.endurance.stepKm).toBe(0)
    }
  })

  it('sheds less heat in the desert, and leaves the other ratings alone', () => {
    const hills = legSpans().find((span) => span.leg.id === 'hills')!.leg
    expect(legLoad('engine', part(1), hills, 'desert')).toBeGreaterThan(legLoad('engine', part(1), hills, 'temperate'))
    expect(legLoad('transmission', part(1), hills, 'desert')).toBe(legLoad('transmission', part(1), hills, 'temperate'))
  })

  it('has no rated load for the cooling itself', () => {
    const base = build()
    expect(base.wear.cooling.rated).toBeNull()
    expect(survivalOf('cooling', base.wear.cooling)).toBeCloseTo(COOLING.standard.reliability, 9)
  })
})

describe('the stat sheet', () => {
  it('counts every worn part in the reliability index', () => {
    const base = build()
    expect(base.stress.tracks).toBeCloseTo(base.massT / (580 * TUNING.tracks.ratedTPerMm), 9)
    expect(base.wear.engine).toEqual({ reliability: ENGINES.diesel780.reliability, have: 780, rated: 800 })
    expect(base.wear.transmission.rated).toBe(TRANSMISSIONS.manual44.ratedT)
    expect(build(smallGearbox).reliabilityIndex).toBeLessThan(base.reliabilityIndex / 2)
    expect(build(narrowTracks).reliabilityIndex).toBeLessThan(base.reliabilityIndex / 2)
  })

  it('warns about tracks too narrow for the weight', () => {
    const narrow = build(narrowTracks)
    const issue = narrow.issues.find((i) => i.code === 'tracksOverloaded')
    expect(issue?.severity).toBe('warning')
    expect(issue?.part).toBe('runningGear.trackWidthMm')
    expect(narrow.growth.massT).toBeLessThan(0)
    expect(build().issues.some((i) => i.code === 'tracksOverloaded')).toBe(false)
  })
})

describe('the endurance run', () => {
  const base = build()

  it('takes the baseline round the whole run', () => {
    const run = endure(base, 1)
    expect(run.lengthKm).toBe(runLengthKm())
    expect(run.finished).toBe(true)
    expect(run.reachedKm).toBe(run.lengthKm)
    expect(run.legs.map((leg) => leg.id)).toEqual(RANGE.endurance.legs.map((leg) => leg.id))
    expect(run.legs.at(-1)!.toKm).toBe(run.lengthKm)
    let hours = 0
    for (const leg of run.legs) hours += (leg.toKm - leg.fromKm) / leg.speedKmh
    expect(run.movingH).toBeCloseTo(hours, 6)
    expect(run.legs[0]!.speedKmh).toBeGreaterThan(run.legs[2]!.speedKmh)
    for (const id of RUN_PART_IDS) expect(run.loads[id].load).toBeLessThanOrEqual(1)
  })

  it('gives the same run for the same seed and a different one for another', () => {
    expect(endure(base, 7)).toEqual(endure(base, 7))
    const narrow = build(narrowTracks)
    const shapes = new Set(SEEDS.slice(0, 20).map((seed) => JSON.stringify(endure(narrow, seed).events)))
    expect(shapes.size).toBeGreaterThan(10)
  })

  it('nearly always passes a tank with every part within its rating', () => {
    const runs = SEEDS.map((seed) => endure(base, seed))
    expect(runs.every((run) => run.finished)).toBe(true)
    expect(runs.filter((run) => run.stops <= MARKS_GEN1.enduranceStops).length).toBeGreaterThan(SEEDS.length * 0.95)
    // Trouble still comes now and then, and it is mended at the roadside.
    const faults = runs.flatMap((run) => run.events)
    expect(faults.length).toBeGreaterThan(0)
    expect(faults.every((event) => !event.ended && event.load <= 1 && event.haltH === RUN_PARTS[event.part].repairH)).toBe(true)
  })

  it('breaks an overloaded transmission for good, most times, in the hills', () => {
    const heavy = build(smallGearbox)
    expect(heavy.stress.transmission).toBeGreaterThan(1.05)
    const runs = SEEDS.map((seed) => endure(heavy, seed))
    const broken = runs.filter((run) => !run.finished)
    expect(broken.length).toBeGreaterThan(SEEDS.length * 0.6)
    for (const run of broken) {
      const last = run.events.at(-1)!
      expect(last.ended).toBe(true)
      expect(last.part).toBe('transmission')
      expect(last.leg).toBe('hills')
      expect(last.load).toBeGreaterThan(1)
      expect(run.reachedKm).toBe(last.km)
      expect(run.reachedKm).toBeLessThanOrEqual(run.lengthKm)
      // The legs it never reached are still listed, for the drawing of the run.
      expect(run.legs.map((leg) => leg.id)).toEqual(RANGE.endurance.legs.map((leg) => leg.id))
    }
    expect(runs[0]!.loads.transmission).toMatchObject({ leg: 'hills', rated: TRANSMISSIONS.manual38.ratedT })
  })

  it('never makes a part last less long by taking load off it', () => {
    const firstFailure = (run: EnduranceRun): number => run.events.find((event) => event.part === 'transmission')?.km ?? Infinity
    const heavy = build(smallGearbox)
    // The same gearbox in a lighter tank: the only thing that changes is the load on it.
    const light = structuredClone(heavy)
    light.wear.transmission.have = TRANSMISSIONS.manual38.ratedT
    for (const seed of SEEDS) expect(firstFailure(endure(light, seed))).toBeGreaterThanOrEqual(firstFailure(endure(heavy, seed)))
  })

  it('throws narrow tracks again and again without ending the run', () => {
    const narrow = build(narrowTracks)
    const runs = SEEDS.map((seed) => endure(narrow, seed))
    expect(runs.every((run) => run.finished)).toBe(true)
    let stops = 0
    for (const run of runs) {
      stops += run.stops
      expect(run.stops).toBe(run.events.length)
      let halted = 0
      for (const event of run.events) halted += event.haltH
      expect(run.haltedH).toBeCloseTo(halted, 9)
    }
    expect(stops / runs.length).toBeGreaterThan(2)
    expect(runs.filter((run) => run.stops > MARKS_GEN1.enduranceStops).length).toBeGreaterThan(SEEDS.length * 0.6)
    expect(runs[0]!.loads.tracks.leg).toBe('rough')
  })

  it('seizes an engine the cooling cannot keep up with', () => {
    const hot = build((s) => { s.powerpack.engine = 'turbine1000' })
    for (const seed of SEEDS.slice(0, 50)) {
      const run = endure(hot, seed)
      expect(run.finished).toBe(false)
      expect(run.events.at(-1)).toMatchObject({ part: 'engine', ended: true })
    }
    const cooled = build((s) => { s.powerpack.engine = 'turbine1000'; s.powerpack.cooling = 'heavyDuty' })
    expect(endure(cooled, 1).loads.engine.load).toBeLessThanOrEqual(1)
  })

  it('overheats in the desert an engine that is fine at home', () => {
    const home = endure(base, 1)
    const away = endure(base, 1, 'desert')
    expect(home.loads.engine.load).toBeLessThanOrEqual(1)
    expect(away.loads.engine.load).toBeGreaterThan(1)
    expect(away.loads.engine.rated).toBeCloseTo(COOLING.standard.capacityHp * 0.85, 6)
    expect(away.loads.transmission).toEqual(home.loads.transmission)
    const broken = SEEDS.filter((seed) => !endure(base, seed, 'desert').finished)
    expect(broken.length).toBeGreaterThan(SEEDS.length * 0.8)
    const cooled = build((s) => { s.powerpack.cooling = 'heavyDuty' })
    expect(endure(cooled, 1, 'desert').loads.engine.load).toBeLessThanOrEqual(1)
  })
})

describe('the endurance mark', () => {
  it('fails a run that does not finish, and one with too many stops', () => {
    const heavy = build(smallGearbox)
    const seed = SEEDS.find((s) => !endure(heavy, s).finished)!
    expect(runProvingGround(heavy, { seed }).endurance.passed).toBe(false)

    const base = build()
    const oneStop = SEEDS.find((s) => endure(base, s).stops === 1)!
    expect(runProvingGround(base, { seed: oneStop }).endurance.passed).toBe(true)
    expect(runProvingGround(base, { seed: oneStop, marks: { ...MARKS_GEN1, enduranceStops: 0 } }).endurance.passed).toBe(false)
  })

  it('runs in the climate it is given', () => {
    expect(runProvingGround(build(), { seed: 1 }).endurance.climate).toBe('temperate')
    expect(runProvingGround(build(), { seed: 1, climate: 'desert' }).endurance.climate).toBe('desert')
  })
})
