// The in-game credits: who made the game, and every font, sound and library
// that ships with it, each with its author, licence and source.
import { CREDIT_GROUPS, CREDITS, type Credit } from '../data/credits'
import { STRINGS, fill } from '../data/strings'
import { el } from './dom'

const S = STRINGS.credits

/** Kept between redraws of the tab, so the list does not fold shut under the player's thumb. */
let open = false

/** One credit as a line of words. */
export function creditLine(credit: Credit): string {
  return fill(S.line, { title: credit.title, by: credit.by, licence: credit.licence })
}

export function drawCredits(): HTMLElement {
  const box = el('details', 'crd')
  box.open = open
  box.dataset.key = 'credits'
  box.addEventListener('toggle', () => {
    open = box.open
  })
  box.append(el('summary', 'crash-sum', S.heading), el('p', 'crd-studio', STRINGS.credit), el('p', 'ctl-note', S.about))
  for (const group of CREDIT_GROUPS) {
    box.append(el('h4', 'sv-sub', S.groups[group]))
    const list = el('ul', 'sv-lines')
    for (const credit of CREDITS[group]) {
      const item = el('li', 'sv-line', creditLine(credit))
      const link = el('a', 'crd-link', S.source)
      link.href = credit.source
      link.rel = 'noopener'
      link.target = '_blank'
      link.setAttribute('aria-label', fill(S.sourceLabel, { title: credit.title }))
      item.append(link)
      list.append(item)
    }
    box.append(list)
  }
  return box
}
