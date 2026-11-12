import { describe, expect, it } from 'vitest'
import { RENDER } from '../src/data/render'
import { DustTrail, dustAt } from '../src/render/dust'

const K = RENDER.dust

describe('a puff of dust', () => {
  it('swells and rises, then shrinks away and is gone', () => {
    const early = dustAt(0.1, 'earth')!
    const middle = dustAt(K.lifeS * 0.4, 'earth')!
    expect(middle.sizeM).toBeGreaterThan(early.sizeM)
    expect(middle.riseM).toBeGreaterThan(early.riseM)
    expect(dustAt(K.lifeS * 0.98, 'earth')!.sizeM).toBeLessThan(middle.sizeM / 4)
    expect(dustAt(K.lifeS, 'earth')).toBeNull()
    expect(dustAt(-0.1, 'earth')).toBeNull()
  })

  it('is thrown higher from mud and kept lower on concrete', () => {
    const at = K.lifeS / 2
    expect(dustAt(at, 'mud')!.riseM).toBeGreaterThan(dustAt(at, 'earth')!.riseM)
    expect(dustAt(at, 'concrete')!.riseM).toBeLessThan(dustAt(at, 'earth')!.riseM)
  })
})

describe('a dust trail', () => {
  it('throws one puff for every so many metres, carrying the rest over', () => {
    const trail = new DustTrail()
    const every = K.kinds.earth.everyM
    expect(trail.due(0, 'earth')).toBe(0)
    expect(trail.due(every * 0.6, 'earth')).toBe(0)
    expect(trail.due(every * 1.2, 'earth')).toBe(1)
    expect(trail.due(every * 2.1, 'earth')).toBe(1)
  })

  it('throws no more than a few a picture, however far it jumps', () => {
    const trail = new DustTrail()
    trail.due(0, 'earth')
    expect(trail.due(1000, 'earth')).toBe(K.mostPerFrame)
    expect(trail.due(1000 + K.kinds.earth.everyM / 2, 'earth')).toBe(0)
  })

  it('starts again when the run is wound back', () => {
    const trail = new DustTrail()
    trail.due(50, 'earth')
    expect(trail.due(10, 'earth')).toBe(0)
    expect(trail.due(10 + K.kinds.earth.everyM, 'earth')).toBe(1)
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
    for (let i = 0; i < 3; i++) dust.kick(i, 0, 0, 'earth', 1)
    dust.show(1.2)
    expect(dust.showing).toBe(3)
    dust.show(1 + K.lifeS + 0.01)
    expect(dust.showing).toBe(0)
    for (let i = 0; i < 6; i++) dust.kick(i, 0, 0, 'mud', 5)
    dust.show(5.1)
    expect(dust.showing).toBe(4)
    dust.show(2)
    expect(dust.showing).toBe(0)
    kit.dispose()
  })
})
