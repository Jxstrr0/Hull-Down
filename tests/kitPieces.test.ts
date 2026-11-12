import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASELINE_SPEC } from '../src/data/baseline'
import { KIT } from '../src/data/kit'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { parseKit, pieceTriangles, placeCorners } from '../src/render/glb'
import { kitPiece, useTankKit } from '../src/render/kitPieces'
import { tankShapeOf, tankTriangles } from '../src/render/tankShape'
import { buildStatSheet } from '../src/sim/vehicle'
import { ROOT } from './helpers'

const file = readFileSync(join(ROOT, 'public', KIT.file))
const kit = parseKit(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength))

/** The signed volume a closed set of triangles encloses: positive when they face outward. */
function volume(corners: readonly number[]): number {
  let sum = 0
  for (let i = 0; i < corners.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = corners.slice(i, i + 9) as [number, number, number, number, number, number, number, number, number]
    sum += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
  }
  return sum / 6
}

afterEach(() => useTankKit(kit))

describe('the tank kit, read without three.js', () => {
  it('reads every piece with the triangles the table says', () => {
    for (const [name, count] of Object.entries(KIT.pieces)) expect(pieceTriangles(kit.get(name)!), name).toBe(count)
  })

  it('keeps a mirrored piece facing outward', () => {
    const wheel = kit.get('road-wheel')!
    const all = [...wheel.body, ...wheel.dark]
    const plain = volume(placeCorners(all, { x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 0 }))
    const mirrored = volume(placeCorners(all, { x: 1, y: 1, z: -1 }, { x: 0, y: 0, z: 0 }))
    expect(plain).toBeGreaterThan(0)
    expect(mirrored).toBeCloseTo(plain, 6)
  })

  it('draws the simple shapes when the kit has not come', async () => {
    const { Kit } = await import('../src/render/rangeScene')
    const { buildTank } = await import('../src/render/tankModel')
    const materials = new Kit()
    const spec = BASELINE_SPEC
    const sheet = buildStatSheet(spec, PACT_LIMITS_GEN1)
    const shape = tankShapeOf(spec, sheet.geometry)
    useTankKit(null)
    expect(kitPiece('road-wheel')).toBeUndefined()
    const plain = buildTank(materials, shape)
    useTankKit(kit)
    const kitted = buildTank(materials, shape)
    const count = (group: typeof plain) => {
      let n = 0
      group.traverse((node) => {
        const geometry = (node as { geometry?: { getAttribute(name: string): { count: number } } }).geometry
        if (geometry) n += geometry.getAttribute('position').count / 3
      })
      return n
    }
    expect(count(kitted)).toBe(tankTriangles(shape))
    expect(count(plain)).toBeLessThan(count(kitted))
    materials.dispose()
  })
})
