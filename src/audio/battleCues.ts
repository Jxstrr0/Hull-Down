// What a battle sounds like from beside the tank the camera is with: which
// guns went off and which rounds landed between two pictures, how each
// landed, and how far away it was. Plain numbers, so it can be tested.
import { AUDIO, type CueId } from '../data/audio'
import { BATTLE } from '../data/battle'
import type { BattleResult, BattleShot } from '../sim/battle/battle'
import { momentOf } from '../ui/battleReplay'

export interface BattleCue {
  id: CueId
  /** Set for a gun: the calibre that fired. */
  calibreMm?: number
  /** Loudness for how far off it was, 0 to 1. */
  gain: number
}

/** The sound of a round arriving: in the ridge, past the tank, off the plate, stopped by it, or through it. */
export function battleStrikeOf(shot: BattleShot): CueId {
  if (shot.berm) return 'short'
  const hit = shot.hit
  if (!hit || (hit.entry === null && !hit.track)) return 'miss'
  if (hit.through) return 'pierce'
  return hit.armour?.ricochet ? 'ricochet' : 'held'
}

/** How loud something is from this far away. */
export function loudnessAt(distM: number): number {
  const B = AUDIO.battle
  return Math.max(B.floorGain, B.halfM / (B.halfM + Math.max(0, distM)))
}

/** How fast a tank is going at a moment, km/h. Nought once it is out of the fight. */
export function battleSpeedKmh(battle: BattleResult, tank: number, atS: number): number {
  const out = battle.tanks[tank]?.outS
  if (out !== null && out !== undefined && atS >= out) return 0
  const before = momentOf(battle, atS - BATTLE.trackS).tanks[tank]
  const now = momentOf(battle, atS).tanks[tank]
  if (!before || !now || atS < BATTLE.trackS) return 0
  return (Math.hypot(now.x - before.x, now.y - before.y) / BATTLE.trackS) * 3.6
}

/**
 * Every short sound of the battle after `fromS` and up to `toS`, heard from
 * beside tank `ear`. `calibres` is the gun of each side. The loudest come
 * first, and only so many are given: a salvo is a few bangs, not a wall.
 */
export function battleCuesBetween(battle: BattleResult, fromS: number, toS: number, ear: number, calibres: readonly [number, number]): BattleCue[] {
  if (!(toS > fromS) || toS - fromS > AUDIO.battle.jumpS) return []
  const cues: BattleCue[] = []
  const away = (atS: number, tank: number): number => {
    const tanks = momentOf(battle, atS).tanks
    const here = tanks[ear]
    const there = tanks[tank]
    return here && there ? Math.hypot(there.x - here.x, there.y - here.y) : 0
  }
  for (const shot of battle.shots) {
    if (shot.atS > toS) break
    if (shot.atS > fromS) {
      const side = battle.tanks[shot.by]?.side ?? 0
      cues.push({ id: 'gun', calibreMm: calibres[side], gain: loudnessAt(away(shot.atS, shot.by)) })
    }
    if (shot.landS > fromS && shot.landS <= toS) cues.push({ id: battleStrikeOf(shot), gain: loudnessAt(away(shot.landS, shot.at)) })
  }
  return cues.sort((a, b) => b.gain - a.gain).slice(0, AUDIO.battle.mostAtOnce)
}
