import { describe, expect, it } from 'vitest'
import { RENDER } from '../src/data/render'
import { DustTrail, dustAt } from '../src/render/dust'

const K = RENDER.dust

describe('a puff of dust', () => {
  it('swells and rises, then shrinks away and is gone', () => {
    const early = dustAt(0.1, K.kinds.earth)!
    const middle = dustAt(K.lifeS * 0.4, K.kinds.earth)!
    expect(middle.sizeM).toBeGreaterThan(early.sizeM)
    expect(middle.riseM).toBeGreaterThan(early.riseM)
    expect(dustAt(K.lifeS * 0.98, K.kinds.earth)!.sizeM).toBeLessThan(middle.sizeM / 4)
    expect(dustAt(K.lifeS, K.kinds.earth)).toBeNull()
    expect(dustAt(-0.1, K.kinds.earth)).toBeNull()
  })

  it('is thrown higher from mud and kept lower on concrete', () => {
    const at = K.lifeS / 2
    expect(dustAt(at, K.kinds.mud)!.riseM).toBeGreaterThan(dustAt(at, K.kinds.earth)!.riseM)
    expect(dustAt(at, K.kinds.concrete)!.riseM).toBeLessThan(dustAt(at, K.kinds.earth)!.riseM)
  })
})

describe('a dust trail', () => {
  it('throws one puff for every so many metres, carrying the rest over', () => {
    const trail = new DustTrail()
    const every = K.kinds.earth.everyM
    expect(trail.due(0, K.kinds.earth.everyM)).toBe(0)
    expect(trail.due(every * 0.6, K.kinds.earth.everyM)).toBe(0)
    expect(trail.due(every * 1.2, K.kinds.earth.everyM)).toBe(1)
    expect(trail.due(every * 2.1, K.kinds.earth.everyM)).toBe(1)
  })

  it('throws no more than a few a picture, however far it jumps', () => {
    const trail = new DustTrail()
    trail.due(0, K.kinds.earth.everyM)
    expect(trail.due(1000, K.kinds.earth.everyM)).toBe(K.mostPerFrame)
    expect(trail.due(1000 + K.kinds.earth.everyM / 2, K.kinds.earth.everyM)).toBe(0)
  })

  it('starts again when the run is wound back', () => {
    const trail = new DustTrail()
    trail.due(50, K.kinds.earth.everyM)
    expect(trail.due(10, K.kinds.earth.everyM)).toBe(0)
    expect(trail.due(10 + K.kinds.earth.everyM, K.kinds.earth.everyM)).toBe(1)
  })

  it('is thicker in mud than on concrete', () => {
    expect(K.kinds.mud.everyM).toBeLessThan(K.kinds.earth.everyM)
    expect(K.kinds.earth.everyM).toBeLessThan(K.kinds.concrete.everyM)
  })
})

describe('the dust pool', () => {
  it('shows puffs while they live, clears when wound back, and gives up the oldest when full', async () => {
    const { Dust, Kit } = await import('../src/render/rangeScene')
    const kit = new Kit()
    const dust = new Dust(kit, 4)
    for (let i = 0; i < 3; i++) dust.kick(i, 0, 0, K.kinds.earth, 1)
    dust.show(1.2)
    expect(dust.showing).toBe(3)
    dust.show(1 + K.lifeS + 0.01)
    expect(dust.showing).toBe(0)
    for (let i = 0; i < 6; i++) dust.kick(i, 0, 0, K.kinds.mud, 5)
    dust.show(5.1)
    expect(dust.showing).toBe(4)
    dust.show(2)
    expect(dust.showing).toBe(0)
    kit.dispose()
  })
})

describe('exhaust smoke', () => {
  it('is thicker, darker and comes faster when the engine works hard', () => {
    const ex = K.exhaust
    expect(ex.hardEveryS).toBeLessThan(ex.everyS)
    expect(ex.hard.size).toBeGreaterThan(ex.light.size)
    const shade = (hex: string): number => [1, 3, 5].reduce((sum, at) => sum + parseInt(hex.slice(at, at + 2), 16), 0)
    expect(shade(ex.hard.colour)).toBeLessThan(shade(ex.light.colour))
  })

  it('works hard while the tank speeds up or climbs, and not while it cruises on the flat', async () => {
    const { Working } = await import('../src/render/rangeScene')
    const working = new Working()
    expect(working.at(0, 0, 0)).toBe(false)
    expect(working.at(1, K.exhaust.hardAccelMs2 * 2, 0)).toBe(true)
    expect(working.at(2, K.exhaust.hardAccelMs2 * 2, 0)).toBe(false)
    expect(working.at(3, K.exhaust.hardAccelMs2 * 2, K.exhaust.climbRad * 2)).toBe(true)
    // Asked twice for the same moment, it gives the same answer.
    const again = new Working()
    again.at(0, 0, 0)
    expect(again.at(1, 5, 0)).toBe(true)
    expect(again.at(1, 5, 0)).toBe(true)
  })

  it('leaves the deck at the engine end', async () => {
    const { exhaustDeckX } = await import('../src/render/rangeScene')
    const { tankShapeOf } = await import('../src/render/tankShape')
    const { BASELINE_SPEC } = await import('../src/data/baseline')
    const { PACT_LIMITS_GEN1 } = await import('../src/data/tuning')
    const { buildStatSheet } = await import('../src/sim/vehicle')
    const shape = tankShapeOf(BASELINE_SPEC, buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1).geometry)
    expect(exhaustDeckX(shape, 'rear')).toBeLessThan(0)
    expect(exhaustDeckX(shape, 'front')).toBeGreaterThan(0)
    expect(Math.abs(exhaustDeckX(shape, 'rear'))).toBeLessThan(shape.lengthM / 2)
  })
})
