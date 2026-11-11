// The glossary: which of its entries explain the words in a piece of text.
// No DOM here, so it can be tested.
import { STRINGS } from '../data/strings'

const TERMS = STRINGS.glossary.terms

export type TermId = keyof typeof TERMS
export const TERM_IDS = (Object.keys(TERMS) as TermId[]).sort((a, b) => TERMS[a].term.localeCompare(TERMS[b].term))

/** True when the text has a word that starts with this, whatever its capitals. */
function has(text: string, start: string): boolean {
  let at = text.indexOf(start)
  while (at >= 0) {
    const before = at === 0 ? ' ' : text.charAt(at - 1)
    if (!/[a-z0-9]/.test(before)) return true
    at = text.indexOf(start, at + 1)
  }
  return false
}

/** The glossary entries that explain something in this text, in the order of the alphabet. */
export function termsIn(text: string): TermId[] {
  const lower = text.toLowerCase()
  return TERM_IDS.filter((id) => TERMS[id].find.some((start) => has(lower, start)))
}
