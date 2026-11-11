import { describe, expect, it } from 'vitest'
import { CONTROLS } from '../src/office/controls'
import { STRINGS } from '../src/data/strings'
import { TERM_IDS, termsIn } from '../src/ui/glossaryWords'

const TERMS = STRINGS.glossary.terms

/** Every string in a table of strings, joined. */
function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return Object.values(value).map(textOf).join(' ')
  return ''
}

describe('the glossary', () => {
  it('has a name, a meaning and something to find for every entry', () => {
    expect(TERM_IDS.length).toBeGreaterThan(30)
    for (const id of TERM_IDS) {
      const term = TERMS[id]
      expect(term.term, id).not.toBe('')
      expect(term.text.length, id).toBeGreaterThan(60)
      expect(term.find.length, id).toBeGreaterThan(0)
      for (const start of term.find) expect(start, id).toBe(start.toLowerCase())
    }
  })

  it('lists its entries in the order of the alphabet, each once', () => {
    const names = TERM_IDS.map((id) => TERMS[id].term)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(new Set(names).size).toBe(names.length)
  })

  it('explains only words the game uses', () => {
    const { glossary: _glossary, ...rest } = STRINGS
    const game = textOf(rest)
    for (const id of TERM_IDS) expect(termsIn(game), id).toContain(id)
  })

  it('finds a word whatever its capitals, and only at the start of a word', () => {
    expect(termsIn('The upper Glacis is sloped.')).toEqual(['glacis', 'slope'])
    expect(termsIn('Stabilised in two planes')).toEqual(['stabiliser'])
    expect(termsIn('A spring day')).toEqual([])
    expect(termsIn('')).toEqual([])
  })

  it('has a word to explain for every choice the designer makes', () => {
    const missing: string[] = []
    for (const control of CONTROLS) {
      const words = STRINGS.controls[control.id]
      const texts = control.kind === 'choice' ? Object.values(control.text) : control.kind === 'toggle' ? [control.text] : []
      const options = texts.map((text) => `${text.name} ${text.note}`).join(' ')
      if (termsIn(`${words.label} ${words.note} ${options}`).length === 0) missing.push(control.id)
    }
    expect(missing).toEqual([])
  })
})
