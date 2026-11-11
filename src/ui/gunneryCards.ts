// The firing tests in the range report: a score, the marks, where the shots
// fell on the board, and each target in turn.
import { GUNNERY } from '../data/gunnery'
import { GUNNERY_TEST_IDS, RANGE, type GunneryTestId } from '../data/range'
import { STRINGS, fill } from '../data/strings'
import type { Fire } from '../sim/gunnery/fire'
import type { DrillRun, GunneryResult, RangeReport, TargetResult } from '../sim/trials'
import type { StatSheet, VehicleSpec } from '../sim/vehicle'
import { el } from './dom'
import { fixed } from './format'
import { faultFix, hitsFix, placeOf, slowFix } from './gunneryAdvice'

const T = STRINGS.range.gunnery
const D = STRINGS.range.drill
const SVG = 'http://www.w3.org/2000/svg'

type FixPart = keyof typeof STRINGS.controls

/** The pieces of the report the firing cards are built from. The range screen owns them. */
export interface CardKit {
  card(title: string, about: string, passed: boolean): HTMLElement
  line(name: string, words: string[], passed: boolean, fix?: HTMLButtonElement): HTMLElement
  fixButton(part: FixPart, key: string): HTMLButtonElement
}

function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  return node
}

/** Every shot of the test on one board. A hit is a dot and a miss is a cross, so it reads without colour. */
function board(run: GunneryResult): HTMLElement {
  const reach = RANGE.gunnery.plotM
  const size = 200
  const scale = size / (reach * 2)
  const box = el('div', 'rg-chart-box rg-board-box')
  const chart = svg('svg', { viewBox: `0 0 ${size} ${size}`, class: 'rg-chart rg-board', role: 'img' })
  const w = GUNNERY.target.widthM * scale
  const h = GUNNERY.target.heightM * scale
  chart.append(
    svg('line', { x1: '0', y1: String(size / 2), x2: String(size), y2: String(size / 2), class: 'rg-leg' }),
    svg('line', { x1: String(size / 2), y1: '0', x2: String(size / 2), y2: String(size), class: 'rg-leg' }),
    svg('rect', { x: String((size - w) / 2), y: String((size - h) / 2), width: String(w), height: String(h), class: 'rg-board-target' }),
  )
  let hits = 0
  let misses = 0
  const clamp = (m: number): number => Math.max(-reach, Math.min(reach, m))
  for (const target of run.targets) {
    for (const shot of target.shots) {
      const x = size / 2 + clamp(shot.acrossM) * scale
      const y = size / 2 - clamp(shot.upM) * scale
      if (shot.hit) {
        hits++
        chart.append(svg('circle', { cx: fixed(x, 1), cy: fixed(y, 1), r: '3.2', class: 'rg-board-hit' }))
      } else {
        misses++
        const arm = 3.4
        chart.append(svg('path', {
          d: `M${fixed(x - arm, 1)} ${fixed(y - arm, 1)} L${fixed(x + arm, 1)} ${fixed(y + arm, 1)} M${fixed(x - arm, 1)} ${fixed(y + arm, 1)} L${fixed(x + arm, 1)} ${fixed(y - arm, 1)}`,
          class: 'rg-board-miss',
        }))
      }
    }
  }
  chart.setAttribute('aria-label', fill(T.plotLabel, { hits: String(hits), misses: String(misses) }))
  box.append(chart, el('p', 'rg-board-key', fill(T.plotKey, { w: fixed(GUNNERY.target.widthM, 1) })))
  return box
}

function targetLine(target: TargetResult, fire: Fire, blind: boolean): HTMLElement {
  const S = T.shot
  const item = el('li', `rg-line-item rg-target${target.hit ? '' : ' rg-target-missed'}`)
  const top = el('div', 'rg-line-head')
  top.append(
    el('span', 'rg-line-name', fill(T.targetName, { range: String(target.rangeM), round: STRINGS.rounds[target.round] })),
    el('span', `rg-verdict ${target.hit ? 'rg-pass' : 'rg-fail'}`, target.hit ? `● ${T.hit}` : `× ${T.miss}`),
  )
  const last = target.shots.at(-1)
  let words: string
  if (!target.seen) words = fill(blind ? S.unseenBlind : S.unseen, { reach: String(fire.night.seeM) })
  else if (!last) words = S.tooSlow
  else if (target.hit) {
    const n = target.shots.length
    words = fill(n === 1 ? S.first : n === 2 ? S.second : S.later, { n: String(n), time: fixed(last.atS, 0) })
  } else {
    const fell = placeOf(last)
    words = fill(target.shots.length === 1 ? S.missedOne : S.missedMany, {
      n: String(target.shots.length), dist: fixed(fell.distM, 1), place: T.place[fell.place],
    })
  }
  item.append(top, el('p', 'rg-line-text', words))
  if (target.shots.some((shot) => shot.jammed)) item.append(el('p', 'rg-line-text', S.jam))
  return item
}

function gunneryCard(id: GunneryTestId, report: RangeReport, sheet: StatSheet, spec: VehicleSpec, kit: CardKit): HTMLElement {
  const run = report.gunnery[id]
  // The tank as it shot: without the part that failed, if one did.
  const fire = sheet.turret.find((part) => part.id === run.fault)?.without ?? sheet.fire
  const layout = RANGE.gunnery.tests[id]
  const ranges = layout.targets.map((target) => target.rangeM)
  const box = kit.card(T.titles[id], fill(T.about[id], {
    n: String(layout.targets.length),
    near: String(Math.min(...ranges)),
    far: String(Math.max(...ranges)),
    time: String(layout.exposureS),
    shots: String(RANGE.gunnery.shotsPerTarget),
  }), run.passed)

  const lines = el('ul', 'rg-lines')
  lines.append(kit.line(
    T.hits,
    [
      fill(T.hitsValue, { hits: String(run.hits), n: String(run.targets.length), first: String(run.firstRoundHits) }),
      fill(T.hitsMark, { n: String(report.marks.hits[id]) }),
    ],
    run.hitsPassed, kit.fixButton(run.fault ? faultFix(run.fault) : hitsFix(run, sheet, spec), `gunnery-${id}-hits`),
  ))
  if (run.timePassed !== null) {
    lines.append(kit.line(
      T.time,
      [
        run.firstShotS === null ? T.timeNever : fill(T.timeValue, { n: fixed(run.firstShotS, 0) }),
        fill(T.timeMark, { n: String(report.marks.firstShotS) }),
      ],
      run.timePassed, kit.fixButton(run.fault ? faultFix(run.fault) : slowFix(sheet, spec), `gunnery-${id}-time`),
    ))
  }

  const targets = el('ul', 'rg-lines')
  const blind = spec.fireControl.night === 'none' || run.fault === 'night'
  for (const target of run.targets) targets.append(targetLine(target, fire, blind))

  box.append(lines)
  if (run.roundsFired > 0) box.append(board(run))
  box.append(targets)
  const notes: string[] = []
  if (run.fault) notes.push(`${T.fault[run.fault]} ${T.faultNote}`)
  if (run.roundsFired > 0) notes.push(fill(T.rounds, { n: String(run.roundsFired) }))
  if (run.halted) notes.push(run.fault === 'stabiliser' ? T.haltsFault : T.halts)
  if (run.unseen > 0) notes.push(run.unseen === 1 ? T.unseenOne : fill(T.unseenMany, { n: String(run.unseen) }))
  // Only a target that was shot at and got away is worth explaining.
  const gotAway = run.targets.some((target) => target.shots.length > 0 && !target.hit)
  if (run.blame && gotAway) notes.push(run.blame === 'shake' && run.halted ? T.blame.shakeHalted : T.blame[run.blame])
  box.append(...notes.map((text) => el('p', 'ctl-note rg-note', text)))
  return box
}

function clock(seconds: number): string {
  const whole = Math.round(seconds)
  return fill(D.time, { m: String(Math.floor(whole / 60)), s: String(whole % 60) })
}

/** A bar for each round of the drill. Jams and hand-fed rounds carry a letter, so the chart reads without colour. */
function drillChart(run: DrillRun): HTMLElement {
  const w = 320
  const h = 120
  const pad = { left: 6, right: 6, top: 22, bottom: 16 }
  const times = run.rounds.map((round) => round.seconds)
  const most = Math.max(...times, 1)
  const step = (w - pad.left - pad.right) / run.rounds.length
  const deep = h - pad.top - pad.bottom
  const chart = svg('svg', { viewBox: `0 0 ${w} ${h}`, class: 'rg-chart', role: 'img' })
  chart.setAttribute('aria-label', fill(D.chartLabel, {
    n: String(run.rounds.length), min: fixed(Math.min(...times), 1), max: fixed(most, 1),
  }))
  chart.append(svg('line', {
    x1: String(pad.left), x2: String(w - pad.right), y1: String(h - pad.bottom), y2: String(h - pad.bottom), class: 'rg-axis',
  }))
  for (const [index, round] of run.rounds.entries()) {
    const tall = (round.seconds / most) * deep
    const x = pad.left + index * step
    chart.append(svg('rect', {
      x: fixed(x + 1.5, 1), y: fixed(h - pad.bottom - tall, 1), width: fixed(step - 3, 1), height: fixed(tall, 1),
      class: round.jammed || round.byHand ? 'rg-drill-bar rg-drill-slow' : 'rg-drill-bar',
    }))
    const letter = round.jammed ? 'J' : round.byHand ? 'H' : ''
    if (letter) {
      const mark = svg('text', {
        x: fixed(x + step / 2, 1), y: fixed(h - pad.bottom - tall - 3, 1), class: 'rg-chart-text rg-drill-letter', 'text-anchor': 'middle',
      })
      mark.textContent = letter
      chart.append(mark)
    }
    // Number the first round, every fifth and the last, so the bars can be counted.
    if (index === 0 || (index + 1) % 5 === 0 || index === run.rounds.length - 1) {
      const label = svg('text', { x: fixed(x + step / 2, 1), y: String(h - 4), class: 'rg-chart-text', 'text-anchor': 'middle' })
      label.textContent = String(index + 1)
      chart.append(label)
    }
  }
  const top = svg('text', { x: String(w - pad.right), y: '10', class: 'rg-chart-text', 'text-anchor': 'end' })
  top.textContent = fill(D.chartTop, { n: fixed(most, 1) })
  chart.append(top)
  const key: string[] = [D.chartKey]
  if (run.jams > 0) key.push(D.chartKeyJam)
  if (run.emptyAfter !== null) key.push(D.chartKeyHand)
  const box = el('div', 'rg-chart-box')
  box.append(chart, el('p', 'rg-board-key', key.join(' ')))
  return box
}

function drillCard(report: RangeReport, kit: CardKit): HTMLElement {
  const run = report.drill
  const box = kit.card(D.title, fill(D.about, { n: String(run.rounds.length) }), run.passed)
  const lines = el('ul', 'rg-lines')
  lines.append(kit.line(
    D.rate,
    [
      fill(D.rateValue, { rpm: fixed(run.rpm, 1), n: String(run.rounds.length), time: clock(run.totalS) }),
      fill(D.rateMark, { n: fixed(report.marks.drillRpm, 1) }),
    ],
    run.passed, kit.fixButton('loading', 'drill-rate'),
  ))
  box.append(lines)
  if (run.rounds.length > 0) box.append(drillChart(run))
  const notes: string[] = []
  const first = run.rounds[0]
  const last = run.rounds.at(-1)
  if (!run.auto && first && last) notes.push(fill(D.tires, { first: fixed(first.seconds, 1), last: fixed(last.seconds, 1) }))
  if (run.auto && run.jams === 0 && run.emptyAfter === null) notes.push(D.steady)
  if (run.jams > 0) {
    notes.push(fill(run.jams === 1 ? D.jamOne : D.jamMany, { n: String(run.jams), s: fixed(run.clearingS, 0) }))
  }
  if (run.emptyAfter !== null) notes.push(fill(D.empty, { n: String(run.emptyAfter) }))
  box.append(...notes.map((text) => el('p', 'ctl-note rg-note', text)))
  return box
}

/** One card for each firing test, in the order the range runs them, then the loading drill. */
export function gunneryCards(report: RangeReport, sheet: StatSheet, spec: VehicleSpec, kit: CardKit): HTMLElement[] {
  return [...GUNNERY_TEST_IDS.map((id) => gunneryCard(id, report, sheet, spec, kit)), drillCard(report, kit)]
}
