import { describe, expect, it } from 'vitest'
import { RENDER } from '../src/data/render'
import { markAt } from '../src/render/marks'

const K = RENDER.marks

describe('a track mark', () => {
  it('lies full width, then narrows away and is gone', () => {
    expect(markAt(-1)).toBeNull()
    expect(markAt(0)).toBe(1)
    expect(markAt(K.lifeS * (1 - K.fadeShare) - 0.01)).toBe(1)
    const fading = markAt(K.lifeS * (1 - K.fadeShare / 2))!
    expect(fading).toBeGreaterThan(0.3)
    expect(fading).toBeLessThan(0.7)
    expect(markAt(K.lifeS)).toBeNull()
  })

  it('is darker in the mud than on earth, and on earth than on concrete', () => {
    const shade = (hex: string): number => [1, 3, 5].reduce((sum, at) => sum + parseInt(hex.slice(at, at + 2), 16), 0)
    expect(shade(K.colours.mud)).toBeLessThan(shade(K.colours.earth))
    expect(shade(K.colours.earth)).toBeLessThan(shade(K.colours.concrete))
  })
})

describe('the mark pool', () => {
  it('shows marks while they last, gives up the oldest when full, and wipes clean when wound back', async () => {
    const { Kit, Marks } = await import('../src/render/rangeScene')
    const kit = new Kit()
    const marks = new Marks(kit, 4)
    for (let i = 0; i < 3; i++) marks.lay(i, 0, 0, 0, 0, 0.5, K.colours.earth, 1)
    marks.show(2)
    expect(marks.showing).toBe(3)
    for (let i = 0; i < 6; i++) marks.lay(i, 0, 0, 0, 0, 0.5, K.colours.earth, 3)
    marks.show(3)
    expect(marks.showing).toBe(4)
    marks.show(3 + K.lifeS)
    expect(marks.showing).toBe(0)
    marks.lay(0, 0, 0, 0, 0, 0.5, K.colours.earth, 20)
    marks.show(20)
    marks.show(5)
    expect(marks.showing).toBe(0)
    kit.dispose()
  })

  it('lays a mark flat on the ground, along the way the tank faces, a little above it', async () => {
    const { Matrix4, Vector3 } = await import('three')
    const { Kit, Marks } = await import('../src/render/rangeScene')
    const kit = new Kit()
    const marks = new Marks(kit, 2)
    marks.lay(10, 0, 5, Math.PI / 2, 0, 0.5, K.colours.earth, 0)
    marks.show(0)
    const matrix = new Matrix4()
    marks.mesh.getMatrixAt(0, matrix)
    const at = new Vector3().setFromMatrixPosition(matrix)
    expect(at.x).toBeCloseTo(10, 6)
    expect(at.y).toBeCloseTo(K.liftM, 6)
    expect(at.z).toBeCloseTo(5, 6)
    // Turned a quarter, its length runs across the field.
    const along = new Vector3(1, 0, 0).applyMatrix4(matrix).sub(at)
    expect(Math.abs(along.z)).toBeCloseTo(K.longM, 6)
    expect(Math.abs(along.x)).toBeLessThan(1e-6)
    kit.dispose()
  })
})
