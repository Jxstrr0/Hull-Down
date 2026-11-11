// The sim's only source of chance. A draw is named by whole numbers (a seed,
// then whatever says which draw it is) and the same name always gives the
// same number, so any trial can be run again and come out the same. Whole
// number maths only, so every device agrees.
import { detLog } from './det'

/** Mixes whole numbers into one 32-bit whole number. */
export function hash32(...parts: number[]): number {
  let h = 0x811c9dc5
  for (const part of parts) {
    let k = part | 0
    k = Math.imul(k, 0xcc9e2d51)
    k = (k << 15) | (k >>> 17)
    k = Math.imul(k, 0x1b873593)
    h ^= k
    h = (h << 13) | (h >>> 19)
    h = (Math.imul(h, 5) + 0xe6546b64) | 0
  }
  h ^= parts.length
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** A number between 0 and 1, never either end. */
export function unit(seed: number, ...key: number[]): number {
  return (hash32(seed, ...key) + 0.5) / 4294967296
}

/**
 * A wait of 1 on average, now and then much longer or shorter. The gap
 * between failures of a part is one of these.
 */
export function unitWait(seed: number, ...key: number[]): number {
  return -detLog(unit(seed, ...key))
}
