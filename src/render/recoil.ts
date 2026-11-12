// How far back the gun is after it fires: a share from nought (run out) to
// one (right back). The barrel is moved in the shader; see Kit.muddy.
import { RENDER } from '../data/render'

const K = RENDER.tank.recoil

/** `sinceS` watched seconds after the gun fired (null if it has not): a quick kick back, then a smooth run out. */
export function recoilAt(sinceS: number | null): number {
  if (sinceS === null || sinceS < 0) return 0
  if (sinceS < K.backS) return sinceS / K.backS
  const out = (sinceS - K.backS) / K.returnS
  if (out >= 1) return 0
  return 1 - out * out * (3 - 2 * out)
}

/** How far a gun this long slides back at the kick, metres. */
export function kickM(gunLengthM: number): number {
  return Math.min(K.mostM, gunLengthM * K.kickShare)
}
