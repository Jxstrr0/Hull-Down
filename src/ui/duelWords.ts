// The words for a duel report: who the opponents are, what each finding
// says, and one duel told round by round. No DOM here, so it can be tested.
import { DUEL, type DuelGroundId } from '../data/duel'
import { ACCORD_LIMITS, BUREAU_IDS, THREAT_TANKS, THREAT_TANK_IDS, type BureauId, type ThreatTankId } from '../data/opponents'
import { STRINGS, fill } from '../data/strings'
import { designRival } from '../sim/ai/designer'
import { combatantOf, type Combatant, type DuelResult, type DuelShot, type SideNo } from '../sim/duel/duel'
import type { DuelFinding, DuelSeries } from '../sim/duel/series'
import type { Limits } from '../sim/vehicle'
import { resultText } from './afterAction'
import { fixed } from './format'

const D = STRINGS.duel

export interface Opponent {
  id: BureauId | ThreatTankId
  kind: 'rival' | 'threat'
  name: string
  line: string
  tank: Combatant
}

/**
 * Everyone a design meets. The rivals build to the same limits; `seed` names
 * the tender, so one project always meets the same three tanks.
 */
export function opponentsFor(limits: Limits, seed: number): Opponent[] {
  const rivals = BUREAU_IDS.map((id): Opponent => ({
    id,
    kind: 'rival',
    name: STRINGS.opponents.bureaus[id].name,
    line: STRINGS.opponents.bureaus[id].line,
    tank: combatantOf(designRival(id, limits, seed), limits),
  }))
  const threats = THREAT_TANK_IDS.map((id): Opponent => ({
    id,
    kind: 'threat',
    name: STRINGS.opponents.threats[id].name,
    line: STRINGS.opponents.threats[id].line,
    tank: combatantOf(THREAT_TANKS[id].spec, ACCORD_LIMITS, THREAT_TANKS[id].rounds),
  }))
  return [...rivals, ...threats]
}

/** The two tanks' names, the one under test first. */
export type Names = readonly [string, string]

export function roundName(id: string): string {
  const rounds: Record<string, string> = STRINGS.rounds
  const threats: Record<string, { name: string }> = STRINGS.threats
  return rounds[id] ?? threats[id]?.name ?? id
}

export function findingText(finding: DuelFinding): string {
  return fill(D.findings[finding.kind], {
    count: String(finding.count),
    of: String(finding.of),
    zone: finding.zone ? STRINGS.zones[finding.zone].name.toLowerCase() : '',
  })
}

/** The words on a finding's fix button. Null for good news. */
export function fixText(finding: DuelFinding): string | null {
  if (!finding.fix) return null
  if ('zone' in finding.fix) return fill(D.fixZone, { zone: STRINGS.zones[finding.fix.zone].name })
  return fill(D.fix, { part: STRINGS.controls[finding.fix.part].label })
}

export function seriesScore(series: Pick<DuelSeries, 'won' | 'lost' | 'drawn'>): string {
  return [
    fill(D.score.won, { n: String(series.won) }),
    fill(D.score.lost, { n: String(series.lost) }),
    fill(D.score.drawn, { n: String(series.drawn) }),
  ].join(' · ')
}

export function overallOf(card: readonly DuelSeries[]): { won: number; lost: number; drawn: number; n: number; text: string; verdict: string } {
  const won = card.reduce((sum, each) => sum + each.won, 0)
  const lost = card.reduce((sum, each) => sum + each.lost, 0)
  const drawn = card.reduce((sum, each) => sum + each.drawn, 0)
  const n = won + lost + drawn
  return {
    won, lost, drawn, n,
    text: fill(D.overall, { won: String(won), lost: String(lost), drawn: String(drawn), n: String(n) }),
    verdict: won > lost ? D.verdicts.ahead : lost > won ? D.verdicts.behind : D.verdicts.even,
  }
}

/** The lines under a ground's score: who shot first, and how each tank's rounds went. */
export function seriesLines(series: DuelSeries, names: Names): string[] {
  const [mine, theirs] = series.tally
  const seconds = (s: number | null): string => (s === null ? D.never : fixed(s, 0))
  const shows = series.duels[0]?.sides
  // A round that lands low goes into the ridge when the target sits behind one, and into the ground when it does not.
  const rounds = (who: string, tally: typeof mine, ridge: boolean): string =>
    fill(tally.berm === 0 ? D.rounds : ridge ? D.roundsBerm : D.roundsShort, {
      who, fired: String(tally.fired), hits: String(tally.hits), through: String(tally.through), berm: String(tally.berm),
    })
  const lines = [
    fill(D.first, { a: String(series.shotFirst[0]), b: String(series.shotFirst[1]) }),
    fill(D.firstShot, { a: seconds(mine.firstShotS), b: seconds(theirs.firstShotS) }),
    rounds(names[0], mine, shows?.[1].showsM != null),
    rounds(names[1], theirs, shows?.[0].showsM != null),
  ]
  if (shows?.[0].showsM != null) lines.push(fill(D.shows, { m: fixed(shows[0].showsM, 2) }))
  if (shows?.[1].showsM != null) lines.push(fill(D.showsTheirs, { m: fixed(shows[1].showsM, 2) }))
  return lines
}

/** What a round did, in a sentence or two. */
export function shotResultText(shot: DuelShot, ridge = true): string {
  if (shot.berm || !shot.hit) return ridge ? D.berm : D.short
  const hit = shot.hit
  const result = resultText(hit)
  return hit.zone ? `${fill(D.hitAt, { zone: STRINGS.zones[hit.zone].name.toLowerCase() })} ${result}` : result
}

export interface DuelLine {
  atS: number
  /** Whose doing it was. Null for the end of the duel. */
  by: SideNo | null
  text: string
}

/** One duel from the first round to the end, in the order things happened. */
export function duelLines(duel: DuelResult, names: Names): DuelLine[] {
  const lines: DuelLine[] = duel.shots.map((shot) => ({
    atS: shot.atS,
    by: shot.by,
    text: [
      shot.jammed ? D.jammed : '',
      fill(D.shot, {
        who: names[shot.by], round: roundName(shot.roundId), range: String(Math.round(shot.rangeM / 10) * 10), aim: D.aims[shot.aimAt],
      }),
      shotResultText(shot, duel.sides[shot.by === 0 ? 1 : 0].showsM !== null),
    ].filter((part) => part !== '').join(' '),
  }))
  duel.sides.forEach((side, no) => {
    if (side.smokeS === null) return
    lines.push({ atS: side.smokeS, by: no as SideNo, text: fill(D.smoke, { who: names[no as SideNo], n: String(DUEL.smoke.blindS) }) })
  })
  lines.sort((a, b) => a.atS - b.atS)
  if (duel.shots.length === 0) lines.push({ atS: duel.endS, by: null, text: D.noShots })
  lines.push({ atS: duel.endS, by: null, text: endText(duel, names) })
  return lines
}

export function endText(duel: DuelResult, names: Names): string {
  const loser = duel.winner === null ? '' : names[duel.winner === 0 ? 1 : 0]
  return fill(D.ends[duel.end], { who: loser, n: String(Math.round(DUEL.limitS / 60)) })
}

export function duelResultWord(duel: DuelResult): string {
  return duel.winner === 0 ? D.results.won : duel.winner === 1 ? D.results.lost : D.results.drawn
}

export function groundText(ground: DuelGroundId): { name: string; line: string } {
  return D.grounds[ground]
}
