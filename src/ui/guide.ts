// The guided first contract, as a card at the top of every page of the
// design office: what to do next, and a button that goes there.
import type { GuideStep } from '../data/guide'
import { fill, STRINGS } from '../data/strings'
import type { GuideState } from '../sim/career/guide'
import { el } from './dom'

const G = STRINGS.guide

/** Which of the four stages each step belongs to. */
const STAGE: Record<GuideStep, number> = { night: 1, faults: 1, build: 2, trial: 3, revise: 3, enter: 3, won: 4, lost: 4 }
const STAGES = 4

export type GuideAction = 'part' | 'faults' | 'bureau' | null

/** Where the step's button goes. The last two steps are read on the Bureau tab itself. */
export function guideAction(step: GuideStep): GuideAction {
  if (step === 'night') return 'part'
  if (step === 'faults') return 'faults'
  return 'bureau'
}

export function guideTitle(state: GuideState): string {
  return `${fill(G.step, { n: String(STAGE[state.step]), of: String(STAGES) })}: ${G.steps[state.step].title}`
}

export function guideText(state: GuideState): string {
  return fill(G.steps[state.step].text, { n: String(state.prototype), failed: String(Math.max(1, state.failed)) })
}

export function guideActionLabel(step: GuideStep): string {
  if (step === 'night') return G.steps.night.action
  if (step === 'faults') return G.steps.faults.action
  return G.toBureau
}

export interface GuideOptions {
  hidden: boolean
  /** True when the Bureau tab is the page showing: its button is left off. */
  onBureau: boolean
  go: (action: GuideAction) => void
  hide: (hidden: boolean) => void
}

function button(key: string, label: string, className: string): HTMLButtonElement {
  const node = el('button', className, label)
  node.type = 'button'
  node.dataset.key = key
  return node
}

export function renderGuide(state: GuideState, options: GuideOptions): HTMLElement {
  const box = el('section', 'guide')
  box.setAttribute('aria-label', G.heading)
  if (options.hidden) {
    const show = button('guide:show', G.show, 'guide-toggle')
    show.addEventListener('click', () => options.hide(false))
    box.classList.add('guide-away')
    box.append(show)
    return box
  }
  box.append(el('p', 'guide-heading', G.heading), el('h3', 'guide-title', guideTitle(state)), el('p', 'guide-text', guideText(state)))
  const row = el('div', 'guide-actions')
  const action = guideAction(state.step)
  if (action && !(action === 'bureau' && options.onBureau)) {
    const go = button('guide:go', guideActionLabel(state.step), 'btn')
    go.addEventListener('click', () => options.go(action))
    row.append(go)
  }
  const hide = button('guide:hide', G.hide, 'guide-toggle')
  hide.addEventListener('click', () => options.hide(true))
  row.append(hide)
  box.append(row)
  return box
}
