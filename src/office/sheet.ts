// The blueprint sheet: a frame, a drawing area and a title block.
// PR 1 pins a data sheet in the drawing area. PR 2 draws the tank on it.
import { STRINGS } from '../data/strings'
import { el } from '../ui/dom'

function cell(label: string, value: string): HTMLElement {
  const box = el('div', 'tb-cell')
  box.append(el('span', 'tb-label', label), el('span', 'tb-value', value))
  return box
}

export function renderSheet(project: string, body: HTMLElement): HTMLElement {
  const s = STRINGS.sheet
  const sheet = el('section', 'sheet')
  sheet.setAttribute('aria-label', s.label)

  const frame = el('div', 'sheet-frame')
  const field = el('div', 'sheet-field')
  field.append(body)

  const block = el('div', 'title-block')
  const head = el('div', 'tb-head')
  head.append(el('span', 'tb-bureau', STRINGS.bureau), el('span', 'tb-country', STRINGS.country))
  block.append(
    head,
    cell(s.project, project),
    cell(s.sheetNo, s.sheetValue),
    cell(s.kind, s.kindValue),
    cell(s.status, s.statusValue),
  )

  frame.append(field, block)
  sheet.append(frame)
  return sheet
}
