import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BATTLE, BATTLE_GROUND_IDS, PACE_ORDERS, RANGE_ORDERS, type Orders } from '../src/data/battle'
import { ACCORD_LIMITS, THREAT_TANKS } from '../src/data/opponents'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { BATTLE_FINDING_KINDS, runBattleSeries, type BattleFinding } from '../src/sim/battle/series'
import { combatantOf } from '../src/sim/duel/duel'
import {
  battleEndText, battleFindingText, battleFixText, battleGroundText, battleLines, battleResultWord, battleSeriesLines,
  orderChoices, tankName,
} from '../src/ui/battleWords'

const LIMITS = PACT_LIMITS_GEN1
const me = combatantOf(BASELINE_SPEC, LIMITS)
const warden = combatantOf(THREAT_TANKS.warden.spec, ACCORD_LIMITS, THREAT_TANKS.warden.rounds)
const palisade = combatantOf(THREAT_TANKS.palisade.spec, ACCORD_LIMITS, THREAT_TANKS.palisade.rounds)
const CLOSE_FAST: Orders = { range: 'close', pace: 'fast' }
const all = BATTLE_GROUND_IDS.flatMap((ground) => [warden, palisade, me].map((foe) => runBattleSeries(me, foe, ground, CLOSE_FAST, 31)))

/** No placeholder left unfilled. */
function whole(text: string): void {
  expect(text).not.toBe('')
  expect(text).not.toMatch(/[{}]/)
  expect(text).not.toContain('undefined')
}

describe('the battle grounds, in words', () => {
  it('each have a name and a line', () => {
    for (const ground of BATTLE_GROUND_IDS) {
      whole(battleGroundText(ground).name)
      whole(battleGroundText(ground).line)
    }
  })

  it('say the right number of tanks', () => {
    const count = ['', 'One', 'Two', 'Three', 'Four']
    for (const ground of BATTLE_GROUND_IDS) {
      const [mine, theirs] = BATTLE.grounds[ground].platoons
      const line = battleGroundText(ground).line
      expect(line).toContain(count[mine.lanes.length])
      if (mine.lanes.length !== theirs.lanes.length) expect(line.toLowerCase()).toContain(count[theirs.lanes.length]?.toLowerCase())
    }
  })
})

describe('the two orders, in words', () => {
  it('offer every order on every ground, worded for holding or attacking', () => {
    for (const ground of BATTLE_GROUND_IDS) {
      const words = orderChoices(ground)
      expect(words.range.map((each) => each.id)).toEqual([...RANGE_ORDERS])
      expect(words.pace.map((each) => each.id)).toEqual([...PACE_ORDERS])
      for (const each of [...words.range, ...words.pace]) {
        whole(each.name)
        whole(each.line)
      }
    }
    expect(orderChoices('defend').range[1]?.name).toBe(STRINGS.battle.range.hold.close.name)
    expect(orderChoices('advance').range[1]?.name).toBe(STRINGS.battle.range.attack.close.name)
    expect(orderChoices('defend').range[1]?.line).toContain('1,000 m')
    expect(orderChoices('defend').pace[1]?.line).toContain(String(BATTLE.shiftAfter))
  })
})

describe('a battle series, in words', () => {
  it('gives the losses, who shot first, the rounds and the breakdowns', () => {
    for (const series of all) {
      const lines = battleSeriesLines(series)
      expect(lines.length).toBe(6)
      for (const line of lines) whole(line)
      expect(lines[0]).toContain(String(series.tally[0].lost))
      expect(lines[0]).toContain(String(series.tally[1].tanks))
    }
  })

  it('has words for every finding and a fix for every bad one', () => {
    for (const kind of BATTLE_FINDING_KINDS) {
      const good = ['shotFirst', 'armourHeld', 'gotThrough', 'fewLost'].includes(kind)
      const finding: BattleFinding = {
        kind, good, weight: 1, count: 3, of: 7, zone: 'hullSideFront', battleIndex: 0,
        fix: good ? null : kind === 'holed' || kind === 'flanked' ? { zone: 'hullSideFront' } : { part: 'powerpack.transmission' },
      }
      const text = battleFindingText(finding)
      whole(text)
      expect(text).toContain('3')
      expect(text).toContain('7')
      if (good) expect(battleFixText(finding)).toBeNull()
      else whole(battleFixText(finding) ?? '')
    }
  })

  it('names the plate or the part on the fix button', () => {
    for (const series of all) {
      for (const finding of series.findings) {
        const words = battleFixText(finding)
        if (!finding.fix) expect(words).toBeNull()
        else if ('zone' in finding.fix) expect(words).toContain(STRINGS.zones[finding.fix.zone].name)
        else expect(words).toContain(STRINGS.controls[finding.fix.part].label)
      }
    }
  })
})

describe('one battle, as it happened', () => {
  it('names each tank by its platoon and number', () => {
    const battle = all[0]?.battles[0]
    if (!battle) throw new Error('no battle')
    expect(tankName(battle, 0)).toBe('Your no. 1')
    expect(tankName(battle, battle.started[0])).toBe('Their no. 1')
  })

  it('runs in order from the first round to the end, with a line for every tank put out', () => {
    for (const series of all) {
      for (const battle of series.battles) {
        const lines = battleLines(battle)
        for (const line of lines) whole(line.text)
        for (let i = 1; i < lines.length; i++) expect(lines[i]?.atS ?? 0).toBeGreaterThanOrEqual(lines[i - 1]?.atS ?? 0)
        const outs = battle.tanks.filter((tank) => tank.outS !== null).length
        expect(lines.length).toBe(1 + battle.events.length + 2)
        expect(battle.events.filter((event) => event.kind === 'out').length).toBe(outs)
        expect(lines[lines.length - 2]?.text).toBe(battleEndText(battle))
        expect(lines[lines.length - 1]?.by).toBeNull()
      }
    }
  })

  it('says who was beaten, or who came out ahead', () => {
    const battles = all.flatMap((series) => series.battles)
    const wiped = battles.find((battle) => battle.end === 'wiped' && battle.winner === 0)
    if (wiped) expect(battleEndText(wiped)).toContain(STRINGS.battle.platoons.theirs)
    const lostIt = battles.find((battle) => battle.end === 'wiped' && battle.winner === 1)
    if (lostIt) expect(battleEndText(lostIt)).toContain(STRINGS.battle.platoons.mine)
    expect(wiped ?? lostIt).toBeDefined()
    for (const battle of battles) {
      whole(battleEndText(battle))
      expect(['Won', 'Lost', 'Drawn']).toContain(battleResultWord(battle))
    }
  })
})
