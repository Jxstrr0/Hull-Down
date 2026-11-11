// Two builds of a design side by side: what changed, where the weight went
// and how every readout moved. Every mark is an arrow and a word, never a
// colour alone.
import { STRINGS, fill } from '../data/strings'
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
  back(): void
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
  root.append(readouts, el('p', 'ds-note', C.note))
  return root
}
