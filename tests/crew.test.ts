import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { CREW, STATION_IDS, WORK_SOURCES } from '../src/data/crew'
import { GUNNERY } from '../src/data/gunnery'
import { COMFORT, RANGEFINDERS } from '../src/data/parts'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1, TUNING } from '../src/data/tuning'
import { RANGE_DAY, firstShotS, jamS, relayS } from '../src/sim/gunnery/fire'
import { buildStatSheet, busiestOf, stationsOf, workloadAt, type StatSheet, type VehicleSpec } from '../src/sim/vehicle'

function spec(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const out = structuredClone(BASELINE_SPEC)
  change?.(out)
  return out
}

function build(change?: (spec: VehicleSpec) => void): StatSheet {
  return buildStatSheet(spec(change), PACT_LIMITS_GEN1)
}

const at = (sheet: StatSheet, id: (typeof STATION_IDS)[number]): number => workloadAt(sheet.crew, id)

describe('crew stations', () => {
  it('seats three with an autoloader and four with a loader, commander first', () => {
    expect(build().crew.map((station) => station.id)).toEqual(['commander', 'gunner', 'driver'])
    expect(build((s) => { s.loading = 'loader' }).crew.map((station) => station.id)).toEqual([...STATION_IDS])
    expect(build().crew).toHaveLength(build().crewCount)
  })

  it('adds up each station from the base and its shares', () => {
    for (const sheet of [build(), build((s) => { s.loading = 'loader'; s.crew.comfort = 'improved' })]) {
      for (const station of sheet.crew) {
        const sum = station.shares.reduce<number>((total, share) => total + share.points, CREW.stationBase)
        expect(station.workload).toBe(sum)
        expect(station.shares.every((share) => share.points !== 0)).toBe(true)
      }
    }
  })

  it('keeps every station between the limits, whatever is fitted', () => {
    const worst = build((s) => {
      s.fireControl = { sight: 'daySight', rangefinder: 'stadiametric', stabiliser: 'none', computer: 'none', night: 'activeInfrared', commanderSight: false }
    })
    const best = build((s) => {
      s.loading = 'loader'
      s.crew.comfort = 'improved'
      s.fireControl = { sight: 'improvedDaySight', rangefinder: 'laser', stabiliser: 'twoPlane', computer: 'electronic', night: 'none', commanderSight: true }
    })
    for (const station of [...worst.crew, ...best.crew]) {
      expect(station.workload).toBeGreaterThanOrEqual(TUNING.crew.workloadMin)
      expect(station.workload).toBeLessThanOrEqual(TUNING.crew.workloadMax)
    }
    expect(at(worst, 'gunner')).toBeGreaterThan(at(best, 'gunner') + 30)
  })

  it('gives the commander the loader\'s other jobs when there is no loader', () => {
    const three = build()
    const four = build((s) => { s.loading = 'loader' })
    expect(at(three, 'commander') - at(four, 'commander')).toBe(CREW.noLoader)
    expect(at(three, 'gunner')).toBe(at(four, 'gunner'))
    expect(three.crew[0]!.shares.map((share) => share.source)).toContain('noLoader')
    expect(four.crew[0]!.shares.map((share) => share.source)).not.toContain('noLoader')
  })

  it('hands the rangefinder to whoever works it', () => {
    const optical = build()
    const stadia = build((s) => { s.fireControl.rangefinder = 'stadiametric' })
    const laser = build((s) => { s.fireControl.rangefinder = 'laser' })
    expect(optical.crew.find((station) => station.ranges)!.id).toBe('commander')
    expect(stadia.crew.find((station) => station.ranges)!.id).toBe('gunner')
    expect(laser.crew.find((station) => station.ranges)!.id).toBe('gunner')
    // The optical rangefinder is the commander's work; the lines in the sight are the gunner's.
    expect(at(optical, 'commander') - at(stadia, 'commander')).toBe(RANGEFINDERS.coincidence.workload)
    expect(at(stadia, 'gunner') - at(optical, 'gunner')).toBe(RANGEFINDERS.stadiametric.workload)
    expect(at(laser, 'gunner')).toBeLessThan(at(optical, 'gunner'))
  })

  it('eases the commander with a sight of his own, and the driver with a gearbox that shifts itself', () => {
    const base = build()
    expect(at(build((s) => { s.fireControl.commanderSight = true }), 'commander')).toBeLessThan(at(base, 'commander'))
    expect(at(build((s) => { s.powerpack.transmission = 'hydro50' }), 'driver')).toBeLessThan(at(base, 'driver'))
    expect(at(build((s) => { s.fireControl.stabiliser = 'none' }), 'gunner')).toBeGreaterThan(at(base, 'gunner'))
    expect(at(build((s) => { s.fireControl.stabiliser = 'none' }), 'commander')).toBe(at(base, 'commander'))
  })

  it('loads the loader by the weight of the round', () => {
    const light = build((s) => { s.loading = 'loader'; s.gun = 'rifled100' })
    const heavy = build((s) => { s.loading = 'loader'; s.gun = 'rifled120' })
    expect(at(heavy, 'loader')).toBeGreaterThan(at(light, 'loader'))
    expect(Number.isInteger(at(heavy, 'loader'))).toBe(true)
  })

  it('moves every station with the crew fittings', () => {
    const basic = build()
    const improved = build((s) => { s.crew.comfort = 'improved' })
    for (const station of basic.crew) {
      expect(station.workload - at(improved, station.id)).toBe(COMFORT.basic.workload - COMFORT.improved.workload)
    }
  })

  it('quotes the busiest station as the tank\'s workload', () => {
    const sheet = build()
    expect(busiestOf(sheet.crew).id).toBe('commander')
    expect(sheet.crewWorkload).toBe(Math.max(...sheet.crew.map((station) => station.workload)))
    expect(stationsOf(spec())).toEqual(sheet.crew)
  })
})

describe('a busy crewman is slow at his own jobs', () => {
  const pace = (workload: number): number => 1 + (workload - GUNNERY.pace.referenceWorkload) * GUNNERY.pace.perPoint

  it('sets each pace from the station that does the job', () => {
    const sheet = build()
    expect(sheet.fire.pace.commander).toBeCloseTo(pace(at(sheet, 'commander')), 12)
    expect(sheet.fire.pace.gunner).toBeCloseTo(pace(at(sheet, 'gunner')), 12)
    expect(sheet.fire.pace.ranging).toBe(sheet.fire.pace.commander)
    const stadia = build((s) => { s.fireControl.rangefinder = 'stadiametric' })
    expect(stadia.fire.pace.ranging).toBe(stadia.fire.pace.gunner)
  })

  it('adds up the first shot from each crewman\'s part in it', () => {
    const { fire } = build()
    const t = fire.times
    expect(firstShotS(fire, RANGE_DAY)).toBeCloseTo(
      t.findS * fire.pace.commander + t.rangeS * fire.pace.ranging + t.layS * fire.pace.gunner, 9,
    )
  })

  it('finds targets quicker with a loader aboard, and lays the gun no quicker', () => {
    const three = build()
    const four = build((s) => { s.loading = 'loader' })
    expect(firstShotS(four.fire, RANGE_DAY)).toBeLessThan(firstShotS(three.fire, RANGE_DAY))
    expect(relayS(four.fire, RANGE_DAY)).toBe(relayS(three.fire, RANGE_DAY))
  })

  it('lays the gun slower when the gunner has more to do, and finds targets no slower', () => {
    const base = build()
    const busy = build((s) => { s.fireControl.computer = 'none' })
    expect(relayS(busy.fire, RANGE_DAY)).toBeGreaterThan(relayS(base.fire, RANGE_DAY))
    expect(busy.fire.pace.commander).toBe(base.fire.pace.commander)
  })

  it('clears a jam at the commander\'s pace', () => {
    const base = build()
    const eased = build((s) => { s.fireControl.commanderSight = true })
    expect(jamS(eased.fire, RANGE_DAY)).toBeLessThan(jamS(base.fire, RANGE_DAY))
  })
})

describe('crew station text', () => {
  it('names every station and every source of work', () => {
    for (const id of STATION_IDS) expect(STRINGS.dataSheet.stations.names[id]).toBeTruthy()
    for (const source of WORK_SOURCES) expect(STRINGS.dataSheet.stations.sources[source]).toBeTruthy()
  })
})
