// The words for a battle report: the grounds, what the two orders mean on
// each, what each finding says, and one battle told as it happened. No DOM
// here, so it can be tested.
import { BATTLE, PACE_ORDERS, RANGE_ORDERS, type BattleGroundId, type PaceOrder, type RangeOrder } from '../data/battle'
import { STRINGS, fill } from '../data/strings'
import type { BattleResult } from '../sim/battle/battle'
import type { BattleFinding, BattleSeries } from '../sim/battle/series'
import type { SideNo } from '../sim/duel/duel'
import { fixed } from './format'

const B = STRINGS.battle
const D = STRINGS.duel

export function battleGroundText(ground: BattleGroundId): { name: string; line: string } {
  return B.grounds[ground]
}

export interface OrderChoice<Id> {
  id: Id
  name: string
  line: string
}

/** What the two orders mean on a ground: a platoon holding a ridge reads them differently from one attacking. */
export function orderChoices(ground: BattleGroundId): { range: OrderChoice<RangeOrder>[]; pace: OrderChoice<PaceOrder>[] } {
  const role = BATTLE.grounds[ground].platoons[0].role
  return {
    range: RANGE_ORDERS.map((id) => {
      const words = B.range[role][id]
      return { id, name: words.name, line: fill(words.line, { m: BATTLE.holdFireM.toLocaleString('en-GB') }) }
    }),
    pace: PACE_ORDERS.map((id) => {
      const words = B.pace[role][id]
      return { id, name: words.name, line: fill(words.line, { n: String(BATTLE.shiftAfter) }) }
    }),
  }
}

/** The lines under a series' score: tanks lost for tanks knocked out, who shot first, rounds, breakdowns. */
export function battleSeriesLines(series: BattleSeries): string[] {
  const [mine, theirs] = series.tally
  const rounds = (who: string, tally: typeof mine): string =>
    fill(B.rounds, { who, fired: String(tally.fired), hits: String(tally.hits), through: String(tally.through) })
  return [
    fill(B.losses, {
      lost: String(mine.lost), mine: String(mine.tanks), killed: String(theirs.lost), theirs: String(theirs.tanks),
    }),
    mine.lost === 0 ? B.noneLost : fill(B.ratio, { n: fixed(theirs.lost / mine.lost, 1) }),
    fill(B.first, { a: String(series.shotFirst[0]), b: String(series.shotFirst[1]) }),
    rounds(B.platoons.mine, mine),
    rounds(B.platoons.theirs, theirs),
    mine.brokeDown === 0 ? B.noBreakdowns : fill(B.brokeDown, { n: String(mine.brokeDown), of: String(mine.tanks) }),
  ]
}

export function battleFindingText(finding: BattleFinding): string {
  return fill(B.findings[finding.kind], {
    count: String(finding.count),
    of: String(finding.of),
    zone: finding.zone ? STRINGS.zones[finding.zone].name.toLowerCase() : '',
  })
}

/** The words on a finding's fix button. Null for good news. */
export function battleFixText(finding: BattleFinding): string | null {
  if (!finding.fix) return null
  if ('zone' in finding.fix) return fill(D.fixZone, { zone: STRINGS.zones[finding.fix.zone].name })
  return fill(D.fix, { part: STRINGS.controls[finding.fix.part].label })
}

/** What a tank is called in the telling: whose it is and its number in the platoon, from one. */
export function tankName(battle: BattleResult, index: number): string {
  const tank = battle.tanks[index]
  if (!tank) return ''
  return fill(tank.side === 0 ? B.tanks.mine : B.tanks.theirs, { n: String(tank.no + 1) })
}

export interface BattleLine {
  atS: number
  /** Whose doing it was. Null for the end of the battle. */
  by: SideNo | null
  text: string
}

/** One battle from the first round to the end: not every round, only what changed things. */
export function battleLines(battle: BattleResult): BattleLine[] {
  const lines: BattleLine[] = []
  const sideOf = (index: number): SideNo => battle.tanks[index]?.side ?? 0
  const first = battle.shots[0]
  if (first) {
    lines.push({
      atS: first.atS, by: sideOf(first.by),
      text: fill(B.firstShot, { who: tankName(battle, first.by), range: String(Math.round(first.rangeM / 10) * 10) }),
    })
  } else lines.push({ atS: battle.endS, by: null, text: B.noShots })
  for (const event of battle.events) {
    const who = tankName(battle, event.tank)
    const by = event.by === null ? '' : tankName(battle, event.by)
    switch (event.kind) {
      case 'out': {
        const cause = battle.tanks[event.tank]?.cause ?? 'silenced'
        lines.push({ atS: event.atS, by: event.by === null ? null : sideOf(event.by), text: fill(B.out[cause], { who, by }) })
        break
      }
      case 'tracked':
        lines.push({ atS: event.atS, by: event.by === null ? null : sideOf(event.by), text: fill(B.tracked, { who, by }) })
        break
      case 'smoke':
        lines.push({ atS: event.atS, by: sideOf(event.tank), text: fill(B.smoke, { who }) })
        break
      case 'brokeDown':
        lines.push({ atS: event.atS, by: sideOf(event.tank), text: fill(B.brokeDownLine, { who }) })
        break
    }
  }
  lines.sort((a, b) => a.atS - b.atS)
  lines.push({ atS: battle.endS, by: null, text: battleEndText(battle) })
  lines.push({
    atS: battle.endS, by: null,
    text: fill(B.survivors, { a: String(battle.fighting[0]), b: String(battle.fighting[1]) }),
  })
  return lines
}

export function battleEndText(battle: BattleResult): string {
  const name = (side: SideNo): string => (side === 0 ? B.platoons.mine : B.platoons.theirs)
  // A wiped platoon is the one named; on points it is the one that came out ahead.
  const who = battle.winner === null ? '' : battle.end === 'wiped' ? name(battle.winner === 0 ? 1 : 0) : name(battle.winner)
  return fill(B.ends[battle.end], { who })
}

export function battleResultWord(battle: BattleResult): string {
  return battle.winner === 0 ? D.results.won : battle.winner === 1 ? D.results.lost : D.results.drawn
}
