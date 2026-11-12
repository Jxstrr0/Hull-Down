import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BATTLE_GROUND_IDS } from '../src/data/battle'
import { RANGE } from '../src/data/range'
import { RENDER } from '../src/data/render'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { battleMud, courseMud, enduranceMud } from '../src/render/mud'
import { mudPatch } from '../src/render/path'
import { Kit } from '../src/render/rangeScene'
import { TURRET, buildTank, setMud, tonesOf } from '../src/render/tankModel'
import { tankShapeOf } from '../src/render/tankShape'
import { buildStatSheet } from '../src/sim/vehicle'

const K = RENDER.tank.mud

describe('mud on the tank', () => {
  it('builds up over the endurance run, slowly on the road and faster off it, never past the most', () => {
    const roadKm = RANGE.endurance.legs[0]!.km
    const allKm = RANGE.endurance.legs.reduce((sum, leg) => sum + leg.km, 0)
    expect(enduranceMud(0)).toBe(0)
    const road = enduranceMud(roadKm)
    expect(road).toBeGreaterThan(0)
    // The next leg is earth: the same distance again adds more than the road did.
    expect(enduranceMud(2 * roadKm) - road).toBeGreaterThan(road)
    let last = 0
    for (let km = 0; km <= allKm + 20; km += 5) {
      const share = enduranceMud(km)
      expect(share).toBeGreaterThanOrEqual(last)
      expect(share).toBeLessThanOrEqual(K.most)
      last = share
    }
    expect(enduranceMud(allKm)).toBeGreaterThan(0.5)
  })

  it('takes the course\'s mud pit with it once through, and not before', () => {
    const pit = mudPatch()
    expect(courseMud(pit.fromX - 10, pit)).toBe(K.course)
    expect(courseMud(pit.toX + 10, pit)).toBe(K.pit)
    const half = courseMud((pit.fromX + pit.toX) / 2, pit)
    expect(half).toBeGreaterThan(K.course)
    expect(half).toBeLessThan(K.pit)
  })

  it('gives every battle ground some mud, within the most', () => {
    for (const ground of BATTLE_GROUND_IDS) {
      expect(battleMud(ground)).toBeGreaterThan(0)
      expect(battleMud(ground)).toBeLessThanOrEqual(K.most)
    }
  })

  it('dirties the hull, wheels and tracks together, one number for the tank, and leaves the turret clean', () => {
    const shape = tankShapeOf(BASELINE_SPEC, buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1).geometry)
    const kit = new Kit()
    for (const tones of [undefined, tonesOf('threeColour')]) {
      const tank = buildTank(kit, shape, tones)
      const other = buildTank(kit, shape, tones)
      const turret = tank.getObjectByName(TURRET)!
      const hullMeshes = tank.children.filter((child) => child !== turret)
      expect(hullMeshes.length).toBeGreaterThan(3)
      const key = (mesh: object): string => (mesh as { material: { customProgramCacheKey(): string } }).material.customProgramCacheKey()
      for (const mesh of hullMeshes) expect(key(mesh)).toMatch(/\+mud$/)
      turret.traverse((node) => {
        if ('material' in node) expect(key(node)).not.toMatch(/mud/)
      })
      setMud(tank, 0.5)
      expect((tank.userData as { mud: { share: { value: number } } }).mud.share.value).toBe(0.5)
      expect((other.userData as { mud: { share: { value: number } } }).mud.share.value).toBe(0)
      // The mud reaches a little above the track tops.
      expect((tank.userData as { mud: { lineM: { value: number } } }).mud.lineM.value).toBeCloseTo(shape.track.topM + K.lineM, 9)
    }
    kit.dispose()
  })
})
