import { Mesh } from 'three'
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { RENDER } from '../src/data/render'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { Kit } from '../src/render/rangeScene'
import { kickM, recoilAt } from '../src/render/recoil'
import { TURRET, buildTank, setRecoil, tonesOf } from '../src/render/tankModel'
import { tankShapeOf } from '../src/render/tankShape'
import { buildStatSheet } from '../src/sim/vehicle'

const K = RENDER.tank.recoil
const shape = tankShapeOf(BASELINE_SPEC, buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1).geometry)

describe('the gun kicking back', () => {
  it('is run out until it fires, snaps back fast, and runs out again slowly', () => {
    expect(recoilAt(null)).toBe(0)
    expect(recoilAt(-0.1)).toBe(0)
    expect(recoilAt(0)).toBe(0)
    expect(recoilAt(K.backS / 2)).toBeCloseTo(0.5, 9)
    expect(recoilAt(K.backS)).toBeCloseTo(1, 9)
    const half = recoilAt(K.backS + K.returnS / 2)
    expect(half).toBeGreaterThan(0.2)
    expect(half).toBeLessThan(0.8)
    expect(recoilAt(K.backS + K.returnS)).toBe(0)
    expect(K.backS).toBeLessThan(K.returnS)
  })

  it('goes back a share of the barrel, never more than its most', () => {
    expect(kickM(4)).toBeCloseTo(4 * K.kickShare, 9)
    expect(kickM(100)).toBe(K.mostM)
  })
})

describe('a gun that recoils', () => {
  it('marks only the barrel, on the turret, with no more meshes', () => {
    for (const tones of [undefined, tonesOf('threeColour')]) {
      const kit = new Kit()
      const tank = buildTank(kit, shape, tones)
      let marked = 0
      let meshes = 0
      tank.traverse((node) => {
        if (!(node instanceof Mesh)) return
        meshes++
        const recoil = node.geometry.getAttribute('recoil')
        if (!recoil) return
        expect(node.parent?.name).toBe(TURRET)
        const values = Array.from(recoil.array as Float32Array)
        // Some corners are the barrel; the rest of the turret stays put.
        expect(values.some((v) => v === 1)).toBe(true)
        expect(values.some((v) => v === 0)).toBe(true)
        expect((node.material as { customProgramCacheKey(): string }).customProgramCacheKey()).toContain('+recoil')
        marked++
      })
      expect(marked).toBeGreaterThanOrEqual(1)
      expect(meshes).toBeLessThanOrEqual(9)
      kit.dispose()
    }
  })

  it('slides the barrel back by the kick and rocks the tank with it', () => {
    const kit = new Kit()
    const tank = buildTank(kit, shape)
    const mud = (tank.userData as { mud: { recoilM: { value: number } } }).mud
    expect(setRecoil(tank, 0)).toBe(0)
    expect(mud.recoilM.value).toBe(0)
    expect(setRecoil(tank, 1)).toBeCloseTo(K.rockRad, 9)
    expect(mud.recoilM.value).toBeCloseTo(kickM(shape.gun.lengthM), 9)
    kit.dispose()
  })
})
