import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STRINGS } from '../src/data/strings'
import { ROOT, listFilesDeep, readRepoFile } from './helpers'

// The brand check (plan PR 18, studio catalogue "Studio pieces"): the splash,
// the credit line and the studio link follow the Longlight brand exactly. The
// game's own screens keep the game's own look and are not checked here.

/** Clay, purple, slate, ivory, lilac. Nothing else in the logo or a studio block. */
const BRAND = ['#d97757', '#7b3fc4', '#141413', '#faf9f5', '#b48ce8']
/** Ivory again, as the splash writes it for a see-through bar. */
const IVORY_RGB = '250, 249, 245'
const CREDIT = '© 2026 Kelbo / Longlight Interactive'
const STUDIO = 'Longlight Interactive'
const LINK = 'https://longlight.games/'

/** The official logo files, copied unchanged from the studio press kit. */
const LOGOS: Record<string, string> = {
  'public/brand/longlight-logo-dark.svg': 'e619f5110ba27d0c77afcfcef9d99ccaa360e7619456213c19b14b5400851c97',
  'public/brand/longlight-logo-light.svg': 'a4dd9e93d458c84b39df3bff7e3b940b47f4ca0c927ba2199f84119aeeebf592',
}

const hexes = (text: string): string[] => [...new Set((text.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((hex) => hex.toLowerCase()))]

describe('the Longlight logo', () => {
  it('is the official file, never redrawn or recoloured', () => {
    expect(listFilesDeep('public/brand').sort()).toEqual(Object.keys(LOGOS).sort())
    for (const [file, sha] of Object.entries(LOGOS)) {
      expect(createHash('sha256').update(readFileSync(join(ROOT, file))).digest('hex'), file).toBe(sha)
    }
  })

  it('uses brand colours only', () => {
    for (const file of Object.keys(LOGOS)) expect(hexes(readRepoFile(file)).filter((hex) => !BRAND.includes(hex)), file).toEqual([])
  })
})

describe('the studio splash', () => {
  const page = readRepoFile('index.html')
  const style = page.slice(page.indexOf('<style>'), page.indexOf('</style>'))
  const splash = page.slice(page.indexOf('<div id="loading"'), page.indexOf('<main id="app">'))

  it('shows the official logo from this site, with the studio named in full', () => {
    expect(splash).toContain('src="/brand/longlight-logo-dark.svg"')
    expect(splash).toContain(`alt="${STUDIO}"`)
    // Nothing hotlinked; the one outside file is Cloudflare's visit counter (Kelbo, 2026-11-12).
    expect(page.replace('src="https://static.cloudflareinsights.com/beacon.min.js"', '')).not.toMatch(/(src|href)="https?:/)
  })

  it('is painted in brand colours only', () => {
    expect(hexes(style).filter((hex) => !BRAND.includes(hex))).toEqual([])
    for (const rgb of style.match(/rgba?\(([^)]*)\)/g) ?? []) expect(rgb).toContain(IVORY_RGB)
  })

  it('is set in Space Grotesk, hosted with the game', () => {
    expect(style).toContain("font-family: 'Space Grotesk'")
    expect(readRepoFile('src/main.ts')).toContain('@fontsource/space-grotesk/')
    expect(page).not.toContain('fonts.googleapis.com')
  })

  it('carries the credit line', () => {
    expect(splash).toContain(CREDIT.replace('©', '&copy;'))
  })
})

describe('studio words in the game', () => {
  it('are the credit line, the full name and the studio link', () => {
    expect(STRINGS.credit).toBe(CREDIT)
    expect(STRINGS.studioName).toBe(STUDIO)
    expect(STRINGS.studioLink).toBe(LINK)
  })

  it('never shorten the studio name', () => {
    const texts = [readRepoFile('src/data/strings.ts'), readRepoFile('index.html'), readRepoFile('public/manifest.webmanifest')]
    for (const whole of texts) {
      // Notes for programmers are not words the player reads.
      const text = whole.replace(/\/\*[\s\S]*?\*\//g, '')
      const short = [...text.matchAll(/Longlight(?! Interactive)/g)].filter((match) => {
        // The site address and the logo file names are not the name.
        const around = text.slice(Math.max(0, match.index - 1), match.index + 12)
        return !/[./-]longlight/i.test(around) && !/longlight[.-]/i.test(around)
      })
      expect(short.map((match) => text.slice(match.index, match.index + 30))).toEqual([])
    }
  })

  it('set the credit line in Space Grotesk wherever it is shown', () => {
    const css = readRepoFile('src/style.css')
    for (const name of ['foot-studio', 'crd-studio']) {
      const rule = css.match(new RegExp(`\\.${name} \\{[^}]*\\}`))?.[0] ?? ''
      expect(rule, name).toContain("'Space Grotesk'")
    }
  })
})
