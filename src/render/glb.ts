// Reads the tank kit (public/kit/tank-kit.glb) without three.js: the file is
// a glTF binary, a JSON chunk naming each piece and a binary chunk with its
// corners. Each piece comes out as flat lists of triangle corners, one list
// per tone, ready to be moved into place and joined with the rest of a tank.
// Only what art/tank-kit.py writes is understood: float corners, whole-number
// indices, no compression, every move already applied to the corners.
import type { KitPiece } from '../data/kit'

/** A piece's triangle corners, three numbers to a corner, by the tone it is painted. */
export interface PieceCorners {
  body: number[]
  dark: number[]
}

export type KitCorners = ReadonlyMap<KitPiece | string, PieceCorners>

interface Accessor {
  bufferView: number
  byteOffset?: number
  componentType: number
  count: number
  type: string
}

interface Gltf {
  nodes: { name: string; mesh?: number }[]
  meshes: { primitives: { attributes: { POSITION: number }; indices?: number; material?: number }[] }[]
  materials?: { name: string }[]
  accessors: Accessor[]
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[]
}

const FLOAT = 5126
const SIZES: Record<number, number> = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }

export function parseKit(file: ArrayBuffer): KitCorners {
  const view = new DataView(file)
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a glTF binary')
  const jsonLength = view.getUint32(12, true)
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(file, 20, jsonLength))) as Gltf
  const binStart = 20 + jsonLength + 8

  const read = (index: number): number[] => {
    const accessor = json.accessors[index]!
    const bufferView = json.bufferViews[accessor.bufferView]!
    const width = accessor.type === 'VEC3' ? 3 : 1
    const size = SIZES[accessor.componentType]!
    const stride = bufferView.byteStride ?? width * size
    const start = binStart + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    const out: number[] = []
    for (let i = 0; i < accessor.count; i++) {
      for (let k = 0; k < width; k++) {
        const at = start + i * stride + k * size
        if (accessor.componentType === FLOAT) out.push(view.getFloat32(at, true))
        else if (size === 1) out.push(view.getUint8(at))
        else if (size === 2) out.push(view.getUint16(at, true))
        else out.push(view.getUint32(at, true))
      }
    }
    return out
  }

  const pieces = new Map<string, PieceCorners>()
  for (const node of json.nodes) {
    if (node.mesh === undefined) continue
    const piece: PieceCorners = { body: [], dark: [] }
    for (const primitive of json.meshes[node.mesh]!.primitives) {
      const places = read(primitive.attributes.POSITION)
      const order = primitive.indices === undefined ? Array.from({ length: places.length / 3 }, (_, i) => i) : read(primitive.indices)
      const tone = json.materials?.[primitive.material ?? -1]?.name === 'dark' ? 'dark' : 'body'
      for (const corner of order) piece[tone].push(places[corner * 3]!, places[corner * 3 + 1]!, places[corner * 3 + 2]!)
    }
    pieces.set(node.name, piece)
  }
  return pieces
}

/** Triangles a piece is drawn with. */
export function pieceTriangles(piece: PieceCorners): number {
  return (piece.body.length + piece.dark.length) / 9
}

export interface Vec {
  x: number
  y: number
  z: number
}

/** The piece's own x, y and z, as directions on the tank. Unturned, they are the tank's own. */
export interface Axes {
  x: Vec
  y: Vec
  z: Vec
}

export const UNTURNED: Axes = { x: { x: 1, y: 0, z: 0 }, y: { x: 0, y: 1, z: 0 }, z: { x: 0, y: 0, z: 1 } }

/**
 * A piece's corners moved into place: scaled along each of its own axes,
 * turned so those axes point along `axes`, then shifted. A negative scale
 * mirrors the piece; its triangles are turned back round so they still face outward.
 */
export function placeCorners(corners: readonly number[], scale: Vec, at: Vec, axes: Axes = UNTURNED): number[] {
  const out: number[] = []
  const { x: a, y: b, z: c } = axes
  const turn = a.x * (b.y * c.z - b.z * c.y) - a.y * (b.x * c.z - b.z * c.x) + a.z * (b.x * c.y - b.y * c.x)
  const flip = scale.x * scale.y * scale.z * turn < 0
  const order = flip ? [0, 6, 3] : [0, 3, 6]
  for (let i = 0; i < corners.length; i += 9) {
    for (const k of order) {
      const px = corners[i + k]! * scale.x
      const py = corners[i + k + 1]! * scale.y
      const pz = corners[i + k + 2]! * scale.z
      out.push(at.x + px * a.x + py * b.x + pz * c.x, at.y + px * a.y + py * b.y + pz * c.y, at.z + px * a.z + py * b.z + pz * c.z)
    }
  }
  return out
}
