import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { GUNNERY } from '../src/data/gunnery'
import { GUNS, LOADING, type GunId } from '../src/data/parts'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import {
  RANGE_DAY, cycleS, firstShotS, flightOf, hitChance, missOf, seenShare, sustainedRpm, type Fire, type FireRound, type Shoot,
} from '../src/sim/gunnery/fire'
import { buildStatSheet, type StatSheet, type VehicleSpec } from '../src/sim/vehicle'

function build(change?: (spec: VehicleSpec) => void): StatSheet {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return buildStatSheet(spec, PACT_LIMITS_GEN1)
}

function round(fire: Fire, kind: FireRound['kind']): FireRound {
  const found = fire.rounds.find((each) => each.kind === kind)
  if (!found) throw new Error(`no ${kind} round`)
  return found
}

/** First-round hit chance with the dart, halted, by day. */
function dart(sheet: StatSheet, rangeM: number, shoot: Shoot = RANGE_DAY): number {
  return hitChance(sheet.fire, round(sheet.fire, 'kinetic'), rangeM, shoot)
}

const MOVING: Shoot = { ...RANGE_DAY, moving: true }
const NIGHT: Shoot = { ...RANGE_DAY, night: true }
const GUN_IDS = Object.keys(GUNS) as GunId[]

describe('a round in flight', () => {
  const fire = build().fire

  it('takes longer and arrives slower the further it goes', () => {
    for (const each of fire.rounds) {
      let before = flightOf(each, 0)
      expect(before.timeS).toBe(0)
      expect(before.speedMs).toBe(each.speedMs)
      for (const rangeM of GUNNERY.rangesM) {
        const now = flightOf(each, rangeM)
        expect(now.timeS).toBeGreaterThan(before.timeS)
        expect(now.speedMs).toBeLessThan(before.speedMs)
        before = now
      }
    }
  })

  it('slows a shaped charge far more than a dart', () => {
    const kinetic = round(fire, 'kinetic')
    const shaped = round(fire, 'shaped')
    expect(flightOf(shaped, 2000).speedMs / shaped.speedMs).toBeLessThan(flightOf(kinetic, 2000).speedMs / kinetic.speedMs - 0.1)
  })
})

describe('hit chance', () => {
  it('is a chance, and falls with range, for every gun and round', () => {
    for (const gun of GUN_IDS) {
      const { fire } = build((s) => { s.gun = gun })
      expect(fire.rounds.length).toBeGreaterThan(0)
      for (const each of fire.rounds) {
        let before = 1
        for (const rangeM of GUNNERY.rangesM) {
          const chance = hitChance(fire, each, rangeM, RANGE_DAY)
          expect(chance).toBeGreaterThan(0)
          expect(chance).toBeLessThanOrEqual(before)
          before = chance
        }
      }
    }
  })

  it('is near certain up close and poor far out', () => {
    const base = build()
    expect(dart(base, 300)).toBeGreaterThan(0.99)
    expect(dart(base, 1000)).toBeGreaterThan(0.85)
    expect(dart(base, 2500)).toBeLessThan(0.45)
  })

  it('rewards each step up in rangefinder, most of all for a slow round', () => {
    const stadia = build((s) => { s.fireControl.rangefinder = 'stadiametric' })
    const optical = build((s) => { s.fireControl.rangefinder = 'coincidence' })
    const laser = build((s) => { s.fireControl.rangefinder = 'laser' })
    expect(dart(optical, 1500)).toBeGreaterThan(dart(stadia, 1500) + 0.1)
    expect(dart(laser, 1500)).toBeGreaterThan(dart(optical, 1500))
    const shaped = (sheet: StatSheet): number => hitChance(sheet.fire, round(sheet.fire, 'shaped'), 1500, RANGE_DAY)
    expect(shaped(laser) - shaped(stadia)).toBeGreaterThan(dart(laser, 1500) - dart(stadia, 1500))
  })

  it('puts a misread range over or under the target, not beside it', () => {
    const stadia = build((s) => { s.fireControl.rangefinder = 'stadiametric' }).fire
    const laser = build((s) => { s.fireControl.rangefinder = 'laser' }).fire
    const a = missOf(stadia, round(stadia, 'kinetic'), 2000, RANGE_DAY)
    const b = missOf(laser, round(laser, 'kinetic'), 2000, RANGE_DAY)
    expect(a.acrossM).toBeCloseTo(b.acrossM, 9)
    expect(a.upM).toBeGreaterThan(b.upM * 1.5)
  })

  it('rewards a better sight and a better computer', () => {
    const base = build()
    expect(dart(build((s) => { s.fireControl.sight = 'improvedDaySight' }), 2000)).toBeGreaterThan(dart(base, 2000) + 0.03)
    expect(dart(build((s) => { s.fireControl.computer = 'electronic' }), 2000)).toBeGreaterThan(dart(base, 2000))
    expect(dart(build((s) => { s.fireControl.computer = 'none' }), 2000)).toBeLessThan(dart(base, 2000))
  })

  it('is lower for conscripts than for the range crew', () => {
    const base = build()
    expect(dart(base, 1500, { ...RANGE_DAY, crew: 'conscript' })).toBeLessThan(dart(base, 1500) - 0.05)
  })
})

describe('rifled against smoothbore', () => {
  const laser = (gun: GunId) => build((s) => {
    s.gun = gun
    s.fireControl.rangefinder = 'laser'
  })
  const stadia = (gun: GunId) => build((s) => {
    s.gun = gun
    s.fireControl.rangefinder = 'stadiametric'
  })

  it('makes the rifled gun the more accurate one when the range is known', () => {
    for (const rangeM of [1500, 2000, 2500]) {
      expect(dart(laser('rifled100'), rangeM)).toBeGreaterThan(dart(laser('smooth125'), rangeM) + 0.05)
      expect(dart(laser('rifled120'), rangeM)).toBeGreaterThan(dart(laser('smooth125'), rangeM) + 0.08)
    }
    const shaped = (sheet: StatSheet): number => hitChance(sheet.fire, round(sheet.fire, 'shaped'), 1500, RANGE_DAY)
    expect(shaped(laser('rifled120'))).toBeGreaterThan(shaped(laser('smooth125')) + 0.15)
  })

  it('makes the smoothbore the better gun when the range is a guess', () => {
    // A faster round falls less, so a range read wrong costs it less.
    for (const rangeM of [1500, 2000]) {
      expect(dart(stadia('smooth125'), rangeM)).toBeGreaterThan(dart(stadia('rifled100'), rangeM) + 0.02)
    }
    const fast = stadia('smooth125').fire
    const slow = stadia('rifled100').fire
    expect(missOf(fast, round(fast, 'kinetic'), 2000, RANGE_DAY).upM)
      .toBeLessThan(missOf(slow, round(slow, 'kinetic'), 2000, RANGE_DAY).upM * 0.85)
  })
})

describe('shooting on the move', () => {
  const none = build((s) => { s.fireControl.stabiliser = 'none' })
  const one = build((s) => { s.fireControl.stabiliser = 'singlePlane' })
  const two = build((s) => { s.fireControl.stabiliser = 'twoPlane' })

  it('needs a stabiliser in both planes to shoot well', () => {
    expect(dart(two, 1000, MOVING)).toBeGreaterThan(dart(one, 1000, MOVING) + 0.25)
    expect(dart(two, 1000, MOVING)).toBeLessThan(dart(two, 1000))
  })

  it('holds a one-plane gun steady up and down but not across', () => {
    const miss = missOf(one.fire, round(one.fire, 'kinetic'), 1000, MOVING)
    expect(miss.acrossM).toBeGreaterThan(miss.upM * 1.5)
  })

  it('halts a tank with no stabiliser, which costs it time more than aim', () => {
    expect(none.fire.moving.halts).toBe(true)
    expect(two.fire.moving.halts).toBe(false)
    expect(dart(none, 1000, MOVING)).toBeGreaterThan(dart(one, 1000, MOVING))
    expect(firstShotS(none.fire, MOVING) - firstShotS(none.fire, RANGE_DAY))
      .toBeGreaterThan((firstShotS(two.fire, MOVING) - firstShotS(two.fire, RANGE_DAY)) * 4)
  })

  it('shoots steadier on a smoother ride', () => {
    const smooth = build((s) => { s.runningGear.suspension = 'hydropneumatic' })
    expect(dart(smooth, 1000, MOVING)).toBeGreaterThan(dart(two, 1000, MOVING) + 0.05)
    expect(dart(smooth, 1000)).toBe(dart(two, 1000))
  })
})

describe('shooting at night', () => {
  const blind = build((s) => { s.fireControl.night = 'none' })
  const infrared = build((s) => { s.fireControl.night = 'activeInfrared' })
  const starlight = build((s) => { s.fireControl.night = 'imageIntensifier' })

  it('is blind without a night sight', () => {
    expect(dart(blind, 1000, NIGHT)).toBe(0)
    expect(dart(blind, 200, NIGHT)).toBeGreaterThan(0.5)
  })

  it('sees further with each better sight', () => {
    expect(seenShare(infrared.fire, 700, NIGHT)).toBe(1)
    expect(seenShare(infrared.fire, 1000, NIGHT)).toBeLessThan(0.5)
    expect(seenShare(starlight.fire, 1000, NIGHT)).toBe(1)
    expect(dart(starlight, 1000, NIGHT)).toBeGreaterThan(dart(infrared, 1000, NIGHT) + 0.4)
    expect(dart(infrared, 600, NIGHT)).toBeGreaterThan(dart(blind, 600, NIGHT))
  })

  it('never shoots better by night than by day', () => {
    for (const sheet of [blind, infrared, starlight]) {
      for (const rangeM of GUNNERY.rangesM) expect(dart(sheet, rangeM, NIGHT)).toBeLessThan(dart(sheet, rangeM))
      expect(firstShotS(sheet.fire, NIGHT)).toBeGreaterThan(firstShotS(sheet.fire, RANGE_DAY))
    }
  })
})

describe('time to first shot', () => {
  it('is shortest with a laser and longest with stadia lines', () => {
    const time = (id: VehicleSpec['fireControl']['rangefinder']): number =>
      build((s) => { s.fireControl.rangefinder = id }).gunnery.firstShotS
    expect(time('laser')).toBeLessThan(time('coincidence') - 3)
    expect(time('coincidence')).toBeLessThan(time('stadiametric'))
  })

  it('is cut by a commander\'s sight, a computer and an easier tank to fight', () => {
    const base = build().gunnery.firstShotS
    expect(build((s) => { s.fireControl.commanderSight = true }).gunnery.firstShotS).toBeLessThan(base - 1.5)
    expect(build((s) => { s.fireControl.computer = 'electronic' }).gunnery.firstShotS).toBeLessThan(base - 1.5)
    expect(build((s) => { s.crew.comfort = 'improved' }).gunnery.firstShotS).toBeLessThan(base)
  })

  it('is slower for conscripts', () => {
    const { fire } = build()
    expect(firstShotS(fire, { ...RANGE_DAY, crew: 'conscript' })).toBeGreaterThan(firstShotS(fire, RANGE_DAY) * 1.2)
  })
})

describe('loader against autoloader', () => {
  const human = build((s) => { s.loading = 'loader' })
  const machine = build((s) => { s.loading = 'carousel' })

  it('tires a human loader round by round, and not a machine', () => {
    expect(human.fire.feed.auto).toBe(false)
    expect(machine.fire.feed.auto).toBe(true)
    expect(cycleS(human.fire, 0, RANGE_DAY)).toBeCloseTo(60 / GUNS.smooth125.loaderRof, 9)
    expect(cycleS(human.fire, 15, RANGE_DAY)).toBeGreaterThan(cycleS(human.fire, 0, RANGE_DAY) * 1.3)
    expect(cycleS(machine.fire, 15, RANGE_DAY)).toBe(cycleS(machine.fire, 0, RANGE_DAY))
  })

  it('gives clearly different rates of fire over a long shoot', () => {
    expect(human.firepower.rateOfFireRpm).toBe(GUNS.smooth125.loaderRof)
    expect(human.gunnery.sustainedRpm).toBeLessThan(human.firepower.rateOfFireRpm - 0.7)
    expect(machine.gunnery.sustainedRpm).toBeGreaterThan(human.gunnery.sustainedRpm + 2.5)
    // The machine loses a little to jams.
    expect(machine.gunnery.sustainedRpm).toBeLessThan(LOADING.carousel.fixedRof)
    expect(machine.gunnery.sustainedRpm).toBeGreaterThan(LOADING.carousel.fixedRof - 0.6)
  })

  it('lets a loader keep up with the machine on a light round, for a while', () => {
    const light = build((s) => {
      s.gun = 'rifled100'
      s.loading = 'loader'
    })
    expect(cycleS(light.fire, 0, RANGE_DAY)).toBeCloseTo(cycleS(machine.fire, 0, RANGE_DAY), 0)
    expect(light.gunnery.sustainedRpm).toBeLessThan(machine.gunnery.sustainedRpm)
    expect(light.gunnery.sustainedRpm).toBeGreaterThan(human.gunnery.sustainedRpm + 1)
  })

  it('tires him sooner in a cramped turret', () => {
    const roomy = build((s) => {
      s.loading = 'loader'
      s.crew.comfort = 'improved'
    })
    expect(roomy.gunnery.sustainedRpm).toBeGreaterThan(human.gunnery.sustainedRpm + 0.2)
  })

  it('slows hand loading in a moving tank, and not the machine', () => {
    expect(cycleS(human.fire, 0, MOVING)).toBeGreaterThan(cycleS(human.fire, 0, RANGE_DAY) * 1.2)
    expect(cycleS(machine.fire, 0, MOVING)).toBe(cycleS(machine.fire, 0, RANGE_DAY))
    expect(sustainedRpm(human.fire, MOVING)).toBeLessThan(human.gunnery.sustainedRpm)
  })

  it('leaves the crew feeding the gun by hand once the machine is empty', () => {
    const bustle = build((s) => {
      s.turret.shape = 'bustle'
      s.loading = 'bustleLoader'
    })
    const ready = LOADING.bustleLoader.readyRounds
    expect(ready).toBeLessThan(GUNNERY.loading.drillRounds)
    expect(cycleS(bustle.fire, ready, RANGE_DAY)).toBeGreaterThan(cycleS(bustle.fire, ready - 1, RANGE_DAY) * 2)
    expect(bustle.gunnery.sustainedRpm).toBeLessThan(LOADING.bustleLoader.fixedRof - 1.5)
    expect(bustle.gunnery.sustainedRpm).toBeGreaterThan(machine.gunnery.sustainedRpm)
  })

  it('cannot shoot faster than the gun can be laid again', () => {
    const { fire } = build()
    const slow: Fire = { ...fire, times: { ...fire.times, relayS: 30 } }
    expect(cycleS(slow, 0, RANGE_DAY)).toBeCloseTo(30 * fire.pace.gunner, 9)
  })
})

describe('the design office quote', () => {
  it('is the same every time for the same design', () => {
    expect(build().gunnery).toEqual(build().gunnery)
  })

  it('lists every round the gun fires at every quoted range', () => {
    for (const gun of GUN_IDS) {
      const { gunnery, fire } = build((s) => { s.gun = gun })
      expect(gunnery.byRound.map((each) => each.id)).toEqual(fire.rounds.map((each) => each.id))
      for (const each of gunnery.byRound) expect(each.chances).toHaveLength(GUNNERY.rangesM.length)
    }
  })

  it('never counts more rounds than the tank carries', () => {
    const few = build((s) => { s.ammo.rounds = 20 })
    expect(few.gunnery.sustainedRpm).toBeGreaterThan(0)
    expect(few.fire.carried).toBe(20)
  })
})
