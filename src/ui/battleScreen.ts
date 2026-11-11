// The battle screen: pick an opponent and a ground, give the platoon its two
// orders, and read how it went: battles won, tanks lost for tanks knocked
// out, what decided it, and any one battle told as it happened. Every mark
// is words and numbers, never a colour alone.
import { BATTLE, BATTLE_GROUND_IDS, type BattleGroundId, type Orders } from '../data/battle'
import type { ZoneId } from '../data/materials'
import { STRINGS, fill } from '../data/strings'
import { DEFAULT_ORDERS } from '../sim/battle/battle'
import { runBattleSeries, type BattleFixPart, type BattleSeries } from '../sim/battle/series'
import { combatantOf } from '../sim/duel/duel'
import type { Limits, VehicleSpec } from '../sim/vehicle'
import {
  battleFindingText, battleFixText, battleGroundText, battleLines, battleResultWord, battleSeriesLines, orderChoices,
  type OrderChoice,
} from './battleWords'
import { createBattleMap, type BattleMap } from './battleMap'
import { el } from './dom'
import { card, scoreBar } from './duelScreen'
import { opponentsFor, seriesScore, type Opponent } from './duelWords'
import { fixed } from './format'

const B = STRINGS.battle
const D = STRINGS.duel

export interface BattleScreenArgs {
  spec: VehicleSpec
  limits: Limits
  projectNo: number
  /** The design's name, as the office shows it. */
  name: string
  back(): void
  /** Leave the battles and open the control that would change a result. */
  fix(part: BattleFixPart): void
  /** Leave the battles and open the Armour tab at one zone. */
  fixZone(zone: ZoneId): void
}

export function renderBattleScreen(args: BattleScreenArgs): HTMLElement {
  const root = el('section', 'range duel battle')
  root.tabIndex = -1
  root.setAttribute('aria-label', B.screenTitle)

  const head = el('div', 'rg-head')
  const back = el('button', 'btn rg-back', `‹ ${D.back}`)
  back.type = 'button'
  back.dataset.key = 'battle-back'
  back.setAttribute('aria-label', D.backLabel)
  back.addEventListener('click', args.back)
  const titles = el('div', 'rg-titles')
  titles.append(el('h2', 'rg-title', B.screenTitle), el('p', 'rg-subject', fill(D.subject, { n: String(args.projectNo), name: args.name })))
  head.append(back, titles)
  root.append(head)

  const me = combatantOf(args.spec, args.limits)
  const opponents = opponentsFor(args.limits, args.projectNo)
  let chosen: Opponent = opponents[0]!
  let ground: BattleGroundId = BATTLE_GROUND_IDS[0]
  let orders: Orders = { ...DEFAULT_ORDERS }

  /** A row of choices where one is on: big buttons with a name and a line under it. */
  const choices = <Id extends string>(
    key: string, label: string, items: readonly { id: Id; kind?: string; name: string; line?: string }[], pick: (id: Id) => void,
  ): { box: HTMLElement; mark(on: Id): void } => {
    const box = el('div', 'duel-pick')
    box.setAttribute('role', 'radiogroup')
    box.setAttribute('aria-label', label)
    const buttons = new Map<Id, HTMLButtonElement>()
    for (const item of items) {
      const button = el('button', 'duel-opp')
      button.type = 'button'
      button.dataset.key = `battle-${key}-${item.id}`
      button.setAttribute('role', 'radio')
      if (item.kind) button.append(el('span', 'duel-opp-kind', item.kind))
      button.append(el('span', 'duel-opp-name', item.name))
      if (item.line) button.append(el('span', 'bt-line', item.line))
      button.addEventListener('click', () => {
        pick(item.id)
        draw()
        root.querySelector<HTMLElement>(`[data-key="battle-${key}-${item.id}"]`)?.focus({ preventScroll: true })
      })
      buttons.set(item.id, button)
      box.append(button)
    }
    return {
      box,
      mark(on) {
        for (const [id, button] of buttons) {
          button.setAttribute('aria-checked', String(id === on))
          button.classList.toggle('duel-opp-on', id === on)
        }
      },
    }
  }

  // --- Who it meets ----------------------------------------------------------
  const picker = card(D.pick)
  const who = choices('opp', D.pickLabel, opponents.map((each) => ({ id: each.id, kind: D.kinds[each.kind], name: each.name })), (id) => {
    chosen = opponents.find((each) => each.id === id) ?? chosen
  })
  picker.append(who.box)

  // --- Where -------------------------------------------------------------------
  const groundCard = card(B.ground)
  const where = choices('ground', B.groundLabel, BATTLE_GROUND_IDS.map((id) => ({ id, name: battleGroundText(id).name })), (id) => {
    ground = id
  })
  const groundLine = el('p', 'ctl-note')
  groundLine.setAttribute('role', 'status')
  groundCard.append(where.box, groundLine)

  // --- The two orders ----------------------------------------------------------
  const ordersCard = card(B.orders)
  ordersCard.dataset.key = 'battle-orders'
  const ordersBody = el('div', 'bt-orders')
  ordersCard.append(el('p', 'ctl-note', B.ordersNote), ordersBody)

  const results = el('div', 'duel-results')
  root.append(picker, groundCard, ordersCard, results, el('p', 'ds-note', fill(B.note, { n: String(BATTLE.runs) })))

  const drawOrders = (): void => {
    const words = orderChoices(ground)
    const group = <Id extends string>(key: string, label: string, items: OrderChoice<Id>[], on: Id, pick: (id: Id) => void): HTMLElement => {
      const box = el('div', 'bt-order')
      const set = choices(key, label, items, pick)
      set.mark(on)
      box.append(el('h4', 'cmp-group', label), set.box)
      return box
    }
    ordersBody.replaceChildren(
      group('range', B.range.label, words.range, orders.range, (id) => {
        orders = { ...orders, range: id }
      }),
      group('pace', B.pace.label, words.pace, orders.pace, (id) => {
        orders = { ...orders, pace: id }
      }),
    )
  }

  /** The result card: the score, the sums, what decided it, and a battle to read. */
  const resultCard = (series: BattleSeries): HTMLElement => {
    const box = card(B.resultTitle)
    box.dataset.key = 'battle-result'
    const score = el('p', 'duel-score', seriesScore(series))
    score.setAttribute('role', 'status')
    box.append(score, scoreBar(series, B.barLabel), el('p', 'ctl-note duel-key', D.barKey))
    const sums = el('ul', 'duel-sums')
    for (const line of battleSeriesLines(series)) sums.append(el('li', 'duel-sum', line))
    box.append(sums)

    // The battle shown below; a finding can turn to the battle that shows it.
    let at = series.findings[0]?.battleIndex ?? 0
    const fold = el('details', 'cmp-fold duel-fold')
    fold.dataset.key = 'battle-fold'
    fold.append(el('summary', 'cmp-fold-title', B.oneBattle))
    const body = el('div', 'duel-one')
    fold.append(body)
    let map: BattleMap | null = null
    const drawBattle = (): void => {
      const battle = series.battles[at]
      if (!battle) return
      map?.stop()
      map = createBattleMap(battle, at + 1)
      const nav = el('div', 'duel-nav')
      const step = (key: string, label: string, aria: string, to: number): HTMLButtonElement => {
        const button = el('button', 'btn duel-step', label)
        button.type = 'button'
        button.dataset.key = `battle-${key}`
        button.setAttribute('aria-label', aria)
        button.disabled = to < 0 || to >= series.battles.length
        button.addEventListener('click', () => {
          at = to
          drawBattle()
          body.querySelector<HTMLElement>(`[data-key="battle-${key}"]`)?.focus({ preventScroll: true })
        })
        return button
      }
      const place = el('p', 'duel-where')
      place.setAttribute('role', 'status')
      place.append(
        el('span', 'duel-where-n', fill(B.battleOf, { at: String(at + 1), n: String(series.battles.length) })),
        el('span', `duel-where-result duel-${battle.winner === 0 ? 'won' : battle.winner === 1 ? 'lost' : 'drawn'}`, battleResultWord(battle)),
      )
      nav.append(step('prev', `‹ ${D.prev}`, B.prevLabel, at - 1), place, step('next', `${D.next} ›`, B.nextLabel, at + 1))
      const lines = el('ol', 'duel-lines')
      lines.setAttribute('aria-label', fill(B.listLabel, { at: String(at + 1) }))
      for (const line of battleLines(battle)) {
        const item = el('li', `duel-line${line.by === null ? ' duel-line-end' : line.by === 0 ? ' duel-line-mine' : ' duel-line-theirs'}`)
        item.append(el('span', 'duel-line-time', fill(D.time, { n: fixed(line.atS, 0) })), el('span', 'duel-line-text', line.text))
        lines.append(item)
      }
      body.replaceChildren(nav, map.root, lines)
    }
    drawBattle()

    box.append(el('h4', 'cmp-group', D.decided))
    if (series.findings.length === 0) box.append(el('p', 'ctl-note', D.nothing))
    else {
      const findings = el('ul', 'duel-findings')
      series.findings.forEach((finding, index) => {
        const item = el('li', `duel-finding duel-finding-${finding.good ? 'for' : 'against'}`)
        item.dataset.key = `battle-finding-${index}`
        const words = el('p', 'duel-finding-text')
        words.append(
          el('span', 'duel-finding-mark', `${finding.good ? '▲' : '▼'} ${finding.good ? D.marks.for : D.marks.against}`),
          el('span', '', battleFindingText(finding)),
        )
        const acts = el('div', 'duel-finding-acts')
        const fix = finding.fix
        const fixWords = battleFixText(finding)
        if (fix && fixWords) {
          const button = el('button', 'fix rg-fix', fixWords)
          button.type = 'button'
          button.dataset.key = `battle-fix-${index}`
          button.addEventListener('click', () => ('zone' in fix ? args.fixZone(fix.zone) : args.fix(fix.part)))
          acts.append(button)
        }
        const look = el('button', 'btn duel-look', fill(B.look, { n: String(finding.battleIndex + 1) }))
        look.type = 'button'
        look.dataset.key = `battle-look-${index}`
        look.addEventListener('click', () => {
          at = finding.battleIndex
          drawBattle()
          fold.open = true
          fold.scrollIntoView({ block: 'nearest' })
        })
        acts.append(look)
        item.append(words, acts)
        findings.append(item)
      })
      box.append(findings)
    }
    box.append(fold)
    return box
  }

  let run = 0
  function draw(): void {
    who.mark(chosen.id)
    where.mark(ground)
    groundLine.textContent = battleGroundText(ground).line
    drawOrders()
    const waiting = el('p', 'rg-waiting', B.running)
    waiting.setAttribute('role', 'status')
    results.replaceChildren(waiting)
    const mine = ++run
    // Let the "fighting" line paint before the sums start.
    setTimeout(() => {
      if (mine !== run || !root.isConnected) return
      results.replaceChildren(resultCard(runBattleSeries(me, chosen.tank, ground, orders, args.projectNo)))
    }, 0)
  }

  draw()
  return root
}
