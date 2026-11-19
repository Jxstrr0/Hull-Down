// Folds: a page as a short list of rows, one open at a time (the Prairie
// Engine Works pattern, and the Design page's own). Each row shows its name and
// a one-line summary; tapping it opens it and shuts whichever was open. Only the
// open row draws what is inside it, so a long page stays a short list.
import { STRINGS, fill } from '../data/strings'
import { el } from './dom'

/** Which row is open, if any. Kept by the screen, so it lasts between redraws. */
export interface FoldState {
  open: string | null
}

export interface Fold {
  key: string
  title: string
  /** What the row holds, in a few words, shown beside its name. */
  summary?: string
  /** Marks the row as wanting attention, as a part with a fault is marked. */
  flag?: boolean
  /** What the open row shows. Called only while it is open. */
  draw: () => HTMLElement[]
}

export interface FoldsOptions {
  folds: readonly Fold[]
  state: FoldState
  /** Draw the screen again after a row opens or shuts. */
  redraw: () => void
  /** The box that scrolls, so the tapped row can be kept under the finger. */
  scroller: HTMLElement
  /** A line to show at the top of the open row, such as what the last action came to. */
  status?: HTMLElement | null
  /** Told when another row opens, so the screen can drop what belonged to the last one. */
  changed?: () => void
}

/** The row that is open after `key` is tapped: it opens, or shuts if it was open. */
export function toggled(state: FoldState, key: string): string | null {
  return state.open === key ? null : key
}

/** A row opened lower than this share of the scroller is lifted to the top, so what it holds can be seen. */
const LIFT_BELOW = 1 / 3

export function drawFolds(options: FoldsOptions): HTMLElement {
  const { state, scroller } = options
  const list = el('div', 'folds')
  for (const fold of options.folds) {
    const open = state.open === fold.key
    const box = el('section', open ? 'sys-row fold ctl-open' : 'sys-row fold')
    if (fold.flag) box.classList.add('ctl-faulty')
    const heading = el('h3', 'ctl-heading')
    const head = el('button', 'ctl-head')
    head.type = 'button'
    head.dataset.key = `fold:${fold.key}`
    head.setAttribute('aria-expanded', open ? 'true' : 'false')
    if (fold.summary) head.setAttribute('aria-label', fill(STRINGS.office.row.label, { name: fold.title, now: fold.summary }))
    const sum = el('span', 'ctl-sum')
    if (fold.flag) sum.append(el('span', 'ctl-sum-fault', STRINGS.fold.flag), ' ')
    sum.append(fold.summary ?? '')
    head.append(el('span', 'ctl-name', fold.title), sum, el('span', 'ctl-chev'))
    head.addEventListener('click', () => {
      // Keep the tapped row where the finger left it, though a row above it may have shut.
      const before = head.getBoundingClientRect().top
      state.open = toggled(state, fold.key)
      options.changed?.()
      options.redraw()
      const again = scroller.querySelector<HTMLElement>(`[data-key="fold:${fold.key}"]`)
      if (!again) return
      scroller.scrollTop += again.getBoundingClientRect().top - before
      // Opened near the bottom: bring it up so what it holds is in view.
      const room = scroller.getBoundingClientRect()
      const top = again.getBoundingClientRect().top - room.top
      if (state.open === fold.key && top > room.height * LIFT_BELOW) scroller.scrollTop += top - 8
      again.focus({ preventScroll: true })
    })
    heading.append(head)
    box.append(heading)
    if (open) {
      const body = el('div', 'fold-body')
      if (options.status) body.append(options.status)
      body.append(...fold.draw())
      box.append(body)
    }
    list.append(box)
  }
  return list
}
