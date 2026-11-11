// A duel fought many times over, each with its own dice, and what the
// results add up to: how often the tank won, who shot first, and the few
// things that decided it, each pointing back at the part that would change
// it. Plain data; the words are put to it elsewhere.
import { DUEL, DUEL_GROUND_IDS, type DuelGround, type DuelGroundId } from '../../data/duel'
import { ZONES, type ZoneId } from '../../data/materials'
import { errorsOf, type Shoot } from '../gunnery/fire'
import { hash32 } from '../rng'
import { runDuel, type Combatant, type DuelEnd, type DuelResult, type SideNo } from './duel'

/** The design-office control a finding points back to. */
export type DuelFixPart =
  | 'gun' | 'barrel' | 'ammo.stowage' | 'protection.fireSuppression'
  | 'fireControl.sight' | 'fireControl.rangefinder' | 'fireControl.stabiliser' | 'fireControl.computer'
  | 'fireControl.night' | 'fireControl.commanderSight'
export type DuelFix = { zone: ZoneId } | { part: DuelFixPart }

export const DUEL_FINDING_KINDS = [
  // Against the tank under test.
  'outdrawn', 'neverFired', 'missing', 'bouncing', 'holed', 'magazine', 'burned',
  // For it.
  'shotFirst', 'armourHeld', 'gotThrough',
] as const
export type DuelFindingKind = (typeof DUEL_FINDING_KINDS)[number]

export interface DuelFinding {
  kind: DuelFindingKind
  /** True for something that went the tank's way. */
  good: boolean
  /** How much it mattered. The report names the heaviest. */
  weight: number
  /** How many times it happened, and out of how many. */
  count: number
  of: number
  /** The plate it is about, when it is about one. */
  zone?: ZoneId
  fix: DuelFix | null
  /** A duel that shows it, by its place in the series. */
  duelIndex: number
}

export interface SideTally {
  fired: number
  /** Rounds that struck the other tank, and those of them that got through. */
  hits: number
  through: number
  /** Rounds that struck the ridge the other tank sat behind. */
  berm: number
  /** Seconds to its first round, averaged over the duels it fired in. Null when it never fired. */
  firstShotS: number | null
}

export interface DuelSeries {
  ground: DuelGroundId
  duels: DuelResult[]
  won: number
  lost: number
  drawn: number
  /** Duels in which each tank got the first round off. */
  shotFirst: [number, number]
  /** How each kind of ending was shared out: duels won that way, and duels lost that way. */
  wonBy: Record<DuelEnd, number>
  lostBy: Record<DuelEnd, number>
  tally: [SideTally, SideTally]
  /** Where rounds got through the tank under test, the plate holed most first. */
  holes: { zone: ZoneId; count: number }[]
  /** The things that decided it, heaviest first. */
  findings: DuelFinding[]
}

function zeroEnds(): Record<DuelEnd, number> {
  return { destroyed: 0, burned: 0, silenced: 0, bothOut: 0, timeUp: 0, ammo: 0 }
}

/** What most slows this tank's first round: the control that would speed it up. */
function slowestPart(tank: Combatant, ground: DuelGround): DuelFixPart {
  if (ground.night) return 'fireControl.night'
  const t = tank.sheet.fire.times
  if (t.rangeS >= t.findS && t.rangeS >= t.layS) return 'fireControl.rangefinder'
  if (t.findS >= t.layS && !tank.sheet.target.spec.fireControl.commanderSight) return 'fireControl.commanderSight'
  return 'fireControl.sight'
}

/** What most throws this tank's rounds off: the control that would steady them. */
function wildestPart(tank: Combatant, ground: DuelGround, moving: boolean): DuelFixPart {
  if (ground.night) return 'fireControl.night'
  const round = tank.rounds[0]
  if (!round) return 'fireControl.sight'
  const shoot: Shoot = { moving, night: false, crew: DUEL.crew, hours: DUEL.crewHours }
  const e = errorsOf(tank.sheet.fire, round.flight, ground.rangeM, shoot)
  const parts: [DuelFixPart, number][] = [
    ['fireControl.sight', e.layM],
    ['barrel', e.scatterM],
    ['fireControl.computer', Math.max(e.driftAcrossM, e.driftUpM)],
    ['fireControl.rangefinder', e.rangingM],
    ['fireControl.stabiliser', Math.max(e.shakeAcrossM, e.shakeUpM)],
  ]
  let worst = parts[0]!
  for (const part of parts) if (part[1] > worst[1]) worst = part
  return worst[0]
}

/**
 * Fights the duel `count` times on one ground. The tank under test is `a`.
 * The same tanks, ground, seed and count always give the same series.
 */
export function runSeries(a: Combatant, b: Combatant, groundId: DuelGroundId, seed: number, count: number = DUEL.runs): DuelSeries {
  const ground: DuelGround = DUEL.grounds[groundId]
  const groundNo = DUEL_GROUND_IDS.indexOf(groundId)
  const duels: DuelResult[] = []
  for (let i = 0; i < count; i++) duels.push(runDuel(a, b, groundId, hash32(seed, groundNo, i)))

  const wonBy = zeroEnds()
  const lostBy = zeroEnds()
  const shotFirst: [number, number] = [0, 0]
  const sums = [0, 1].map(() => ({ fired: 0, hits: 0, through: 0, berm: 0, firstS: 0, firstN: 0 }))
  const holed = new Map<ZoneId, number>()
  let won = 0
  let lost = 0
  let neverFired = 0
  /** The first duel that shows each thing, to look at. */
  const shown: Partial<Record<DuelFindingKind, number>> = {}
  const show = (kind: DuelFindingKind, index: number): void => {
    if (shown[kind] === undefined) shown[kind] = index
  }
  const shownAt = new Map<ZoneId, number>()

  duels.forEach((duel, index) => {
    if (duel.winner === 0) {
      won++
      wonBy[duel.end]++
    } else if (duel.winner === 1) {
      lost++
      lostBy[duel.end]++
      if (duel.end === 'destroyed') show('magazine', index)
      if (duel.end === 'burned') show('burned', index)
      if (duel.sides[0].fired === 0) {
        neverFired++
        show('neverFired', index)
      }
    }
    if (duel.firstShotBy !== null) {
      shotFirst[duel.firstShotBy]++
      show(duel.firstShotBy === 0 ? 'shotFirst' : 'outdrawn', index)
    }
    for (const no of [0, 1] as const) {
      const side = duel.sides[no]
      const sum = sums[no]!
      sum.fired += side.fired
      sum.hits += side.hits
      sum.through += side.through
      if (side.firstShotS !== null) {
        sum.firstS += side.firstShotS
        sum.firstN++
      }
    }
    for (const shot of duel.shots) {
      if (shot.berm) sums[shot.by]!.berm++
      const hit = shot.hit
      if (shot.by === 0 && (!hit || (hit.zone === null && !hit.track))) show('missing', index)
      if (!hit || hit.zone === null) continue
      if (shot.by === 1 && hit.through) {
        holed.set(hit.zone, (holed.get(hit.zone) ?? 0) + 1)
        if (!shownAt.has(hit.zone)) shownAt.set(hit.zone, index)
      }
      if (shot.by === 1 && !hit.through) show('armourHeld', index)
      if (shot.by === 0) show(hit.through ? 'gotThrough' : 'bouncing', index)
    }
  })

  const tallyOf = (no: SideNo): SideTally => {
    const sum = sums[no]!
    return {
      fired: sum.fired, hits: sum.hits, through: sum.through, berm: sum.berm,
      firstShotS: sum.firstN > 0 ? sum.firstS / sum.firstN : null,
    }
  }
  const tally: [SideTally, SideTally] = [tallyOf(0), tallyOf(1)]
  const holes = ZONES.filter((zone) => holed.has(zone))
    .map((zone) => ({ zone, count: holed.get(zone) ?? 0 }))
    .sort((x, y) => y.count - x.count)

  // What decided it. Things against the tank weigh by how often it lost; things for it by how often it won.
  const k = DUEL.report
  const n = duels.length
  const drawn = n - won - lost
  const against = n > 0 ? (lost + drawn / 2) / n : 0
  const forIt = n > 0 ? (won + drawn / 2) / n : 0
  const findings: DuelFinding[] = []
  const add = (
    kind: DuelFindingKind, good: boolean, count: number, of: number, fix: DuelFix | null, duelIndex: number | undefined, zone?: ZoneId,
  ): void => {
    if (of <= 0) return
    findings.push({ kind, good, weight: (count / of) * (good ? forIt : against), count, of, zone, fix, duelIndex: duelIndex ?? 0 })
  }
  const [mine, theirs] = tally
  const share = (count: number, of: number): number => (of > 0 ? count / of : 0)
  const moving = ground.postures[0] === 'advancing'

  if (share(shotFirst[1], n) >= k.shotFirst) {
    add('outdrawn', false, shotFirst[1], n, { part: slowestPart(a, ground) }, shown.outdrawn)
  }
  if (share(shotFirst[0], n) >= k.shotFirst) add('shotFirst', true, shotFirst[0], n, null, shown.shotFirst)
  if (share(neverFired, n) >= k.neverFired) {
    add('neverFired', false, neverFired, n, { part: slowestPart(a, ground) }, shown.neverFired)
  }
  if (mine.fired >= k.fewest && theirs.fired >= k.fewest &&
    share(theirs.hits, theirs.fired - theirs.berm) - share(mine.hits, mine.fired - mine.berm) >= k.missingBy) {
    add('missing', false, mine.fired - mine.hits, mine.fired, { part: wildestPart(a, ground, moving) }, shown.missing)
  }
  if (mine.hits >= k.fewest) {
    const wasted = mine.hits - mine.through
    if (share(wasted, mine.hits) >= k.bounced) add('bouncing', false, wasted, mine.hits, { part: 'gun' }, shown.bouncing)
    if (share(mine.through, mine.hits) >= k.gotThrough) add('gotThrough', true, mine.through, mine.hits, null, shown.gotThrough)
  }
  if (theirs.hits >= k.fewest) {
    const held = theirs.hits - theirs.through
    if (share(held, theirs.hits) >= k.bounced) add('armourHeld', true, held, theirs.hits, null, shown.armourHeld)
  }
  const worst = holes[0]
  if (worst && theirs.through >= k.fewest && share(worst.count, theirs.through) >= k.onePlate) {
    add('holed', false, worst.count, theirs.through, { zone: worst.zone }, shownAt.get(worst.zone), worst.zone)
  }
  if (lost > 0 && share(lostBy.destroyed, lost) >= k.magazine) {
    add('magazine', false, lostBy.destroyed, lost, { part: 'ammo.stowage' }, shown.magazine)
  }
  if (lost > 0 && share(lostBy.burned, lost) >= k.burned) {
    add('burned', false, lostBy.burned, lost, { part: 'protection.fireSuppression' }, shown.burned)
  }
  findings.sort((x, y) => y.weight - x.weight)

  return {
    ground: groundId, duels, won, lost, drawn, shotFirst, wonBy, lostBy, tally, holes,
    findings: findings.slice(0, k.findings),
  }
}

/** The whole card against one opponent: every ground, in order. */
export function runCard(a: Combatant, b: Combatant, seed: number, count: number = DUEL.runs): DuelSeries[] {
  return DUEL_GROUND_IDS.map((ground) => runSeries(a, b, ground, seed, count))
}
