// The in-game credits: who made the game, and every font, sound and library
// that ships with it, each with its author, licence and source.
import { CREDIT_GROUPS, CREDITS, type Credit } from '../data/credits'
import { STRINGS, fill } from '../data/strings'
import { el } from './dom'

const S = STRINGS.credits

/** One credit as a line of words. */
export function creditLine(credit: Credit): string {
  return fill(S.line, { title: credit.title, by: credit.by, licence: credit.licence })
}

/** What the credits row of the menu holds. */
export function drawCreditsBody(): HTMLElement[] {
  const box = el('div', 'crd')
  box.dataset.key = 'credits'
  box.append(el('p', 'crd-studio', STRINGS.credit), el('p', 'ctl-note', S.about))
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
  return [box]
}
