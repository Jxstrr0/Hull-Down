// The test shot, followed on behind the armour, in words: what the round
// reaches in order, what the fragments reach, and what it all adds up to.
import { HITS } from '../data/hits'
import { STRINGS, fill } from '../data/strings'
import type { HitResult, Reached, VehicleSpec } from '../sim/vehicle'
import { fixed } from '../ui/format'

const B = STRINGS.office.armour.behind
const NAMES = STRINGS.dataSheet.stations.names

export interface BehindRow {
  name: string
  value: string
  /** True for the row a player should not miss: someone out of action, or a chance of losing the tank. */
  grave: boolean
}

export interface Behind {
  rows: BehindRow[]
  /** Sentences under the list: fragments, the protection systems, and the sum of it. */
  notes: string[]
  sum: string
}

const pct = (chance: number): string => fixed(chance * 100, 0)

function rowFor(each: Reached): BehindRow {
  const name = B.items[each.id]
  const chance = each.chance
  if (each.effect === 'crew') return { name, value: B.crewOut, grave: true }
  if (each.effect === 'binHeld') return { name, value: B.binHeld, grave: false }
  if (each.kind === 'ammo' || each.kind === 'autoloader') {
    const wrecked = each.kind === 'autoloader'
    if (chance === null) return { name, value: wrecked ? B.wrecked : B.holed, grave: false }
    const then = fill(each.vented ? B.vents : B.explodes, { pct: pct(chance) })
    return { name, value: wrecked ? fill(B.wreckedAnd, { then }) : then, grave: !each.vented }
  }
  if (each.kind === 'fuel' || each.kind === 'engine') {
    const then = fill(B.burns, { pct: pct(chance ?? 0) })
    return { name, value: fill(each.kind === 'engine' ? B.wreckedAnd : B.holedAnd, { then }), grave: false }
  }
  return { name, value: B.wrecked, grave: false }
}

function listOf(words: string[]): string {
  if (words.length <= 1) return words.join('')
  return words.slice(0, -1).join(', ') + B.and + words[words.length - 1]!
}

/** Nothing when the round never got through the armour. */
export function behindOf(result: HitResult, spec: VehicleSpec, crewCount: number): Behind | null {
  if (!result.through) return null
  const rows = result.reached.map(rowFor)
  const held = result.reached.some((each) => each.effect === 'binHeld')
  if (!held) rows.push({ name: B.round, value: result.exits ? B.exits : B.stops, grave: false })

  const notes: string[] = []
  if (result.spalled.length > 0) {
    notes.push(fill(B.fragments, { list: listOf(result.spalled.map((station) => NAMES[station].toLowerCase())) }))
  }
  // A liner is worth a word when it is doing its work, or when someone was caught without one.
  if (spec.protection.spallLiner) notes.push(B.linerFitted)
  else if (result.spalled.length > 0) notes.push(B.linerMissing)
  const mayBurn = result.reached.some((each) => each.kind === 'fuel' || each.kind === 'engine')
  if (mayBurn) {
    notes.push(spec.protection.fireSuppression ? fill(B.suppressionFitted, { pct: pct(HITS.suppression) }) : B.suppressionMissing)
  }
  const mayExplode = result.reached.some((each) =>
    (each.kind === 'ammo' || each.kind === 'autoloader') && each.chance !== null && !each.vented)
  if (mayExplode) notes.push(B.explosionNote)

  const parts: string[] = []
  if (result.crewOut.length > 0) parts.push(fill(B.sumCrew, { n: String(result.crewOut.length), of: String(crewCount) }))
  if (result.firepowerKill) parts.push(B.sumGun)
  if (result.mobilityKill) parts.push(B.sumMove)
  const sum = parts.length > 0 ? fill(B.sum, { list: listOf(parts) }) : B.sumNothing
  return { rows, notes, sum }
}
