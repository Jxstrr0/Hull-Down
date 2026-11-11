// Camouflage patterns, made as plain pixels with no three.js, so they can be
// tested. A pattern repeats without a seam and is the same on every device.
import { CAMO, PAINT, type PaintId, type PaintScheme } from '../data/paint'
import { unit } from '../sim/rng'

/** A pattern to paint over the plate. */
export interface Camo {
  /** Tells patterns apart, so one is made only once. */
  key: string
  /** Red, green, blue and 255 for every pixel, row by row. */
  pixels: Uint8Array
  sizePx: number
  /** How much plate the pattern covers before it repeats. */
  tileM: number
}

function rgb(colour: string): [number, number, number] {
  const n = parseInt(colour.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Smooth hills and hollows between a grid of random points. It wraps, so the left edge meets the right. */
function hills(sizePx: number, cells: number, seed: number): Float32Array {
  const out = new Float32Array(sizePx * sizePx)
  const at = (cx: number, cy: number): number => unit(seed, ((cx % cells) + cells) % cells, ((cy % cells) + cells) % cells)
  const ease = (t: number): number => t * t * (3 - 2 * t)
  for (let y = 0; y < sizePx; y++) {
    for (let x = 0; x < sizePx; x++) {
      const gx = (x / sizePx) * cells
      const gy = (y / sizePx) * cells
      const x0 = Math.floor(gx)
      const y0 = Math.floor(gy)
      const tx = ease(gx - x0)
      const ty = ease(gy - y0)
      const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx
      const low = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx
      out[y * sizePx + x] = top * (1 - ty) + low * ty
    }
  }
  return out
}

/**
 * The pixels of a scheme's pattern. The highest ground takes the first
 * patch colour, the next highest the second, and what is left stays the
 * body colour, so each patch covers the share the scheme asks for.
 */
export function camoPixels(scheme: PaintScheme, sizePx: number = CAMO.sizePx, seed: number = CAMO.seed): Uint8Array {
  const count = sizePx * sizePx
  const broad = hills(sizePx, CAMO.cells, seed)
  const fine = hills(sizePx, CAMO.detailCells, seed + 1)
  const height = new Float32Array(count)
  for (let i = 0; i < count; i++) height[i] = broad[i]! * (1 - CAMO.detailShare) + fine[i]! * CAMO.detailShare
  // Highest first: the order pixels are handed out in.
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => height[b]! - height[a]! || a - b)
  const pixels = new Uint8Array(count * 4)
  let next = 0
  const fillWith = (colour: string, howMany: number): void => {
    const [r, g, b] = rgb(colour)
    for (let n = 0; n < howMany && next < count; n++, next++) {
      const at = order[next]! * 4
      pixels[at] = r
      pixels[at + 1] = g
      pixels[at + 2] = b
      pixels[at + 3] = 255
    }
  }
  for (const patch of scheme.patches) fillWith(patch.colour, Math.round(patch.share * count))
  fillWith(scheme.body, count)
  return pixels
}

/** The pattern a paint scheme wears, or nothing when it is one flat colour. */
export function camoOf(paint: PaintId): Camo | undefined {
  const scheme = PAINT[paint]
  if (scheme.patches.length === 0) return undefined
  return { key: paint, pixels: camoPixels(scheme), sizePx: CAMO.sizePx, tileM: CAMO.tileM }
}

/**
 * Where on the pattern each corner of a triangle falls, two numbers to a
 * corner. A face is painted from whichever side it faces most squarely, so
 * the pattern is not smeared along the plates that run away from it.
 */
export function camoPlaces(corners: readonly number[], tileM: number): number[] {
  const out: number[] = []
  for (let i = 0; i + 8 < corners.length; i += 9) {
    const ux = corners[i + 3]! - corners[i]!, uy = corners[i + 4]! - corners[i + 1]!, uz = corners[i + 5]! - corners[i + 2]!
    const vx = corners[i + 6]! - corners[i]!, vy = corners[i + 7]! - corners[i + 1]!, vz = corners[i + 8]! - corners[i + 2]!
    const nx = Math.abs(uy * vz - uz * vy), ny = Math.abs(uz * vx - ux * vz), nz = Math.abs(ux * vy - uy * vx)
    for (let c = 0; c < 3; c++) {
      const x = corners[i + c * 3]!, y = corners[i + c * 3 + 1]!, z = corners[i + c * 3 + 2]!
      if (ny >= nx && ny >= nz) out.push(x / tileM, z / tileM)
      else if (nx >= nz) out.push(z / tileM, y / tileM)
      else out.push(x / tileM, y / tileM)
    }
  }
  return out
}
