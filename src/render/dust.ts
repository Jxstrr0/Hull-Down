// Dust behind a moving tank, and mud flung up in the course's pit: puffs left
// where the back of each track was, that swell, rise and shrink away. This
// works out when and how big; the Dust pool in rangeScene.ts draws them.
import { RENDER } from '../data/render'

const K = RENDER.dust
export type DustKind = keyof typeof K.kinds

/** A puff `ageS` into its life: how far it has risen and how wide it is, or null once it is gone (or not yet born). */
export function dustAt(ageS: number, kind: DustKind): { riseM: number; sizeM: number } | null {
  if (ageS < 0 || ageS >= K.lifeS) return null
  const k = K.kinds[kind]
  const life = ageS / K.lifeS
  const swell = K.fromM + (K.toM - K.fromM) * Math.sqrt(life)
  const fade = Math.min(1, (1 - life) / K.fadeShare)
  return { riseM: K.riseM * k.rise * life, sizeM: swell * k.size * fade }
}

/**
 * How many puffs a tank throws for going on to `distanceM`: one every `everyM`,
 * no more than a few a picture. Going back (a seek) starts it afresh.
 */
export class DustTrail {
  private lastM: number | null = null
  private owedM = 0

  due(distanceM: number, kind: DustKind): number {
    const moved = this.lastM === null ? 0 : distanceM - this.lastM
    this.lastM = distanceM
    if (moved < 0) {
      this.owedM = 0
      return 0
    }
    this.owedM += moved
    const every = K.kinds[kind].everyM
    const puffs = Math.floor(this.owedM / every)
    this.owedM -= puffs * every
    if (puffs > K.mostPerFrame) this.owedM = 0
    return Math.min(puffs, K.mostPerFrame)
  }
}
