// Two builds of a design side by side: what changed, where the weight went
// and how every readout moved. Every mark is an arrow and a word, never a
// colour alone.
import { STRINGS, fill } from '../data/strings'
import type { RangeReport } from '../sim/trials'
import type { Limits } from '../sim/vehicle'
import { compareTrials } from '../office/compareTrials'
import { runRange } from './rangeRunner'
import { READOUT_GROUPS, compareBuilds, type Build, type Move, type ReadoutMove } from '../office/compare'
import { el } from './dom'
import { fixed, signed } from './format'

const C = STRINGS.office.compare
const ARROW: Record<Move, string> = { up: '▲', down: '▼', same: '' }

export interface CompareSide {
  /** What to call it: "Revision 2", or "The drawing board". */
  label: string
  build: Build
}

export interface CompareScreenArgs {
  earlier: CompareSide
  later: CompareSide
  /** The limits both were built to, and the luck of the day: the range runs them both again. */
  limits: Limits
  seed: number
  back(): void
}

const SVG = 'http://www.w3.org/2000/svg'
const T = C.trials

function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  return node
}

/** Speed against time for both builds: the later one a solid line, the earlier a faint dashed ghost. */
function ghostChart(before: RangeReport, after: RangeReport, a: string, b: string): HTMLElement {
  const w = 320
  const h = 110
  const pad = { left: 4, right: 4, top: 14, bottom: 4 }
  const markKmh = after.marks.topKmh
  const span = (report: RangeReport): number => (report.acceleration.trace.vMs.length - 1) * report.acceleration.trace.stepS
  const spanS = Math.max(span(before), span(after))
  const peakKmh = Math.max(before.acceleration.topKmh, after.acceleration.topKmh, markKmh) * 1.08
  const px = (s: number): number => pad.left + (s / spanS) * (w - pad.left - pad.right)
  const py = (kmh: number): number => h - pad.bottom - (kmh / peakKmh) * (h - pad.top - pad.bottom)
  const line = (report: RangeReport): string => {
    const { vMs, stepS } = report.acceleration.trace
    const every = Math.max(1, Math.floor(vMs.length / 160))
    const points: string[] = []
    vMs.forEach((v, index) => {
      if (index % every === 0 || index === vMs.length - 1) points.push(`${fixed(px(index * stepS), 1)},${fixed(py(v * 3.6), 1)}`)
    })
    return points.join(' ')
  }
  const chart = svg('svg', { viewBox: `0 0 ${w} ${h}`, class: 'rg-chart', role: 'img' })
  chart.setAttribute('aria-label', fill(T.chartLabel, {
    a, b, aTop: fixed(before.acceleration.topKmh, 0), bTop: fixed(after.acceleration.topKmh, 0),
  }))
  const markY = fixed(py(markKmh), 1)
  chart.append(
    svg('line', { x1: String(pad.left), x2: String(w - pad.right), y1: String(h - pad.bottom), y2: String(h - pad.bottom), class: 'rg-axis' }),
    svg('line', { x1: String(pad.left), x2: String(w - pad.right), y1: markY, y2: markY, class: 'rg-mark' }),
    svg('polyline', { points: line(before), class: 'rg-line cmp-ghost' }),
    svg('polyline', { points: line(after), class: 'rg-line' }),
  )
  const markText = svg('text', { x: String(pad.left + 2), y: fixed(py(markKmh) - 4, 1), class: 'rg-chart-text' })
  markText.textContent = fill(T.chartMark, { n: String(markKmh) })
  const endText = svg('text', { x: String(w - pad.right - 2), y: String(h - pad.bottom - 5), class: 'rg-chart-text', 'text-anchor': 'end' })
  endText.textContent = fill(T.chartEnd, { n: fixed(spanS, 0) })
  chart.append(markText, endText)
  const box = el('div', 'rg-chart-box')
  box.append(chart)
  return box
}

/** A value with a tick or a cross and the words, when the thing has a mark to meet. */
function marked(className: string, text: string, passed: boolean | null): HTMLElement {
  const span = el('span', className, passed === null ? text : `${passed ? '✓' : '✗'} ${text}`)
  if (passed !== null) span.setAttribute('aria-label', `${text}, ${passed ? T.passMark : T.failMark}`)
  return span
}

function card(title: string): HTMLElement {
  const box = el('section', 'rg-card cmp-card')
  box.append(el('h3', 'ds-group-title', title))
  return box
}

/** One line: the name, what it was and what it is now, and a mark. */
function row(label: string, before: string, after: string, mark?: HTMLElement): HTMLElement {
  const line = el('div', 'cmp-row')
  line.append(el('dt', 'cmp-label', label))
  const value = el('dd', 'cmp-value')
  value.append(el('span', 'cmp-before', before), el('span', 'cmp-arrow', '→'), el('span', 'cmp-after', after))
  if (mark) value.append(mark)
  line.append(value)
  return line
}

function moveMark(move: ReadoutMove): HTMLElement {
  const word = move.verdict ? C[move.verdict] : move.move === 'up' ? C.up : C.down
  const mark = el('span', `cmp-mark${move.verdict ? ` cmp-${move.verdict}` : ''}`, `${ARROW[move.move]} ${word}`)
  return mark
}

export function renderCompareScreen(args: CompareScreenArgs): HTMLElement {
  const { earlier, later } = args
  const result = compareBuilds(earlier.build, later.build)

  const root = el('section', 'range cmp')
  root.tabIndex = -1
  root.setAttribute('aria-label', C.screenTitle)

  const head = el('div', 'rg-head')
  const back = el('button', 'btn rg-back', `‹ ${C.back}`)
  back.type = 'button'
  back.dataset.key = 'compare-back'
  back.setAttribute('aria-label', C.backLabel)
  back.addEventListener('click', args.back)
  const titles = el('div', 'rg-titles')
  titles.append(el('h2', 'rg-title', C.screenTitle), el('p', 'rg-subject', fill(C.subject, { a: earlier.label, b: later.label })))
  head.append(back, titles)
  root.append(head)

  if (result.same) root.append(el('p', 'rg-summary', C.same))

  const parts = card(C.parts)
  if (result.parts.length === 0) parts.append(el('p', 'ctl-note', C.noParts))
  else {
    const list = el('dl', 'cmp-rows')
    for (const part of result.parts) list.append(row(part.label, part.before, part.after))
    parts.append(list)
  }
  root.append(parts)

  const armour = card(C.armour)
  if (result.armour.length === 0) armour.append(el('p', 'ctl-note', C.noArmour))
  else {
    const list = el('dl', 'cmp-rows cmp-armour')
    for (const zone of result.armour) list.append(row(zone.label, zone.before, zone.after))
    armour.append(list)
  }
  root.append(armour)

  const weight = card(C.weight)
  const areas = el('dl', 'cmp-rows')
  for (const area of result.weight) {
    const mark = area.move === 'same'
      ? undefined
      : el('span', 'cmp-mark', `${ARROW[area.move]} ${fill(C.weightDelta, { delta: signed(Number(fixed(area.afterT, 2)) - Number(fixed(area.beforeT, 2)), 2) })}`)
    const line = row(area.label, fixed(area.beforeT, 2), fill(C.tonnes, { n: fixed(area.afterT, 2) }), mark)
    if (area.move === 'same') line.classList.add('cmp-still')
    areas.append(line)
  }
  weight.append(areas)
  root.append(weight)

  const readouts = card(C.readouts)
  const moved = result.readouts.filter((each) => each.move !== 'same')
  const still = result.readouts.filter((each) => each.move === 'same')
  if (moved.length === 0) readouts.append(el('p', 'ctl-note', C.noneMoved))
  for (const group of READOUT_GROUPS) {
    const rows = moved.filter((each) => each.group === group)
    if (rows.length === 0) continue
    readouts.append(el('h4', 'cmp-group', STRINGS.dataSheet.groups[group]))
    const list = el('dl', 'cmp-rows')
    for (const each of rows) {
      const line = row(each.label, each.before, each.after, moveMark(each))
      line.dataset.key = `cmp-${each.key}`
      list.append(line)
    }
    readouts.append(list)
  }
  if (still.length > 0) {
    const fold = el('details', 'cmp-fold')
    fold.append(el('summary', 'cmp-fold-title', `${C.unmoved} (${fill(C.unmovedCount, { n: String(still.length) })})`))
    const list = el('dl', 'cmp-rows')
    for (const each of still) {
      const line = el('div', 'cmp-row cmp-still')
      line.append(el('dt', 'cmp-label', each.label), el('dd', 'cmp-value', each.after))
      list.append(line)
    }
    fold.append(list)
    readouts.append(fold)
  }
  root.append(readouts)

  // --- At the range ---------------------------------------------------------
  const trials = card(T.title)
  trials.dataset.key = 'cmp-trials'
  const waiting = el('p', 'rg-waiting', T.running)
  waiting.setAttribute('role', 'status')
  trials.append(el('p', 'ctl-note', T.about), waiting)
  root.append(trials, el('p', 'ds-note', C.note))
  const job = (side: CompareSide) => runRange({ spec: side.build.spec, limits: args.limits, setup: { seed: args.seed } })
  void Promise.all([job(earlier), job(later)]).then(([before, after]) => {
    if (!root.isConnected) return
    waiting.remove()
    trials.append(
      el('h4', 'cmp-group', T.chartTitle),
      ghostChart(before, after, earlier.label, later.label),
      el('p', 'ctl-note cmp-key', fill(T.chartKey, { a: earlier.label, b: later.label })),
    )
    const list = el('dl', 'cmp-rows')
    for (const each of compareTrials(before, after)) {
      const line = el('div', `cmp-row${each.move === 'same' ? ' cmp-still' : ''}`)
      line.dataset.key = `cmp-trial-${each.key}`
      line.append(el('dt', 'cmp-label', each.label))
      const value = el('dd', 'cmp-value')
      value.append(marked('cmp-before', each.before, each.beforePassed), el('span', 'cmp-arrow', '→'), marked('cmp-after', each.after, each.afterPassed))
      value.append(each.verdict
        ? el('span', `cmp-mark cmp-${each.verdict}`, `${ARROW[each.move]} ${C[each.verdict]}`)
        : el('span', 'cmp-mark cmp-nochange', T.same))
      line.append(value)
      list.append(line)
    }
    trials.append(list)
  })
  return root
}
