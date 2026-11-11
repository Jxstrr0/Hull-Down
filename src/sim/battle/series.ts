// A platoon battle fought many times over, each with its own dice, and what
// the results add up to: battles won, tanks lost for tanks knocked out,
// rounds used, breakdowns, and the few things that decided it, each pointing
// back at the part that would change it. Plain data; the words are put to
// it elsewhere.
import { BATTLE, BATTLE_GROUND_IDS, type BattleGroundId, type Orders } from '../../data/battle'
import type { CrewId } from '../../data/gunnery'
import { ZONES, type ZoneId } from '../../data/materials'
import type { Combatant, SideNo } from '../duel/duel'
import { slowestPart, wildestPart, type DuelFixPart } from '../duel/series'
import { hash32 } from '../rng'
import { runBattle, type BattleEnd, type BattleResult } from './battle'

/** The design-office control a finding points back to. */
export type BattleFixPart =
  | DuelFixPart | 'powerpack.transmission' | 'powerpack.cooling' | 'runningGear.suspension' | 'runningGear.trackWidthMm'
export type BattleFix = { zone: ZoneId } | { part: BattleFixPart }

export const BATTLE_FINDING_KINDS = [
  // Against the platoon under test.
  'outdrawn', 'missing', 'bouncing', 'holed', 'flanked', 'magazine', 'burned', 'brokeDown',
  // For it.
  'shotFirst', 'armourHeld', 'gotThrough', 'fewLost',
] as const
export type BattleFindingKind = (typeof BATTLE_FINDING_KINDS)[number]

export interface BattleFinding {
  kind: BattleFindingKind
  /** True for something that went the platoon's way. */
  good: boolean
  /** How much it mattered. The report names the heaviest. */
  weight: number
  /** How many times it happened, and out of how many. */
  count: number
  of: number
  /** The plate it is about, when it is about one. */
  zone?: ZoneId
  fix: BattleFix | null
  /** A battle that shows it, by its place in the series. */
  battleIndex: number
}

export interface PlatoonTally {
  /** Tanks sent into all the battles, and those put out of the fight. */
  tanks: number
  lost: number
  /** Of those lost, the ones that blew up and the ones that burned. */
  destroyed: number
  burned: number
  brokeDown: number
  fired: number
  /** Rounds that struck a tank, and those of them that got through. */
  hits: number
  through: number
  /** Rounds that struck a ridge or the ground short of the target. */
  berm: number
}

export interface BattleSeries {
  ground: BattleGroundId
  orders: Orders
  battles: BattleResult[]
  won: number
  lost: number
  drawn: number
  /** Battles in which each platoon got the first round off. */
  shotFirst: [number, number]
  /** How each kind of ending was shared out: battles won that way, and battles lost that way. */
  wonBy: Record<BattleEnd, number>
  lostBy: Record<BattleEnd, number>
  tally: [PlatoonTally, PlatoonTally]
  /** Where rounds got through the platoon's tanks, the plate holed most first. */
  holes: { zone: ZoneId; count: number }[]
  /** The things that decided it, heaviest first. */
  findings: BattleFinding[]
}

function zeroEnds(): Record<BattleEnd, number> {
  return { wiped: 0, bothOut: 0, held: 0, points: 0, draw: 0 }
}

function zeroTally(): PlatoonTally {
  return { tanks: 0, lost: 0, destroyed: 0, burned: 0, brokeDown: 0, fired: 0, hits: 0, through: 0, berm: 0 }
}

/** The part working hardest for what it is rated to carry: the one most likely to have given out. */
function weakestPart(tank: Combatant): BattleFixPart {
  const s = tank.sheet.stress
  const parts: [BattleFixPart, number][] = [
    ['powerpack.transmission', s.transmission],
    ['runningGear.suspension', s.suspension],
    ['powerpack.cooling', s.cooling],
    ['runningGear.trackWidthMm', s.tracks],
  ]
  let worst = parts[0]!
  for (const part of parts) if (part[1] > worst[1]) worst = part
  return worst[0]
}

const SIDE_ZONES: readonly ZoneId[] = ['hullSideFront', 'hullSideRear', 'turretSides']

/**
 * Fights the battle `count` times on one ground. The platoon under test is
 * all `mine`. The same tanks, ground, orders, seed and count always give the
 * same series.
 */
export function runBattleSeries(
  mine: Combatant, theirs: Combatant, groundId: BattleGroundId, orders: Orders, seed: number, count: number = BATTLE.runs,
  crews?: readonly [CrewId, CrewId],
): BattleSeries {
  const ground = BATTLE.grounds[groundId]
  const groundNo = BATTLE_GROUND_IDS.indexOf(groundId)
  const battles: BattleResult[] = []
  for (let i = 0; i < count; i++) battles.push(runBattle(mine, theirs, groundId, orders, hash32(seed, groundNo, i), crews))

  const wonBy = zeroEnds()
  const lostBy = zeroEnds()
  const shotFirst: [number, number] = [0, 0]
  const tally: [PlatoonTally, PlatoonTally] = [zeroTally(), zeroTally()]
  const holed = new Map<ZoneId, number>()
  const flankHoled = new Map<ZoneId, number>()
  let flankHoles = 0
  let won = 0
  let lost = 0
  let myRanges = 0
  /** The first battle that shows each thing, to look at. */
  const shown: Partial<Record<BattleFindingKind, number>> = {}
  const show = (kind: BattleFindingKind, index: number): void => {
    if (shown[kind] === undefined) shown[kind] = index
  }
  const shownAt = new Map<ZoneId, number>()

  battles.forEach((battle, index) => {
    if (battle.winner === 0) {
      won++
      wonBy[battle.end]++
    } else if (battle.winner === 1) {
      lost++
      lostBy[battle.end]++
    }
    if (battle.firstShotBy !== null) {
      shotFirst[battle.firstShotBy]++
      show(battle.firstShotBy === 0 ? 'shotFirst' : 'outdrawn', index)
    }
    for (const tank of battle.tanks) {
      const sum = tally[tank.side]
      sum.tanks++
      sum.fired += tank.fired
      sum.hits += tank.hits
      sum.through += tank.through
      if (tank.brokeDown) {
        sum.brokeDown++
        if (tank.side === 0) show('brokeDown', index)
      }
      if (tank.outS === null) continue
      sum.lost++
      if (tank.cause === 'destroyed') {
        sum.destroyed++
        if (tank.side === 0) show('magazine', index)
      }
      if (tank.cause === 'burned') {
        sum.burned++
        if (tank.side === 0) show('burned', index)
      }
    }
    if (battle.started[0] - battle.fighting[0] === 0 && battle.winner === 0) show('fewLost', index)
    for (const shot of battle.shots) {
      const by: SideNo = battle.tanks[shot.by]?.side ?? 0
      if (shot.berm) tally[by].berm++
      if (by === 0) myRanges += shot.rangeM
      const hit = shot.hit
      if (by === 0 && (!hit || (hit.zone === null && !hit.track))) show('missing', index)
      if (!hit || hit.zone === null) continue
      if (by === 1 && hit.through) {
        holed.set(hit.zone, (holed.get(hit.zone) ?? 0) + 1)
        if (!shownAt.has(hit.zone)) shownAt.set(hit.zone, index)
        if (Math.abs(shot.bearingDeg) >= BATTLE.report.flankDeg) {
          flankHoles++
          flankHoled.set(hit.zone, (flankHoled.get(hit.zone) ?? 0) + 1)
          show('flanked', index)
        }
      }
      if (by === 1 && !hit.through) show('armourHeld', index)
      if (by === 0) show(hit.through ? 'gotThrough' : 'bouncing', index)
    }
  })

  const holes = ZONES.filter((zone) => holed.has(zone))
    .map((zone) => ({ zone, count: holed.get(zone) ?? 0 }))
    .sort((x, y) => y.count - x.count)

  // What decided it. Things against the platoon weigh by how often it lost; things for it by how often it won.
  const k = BATTLE.report
  const n = battles.length
  const drawn = n - won - lost
  const against = n > 0 ? (lost + drawn / 2) / n : 0
  const forIt = n > 0 ? (won + drawn / 2) / n : 0
  const findings: BattleFinding[] = []
  const add = (
    kind: BattleFindingKind, good: boolean, count: number, of: number, fix: BattleFix | null, zone?: ZoneId,
  ): void => {
    if (of <= 0) return
    findings.push({
      kind, good, weight: (count / of) * (good ? forIt : against), count, of, zone, fix, battleIndex: shown[kind] ?? 0,
    })
  }
  const [me, them] = tally
  const share = (count: number, of: number): number => (of > 0 ? count / of : 0)
  const moving = ground.platoons[0].role === 'attack' && orders.pace === 'fast'
  const typical = { night: ground.night, rangeM: me.fired > 0 ? myRanges / me.fired : 1500 }

  if (share(shotFirst[1], n) >= k.shotFirst) add('outdrawn', false, shotFirst[1], n, { part: slowestPart(mine, typical) })
  if (share(shotFirst[0], n) >= k.shotFirst) add('shotFirst', true, shotFirst[0], n, null)
  if (me.fired >= k.fewest && them.fired >= k.fewest &&
    share(them.hits, them.fired - them.berm) - share(me.hits, me.fired - me.berm) >= k.missingBy) {
    add('missing', false, me.fired - me.hits, me.fired, { part: wildestPart(mine, typical, moving) })
  }
  if (me.hits >= k.fewest) {
    const wasted = me.hits - me.through
    if (share(wasted, me.hits) >= k.bounced) add('bouncing', false, wasted, me.hits, { part: 'gun' })
    if (share(me.through, me.hits) >= k.gotThrough) add('gotThrough', true, me.through, me.hits, null)
  }
  if (them.hits >= k.fewest) {
    const held = them.hits - them.through
    if (share(held, them.hits) >= k.bounced) add('armourHeld', true, held, them.hits, null)
  }
  const worst = holes[0]
  if (them.through >= k.fewest && share(flankHoles, them.through) >= k.flanked) {
    // The side plate that let most of them in.
    let plate: ZoneId = 'hullSideFront'
    let most = -1
    for (const zone of SIDE_ZONES) {
      const times = flankHoled.get(zone) ?? 0
      if (times > most) {
        plate = zone
        most = times
      }
    }
    add('flanked', false, flankHoles, them.through, { zone: plate }, plate)
  } else if (worst && them.through >= k.fewest && share(worst.count, them.through) >= k.onePlate) {
    findings.push({
      kind: 'holed', good: false, weight: share(worst.count, them.through) * against, count: worst.count,
      of: them.through, zone: worst.zone, fix: { zone: worst.zone }, battleIndex: shownAt.get(worst.zone) ?? 0,
    })
  }
  if (me.lost > 0 && share(me.destroyed, me.lost) >= k.magazine) {
    add('magazine', false, me.destroyed, me.lost, { part: 'ammo.stowage' })
  }
  if (me.lost > 0 && share(me.burned, me.lost) >= k.burned) {
    add('burned', false, me.burned, me.lost, { part: 'protection.fireSuppression' })
  }
  if (share(me.brokeDown, me.tanks) >= k.brokeDown) add('brokeDown', false, me.brokeDown, me.tanks, { part: weakestPart(mine) })
  if (won > lost && share(me.lost, me.tanks) <= k.fewLost) add('fewLost', true, me.tanks - me.lost, me.tanks, null)
  findings.sort((x, y) => y.weight - x.weight)

  return {
    ground: groundId, orders, battles, won, lost, drawn, shotFirst, wonBy, lostBy, tally, holes,
    findings: findings.slice(0, k.findings),
  }
}
