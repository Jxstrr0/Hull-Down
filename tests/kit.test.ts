import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { KIT } from '../src/data/kit'
import { ROOT } from './helpers'

// The tank kit file is a glTF binary: a short header, then a JSON chunk that
// names every piece. Reading the JSON is enough to check what ships.
interface Gltf {
  nodes: { name: string; mesh?: number }[]
  meshes: { primitives: { indices?: number; material?: number }[] }[]
  accessors: { count: number }[]
  materials: { name: string }[]
}

const bytes = readFileSync(join(ROOT, 'public', KIT.file))
const jsonLength = bytes.readUInt32LE(12)
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8')) as Gltf

function trianglesOf(name: string): number {
  const node = gltf.nodes.find((each) => each.name === name)
  const mesh = node?.mesh === undefined ? undefined : gltf.meshes[node.mesh]
  return (mesh?.primitives ?? []).reduce((sum, p) => sum + (p.indices === undefined ? 0 : gltf.accessors[p.indices]!.count / 3), 0)
}

describe('tank kit', () => {
  it('is a glTF binary, and small', () => {
    expect(bytes.toString('ascii', 0, 4)).toBe('glTF')
    expect(bytes.length).toBeLessThanOrEqual(KIT.maxBytes)
  })

  it('holds every piece, and nothing else', () => {
    expect(gltf.nodes.map((node) => node.name).sort()).toEqual(Object.keys(KIT.pieces).sort())
  })

  it('keeps every piece under its triangle cap', () => {
    for (const [name, cap] of Object.entries(KIT.pieces)) {
      const count = trianglesOf(name)
      expect(count, name).toBeGreaterThan(0)
      expect(count, name).toBeLessThanOrEqual(cap)
    }
  })

  it('paints with the two tones only', () => {
    expect(gltf.materials.map((m) => m.name).sort()).toEqual([...KIT.tones].sort())
  })
})
