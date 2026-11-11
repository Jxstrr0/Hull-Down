import { describe, expect, it } from 'vitest'
import { listFilesDeep, readRepoFile } from './helpers'

// Every word the player reads lives in `src/data/`, so it can be found,
// checked and one day translated in one place. This test reads the rest of
// the source and fails on anything that looks like English written in code.

/** Words the code may spell out: keyboard keys, and names the browser or a file format asks for. */
const ALLOWED = new Set([
  'Enter', 'Escape', 'Tab', 'Home', 'End', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace', 'Delete',
])

/** Tag names, which a selector may list. */
const TAGS = new Set(['button', 'input', 'select', 'textarea', 'label', 'svg', 'canvas'])

const LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g

/** The code of a file with its comments, imports and messages meant for programmers taken out. */
function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*(import|export) .* from .*$/gm, '')
    .replace(/^.*\b(throw new Error|console\.(log|warn|error))\b.*$/gm, '')
}

/**
 * Every class the stylesheet knows, and the first part of each (`cmp` of
 * `cmp-row`), which screens use to mark themselves. A string of these is a
 * class list, not a sentence.
 */
function classesOf(css: string): Set<string> {
  const names = [...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map((match) => match[1] ?? '')
  return new Set(names.flatMap((name) => [name, name.split('-')[0] ?? name]))
}

/** Why a string literal looks like text for the player, or null when it does not. */
export function looksLikeText(literal: string, classes: ReadonlySet<string>): string | null {
  // What a template fills in at run time is not text written here.
  const text = literal.replace(/\$\{[^}]*\}/g, ' ').trim()
  if (text === '' || ALLOWED.has(text)) return null
  const words = text.split(/\s+/)
  // Code speaks in paths, selectors, units and attributes; a sentence has none of their marks.
  const plain = words.every((word) => /^[A-Za-z][a-z]*[.,!?]?$/.test(word))
  if (!plain) return null
  // A lone letter is a path command or a unit, never a word on its own.
  const real = words.map((word) => word.replace(/[.,!?]$/, '')).filter((word) => word.length >= 2)
  if (real.some((word) => /^[A-Z][a-z]+$/.test(word))) return 'a word with a capital letter'
  if (real.length >= 2 && !real.every((word) => classes.has(word) || TAGS.has(word))) return 'several plain words'
  return null
}

describe('hard-coded text', () => {
  const classes = classesOf(readRepoFile('src/style.css'))
  const files = listFilesDeep('src').filter((file) => file.endsWith('.ts') && !file.startsWith('src/data/'))

  it('finds the source and the stylesheet', () => {
    expect(files.length).toBeGreaterThan(20)
    expect(classes.size).toBeGreaterThan(20)
  })

  it('knows a sentence from a class list, a path or a key', () => {
    expect(looksLikeText('No faults found.', classes)).not.toBeNull()
    expect(looksLikeText('send it again', classes)).not.toBeNull()
    expect(looksLikeText('Close', classes)).not.toBeNull()
    expect(looksLikeText('Weighs ${mass} t', classes)).not.toBeNull()
    expect(looksLikeText('Kr ${n}M', classes)).not.toBeNull()
    expect(looksLikeText('M${a} L${b} Z', classes)).toBeNull()
    expect(looksLikeText('button, input', classes)).toBeNull()
    expect(looksLikeText('Enter', classes)).toBeNull()
    expect(looksLikeText('aria-label', classes)).toBeNull()
    expect(looksLikeText('M 0 0 L 10 10', classes)).toBeNull()
    expect(looksLikeText('hulldown.career', classes)).toBeNull()
    expect(looksLikeText('${x} ${y}', classes)).toBeNull()
    expect(looksLikeText([...classes].slice(0, 2).join(' '), new Set([...classes].slice(0, 2)))).toBeNull()
  })

  it('is nowhere outside src/data', () => {
    const hits: string[] = []
    for (const file of files) {
      const code = codeOf(readRepoFile(file))
      for (const match of code.matchAll(LITERAL)) {
        const literal = match[1] ?? match[2] ?? match[3] ?? ''
        const why = looksLikeText(literal, classes)
        if (why) hits.push(`${file}: "${literal}" (${why})`)
      }
    }
    expect(hits).toEqual([])
  })
})
