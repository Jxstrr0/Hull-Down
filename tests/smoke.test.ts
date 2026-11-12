import { describe, expect, it } from 'vitest'
import { RENDER } from '../src/data/render'
import { wreckPuffs } from '../src/render/smoke'

const k = RENDER.battle.wreckSmoke

describe('the smoke off a wreck', () => {
  it('is nothing before the tank is out, and one small puff the moment it is', () => {
    expect(wreckPuffs(-0.1)).toEqual([])
    const first = wreckPuffs(0)
    expect(first).toHaveLength(1)
    expect(first[0]!.riseM).toBe(0)
  })

  it('builds a whole column that fits the slots, each puff in a slot of its own', () => {
    for (let s = 0; s < 30; s += 0.13) {
      const puffs = wreckPuffs(s)
      expect(puffs.length).toBeLessThanOrEqual(k.puffs)
      expect(new Set(puffs.map((puff) => puff.slot)).size).toBe(puffs.length)
    }
    expect(wreckPuffs(20).length).toBeGreaterThanOrEqual(k.puffs - 1)
  })

  it('rises, swells and leans down the wind as each puff ages, then thins away', () => {
    const young = wreckPuffs(10.5)[0]!
    const old = wreckPuffs(10.5).at(-1)!
    expect(old.riseM).toBeGreaterThan(young.riseM)
    expect(old.downM).toBeGreaterThan(young.downM)
    expect(old.riseM).toBeLessThanOrEqual(k.riseM)
    // A puff about to go is small again.
    const going = wreckPuffs(k.lifeS - 0.01).find((puff) => puff.slot === 0)!
    expect(going.sizeM).toBeLessThan(k.fromM)
  })

  it('is the same column every time it is asked, so winding the replay is seamless', () => {
    expect(wreckPuffs(7.3)).toEqual(wreckPuffs(7.3))
  })
})
