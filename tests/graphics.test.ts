import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BATTLE_GROUND_IDS } from '../src/data/battle'
import { FIRST_TIER, FRAME_METER, GRAPHICS_SETTINGS, TIERS, TIER_IDS } from '../src/data/graphics'
import { ACCORD_LIMITS, THREAT_TANKS } from '../src/data/opponents'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import {
  GRAPHICS_KEY, cleanGraphics, loadGraphics, newGraphics, pickGraphics, saveGraphics, tierOf, withMeasure,
} from '../src/persist/graphicsStore'
import { createFrameMeter, tierAfter } from '../src/render/frameMeter'
import { runBattle } from '../src/sim/battle/battle'
import { combatantOf } from '../src/sim/duel/duel'

/** Feeds a meter frames this far apart until it speaks, and says what it said and after how many. */
function timed(gapMs: number, stallEvery = 0): { fps: number | null; frames: number } {
  const meter = createFrameMeter()
  for (let n = 1; n <= 1000; n++) {
    const fps = meter.add(stallEvery > 0 && n % stallEvery === 0 ? 400 : gapMs)
    if (fps !== null) return { fps, frames: n }
  }
  return { fps: null, frames: 1000 }
}

describe('the graphics tiers', () => {
  it('get cheaper down the list, and every one has its words', () => {
    for (let i = 1; i < TIER_IDS.length; i++) {
      const finer = TIERS[TIER_IDS[i - 1]!]
      const plainer = TIERS[TIER_IDS[i]!]
      expect(plainer.pixelRatio).toBeLessThan(finer.pixelRatio)
      expect(plainer.scenery).toBeLessThan(finer.scenery)
    }
    expect(TIERS[TIER_IDS[TIER_IDS.length - 1]!].pixelRatio).toBeGreaterThanOrEqual(1)
    expect(TIER_IDS[0]).toBe(FIRST_TIER)
    for (const id of GRAPHICS_SETTINGS) expect(STRINGS.graphics.settings[id].name.length).toBeGreaterThan(0)
    for (const id of TIER_IDS) expect(STRINGS.graphics.tiers[id].length).toBeGreaterThan(0)
    expect(STRINGS.graphics.settings.auto.note).toContain('{tier}')
  })
})

describe('the frame meter', () => {
  it('throws the first frames away, times the rest, and speaks once', () => {
    const { fps, frames } = timed(1000 / 60)
    expect(fps).toBeCloseTo(60, 0)
    expect(frames).toBe(FRAME_METER.skipFrames + FRAME_METER.sampleFrames)
    const meter = createFrameMeter()
    let said = 0
    for (let n = 0; n < 500; n++) if (meter.add(20) !== null) said++
    expect(said).toBe(1)
  })

  it('is not thrown by the odd long stall, or by a gap that is no gap', () => {
    expect(timed(1000 / 60, 10).fps).toBeCloseTo(60, 0)
    const meter = createFrameMeter()
    for (let n = 0; n < 500; n++) expect(meter.add(n % 2 === 0 ? 0 : Number.NaN)).toBeNull()
  })

  it('steps down one tier when the device is slow, to the bottom when it is very slow, and never up', () => {
    expect(tierAfter('high', 60)).toBe('high')
    expect(tierAfter('high', FRAME_METER.stepDownFps - 1)).toBe('medium')
    expect(tierAfter('medium', FRAME_METER.stepDownFps - 1)).toBe('low')
    expect(tierAfter('low', FRAME_METER.stepDownFps - 1)).toBe('low')
    expect(tierAfter('high', FRAME_METER.lowFps - 1)).toBe('low')
    expect(tierAfter('low', 120)).toBe('low')
  })
})

describe('the picture quality kept on the device', () => {
  it('starts on auto at the top tier with nothing measured', () => {
    const fresh = newGraphics()
    expect(fresh).toEqual({ setting: 'auto', auto: FIRST_TIER, measured: null })
    expect(tierOf(fresh)).toBe(FIRST_TIER)
  })

  it('on auto, steps down when a view measures a slow device, and remembers the frame rate', () => {
    let graphics = withMeasure(newGraphics(), 31.4)
    expect(tierOf(graphics)).toBe('medium')
    expect(graphics.measured).toEqual({ fps: 31, tier: 'high' })
    graphics = withMeasure(graphics, 58)
    expect(tierOf(graphics)).toBe('medium')
    expect(graphics.measured).toEqual({ fps: 58, tier: 'medium' })
  })

  it('leaves a picked tier alone however slow the device, and auto starts again from the top', () => {
    let graphics = pickGraphics(withMeasure(newGraphics(), 10), 'high')
    expect(tierOf(graphics)).toBe('high')
    graphics = withMeasure(graphics, 10)
    expect(tierOf(graphics)).toBe('high')
    expect(graphics.measured).toEqual({ fps: 10, tier: 'high' })
    graphics = pickGraphics(graphics, 'auto')
    expect(tierOf(graphics)).toBe(FIRST_TIER)
  })

  it('is saved and loaded under its own key, and drops what it cannot trust', () => {
    const kept = new Map<string, string>()
    const storage = { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => void kept.set(key, value) }
    expect(loadGraphics(storage)).toEqual(newGraphics())
    const graphics = withMeasure(pickGraphics(newGraphics(), 'low'), 47)
    expect(saveGraphics(storage, graphics)).toBe(true)
    expect([...kept.keys()]).toEqual([GRAPHICS_KEY])
    expect(GRAPHICS_KEY.startsWith('hulldown.')).toBe(true)
    expect(loadGraphics(storage)).toEqual(graphics)
    kept.set(GRAPHICS_KEY, '{not json')
    expect(loadGraphics(storage)).toEqual(newGraphics())
    expect(cleanGraphics({ setting: 'ultra', auto: 7, measured: { fps: -3, tier: 'high' } })).toEqual(newGraphics())
    expect(cleanGraphics({ setting: 'medium', auto: 'low', measured: { fps: 44.6, tier: 'medium' } }))
      .toEqual({ setting: 'medium', auto: 'low', measured: { fps: 45, tier: 'medium' } })
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(loadGraphics(blocked)).toEqual(newGraphics())
    expect(saveGraphics(blocked, graphics)).toBe(false)
  })
})

describe('a battle drawn at a lower tier', () => {
  it('has fewer trees and never more to draw', async () => {
    const { buildBattleStage, stageCost } = await import('../src/render/battleScene')
    const { Kit } = await import('../src/render/rangeScene')
    const me = combatantOf(BASELINE_SPEC, PACT_LIMITS_GEN1)
    const foe = combatantOf(THREAT_TANKS.warden.spec, ACCORD_LIMITS, THREAT_TANKS.warden.rounds)
    const look = (tank: typeof me) => ({ spec: tank.sheet.target.spec, geometry: tank.sheet.geometry })
    let thinned = false
    for (const ground of BATTLE_GROUND_IDS) {
      const battle = runBattle(me, foe, ground, { range: 'close', pace: 'fast' }, 1)
      const costs = TIER_IDS.map((id) => {
        const kit = new Kit()
        const cost = stageCost(buildBattleStage(kit, battle, look(me), look(foe), TIERS[id].scenery))
        kit.dispose()
        return cost
      })
      for (let i = 1; i < costs.length; i++) {
        expect(costs[i]!.triangles).toBeLessThanOrEqual(costs[i - 1]!.triangles)
        expect(costs[i]!.meshes).toBeLessThanOrEqual(costs[i - 1]!.meshes)
      }
      if (costs[costs.length - 1]!.meshes < costs[0]!.meshes) thinned = true
    }
    expect(thinned).toBe(true)
  })
})
