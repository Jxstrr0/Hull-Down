import type { MeshLambertMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { CAMO, DEFAULT_PAINT, PAINT, PAINT_IDS, cleanPaint } from '../src/data/paint'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { cleanStore, currentDesign, decodeStore, encodeStore, keepRevision, newStore, paintOf, setPaint } from '../src/persist/designs'
import { camoOf, camoPixels, camoPlaces } from '../src/render/camo'
import { buildStatSheet } from '../src/sim/vehicle'

const HEX = /^#[0-9a-f]{6}$/

function hex(pixels: Uint8Array, at: number): string {
  return `#${[0, 1, 2].map((c) => pixels[at * 4 + c]!.toString(16).padStart(2, '0')).join('')}`
}

describe('the paint schemes', () => {
  it('each has its colours, a name and a note, and patches that leave some body colour showing', () => {
    for (const id of PAINT_IDS) {
      const scheme = PAINT[id]
      for (const colour of [scheme.body, scheme.dark, scheme.tile, ...scheme.patches.map((patch) => patch.colour)]) expect(colour).toMatch(HEX)
      expect(scheme.patches.reduce((sum, patch) => sum + patch.share, 0)).toBeLessThan(0.8)
      expect(STRINGS.paint.schemes[id].name.length).toBeGreaterThan(0)
      expect(STRINGS.paint.schemes[id].note.length).toBeGreaterThan(0)
    }
    expect(PAINT_IDS).toContain(DEFAULT_PAINT)
  })

  it('reads a paint it knows from a save and falls back on anything else', () => {
    expect(cleanPaint('winter')).toBe('winter')
    expect(cleanPaint('tartan')).toBe(DEFAULT_PAINT)
    expect(cleanPaint(undefined)).toBe(DEFAULT_PAINT)
    expect(cleanPaint(3)).toBe(DEFAULT_PAINT)
  })
})

describe('a camouflage pattern', () => {
  it('is only made for schemes with patches', () => {
    expect(camoOf('green')).toBeUndefined()
    expect(camoOf('sand')).toBeUndefined()
    expect(camoOf('threeColour')?.pixels.length).toBe(CAMO.sizePx * CAMO.sizePx * 4)
    expect(camoOf('winter')?.tileM).toBe(CAMO.tileM)
  })

  it('comes out the same every time', () => {
    expect(Array.from(camoPixels(PAINT.threeColour))).toEqual(Array.from(camoPixels(PAINT.threeColour)))
  })

  it('gives every colour the share of the plate the scheme asks for, and uses no other colour', () => {
    for (const id of ['threeColour', 'winter'] as const) {
      const scheme = PAINT[id]
      const pixels = camoPixels(scheme)
      const count = CAMO.sizePx * CAMO.sizePx
      const seen = new Map<string, number>()
      for (let i = 0; i < count; i++) {
        seen.set(hex(pixels, i), (seen.get(hex(pixels, i)) ?? 0) + 1)
        expect(pixels[i * 4 + 3]).toBe(255)
      }
      expect(seen.size).toBe(scheme.patches.length + 1)
      for (const patch of scheme.patches) expect((seen.get(patch.colour) ?? 0) / count).toBeCloseTo(patch.share, 2)
      expect(seen.get(scheme.body)).toBeGreaterThan(0)
    }
  })

  it('is made of patches, not speckle: most pixels match the one beside them, across the seam too', () => {
    const pixels = camoPixels(PAINT.threeColour)
    const n = CAMO.sizePx
    let same = 0
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (hex(pixels, y * n + x) === hex(pixels, y * n + ((x + 1) % n))) same++
    expect(same / (n * n)).toBeGreaterThan(0.85)
    let seam = 0
    for (let y = 0; y < n; y++) if (hex(pixels, y * n + n - 1) === hex(pixels, y * n)) seam++
    expect(seam / n).toBeGreaterThan(0.7)
  })

  it('places a face on the pattern from the side it faces', () => {
    // A triangle lying flat is placed by where it is on the ground.
    expect(camoPlaces([0, 1, 0, 2, 1, 0, 0, 1, 4], 2)).toEqual([0, 0, 1, 0, 0, 2])
    // One standing across the tank is placed by how far along and how high.
    expect(camoPlaces([0, 0, 3, 2, 0, 3, 0, 4, 3], 2)).toEqual([0, 0, 1, 0, 0, 2])
    // One facing forward is placed by how far across and how high.
    expect(camoPlaces([5, 0, 0, 5, 0, 2, 5, 4, 0], 2)).toEqual([0, 0, 1, 0, 0, 2])
  })
})

describe('paint on a saved design', () => {
  it('is the default until one is picked, and the default is not written down', () => {
    const store = newStore()
    const design = currentDesign(store)
    expect(paintOf(design)).toBe(DEFAULT_PAINT)
    setPaint(design, 'winter')
    expect(paintOf(design)).toBe('winter')
    setPaint(design, DEFAULT_PAINT)
    expect('paint' in design).toBe(false)
  })

  it('survives a save and a load, and a paint the game does not know is dropped', () => {
    const store = newStore()
    setPaint(currentDesign(store), 'threeColour')
    expect(paintOf(currentDesign(decodeStore(encodeStore(store))))).toBe('threeColour')
    const odd = JSON.parse(encodeStore(store)) as { designs: { paint: string }[] }
    odd.designs[0]!.paint = 'tartan'
    expect(paintOf(currentDesign(cleanStore(odd)))).toBe(DEFAULT_PAINT)
  })

  it('is not a new build: a repaint adds no revision', () => {
    const store = newStore()
    const design = currentDesign(store)
    design.spec = structuredClone(BASELINE_SPEC)
    keepRevision(design)
    setPaint(design, 'sand')
    keepRevision(design)
    expect(design.revisions.length).toBe(1)
  })
})

describe('a painted tank', () => {
  it('carries its pattern on the plate only, and is no more meshes or triangles than a plain one', async () => {
    const { Mesh } = await import('three')
    const { Kit } = await import('../src/render/rangeScene')
    const { TRACKS, buildTank, tonesOf } = await import('../src/render/tankModel')
    const { tankShapeOf, tankTriangles } = await import('../src/render/tankShape')
    const shape = tankShapeOf(BASELINE_SPEC, buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1).geometry)
    for (const id of PAINT_IDS) {
      const kit = new Kit()
      const tank = buildTank(kit, shape, tonesOf(id))
      let meshes = 0
      let triangles = 0
      let patterned = 0
      const pictures = new Set<unknown>()
      tank.traverse((node) => {
        if (!(node instanceof Mesh)) return
        meshes++
        const corners = node.geometry.getAttribute('position').count
        triangles += corners / 3
        const material = node.material as MeshLambertMaterial
        if (material.map) {
          patterned++
          expect(node.geometry.getAttribute('uv').count).toBe(corners)
          if (node.name !== TRACKS) pictures.add(material.map)
        }
      })
      expect(meshes).toBeLessThanOrEqual(9)
      expect(triangles).toBe(tankTriangles(shape))
      // With patches, the hull, the turret and the wheels are each painted with them, from one picture; the tracks have their links.
      const camo = PAINT[id].patches.length > 0
      expect(patterned).toBe((camo ? 3 : 0) + 1)
      expect(pictures.size).toBe(camo ? 1 : 0)
      kit.dispose()
    }
  })
})
