// A battle at one moment, for the map: where each tank is, which way it
// faces, what state it is in, and the rounds in the air. No DOM here, so it
// can be tested.
import { BATTLE } from '../data/battle'
import { DUEL } from '../data/duel'
import type { BattleResult } from '../sim/battle/battle'
import type { SideNo } from '../sim/duel/duel'

/** How a tank stands at a moment: fighting, hidden in its own smoke, or out of the fight. */
export type TankState = 'fighting' | 'smoke' | 'out'

export interface TankAt {
  side: SideNo
  no: number
  x: number
  y: number
  headingDeg: number
  state: TankState
}

export interface RoundAt {
  by: number
  /** Where it was fired from and where it is going. */
  fromX: number
  fromY: number
  toX: number
  toY: number
  /** How far along it is, 0..1. */
  along: number
}

export interface BattleMoment {
  atS: number
  tanks: TankAt[]
  rounds: RoundAt[]
}

/** The shortest way round from one heading to another, degrees. */
function turn(from: number, to: number): number {
  let d = (to - from) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

function placeAt(track: readonly number[], atS: number): { x: number; y: number; headingDeg: number } {
  const samples = Math.floor(track.length / 3)
  if (samples === 0) return { x: 0, y: 0, headingDeg: 0 }
  const at = Math.max(0, Math.min(samples - 1, atS / BATTLE.trackS))
  const i = Math.min(samples - 1, Math.floor(at))
  const j = Math.min(samples - 1, i + 1)
  const part = at - i
  const ax = track[i * 3] ?? 0
  const ay = track[i * 3 + 1] ?? 0
  const ah = track[i * 3 + 2] ?? 0
  const bx = track[j * 3] ?? ax
  const by = track[j * 3 + 1] ?? ay
  const bh = track[j * 3 + 2] ?? ah
  return { x: ax + (bx - ax) * part, y: ay + (by - ay) * part, headingDeg: ah + turn(ah, bh) * part }
}

/** The battle as it stood `atS` seconds in. */
export function momentOf(battle: BattleResult, atS: number): BattleMoment {
  const t = Math.max(0, Math.min(battle.endS, atS))
  const tanks: TankAt[] = battle.tanks.map((tank, index) => {
    const place = placeAt(battle.tracks[index] ?? [], t)
    const out = tank.outS !== null && t >= tank.outS
    const smoked = tank.smokeS !== null && t >= tank.smokeS && t < tank.smokeS + DUEL.smoke.blindS
    return { side: tank.side, no: tank.no, ...place, state: out ? 'out' : smoked ? 'smoke' : 'fighting' }
  })
  const rounds: RoundAt[] = []
  for (const shot of battle.shots) {
    if (shot.atS > t) break
    if (shot.landS < t) continue
    const from = placeAt(battle.tracks[shot.by] ?? [], shot.atS)
    const to = placeAt(battle.tracks[shot.at] ?? [], shot.landS)
    rounds.push({
      by: shot.by, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y,
      along: shot.landS > shot.atS ? (t - shot.atS) / (shot.landS - shot.atS) : 1,
    })
  }
  return { atS: t, tanks, rounds }
}
