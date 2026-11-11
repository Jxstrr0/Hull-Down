// The duel screen: pick an opponent, and read how the design did against it
// on each ground: the score, who shot first, what decided it, and any one
// duel told round by round. Every mark is words and numbers, never a colour
// alone.
import { DUEL } from '../data/duel'
import type { ZoneId } from '../data/materials'
import { STRINGS, fill } from '../data/strings'
import { combatantOf } from '../sim/duel/duel'
import { runCard, type DuelFixPart, type DuelSeries } from '../sim/duel/series'
import type { Limits, VehicleSpec } from '../sim/vehicle'
import { el } from './dom'
import {
  duelLines, duelResultWord, findingText, fixText, groundText, opponentsFor, overallOf, seriesLines, seriesScore,
  type Names, type Opponent,
} from './duelWords'
import { fixed } from './format'

const D = STRINGS.duel

export interface DuelScreenArgs {
  spec: VehicleSpec
  limits: Limits
  projectNo: number
  /** The design's name, as the office shows it. */
  name: string
  back(): void
  /** Leave the duels and open the control that would change a result. */
  fix(part: DuelFixPart): void
  /** Leave the duels and open the Armour tab at one zone. */
  fixZone(zone: ZoneId): void
}

export function card(title: string): HTMLElement {
  const box = el('section', 'rg-card duel-card')
  box.append(el('h3', 'ds-group-title', title))
  return box
}

/** Won, lost and drawn as one bar. Each part has its own pattern, and the numbers are written beside it. */
export function scoreBar(series: Pick<DuelSeries, 'won' | 'lost' | 'drawn'>, label: string = D.barLabel): HTMLElement {
  const n = series.won + series.lost + series.drawn
  const bar = el('div', 'duel-bar')
  bar.setAttribute('role', 'img')
  bar.setAttribute('aria-label', fill(label, {
    n: String(n), won: String(series.won), lost: String(series.lost), drawn: String(series.drawn),
  }))
  for (const [kind, count] of [['won', series.won], ['drawn', series.drawn], ['lost', series.lost]] as const) {
    if (count === 0) continue
    const part = el('span', `duel-bar-part duel-bar-${kind}`)
    part.style.flexGrow = String(count)
    bar.append(part)
  }
  return bar
}

export function renderDuelScreen(args: DuelScreenArgs): HTMLElement {
  const root = el('section', 'range duel')
  root.tabIndex = -1
  root.setAttribute('aria-label', D.screenTitle)

  const head = el('div', 'rg-head')
  const back = el('button', 'btn rg-back', `‹ ${D.back}`)
  back.type = 'button'
  back.dataset.key = 'duel-back'
  back.setAttribute('aria-label', D.backLabel)
  back.addEventListener('click', args.back)
  const titles = el('div', 'rg-titles')
  titles.append(el('h2', 'rg-title', D.screenTitle), el('p', 'rg-subject', fill(D.subject, { n: String(args.projectNo), name: args.name })))
  head.append(back, titles)
  root.append(head)

  const me = combatantOf(args.spec, args.limits)
  const opponents = opponentsFor(args.limits, args.projectNo)
  let chosen: Opponent = opponents[0]!

  // --- Who it meets ----------------------------------------------------------
  const picker = card(D.pick)
  const list = el('div', 'duel-pick')
  list.setAttribute('role', 'radiogroup')
  list.setAttribute('aria-label', D.pickLabel)
  const buttons = new Map<string, HTMLButtonElement>()
  for (const opponent of opponents) {
    const button = el('button', 'duel-opp')
    button.type = 'button'
    button.dataset.key = `duel-opp-${opponent.id}`
    button.setAttribute('role', 'radio')
    button.append(el('span', 'duel-opp-kind', D.kinds[opponent.kind]), el('span', 'duel-opp-name', opponent.name))
    button.addEventListener('click', () => {
      chosen = opponent
      draw()
    })
    buttons.set(opponent.id, button)
    list.append(button)
  }
  picker.append(list)
  root.append(picker)

  const results = el('div', 'duel-results')
  root.append(results, el('p', 'ds-note', fill(D.note, { n: String(DUEL.runs) })))

  /** The fix button for one finding. */
  const fixButton = (series: DuelSeries, index: number): HTMLButtonElement | null => {
    const finding = series.findings[index]
    const words = finding ? fixText(finding) : null
    if (!finding?.fix || !words) return null
    const fix = finding.fix
    const button = el('button', 'fix rg-fix', words)
    button.type = 'button'
    button.dataset.key = `duel-fix-${series.ground}-${index}`
    button.addEventListener('click', () => ('zone' in fix ? args.fixZone(fix.zone) : args.fix(fix.part)))
    return button
  }

  /** One ground's card: the score, the sums, what decided it, and a duel to read. */
  const groundCard = (series: DuelSeries, names: Names): HTMLElement => {
    const ground = groundText(series.ground)
    const box = card(ground.name)
    box.dataset.key = `duel-ground-${series.ground}`
    box.append(el('p', 'ctl-note', ground.line))
    const score = el('p', 'duel-score', seriesScore(series))
    box.append(score, scoreBar(series))
    const sums = el('ul', 'duel-sums')
    for (const line of seriesLines(series, names)) sums.append(el('li', 'duel-sum', line))
    box.append(sums)

    // The duel shown below; a finding can turn to the duel that shows it.
    let at = series.findings[0]?.duelIndex ?? 0
    const fold = el('details', 'cmp-fold duel-fold')
    fold.dataset.key = `duel-fold-${series.ground}`
    fold.append(el('summary', 'cmp-fold-title', D.oneDuel))
    const body = el('div', 'duel-one')
    fold.append(body)
    const drawDuel = (): void => {
      const duel = series.duels[at]
      if (!duel) return
      const nav = el('div', 'duel-nav')
      const step = (key: string, label: string, aria: string, to: number): HTMLButtonElement => {
        const button = el('button', 'btn duel-step', label)
        button.type = 'button'
        button.dataset.key = `duel-${key}-${series.ground}`
        button.setAttribute('aria-label', aria)
        button.disabled = to < 0 || to >= series.duels.length
        button.addEventListener('click', () => {
          at = to
          drawDuel()
          body.querySelector<HTMLElement>(`[data-key="duel-${key}-${series.ground}"]`)?.focus({ preventScroll: true })
        })
        return button
      }
      const where = el('p', 'duel-where')
      where.setAttribute('role', 'status')
      where.append(
        el('span', 'duel-where-n', fill(D.duelOf, { at: String(at + 1), n: String(series.duels.length) })),
        el('span', `duel-where-result duel-${duel.winner === 0 ? 'won' : duel.winner === 1 ? 'lost' : 'drawn'}`, duelResultWord(duel)),
      )
      nav.append(step('prev', `‹ ${D.prev}`, D.prevLabel, at - 1), where, step('next', `${D.next} ›`, D.nextLabel, at + 1))
      const lines = el('ol', 'duel-lines')
      lines.setAttribute('aria-label', fill(D.listLabel, { at: String(at + 1) }))
      for (const line of duelLines(duel, names)) {
        const item = el('li', `duel-line${line.by === null ? ' duel-line-end' : line.by === 0 ? ' duel-line-mine' : ' duel-line-theirs'}`)
        item.append(el('span', 'duel-line-time', fill(D.time, { n: fixed(line.atS, 1) })), el('span', 'duel-line-text', line.text))
        lines.append(item)
      }
      body.replaceChildren(nav, lines)
    }
    drawDuel()

    box.append(el('h4', 'cmp-group', D.decided))
    if (series.findings.length === 0) box.append(el('p', 'ctl-note', D.nothing))
    else {
      const findings = el('ul', 'duel-findings')
      series.findings.forEach((finding, index) => {
        const item = el('li', `duel-finding duel-finding-${finding.good ? 'for' : 'against'}`)
        item.dataset.key = `duel-finding-${series.ground}-${index}`
        const words = el('p', 'duel-finding-text')
        words.append(
          el('span', 'duel-finding-mark', `${finding.good ? '▲' : '▼'} ${finding.good ? D.marks.for : D.marks.against}`),
          el('span', '', findingText(finding)),
        )
        const acts = el('div', 'duel-finding-acts')
        const fix = fixButton(series, index)
        if (fix) acts.append(fix)
        const look = el('button', 'btn duel-look', fill(D.look, { n: String(finding.duelIndex + 1) }))
        look.type = 'button'
        look.dataset.key = `duel-look-${series.ground}-${index}`
        look.addEventListener('click', () => {
          at = finding.duelIndex
          drawDuel()
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

  function draw(): void {
    for (const [id, button] of buttons) {
      const on = id === chosen.id
      button.setAttribute('aria-checked', String(on))
      button.classList.toggle('duel-opp-on', on)
    }
    const waiting = el('p', 'rg-waiting', D.running)
    waiting.setAttribute('role', 'status')
    results.replaceChildren(waiting)
    const opponent = chosen
    // Let the "fighting" line paint before the sums start.
    setTimeout(() => {
      if (opponent !== chosen || !root.isConnected) return
      const names: Names = [D.yours, opponent.name]
      const duels = runCard(me, opponent.tank, args.projectNo)
      const S = D.sheet
      const sheet = opponent.tank.sheet

      const about = card(opponent.name)
      about.dataset.key = 'duel-about'
      about.append(el('p', 'ctl-note', opponent.line), el('p', 'ctl-note', opponent.kind === 'rival' ? S.rival : S.threat))
      const rows = el('dl', 'cmp-rows')
      const row = (label: string, value: string): void => {
        const line = el('div', 'cmp-row')
        line.append(el('dt', 'cmp-label', label), el('dd', 'cmp-value', value))
        rows.append(line)
      }
      row(S.mass, fill(S.massValue, { n: fixed(sheet.massT, 1) }))
      row(S.gun, fill(S.gunValue, { n: String(sheet.firepower.calibreMm) }))
      row(S.front, fill(S.frontValue, {
        glacis: fixed(sheet.protection.upperGlacis.keMm, 0), turret: fixed(sheet.protection.turretFrontLeft.keMm, 0),
      }))
      row(S.firstShot, fill(S.firstShotValue, { n: fixed(sheet.gunnery.firstShotS, 0) }))
      row(S.crew, String(sheet.crewCount))
      about.append(rows)

      const all = overallOf(duels)
      const overall = card(D.overallTitle)
      overall.dataset.key = 'duel-overall'
      const summary = el('p', 'rg-summary', `${all.text} ${all.verdict}`)
      summary.setAttribute('role', 'status')
      overall.append(summary, scoreBar(all), el('p', 'ctl-note duel-key', D.barKey))

      results.replaceChildren(about, overall, ...duels.map((series) => groundCard(series, names)))
    }, 0)
  }

  draw()
  return root
}
