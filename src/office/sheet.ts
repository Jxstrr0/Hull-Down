// The blueprint sheet. In PR 0 it is empty: a frame, centre lines, a stamp
// and a title block. PR 2 draws the tank on it.
import { STRINGS } from '../data/strings'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function cell(label: string, value: string): HTMLElement {
  const box = el('div', 'tb-cell')
  box.append(el('span', 'tb-label', label), el('span', 'tb-value', value))
  return box
}

export function renderSheet(): HTMLElement {
  const s = STRINGS.sheet
  const sheet = el('section', 'sheet')
  sheet.setAttribute('aria-label', s.label)

  const frame = el('div', 'sheet-frame')
  const field = el('div', 'sheet-field')
  field.append(el('p', 'sheet-empty', s.empty), el('p', 'sheet-stamp', s.stamp), el('p', 'sheet-note', s.note))

  const block = el('div', 'title-block')
  const head = el('div', 'tb-head')
  head.append(el('span', 'tb-bureau', STRINGS.bureau), el('span', 'tb-country', STRINGS.country))
  block.append(
    head,
    cell(s.project, s.projectNone),
    cell(s.sheetNo, s.sheetValue),
    cell(s.scale, s.scaleValue),
    cell(s.status, s.statusValue),
  )

  frame.append(field, block)
  sheet.append(frame)
  return sheet
}
