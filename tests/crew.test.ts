import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { COMFORT_SOURCES, CREW, STATION_IDS, WORK_SOURCES } from '../src/data/crew'
import { GUNNERY } from '../src/data/gunnery'
import { COMFORT, RANGEFINDERS } from '../src/data/parts'
import { MARKS_GEN1, RANGE } from '../src/data/range'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1, TUNING } from '../src/data/tuning'
import { RANGE_DAY, fatigueOf, firstShotS, jamS, loadS, relayS, type Shoot } from '../src/sim/gunnery/fire'
import { runLoadingDrill, runProvingGround } from '../src/sim/trials'
import {
  buildStatSheet, busiestOf, comfortOf, fatigueAfter, slowOf, stationsOf, tiringPerHour, workloadAt,
  type StatSheet, type VehicleSpec,
} from '../src/sim/vehicle'

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
      s.fireControl = { sight: 'daySight', rangefinder: 'stadiametric', stabiliser: 'none', computer: 'none', night: 'activeInfrared', commanderSight: false, searchRadar: false }
    })
    const best = build((s) => {
      s.loading = 'loader'
      s.crew.comfort = 'improved'
      s.fireControl = { sight: 'improvedDaySight', rangefinder: 'laser', stabiliser: 'twoPlane', computer: 'electronic', night: 'none', commanderSight: true, searchRadar: false }
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

describe('comfort', () => {
  it('starts from the fittings: the basic turret is cramped and cold', () => {
    expect(build().comfort.score).toBe(CREW.comfort.base + CREW.comfort.fittings.basic)
    expect(build().comfort.shares).toEqual([{ source: 'fittings', points: CREW.comfort.fittings.basic }])
    expect(build((s) => { s.crew.comfort = 'standard' }).comfort).toEqual({ score: CREW.comfort.base, shares: [] })
    expect(build((s) => { s.crew.comfort = 'improved' }).comfort.score).toBeGreaterThan(build().comfort.score + 20)
  })

  it('is better on a smooth ride and worse with the engine up front', () => {
    const base = build().comfort.score
    expect(build((s) => { s.runningGear.suspension = 'hydropneumatic' }).comfort.score).toBe(base + CREW.comfort.ride.hydropneumatic)
    expect(build((s) => { s.hull.engineAt = 'front' }).comfort.score).toBe(base + CREW.comfort.engineAtFront)
  })

  it('lists what adds and what takes away, biggest first, and stays within 0 to 100', () => {
    const comfort = comfortOf(spec((s) => { s.runningGear.suspension = 'hydropneumatic'; s.hull.engineAt = 'front' }))
    expect(comfort.shares.map((share) => share.source)).toEqual(['fittings', 'ride', 'engine'])
    expect(comfort.score).toBeGreaterThanOrEqual(CREW.comfort.min)
    expect(comfort.score).toBeLessThanOrEqual(CREW.comfort.max)
  })
})

describe('fatigue', () => {
  const F = CREW.fatigue
  const TIRED: Shoot = { ...RANGE_DAY, hours: RANGE.crewHours }

  it('tires a crewman at the reference rate at an easy station in a middling tank', () => {
    expect(tiringPerHour(F.referenceWorkload, F.referenceComfort)).toBeCloseTo(F.perHour, 12)
  })

  it('tires him sooner at a busy station and in an uncomfortable tank', () => {
    expect(tiringPerHour(70, 50)).toBeGreaterThan(tiringPerHour(50, 50))
    expect(tiringPerHour(50, 35)).toBeGreaterThan(tiringPerHour(50, 50))
    expect(tiringPerHour(50, 65)).toBeLessThan(tiringPerHour(50, 50))
    expect(tiringPerHour(10, 100)).toBeCloseTo(F.perHour * F.leastShare, 12)
  })

  it('builds with the hours and stops at worn out', () => {
    expect(fatigueAfter(0, 0.05)).toBe(0)
    expect(fatigueAfter(4, 0.05)).toBeCloseTo(0.2, 12)
    expect(fatigueAfter(8, 0.05)).toBeCloseTo(0.4, 12)
    expect(fatigueAfter(100, 0.05)).toBe(1)
    expect(slowOf(0)).toBe(1)
    expect(slowOf(1)).toBeCloseTo(1 + F.slowAtFull, 12)
  })

  it('gives every station its own rate, from its workload and the tank\'s comfort', () => {
    const sheet = build()
    for (const station of sheet.crew) {
      expect(station.tiringPerHour).toBeCloseTo(tiringPerHour(station.workload, sheet.comfort.score), 12)
    }
    // The commander has the most to do, so the commander tires soonest.
    const rates = sheet.crew.map((station) => station.tiringPerHour)
    expect(Math.max(...rates)).toBe(sheet.crew.find((station) => station.id === 'commander')!.tiringPerHour)
  })

  it('quotes a fresh crew, and leaves a fresh crew as fast as before', () => {
    const { fire, gunnery } = build()
    expect(RANGE_DAY.hours).toBe(0)
    expect(fatigueOf(fire, 'commander', RANGE_DAY)).toBe(0)
    expect(gunnery.firstShotS).toBe(firstShotS(fire, RANGE_DAY))
    expect(gunnery.tiredHours).toBe(RANGE.crewHours)
    expect(gunnery.firstShotTiredS).toBe(firstShotS(fire, TIRED))
  })

  it('slows each job by how worn the crewman doing it is', () => {
    const { fire } = build()
    const t = fire.times
    const slow = (role: 'commander' | 'gunner' | 'ranging'): number => fire.pace[role] * slowOf(fatigueOf(fire, role, TIRED))
    expect(firstShotS(fire, TIRED)).toBeCloseTo(t.findS * slow('commander') + t.rangeS * slow('ranging') + t.layS * slow('gunner'), 9)
    expect(firstShotS(fire, TIRED)).toBeGreaterThan(firstShotS(fire, RANGE_DAY) * 1.08)
    expect(relayS(fire, TIRED)).toBeGreaterThan(relayS(fire, RANGE_DAY))
    expect(jamS(fire, TIRED)).toBeGreaterThan(jamS(fire, RANGE_DAY))
  })

  it('does not tire a machine, and does tire a loader', () => {
    const machine = build()
    const human = build((s) => { s.loading = 'loader' })
    expect(machine.fire.tire.loader).toBe(0)
    expect(loadS(machine.fire, 0, TIRED)).toBe(loadS(machine.fire, 0, RANGE_DAY))
    expect(human.fire.tire.loader).toBeGreaterThan(0)
    expect(loadS(human.fire, 0, TIRED)).toBeCloseTo(loadS(human.fire, 0, RANGE_DAY) * slowOf(fatigueOf(human.fire, 'loader', TIRED)), 9)
    expect(human.gunnery.sustainedTiredRpm).toBeLessThan(human.gunnery.sustainedRpm * 0.95)
    expect(machine.gunnery.sustainedTiredRpm).toBeGreaterThan(machine.gunnery.sustainedRpm * 0.98)
  })

  it('keeps the crew fresher in a comfortable tank', () => {
    const basic = build()
    const improved = build((s) => { s.crew.comfort = 'improved' })
    const gap = (sheet: StatSheet): number => sheet.gunnery.firstShotTiredS / sheet.gunnery.firstShotS
    expect(gap(improved)).toBeLessThan(gap(basic) - 0.04)
    expect(fatigueOf(improved.fire, 'commander', TIRED)).toBeLessThan(fatigueOf(basic.fire, 'commander', TIRED) * 0.7)
  })
})

describe('the range at the end of the day', () => {
  it('shoots with a crew that has been in the tank all day', () => {
    const sheet = build()
    const report = runProvingGround(sheet, { seed: 1 })
    expect(report.crewHours).toBe(RANGE.crewHours)
    expect(report.gunnery.halted.firstShotS).toBeCloseTo(sheet.gunnery.firstShotTiredS, 9)
    expect(report.gunnery.halted.firstShotS!).toBeGreaterThan(sheet.gunnery.firstShotS)
  })

  it('lets comfort rescue a slow fire control from the time mark', () => {
    const stadia = build((s) => { s.fireControl.rangefinder = 'stadiametric' })
    const eased = build((s) => { s.fireControl.rangefinder = 'stadiametric'; s.crew.comfort = 'improved' })
    expect(stadia.gunnery.firstShotTiredS).toBeGreaterThan(MARKS_GEN1.firstShotS)
    expect(eased.gunnery.firstShotTiredS).toBeLessThan(MARKS_GEN1.firstShotS)
    expect(runProvingGround(stadia, { seed: 1 }).gunnery.halted.timePassed).toBe(false)
    expect(runProvingGround(eased, { seed: 1 }).gunnery.halted.timePassed).toBe(true)
  })

  it('runs the loading drill with a loader who is already tired', () => {
    const human = build((s) => { s.loading = 'loader' })
    const drill = runLoadingDrill(human.fire, 1)
    expect(drill.rpm).toBeCloseTo(human.gunnery.sustainedTiredRpm, 9)
    expect(drill.rpm).toBeLessThan(human.gunnery.sustainedRpm)
    // Standard fittings are enough to bring a loader with 125 mm rounds up to the mark.
    expect(drill.rpm).toBeLessThan(MARKS_GEN1.drillRpm)
    expect(runLoadingDrill(build((s) => { s.loading = 'loader'; s.crew.comfort = 'standard' }).fire, 1).rpm).toBeGreaterThan(MARKS_GEN1.drillRpm)
  })
})

describe('crew station text', () => {
  it('names every station, every source of work and every source of comfort', () => {
    for (const id of STATION_IDS) expect(STRINGS.dataSheet.stations.names[id]).toBeTruthy()
    for (const source of WORK_SOURCES) expect(STRINGS.dataSheet.stations.sources[source]).toBeTruthy()
    for (const source of COMFORT_SOURCES) expect(STRINGS.dataSheet.stations.comfortSources[source]).toBeTruthy()
  })
})
