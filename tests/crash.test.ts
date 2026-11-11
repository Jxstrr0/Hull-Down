import { describe, expect, it } from 'vitest'
import { CRASH } from '../src/data/crash'
import { STRINGS } from '../src/data/strings'
import { storedSave } from '../src/persist/backup'
import { CAREER_KEY } from '../src/persist/careerStore'
import { DESIGNS_KEY, encodeStore, newStore, addDesign } from '../src/persist/designs'
import { decodeSave, encodeSave, SAVE_FORMAT, SAVE_PREFIX } from '../src/persist/saveCode'
import { crashMessage, crashReport, isCrash } from '../src/ui/crashWords'
import { readRepoFile } from './helpers'

// The crash screen (plan PR 18): if the game breaks, the player gets a plain
// account, the save code and a way to start again.

function storage(items: Record<string, string>) {
  return {
    getItem: (key: string) => items[key] ?? null,
    setItem: (key: string, value: string) => {
      items[key] = value
    },
  }
}

describe('what counts as a crash', () => {
  it('is any error nobody caught', () => {
    expect(isCrash(new TypeError('x is not a function'))).toBe(true)
    expect(isCrash('Script error.')).toBe(true)
    expect(isCrash({ code: 3 })).toBe(true)
  })

  it('is not a complaint the game carries on from', () => {
    expect(isCrash('ResizeObserver loop completed with undelivered notifications.')).toBe(false)
    expect(isCrash(new DOMException('The play() request was interrupted', 'AbortError'))).toBe(false)
    expect(isCrash(new DOMException('Write permission denied.', 'NotAllowedError'))).toBe(false)
    expect(isCrash(undefined)).toBe(false)
    expect(isCrash(null)).toBe(false)
  })

  it('names whatever was thrown', () => {
    expect(crashMessage(new RangeError('too far'))).toBe('RangeError: too far')
    expect(crashMessage('plain words')).toBe('plain words')
    expect(crashMessage({ code: 3 })).toBe('{"code":3}')
    const loop: Record<string, unknown> = {}
    loop.self = loop
    expect(crashMessage(loop)).toBe('[object Object]')
  })
})

describe('the fault report', () => {
  const facts = { version: '0.18.0.0', commit: 'abc1234', built: '2026-11-11', browser: 'TestBrowser/1.0' }

  it('names the version, the fault and the browser', () => {
    const report = crashReport({ ...facts, reason: 'it fell over' })
    expect(report.split('\n')).toEqual(['Hull Down v0.18.0.0 · abc1234 · 2026-11-11', 'Fault: it fell over', 'Browser: TestBrowser/1.0'])
  })

  it('keeps only the top of the trace, and the message once', () => {
    const error = new Error('deep')
    error.stack = ['Error: deep', ...Array.from({ length: 20 }, (_, n) => `    at step${n} (file.js:${n})`)].join('\n')
    const lines = crashReport({ ...facts, reason: error }).split('\n')
    expect(lines).toHaveLength(3 + CRASH.traceLines - 1)
    expect(lines.filter((line) => line.includes('Error: deep'))).toEqual(['Fault: Error: deep'])
    expect(lines[2]).toBe('at step0 (file.js:0)')
  })
})

describe('the save on the crash screen', () => {
  it('is what the browser last kept', async () => {
    const store = newStore()
    addDesign(store)
    const save = storedSave(storage({ [DESIGNS_KEY]: encodeStore(store) }))
    expect(save.format).toBe(SAVE_FORMAT)
    expect(save.career).toBeNull()
    expect(save.designs.designs).toHaveLength(store.designs.length)
    const code = await encodeSave(save)
    expect(code.startsWith(SAVE_PREFIX)).toBe(true)
    const back = await decodeSave(code)
    expect(back.ok && back.save.designs.designs.length).toBe(store.designs.length)
  })

  it('still gives a save when storage is empty, damaged or blocked', () => {
    expect(storedSave(storage({})).designs.designs.length).toBeGreaterThan(0)
    expect(storedSave(storage({ [DESIGNS_KEY]: '{{{', [CAREER_KEY]: 'not a career' })).career).toBeNull()
    const blocked = {
      getItem: (): string | null => {
        throw new Error('blocked')
      },
      setItem: (): void => {},
    }
    expect(storedSave(blocked).designs.designs.length).toBeGreaterThan(0)
  })
})

describe('the crash screen in the page', () => {
  it('is watching before the game is drawn', () => {
    const main = readRepoFile('src/main.ts')
    expect(main.indexOf('watchForCrashes()')).toBeGreaterThan(-1)
    expect(main.indexOf('watchForCrashes()')).toBeLessThan(main.lastIndexOf('mount()'))
    expect(main).toContain('showCrash(error)')
  })

  it('says what happened in plain words', () => {
    expect(STRINGS.crash.lead).toContain('not lost')
    expect(STRINGS.crash.reportAbout).toContain('Nothing about you')
  })
})
