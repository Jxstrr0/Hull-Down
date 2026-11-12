// Smoke rising off a tank put out of the fight: a column of puffs, each born
// at the wreck, swelling and rising as the wind leans it over, then thinning
// away. Worked out from how long the tank has been out, so winding the replay
// back or on shows the same column. Pure: no three.js here.
import { RENDER } from '../data/render'

/** A puff of the column now: which slot of the wreck's few it takes, how far it has risen, leant over and swelled. */
export interface WreckPuff {
  slot: number
  riseM: number
  /** How far along the wind it has gone, metres, and how far it sways off that across the wind. */
  downM: number
  swayM: number
  sizeM: number
  /** How far it has rolled over as it rises, radians, so no two puffs show the same face. */
  turnRad: number
}

/** The column `sinceS` seconds of watching after the tank was put out: every puff alive now, the newest first. */
export function wreckPuffs(sinceS: number): WreckPuff[] {
  const k = RENDER.battle.wreckSmoke
  if (sinceS < 0) return []
  const newest = Math.floor(sinceS / k.everyS)
  const puffs: WreckPuff[] = []
  for (let n = newest; n >= 0 && n > newest - k.puffs; n--) {
    const ageS = sinceS - n * k.everyS
    if (ageS >= k.lifeS) break
    const life = ageS / k.lifeS
    // A number from -1 to 1 for each puff, the same every time.
    const jitter = (((Math.sin((n + 1) * 12.9898) * 43758.5453) % 1) + 1) % 1 * 2 - 1
    const fade = Math.min(1, (1 - life) / k.fadeShare)
    puffs.push({
      slot: n % k.puffs,
      riseM: k.riseM * life,
      downM: k.driftM * life * life,
      swayM: k.swayM * jitter * life,
      turnRad: (n * 2.4 + life * k.rollRad * jitter) % (2 * Math.PI),
      sizeM: (k.fromM + (k.toM - k.fromM) * Math.sqrt(life)) * (1 + 0.2 * jitter) * fade,
    })
  }
  return puffs
}
