// Who the camera is with during a battle, and where it stands. No three.js
// here: plain sums on the battle the sim has already fought, so it can be
// tested. The director stays with one of your tanks, goes to another when
// that one is about to fire or be hit, and stands by any tank that is being
// put out of the fight.
import { RENDER } from '../data/render'
import type { BattleResult } from '../sim/battle/battle'

/** `chase`: behind a tank, looking along its gun. `close`: standing beside one. */
export type Look = 'chase' | 'close'

export interface Cut {
  fromS: number
  tank: number
  look: Look
}

function fightsAt(battle: BattleResult, tank: number, atS: number): boolean {
  const outS = battle.tanks[tank]?.outS ?? null
  return outS === null || outS > atS
}

/** The first of your tanks still fighting at a moment, starting the search from one of them. */
function mineStanding(battle: BattleResult, atS: number, from: number): number | null {
  const mine = battle.tanks.map((tank, index) => ({ tank, index })).filter(({ tank }) => tank.side === 0)
  for (let i = 0; i < mine.length; i++) {
    const pick = mine[(from + i) % mine.length]
    if (pick && fightsAt(battle, pick.index, atS)) return pick.index
  }
  return null
}

/** The cuts of the whole battle, in order. The first starts at nought. */
export function directorCuts(battle: BattleResult): Cut[] {
  const k = RENDER.battle
  interface Want { atS: number; tank: number; look: Look }
  const wants: Want[] = []
  for (const shot of battle.shots) {
    if (battle.tanks[shot.by]?.side === 0) wants.push({ atS: shot.atS - k.leadS, tank: shot.by, look: 'chase' })
    const hit = shot.hit
    if (battle.tanks[shot.at]?.side === 0 && hit && (hit.zone !== null || hit.track)) {
      wants.push({ atS: shot.landS - k.leadS, tank: shot.at, look: 'chase' })
    }
  }
  battle.tanks.forEach((tank, index) => {
    if (tank.outS !== null) wants.push({ atS: tank.outS - k.close.leadS, tank: index, look: 'close' })
  })
  wants.sort((a, b) => a.atS - b.atS)

  const firstToFire = battle.shots.find((shot) => battle.tanks[shot.by]?.side === 0)?.by
  let chasing = firstToFire ?? mineStanding(battle, 0, 0) ?? 0
  const cuts: Cut[] = [{ fromS: 0, tank: chasing, look: 'chase' }]
  let chaseSinceS = 0
  /** While the camera stands by a tank, and the cut that takes it away again. */
  let heldUntilS = 0
  let comeBack: Cut | null = null

  for (const want of wants) {
    const atS = Math.max(0, want.atS)
    if (want.look === 'close') {
      // A second tank going while the camera is standing by the first: it goes straight over.
      if (comeBack) cuts.splice(cuts.indexOf(comeBack), 1)
      cuts.push({ fromS: Math.max(atS, cuts[cuts.length - 1]?.fromS ?? 0), tank: want.tank, look: 'close' })
      heldUntilS = atS + k.close.leadS + k.close.holdS
      const next = mineStanding(battle, heldUntilS, chasing)
      comeBack = next === null ? null : { fromS: heldUntilS, tank: next, look: 'chase' }
      if (comeBack) {
        cuts.push(comeBack)
        chasing = comeBack.tank
        chaseSinceS = heldUntilS
      }
      continue
    }
    if (atS < heldUntilS || want.tank === chasing || atS - chaseSinceS < k.minCutS) continue
    if (!fightsAt(battle, want.tank, atS + k.leadS)) continue
    cuts.push({ fromS: atS, tank: want.tank, look: 'chase' })
    chasing = want.tank
    chaseSinceS = atS
    comeBack = null
  }
  return cuts.filter((cut) => cut.fromS <= battle.endS)
}

/** The cut the battle is in at a moment. */
export function cutAt(cuts: readonly Cut[], atS: number): Cut {
  let now = cuts[0] ?? { fromS: 0, tank: 0, look: 'chase' as Look }
  for (const cut of cuts) {
    if (cut.fromS > atS) break
    now = cut
  }
  return now
}

/**
 * The tank a tank's gun is on at a moment: the one it fires at next, or the
 * one it last fired at. Null when it never fires.
 */
export function aimOf(battle: BattleResult, tank: number, atS: number): number | null {
  let last: number | null = null
  for (const shot of battle.shots) {
    if (shot.by !== tank) continue
    if (shot.atS >= atS) return shot.at
    last = shot.at
  }
  return last
}

/** A point on the ground and a height over it, metres. x across the ground, y up it. */
export interface Spot {
  x: number
  y: number
  up: number
}

/** Where the camera stands and what it looks at, for a tank at a place with its gun laid a given way. */
export function cameraFor(look: Look, place: { x: number; y: number }, gunDeg: number): { from: Spot; to: Spot } {
  const k = RENDER.battle
  const r = (gunDeg * Math.PI) / 180
  const ahead = { x: Math.sin(r), y: Math.cos(r) }
  if (look === 'chase') {
    return {
      from: { x: place.x - ahead.x * k.chase.backM, y: place.y - ahead.y * k.chase.backM, up: k.chase.upM },
      to: { x: place.x + ahead.x * k.chase.aheadM, y: place.y + ahead.y * k.chase.aheadM, up: k.chase.lookUpM },
    }
  }
  // Off to the tank's right and a little ahead of it, looking back at it.
  const right = { x: ahead.y, y: -ahead.x }
  return {
    from: {
      x: place.x + (right.x * 0.85 + ahead.x * 0.5) * k.close.awayM,
      y: place.y + (right.y * 0.85 + ahead.y * 0.5) * k.close.awayM,
      up: k.close.upM,
    },
    to: { x: place.x, y: place.y, up: k.chase.lookUpM },
  }
}
