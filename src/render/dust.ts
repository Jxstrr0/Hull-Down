// Dust behind a moving tank, and mud flung up in the course's pit: puffs left
// where the back of each track was, that swell, rise and shrink away. This
// works out when and how big; the Dust pool in rangeScene.ts draws them.
import { RENDER } from '../data/render'

const K = RENDER.dust
export type DustKind = keyof typeof K.kinds

/** How a puff looks: its colour, and how big and how high it goes against the plain earth puff. */
export interface PuffLook {
  colour: string
  size: number
  rise: number
}

/** A puff `ageS` into its life: how far it has risen and how wide it is, or null once it is gone (or not yet born). */
export function dustAt(ageS: number, k: PuffLook): { riseM: number; sizeM: number } | null {
  if (ageS < 0 || ageS >= K.lifeS) return null
  const life = ageS / K.lifeS
  const swell = K.fromM + (K.toM - K.fromM) * Math.sqrt(life)
  const fade = Math.min(1, (1 - life) / K.fadeShare)
  return { riseM: K.riseM * k.rise * life, sizeM: swell * k.size * fade }
}

/**
 * How many puffs are due for getting on to `at` (metres driven, or seconds
 * gone): one every `every`, no more than a few a picture. Going back (a seek)
 * starts it afresh.
 */
export class DustTrail {
  private lastM: number | null = null
  private owedM = 0

  due(at: number, every: number): number {
    const moved = this.lastM === null ? 0 : at - this.lastM
    this.lastM = at
    if (moved < 0) {
      this.owedM = 0
      return 0
    }
    this.owedM += moved
    const puffs = Math.floor(this.owedM / every)
    this.owedM -= puffs * every
    if (puffs > K.mostPerFrame) this.owedM = 0
    return Math.min(puffs, K.mostPerFrame)
  }
}

/** Where each puff of a muzzle blast starts, and which way it is blown: evenly round a ring, outward. */
export function blastRing(): { x: number; z: number; driftX: number; driftZ: number }[] {
  const b = K.blast
  return Array.from({ length: b.puffs }, (_, i) => {
    const turn = (i / b.puffs) * 2 * Math.PI
    const x = Math.cos(turn)
    const z = Math.sin(turn)
    return { x: (x * b.ringM) / 2, z: (z * b.ringM) / 2, driftX: x * b.driftM, driftZ: z * b.driftM }
  })
}

/**
 * Whether the gun has just fired, given how long since it last fired now and
 * at the last picture: it fired if that time went back, or there was none.
 */
export function justFired(sinceS: number | null, before: number | null): boolean {
  return sinceS !== null && (before === null || sinceS < before)
}
