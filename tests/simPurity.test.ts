import { describe, expect, it } from 'vitest'
import { listFilesDeep, readRepoFile } from './helpers'

// The sim must give the same result for the same tank and seed on every
// device, so it may not touch randomness, clocks, the DOM or three.js.
const BANNED: [RegExp, string][] = [
  [/\bMath\.random\b/, 'Math.random'],
  [/\bDate\.now\b/, 'Date.now'],
  [/\bnew Date\b/, 'new Date'],
  [/\bperformance\.now\b/, 'performance.now'],
  [/\b(document|window|navigator|localStorage)\./, 'a browser global'],
  [/from ['"]three/, 'three.js'],
]

describe('sim purity', () => {
  const files = listFilesDeep('src/sim').filter((f) => f.endsWith('.ts'))

  it('finds the sim', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('uses no randomness, clocks, DOM or three.js', () => {
    const hits: string[] = []
    for (const file of files) {
      // Comments may mention the banned names; only code counts.
      const code = readRepoFile(file)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      for (const [pattern, name] of BANNED) if (pattern.test(code)) hits.push(`${file}: ${name}`)
    }
    expect(hits).toEqual([])
  })
})
