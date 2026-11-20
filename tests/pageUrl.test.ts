// The part sketches are asked for by full address, so they load wherever the
// game is served and whichever stylesheet paints them.
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SKETCHES } from '../src/data/sketches'
import { pageUrl } from '../src/office/pageUrl'

describe('pageUrl', () => {
  it('puts a sketch beside the page, not beside the stylesheet', () => {
    expect(pageUrl('sketches/gun-rifled100.png', 'https://hulldown.longlight.games/')).toBe(
      'https://hulldown.longlight.games/sketches/gun-rifled100.png',
    )
  })

  it('works under a sub-folder and with a file name in the address', () => {
    expect(pageUrl('sketches/a.png', 'https://example.test/Hull-Down/index.html?x=1#top')).toBe(
      'https://example.test/Hull-Down/sketches/a.png',
    )
  })

  it('every sketch is a relative address to a file that exists', () => {
    for (const path of Object.values(SKETCHES)) {
      expect(path.startsWith('sketches/')).toBe(true)
      expect(existsSync(`public/${path}`), path).toBe(true)
    }
  })
})
