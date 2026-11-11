import { readFileSync } from 'node:fs'
import { TENDER_IDS } from '../src/data/tenders'
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BODIES } from '../src/data/career'
import { cleanCareer } from '../src/persist/careerCodec'
import { FIRST_PROJECT_NO, newStore } from '../src/persist/designs'
import {
  SAVE_FORMAT, SAVE_PREFIX, checksum, decodeSave, encodeSave, fromBase64Url, readSave, toBase64Url, type SaveFile,
} from '../src/persist/saveCode'
import { buildPrototype, enterTender, newCareer, type Career } from '../src/sim/career/career'

// Codes written by format 1 of the game. They must load in every later version: never edit this file.
const [GOLDEN, GOLDEN_PLAIN] = readFileSync(new URL('./fixtures/save-v1.txt', import.meta.url), 'utf8').trim().split('\n') as [string, string]

function played(): Career {
  const better = structuredClone(BASELINE_SPEC)
  better.fireControl.night = 'imageIntensifier'
  better.name = 'Night owl'
  let career = buildPrototype(newCareer(11), BASELINE_SPEC)
  career = buildPrototype(career, better)
  return enterTender(career, 2)
}
const SAVE: SaveFile = { format: SAVE_FORMAT, career: played(), designs: newStore() }

describe('base64url and the checksum', () => {
  it('carry any bytes there and back', () => {
    for (const length of [0, 1, 2, 3, 4, 5, 31, 256]) {
      const bytes = new Uint8Array(length).map((_, i) => (i * 37 + length) & 255)
      const text = toBase64Url(bytes)
      expect(text).toMatch(/^[A-Za-z0-9_-]*$/)
      expect([...fromBase64Url(text)!]).toEqual([...bytes])
    }
  })

  it('refuse text that is not base64url', () => {
    expect(fromBase64Url('ab+d')).toBeNull()
    expect(fromBase64Url('abcde')).toBeNull()
  })

  it('give eight hex figures that change with the bytes', () => {
    const a = checksum(new Uint8Array([1, 2, 3]))
    expect(a).toMatch(/^[0-9a-f]{8}$/)
    expect(checksum(new Uint8Array([1, 2, 4]))).not.toBe(a)
  })
})

describe('the save code', () => {
  it('starts HD1: and carries a whole save there and back', async () => {
    const code = await encodeSave(SAVE)
    expect(code.startsWith(`${SAVE_PREFIX}d.`)).toBe(true)
    expect(code).toMatch(/^HD1:d\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/)
    const back = await decodeSave(code)
    expect(back).toEqual({ ok: true, save: SAVE })
  })

  it('packs the save smaller than it was', async () => {
    const packed = await encodeSave(SAVE)
    const plain = await encodeSave(SAVE, false)
    expect(plain.startsWith(`${SAVE_PREFIX}p.`)).toBe(true)
    expect(packed.length).toBeLessThan(plain.length / 2)
    expect(await decodeSave(plain)).toEqual({ ok: true, save: SAVE })
  })

  it('carries a chest with no career', async () => {
    const chest: SaveFile = { format: SAVE_FORMAT, career: null, designs: newStore() }
    expect(await decodeSave(await encodeSave(chest))).toEqual({ ok: true, save: chest })
  })

  it('reads a code with the spaces and line breaks that copying adds', async () => {
    const code = await encodeSave(SAVE)
    const broken = `  ${code.slice(0, 40)}\n${code.slice(40, 90)} \r\n${code.slice(90)}\n`
    expect(await decodeSave(broken)).toEqual({ ok: true, save: SAVE })
  })

  it('says so when the text is not a code, is spoiled, or is cut short', async () => {
    const code = await encodeSave(SAVE)
    expect(await decodeSave('hello')).toEqual({ ok: false, error: 'notACode' })
    expect(await decodeSave('')).toEqual({ ok: false, error: 'notACode' })
    expect(await decodeSave('HD1:')).toEqual({ ok: false, error: 'damaged' })
    expect(await decodeSave('HD1:x.abcd.00000000')).toEqual({ ok: false, error: 'damaged' })
    expect(await decodeSave(code.slice(0, -30))).toEqual({ ok: false, error: 'damaged' })
    const at = 60
    const swapped = code.slice(0, at) + (code[at] === 'A' ? 'B' : 'A') + code.slice(at + 1)
    expect(await decodeSave(swapped)).toEqual({ ok: false, error: 'damaged' })
    const sum = code.slice(-8)
    const wrongSum = code.slice(0, -8) + (sum === '00000000' ? '00000001' : '00000000')
    expect(await decodeSave(wrongSum)).toEqual({ ok: false, error: 'damaged' })
  })
})

describe('old and new saves', () => {
  it('loads the codes written by format 1, for ever', async () => {
    const packed = await decodeSave(GOLDEN)
    expect(packed.ok).toBe(true)
    if (!packed.ok) return
    const career = packed.save.career!
    expect(career.seed).toBe(4)
    expect(career.budgetKr).toBe(10_382_000)
    expect(career.reputation).toEqual({ army: 53, ministry: 48, pact: 56 })
    expect(career.prototypes.map((each) => each.no)).toEqual([1, 2])
    expect(career.prototypes[1]!.spec.name).toBe('Golden')
    expect(career.prototypes[1]!.spec.fireControl.rangefinder).toBe('laser')
    expect(career.outcome).toMatchObject({ entered: 2, place: 2, won: false, designation: null })
    expect(career.outcome!.bids).toHaveLength(4)
    expect(packed.save.designs.designs[0]!.projectNo).toBe(FIRST_PROJECT_NO)

    const plain = await decodeSave(GOLDEN_PLAIN)
    expect(plain).toEqual({ ok: true, save: { format: SAVE_FORMAT, career: null, designs: newStore() } })
  })

  it('refuses a save from a later version of the game', () => {
    expect(readSave({ format: SAVE_FORMAT + 1, career: null, designs: {} })).toEqual({ ok: false, error: 'newer' })
  })

  it('refuses a save with no format, or one it has no way up from', () => {
    expect(readSave({ career: null })).toEqual({ ok: false, error: 'damaged' })
    expect(readSave(null)).toEqual({ ok: false, error: 'damaged' })
    expect(readSave({ format: 1 }, {}, 3)).toEqual({ ok: false, error: 'damaged' })
  })

  it('walks an old save up one format at a time', () => {
    const steps: string[] = []
    const result = readSave(
      { format: 1, bureau: { seed: 9, budgetKr: 5 }, chest: newStore() },
      {
        1: (old) => { steps.push('1'); return { ...old, career: old.bureau } },
        2: (old) => { steps.push('2'); return { ...old, designs: old.chest } },
      },
      3,
    )
    expect(steps).toEqual(['1', '2'])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.save.format).toBe(3)
      expect(result.save.career).toMatchObject({ seed: 9, budgetKr: 5 })
      expect(result.save.designs).toEqual(newStore())
    }
  })
})

describe('cleaning a career read from a save', () => {
  const good = played()

  it('leaves a sound career as it was', () => {
    expect(cleanCareer(JSON.parse(JSON.stringify(good)))).toEqual(good)
  })

  it('finds no career in something that is not one', () => {
    for (const raw of [null, undefined, 3, 'career', [], {}, { seed: 'x' }]) expect(cleanCareer(raw)).toBeNull()
  })

  it('pulls numbers into range and fills what is missing', () => {
    const career = cleanCareer({ seed: 5, tenderNo: 99, budgetKr: -4, reputation: { army: 400, ministry: -3, pact: 'high' } })!
    expect(career.tenderNo).toBe(TENDER_IDS.length - 1)
    expect(career.budgetKr).toBe(0)
    expect(career.reputation).toEqual({ army: 100, ministry: 0, pact: 50 })
    expect(career.prototypes).toEqual([])
    expect(career.outcome).toBeNull()
    expect(career.adopted).toEqual([])
    for (const body of BODIES) expect(Number.isInteger(career.reputation[body])).toBe(true)
  })

  it('cleans every design and numbers the prototypes afresh', () => {
    const raw = JSON.parse(JSON.stringify(good)) as { prototypes: { no: number; spec: { gun: string; name: string } }[] }
    raw.prototypes[0]!.no = 7
    raw.prototypes[0]!.spec.gun = 'deathRay'
    raw.prototypes[1]!.spec.name = 'x'.repeat(200)
    const career = cleanCareer({ ...raw, prototypes: [...raw.prototypes, 'junk', ...raw.prototypes, ...raw.prototypes, ...raw.prototypes] })!
    expect(career.prototypes.map((each) => each.no)).toEqual([1, 2, 3, 4, 5])
    expect(career.prototypes[0]!.spec.gun).toBe(BASELINE_SPEC.gun)
    expect(career.prototypes[1]!.spec.name.length).toBeLessThanOrEqual(28)
  })

  it('drops a decision that does not add up, so the army decides again', () => {
    const tamper = (change: (outcome: Record<string, unknown>) => void): Career => {
      const raw = JSON.parse(JSON.stringify(good)) as { outcome: Record<string, unknown> }
      change(raw.outcome)
      return cleanCareer(raw)!
    }
    expect(tamper(() => undefined).outcome).toEqual(good.outcome)
    expect(tamper((outcome) => { outcome.place = good.outcome!.place === 1 ? 2 : 1 }).outcome).toBeNull()
    expect(tamper((outcome) => { outcome.won = !good.outcome!.won }).outcome).toBeNull()
    expect(tamper((outcome) => { outcome.entered = 9 }).outcome).toBeNull()
    expect(tamper((outcome) => { (outcome.bids as unknown[]).pop() }).outcome).toBeNull()
    expect(tamper((outcome) => { const bids = outcome.bids as { who: string }[]; bids[1]!.who = bids[0]!.who }).outcome).toBeNull()
    expect(tamper((outcome) => { (outcome.bids as { total: unknown }[])[0]!.total = 'lots' }).outcome).toBeNull()
  })
})
