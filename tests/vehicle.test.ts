import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { ZONES } from '../src/data/materials'
import {
  COMPUTERS, COOLING, ENGINES, GUNS, HULLS, LOADING, NIGHT_SIGHTS, RANGEFINDERS, SIGHTS, STABILISERS, STOWAGE,
  SUSPENSIONS, TRANSMISSIONS, TURRETS,
} from '../src/data/parts'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1, TUNING } from '../src/data/tuning'
import {
  AREAS, ISSUE_CODES, buildStatSheet, stressFactor, type IssueCode, type Limits, type StatSheet, type VehicleSpec,
} from '../src/sim/vehicle'

/** The baseline with one change made to it. */
function build(change?: (spec: VehicleSpec) => void, limits: Limits = PACT_LIMITS_GEN1): StatSheet {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return buildStatSheet(spec, limits)
}

function codes(sheet: StatSheet): IssueCode[] {
  return sheet.issues.map((issue) => issue.code)
}

function keys<T extends object>(table: T): (keyof T)[] {
  return Object.keys(table) as (keyof T)[]
}

/** Every number anywhere in a stat sheet. */
function numbersIn(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') out.push(value)
  else if (value && typeof value === 'object') for (const inner of Object.values(value)) numbersIn(inner, out)
  return out
}

describe('the Radan baseline', () => {
  const sheet = build()

  it('is a legal design with nothing wrong', () => {
    expect(sheet.issues).toEqual([])
  })

  it('sits a little under the Pact weight limit', () => {
    expect(sheet.massT).toBeGreaterThan(40)
    expect(sheet.massT).toBeLessThan(PACT_LIMITS_GEN1.maxMassT)
    expect(sheet.growth.massT).toBeGreaterThan(0)
    expect(sheet.growth.massT).toBeLessThan(3)
  })

  it('has believable headline numbers', () => {
    expect(sheet.crewCount).toBe(3)
    expect(sheet.firepower.calibreMm).toBe(125)
    expect(sheet.firepower.rateOfFireRpm).toBe(7)
    expect(sheet.mobility.topSpeedKmh).toBeGreaterThan(50)
    expect(sheet.mobility.topSpeedKmh).toBeLessThan(65)
    expect(sheet.mobility.rangeKm).toBeGreaterThan(300)
    expect(sheet.mobility.rangeKm).toBeLessThan(500)
    expect(sheet.mobility.groundPressureKgCm2).toBeGreaterThan(0.7)
    expect(sheet.mobility.groundPressureKgCm2).toBeLessThan(1)
    expect(sheet.geometry.widthM).toBeLessThanOrEqual(PACT_LIMITS_GEN1.maxWidthM)
    expect(sheet.reliabilityIndex).toBeGreaterThan(55)
    expect(sheet.reliabilityIndex).toBeLessThan(90)
    expect(sheet.unitCostKr).toBeGreaterThan(1_500_000)
    expect(sheet.unitCostKr).toBeLessThan(3_000_000)
  })

  it('adds up', () => {
    const { rollup } = sheet
    let mass = 0
    let volume = 0
    let cost = 0
    for (const area of AREAS) {
      mass += rollup.massT[area]
      volume += rollup.volumeM3[area]
      cost += rollup.costKr[area]
    }
    expect(mass).toBeCloseTo(sheet.massT, 9)
    expect(volume).toBeCloseTo(rollup.usedM3, 9)
    expect(cost).toBeCloseTo(sheet.unitCostKr, 6)

    let armour = 0
    for (const zone of ZONES) armour += rollup.zoneMassT[zone]
    expect(armour).toBeCloseTo(rollup.massT.armour, 9)
    expect(rollup.readyRounds + rollup.stowedRounds).toBe(sheet.firepower.rounds)
  })

  it('gives the same sheet every time', () => {
    expect(build()).toEqual(sheet)
  })
})

describe('trade-offs', () => {
  const base = build()

  it('more armour costs weight, speed, range and money', () => {
    const thick = build((s) => s.armour.turretSides.push({ material: 'rolledSteel', mm: 40 }))
    expect(thick.massT).toBeGreaterThan(base.massT)
    expect(thick.rollup.zoneMassT.turretSides).toBeGreaterThan(base.rollup.zoneMassT.turretSides)
    expect(thick.rollup.zoneMassT.upperGlacis).toBe(base.rollup.zoneMassT.upperGlacis)
    expect(thick.mobility.topSpeedKmh).toBeLessThan(base.mobility.topSpeedKmh)
    expect(thick.mobility.powerToWeightHpT).toBeLessThan(base.mobility.powerToWeightHpT)
    expect(thick.mobility.rangeKm).toBeLessThan(base.mobility.rangeKm)
    expect(thick.mobility.groundPressureKgCm2).toBeGreaterThan(base.mobility.groundPressureKgCm2)
    expect(thick.unitCostKr).toBeGreaterThan(base.unitCostKr)
    expect(thick.growth.massT).toBeLessThan(base.growth.massT)
  })

  it('a steeper glacis is a longer, heavier plate that eats hull space', () => {
    const steep = build((s) => { s.hull.glacisAngleDeg = 72 })
    expect(steep.rollup.zoneMassT.upperGlacis).toBeGreaterThan(base.rollup.zoneMassT.upperGlacis)
    expect(steep.rollup.capacityM3).toBeLessThan(base.rollup.capacityM3)
  })

  it('composite is lighter than steel for the same thickness, and dearer', () => {
    const steel = build((s) => { s.armour.upperGlacis = [{ material: 'rolledSteel', mm: 180 }] })
    const mixed = build((s) => {
      s.armour.upperGlacis = [{ material: 'rolledSteel', mm: 80 }, { material: 'compositeInsert', mm: 100 }]
    })
    expect(mixed.rollup.zoneMassT.upperGlacis).toBeLessThan(steel.rollup.zoneMassT.upperGlacis)
    expect(mixed.rollup.costKr.armour).toBeGreaterThan(steel.rollup.costKr.armour)
  })

  it('an air gap weighs only its brackets, far less than plate', () => {
    const spaced = build((s) => s.armour.hullSideFront.push({ material: 'airGap', mm: 200 }))
    const plated = build((s) => s.armour.hullSideFront.push({ material: 'rolledSteel', mm: 200 }))
    expect(spaced.massT).toBeGreaterThan(base.massT)
    expect(spaced.massT - base.massT).toBeLessThan((plated.massT - base.massT) / 20)
  })

  it('more fuel goes further and weighs more', () => {
    const full = build((s) => { s.powerpack.fuelL = 1400 })
    expect(full.mobility.rangeKm).toBeGreaterThan(base.mobility.rangeKm)
    expect(full.massT).toBeGreaterThan(base.massT)
    expect(full.growth.volumeM3).toBeLessThan(base.growth.volumeM3)
  })

  it('wider tracks spread the weight but push the width', () => {
    const wide = build((s) => { s.runningGear.trackWidthMm = 660 })
    expect(wide.mobility.groundPressureKgCm2).toBeLessThan(base.mobility.groundPressureKgCm2)
    expect(wide.geometry.widthM).toBeGreaterThan(base.geometry.widthM)
    expect(wide.massT).toBeGreaterThan(base.massT)
  })

  it('a human loader means four crew, a taller turret and a rate of fire set by the gun', () => {
    const manual = build((s) => { s.loading = 'loader' })
    expect(manual.crewCount).toBe(4)
    expect(manual.firepower.rateOfFireRpm).toBe(GUNS[BASELINE_SPEC.gun].loaderRof)
    expect(manual.geometry.heightM).toBeGreaterThan(base.geometry.heightM)
    expect(manual.firepower.gunDepressionDeg).toBeGreaterThan(base.firepower.gunDepressionDeg)
    expect(manual.crewWorkload).toBeLessThan(base.crewWorkload)
  })

  it('better fire control eases the crew and costs money', () => {
    const fitted = build((s) => {
      s.fireControl.rangefinder = 'laser'
      s.fireControl.computer = 'electronic'
    })
    expect(fitted.crewWorkload).toBeLessThan(base.crewWorkload)
    expect(fitted.unitCostKr).toBeGreaterThan(base.unitCostKr)
  })

  it('a stronger engine is faster until the gearing holds it', () => {
    const strong = build((s) => {
      s.powerpack.engine = 'turbine1000'
      s.powerpack.cooling = 'heavyDuty'
    })
    expect(strong.mobility.powerToWeightHpT).toBeGreaterThan(base.mobility.powerToWeightHpT)
    expect(strong.mobility.topSpeedKmh).toBeGreaterThanOrEqual(base.mobility.topSpeedKmh)
    expect(strong.mobility.topSpeedKmh).toBeLessThanOrEqual(TRANSMISSIONS[BASELINE_SPEC.powerpack.transmission].gearedKmh)
    expect(strong.mobility.rangeKm).toBeLessThan(base.mobility.rangeKm)
  })
})

describe('constraint checks', () => {
  it('names the part to fix for each issue', () => {
    const sheet = build((s) => { s.turret.ringMm = 1900 })
    const issue = sheet.issues.find((i) => i.code === 'ringTooSmallForGun')
    expect(issue).toMatchObject({ severity: 'error', part: 'turret.ringMm', value: 1900, limit: GUNS.smooth125.minRingMm })
  })

  it('catches a turret ring that will not fit', () => {
    expect(codes(build((s) => { s.turret.ringMm = 1900 }))).toContain('ringTooSmallForLoader')
    expect(codes(build((s) => { s.turret.ringMm = 2300 }))).toContain('ringTooBigForHull')
    expect(codes(build((s) => { s.turret.ringMm = 2110 }))).toContain('ringOffStep')
  })

  it('catches loading and stowage that need a bustle', () => {
    expect(codes(build((s) => { s.loading = 'bustleLoader' }))).toContain('loaderNeedsBustle')
    expect(codes(build((s) => { s.ammo.stowage = 'blowOutPanels' }))).toContain('stowageNeedsBustle')
    const bustle = build((s) => {
      s.turret.shape = 'bustle'
      s.loading = 'bustleLoader'
      s.ammo.stowage = 'blowOutPanels'
    })
    expect(codes(bustle)).not.toContain('loaderNeedsBustle')
    expect(codes(bustle)).not.toContain('stowageNeedsBustle')
  })

  it('catches a gun outside the Pact calibres', () => {
    expect(codes(build((s) => { s.gun = 'rifled120' }))).toContain('calibreNotStandard')
  })

  it('catches an overweight tank and warns about what will break', () => {
    const heavy = build((s) => s.armour.hullSideFront.push({ material: 'rolledSteel', mm: 120 }))
    expect(codes(heavy)).toEqual(expect.arrayContaining(['overMassLimit', 'transmissionOverloaded', 'suspensionOverloaded']))
    expect(heavy.issues.find((i) => i.code === 'overMassLimit')?.severity).toBe('error')
    expect(heavy.issues.find((i) => i.code === 'transmissionOverloaded')?.severity).toBe('warning')
    expect(heavy.reliabilityIndex).toBeLessThan(build().reliabilityIndex)
    expect(heavy.growth.massT).toBeLessThan(0)
  })

  it('warns when the cooling cannot keep up with the engine', () => {
    const hot = build((s) => { s.powerpack.engine = 'turbine1000' })
    expect(codes(hot)).toContain('coolingOverloaded')
    expect(hot.stress.cooling).toBeGreaterThan(1)
    expect(hot.growth.coolingHp).toBeLessThan(0)
  })

  it('catches a tank too wide for the rail wagons', () => {
    const wide = build((s) => { s.runningGear.trackWidthMm = 700 })
    expect(wide.geometry.widthM).toBeGreaterThan(PACT_LIMITS_GEN1.maxWidthM)
    expect(codes(wide)).toContain('overWidthLimit')
  })

  it('catches a hull with no room left', () => {
    const crammed = build((s) => {
      s.hull.size = 'light'
      s.turret.ringMm = 1950
      s.gun = 'rifled100'
      s.loading = 'loader'
      s.ammo.rounds = 60
      s.powerpack.fuelL = 1800
      s.crew.comfort = 'improved'
    })
    expect(codes(crammed)).toContain('outOfSpace')
    expect(crammed.growth.volumeM3).toBeLessThan(0)
  })

  it('catches a unit cost over the tender limit, only when there is one', () => {
    expect(codes(build())).not.toContain('overCostLimit')
    const capped = build(undefined, { ...PACT_LIMITS_GEN1, maxUnitCostKr: 1_000_000 })
    expect(codes(capped)).toContain('overCostLimit')
  })

  it('catches settings outside the allowed ranges', () => {
    expect(codes(build((s) => { s.hull.glacisAngleDeg = 80 }))).toContain('glacisAngleOutOfRange')
    expect(codes(build((s) => { s.runningGear.trackWidthMm = 400 }))).toContain('trackWidthOutOfRange')
    expect(codes(build((s) => { s.powerpack.fuelL = 100 }))).toContain('fuelOutOfRange')
    expect(codes(build((s) => { s.ammo.rounds = 80 }))).toContain('roundsOutOfRange')
    expect(codes(build((s) => { s.ammo.rounds = 30.5 }))).toContain('roundsOutOfRange')
    expect(codes(build((s) => { s.runningGear.roadWheels = 7 }))).toContain('wheelsOutOfRange')
    expect(codes(build((s) => { s.hull.glacisAngleDeg = Number.NaN }))).toContain('glacisAngleOutOfRange')
  })

  it('catches bad armour stacks', () => {
    const stacked = build((s) => {
      s.armour.belly = Array.from({ length: TUNING.limits.maxLayersPerZone + 1 }, () => ({ material: 'rolledSteel' as const, mm: 5 }))
    })
    expect(stacked.issues.find((i) => i.code === 'tooManyLayers')?.part).toBe('armour.belly')
    expect(codes(build((s) => { s.armour.mantlet = [{ material: 'castSteel', mm: 0 }] }))).toContain('layerThicknessOutOfRange')
    expect(codes(build((s) => { s.armour.mantlet = [{ material: 'castSteel', mm: 900 }] }))).toContain('layerThicknessOutOfRange')
  })

  it('has player text for every issue code', () => {
    const text: Record<string, string> = STRINGS.issues
    for (const code of ISSUE_CODES) expect(text[code], code).toBeTruthy()
    expect(Object.keys(text).sort()).toEqual([...ISSUE_CODES].sort())
  })
})

describe('reliability under stress', () => {
  it('is untouched up to the rated load, then falls to a floor', () => {
    expect(stressFactor(0.5)).toBe(1)
    expect(stressFactor(1)).toBe(1)
    expect(stressFactor(1.1)).toBeLessThan(1)
    expect(stressFactor(1.2)).toBeLessThan(stressFactor(1.1))
    expect(stressFactor(5)).toBe(TUNING.reliability.floor)
  })
})

describe('the parts tables', () => {
  it('give a finite stat sheet for every part swapped into the baseline', () => {
    const swaps: ((s: VehicleSpec) => void)[] = [
      ...keys(HULLS).map((id) => (s: VehicleSpec) => { s.hull.size = id }),
      ...keys(TURRETS).map((id) => (s: VehicleSpec) => { s.turret.shape = id }),
      ...keys(GUNS).map((id) => (s: VehicleSpec) => { s.gun = id }),
      ...keys(LOADING).map((id) => (s: VehicleSpec) => { s.loading = id }),
      ...keys(STOWAGE).map((id) => (s: VehicleSpec) => { s.ammo.stowage = id }),
      ...keys(SIGHTS).map((id) => (s: VehicleSpec) => { s.fireControl.sight = id }),
      ...keys(RANGEFINDERS).map((id) => (s: VehicleSpec) => { s.fireControl.rangefinder = id }),
      ...keys(STABILISERS).map((id) => (s: VehicleSpec) => { s.fireControl.stabiliser = id }),
      ...keys(COMPUTERS).map((id) => (s: VehicleSpec) => { s.fireControl.computer = id }),
      ...keys(NIGHT_SIGHTS).map((id) => (s: VehicleSpec) => { s.fireControl.night = id }),
      ...keys(ENGINES).map((id) => (s: VehicleSpec) => { s.powerpack.engine = id }),
      ...keys(TRANSMISSIONS).map((id) => (s: VehicleSpec) => { s.powerpack.transmission = id }),
      ...keys(COOLING).map((id) => (s: VehicleSpec) => { s.powerpack.cooling = id }),
      ...keys(SUSPENSIONS).map((id) => (s: VehicleSpec) => { s.runningGear.suspension = id }),
      (s) => { s.fireControl.commanderSight = true },
      (s) => { s.powerpack.apu = true },
      (s) => { s.protection.spallLiner = true },
      (s) => { s.hull.engineAt = 'front' },
      (s) => { s.crew.comfort = 'improved' },
    ]
    expect(swaps.length).toBeGreaterThan(40)
    for (const swap of swaps) {
      const sheet = build(swap)
      for (const n of numbersIn(sheet)) expect(Number.isFinite(n)).toBe(true)
      expect(sheet.massT).toBeGreaterThan(25)
      expect(sheet.massT).toBeLessThan(60)
      expect(sheet.reliabilityIndex).toBeGreaterThan(0)
      expect(sheet.reliabilityIndex).toBeLessThanOrEqual(100)
      expect(sheet.crewWorkload).toBeGreaterThanOrEqual(TUNING.crew.workloadMin)
      expect(sheet.crewWorkload).toBeLessThanOrEqual(TUNING.crew.workloadMax)
    }
  })

  it('keep every reliability figure between 0 and 1', () => {
    const tables = [HULLS, TURRETS, GUNS, LOADING, STOWAGE, SIGHTS, RANGEFINDERS, STABILISERS, COMPUTERS, NIGHT_SIGHTS,
      ENGINES, TRANSMISSIONS, COOLING, SUSPENSIONS]
    for (const table of tables) {
      for (const part of Object.values(table)) {
        expect(part.reliability).toBeGreaterThan(0)
        expect(part.reliability).toBeLessThanOrEqual(1)
        expect(part.massT).toBeGreaterThanOrEqual(0)
        expect(part.costKr).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
