// Tap-to-explain: the words on a page that the glossary knows, as a row of
// buttons, with the meaning of the one tapped shown under them.
import { fill, STRINGS } from '../data/strings'
import { el } from './dom'
import { TERM_IDS, termsIn, type TermId } from './glossaryWords'

const G = STRINGS.glossary

/** What the reader has open. Kept by the screen so it survives a redraw. */
export interface GlossaryState {
  open: TermId | undefined
  /** True when every word is listed, not only those on the page. */
  all: boolean
}

/** Every piece of text under these elements, kept apart so a label does not run into the word after it. */
export function pageTextOf(parts: readonly HTMLElement[]): string {
  const pieces: string[] = []
  for (const part of parts) {
    const walker = document.createTreeWalker(part, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) pieces.push(node.textContent ?? '')
  }
  return pieces.join(' ')
}

/** The glossary for a page that shows this text. Null when it has no word to explain. */
export function renderGlossary(pageText: string, state: GlossaryState): HTMLElement | null {
  const here = termsIn(pageText)
  if (here.length === 0 && !state.all) return null

  const box = el('section', 'gloss')
  box.setAttribute('aria-label', G.heading)
  const title = el('h3', 'gloss-title', G.heading)
  const hint = el('p', 'gloss-hint', G.hint)
  const list = el('div', 'gloss-terms')
  const meaning = el('div', 'gloss-text')
  meaning.setAttribute('role', 'status')
  const more = el('button', 'gloss-all')
  more.type = 'button'
  more.dataset.key = 'gloss:all'

  function draw(): void {
    const ids = state.all ? TERM_IDS : here
    if (state.open && !ids.includes(state.open)) state.open = undefined
    list.replaceChildren(...ids.map((id) => {
      const term = G.terms[id]
      const button = el('button', 'gloss-term', term.term)
      button.type = 'button'
      button.dataset.key = `gloss:${id}`
      button.setAttribute('aria-expanded', String(state.open === id))
      button.setAttribute('aria-label', fill(G.termLabel, { term: term.term }))
      button.addEventListener('click', () => {
        state.open = state.open === id ? undefined : id
        draw()
      })
      return button
    }))
    if (state.open) {
      const term = G.terms[state.open]
      meaning.replaceChildren(el('strong', 'gloss-name', term.term), el('p', 'gloss-meaning', term.text))
      meaning.hidden = false
    } else {
      meaning.replaceChildren()
      meaning.hidden = true
    }
    more.textContent = state.all ? G.fewer : G.all
  }

  more.addEventListener('click', () => {
    state.all = !state.all
    draw()
  })
  draw()
  box.append(title, hint, list, meaning, more)
  return box
}
