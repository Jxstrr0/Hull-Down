import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { TUNING, PACT_LIMITS_GEN1 } from '../src/data/tuning'
import {
  DESIGNS_KEY, FIRST_PROJECT_NO, MAX_DESIGNS, MAX_REVISIONS, addDesign, currentDesign, decodeStore, encodeStore, keepRevision,
  lastRevision, loadStore, newStore, openDesign, restoreRevision, sameBuild, saveStore, scrapDesign, type KeyValue,
} from '../src/persist/designs'
import { NAME_MAX, cleanName, cleanSpec } from '../src/persist/specCodec'
import { buildStatSheet } from '../src/sim/vehicle'

/** A stand-in for the browser's storage. */
function fakeStorage(): KeyValue & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  }
}

const blocked: KeyValue = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('design names', () => {
  it('tidies spacing and drops control characters', () => {
    expect(cleanName('  Grey \n\t Wolf\u0000 ')).toBe('Grey Wolf')
    expect(cleanName('Mk​2')).toBe('Mk 2')
  })

  it('keeps names to one short line', () => {
    const name = cleanName('x'.repeat(200))
    expect(name).toHaveLength(NAME_MAX)
    expect(cleanName(`${'x'.repeat(NAME_MAX - 1)} yyyy`)).toBe('x'.repeat(NAME_MAX - 1))
  })

  it('turns anything that is not text into no name', () => {
    expect(cleanName(undefined)).toBe('')
    expect(cleanName(42)).toBe('')
    expect(cleanName({})).toBe('')
  })
})

describe('reading a spec that cannot be trusted', () => {
  it('gives the baseline for rubbish', () => {
    for (const rubbish of [null, undefined, 7, 'tank', []]) {
      expect(cleanSpec(rubbish)).toEqual({ ...BASELINE_SPEC, name: '' })
    }
  })

  it('returns a good spec unchanged apart from being a copy', () => {
    const spec = structuredClone(BASELINE_SPEC)
    spec.name = 'Grey Wolf'
    spec.hull.glacisAngleDeg = 60
    const cleaned = cleanSpec(spec)
    expect(cleaned).toEqual(spec)
    expect(cleaned).not.toBe(spec)
    expect(cleaned.armour).not.toBe(spec.armour)
  })

  it('keeps the baseline part where a part id is unknown', () => {
    const raw = structuredClone(BASELINE_SPEC) as unknown as { hull: { size: string }; gun: unknown }
    raw.hull.size = 'hovercraft'
    raw.gun = 'big'
    const cleaned = cleanSpec(raw)
    expect(cleaned.hull.size).toBe(BASELINE_SPEC.hull.size)
    expect(cleaned.gun).toEqual(BASELINE_SPEC.gun)
  })

  it('pulls numbers back into range', () => {
    const raw = structuredClone(BASELINE_SPEC)
    raw.hull.glacisAngleDeg = 500
    raw.powerpack.fuelL = -3
    const cleaned = cleanSpec(raw)
    expect(cleaned.hull.glacisAngleDeg).toBe(TUNING.limits.glacisAngleDeg.max)
    expect(cleaned.powerpack.fuelL).toBe(TUNING.limits.fuelL.min)
  })

  it('cleans armour layers', () => {
    const raw = structuredClone(BASELINE_SPEC) as unknown as { armour: Record<string, unknown> }
    raw.armour.upperGlacis = [
      { material: 'rolledSteel', mm: 80.4 },
      { material: 'unobtainium', mm: 50 },
      { material: 'rolledSteel', mm: -5 },
      { material: 'castSteel', mm: 99999 },
      'plate',
    ]
    raw.armour.hullRear = 'thick'
    raw.armour.belly = Array.from({ length: 12 }, () => ({ material: 'rolledSteel', mm: 5 }))
    const cleaned = cleanSpec(raw)
    expect(cleaned.armour.upperGlacis).toEqual([
      { material: 'rolledSteel', mm: 80 },
      { material: 'castSteel', mm: TUNING.limits.maxLayerMm },
    ])
    expect(cleaned.armour.hullRear).toEqual(BASELINE_SPEC.armour.hullRear)
    expect(cleaned.armour.belly).toHaveLength(TUNING.limits.maxLayersPerZone)
  })

  it('always gives something the model can work out', () => {
    const cleaned = cleanSpec({ name: 'Half a tank', hull: { size: 'heavy' }, armour: { turretRoof: [] } })
    expect(cleaned.hull.size).toBe('heavy')
    expect(cleaned.name).toBe('Half a tank')
    expect(cleaned.armour.turretRoof).toEqual([])
    const sheet = buildStatSheet(cleaned, PACT_LIMITS_GEN1)
    expect(Number.isFinite(sheet.massT)).toBe(true)
  })
})

describe('the plan chest', () => {
  it('starts with one unnamed design numbered from the first project number', () => {
    const store = newStore()
    expect(store.designs).toHaveLength(1)
    expect(currentDesign(store).projectNo).toBe(FIRST_PROJECT_NO)
    expect(currentDesign(store).spec.name).toBe('')
    expect({ ...currentDesign(store).spec, name: BASELINE_SPEC.name }).toEqual(BASELINE_SPEC)
  })

  it('numbers new designs in order and puts them on the board', () => {
    const store = newStore()
    expect(addDesign(store)).toBe(true)
    expect(addDesign(store)).toBe(true)
    expect(store.designs.map((design) => design.projectNo)).toEqual([101, 102, 103])
    expect(store.current).toBe(103)
  })

  it('copies a design without sharing its parts', () => {
    const store = newStore()
    const first = currentDesign(store)
    first.spec.name = 'Grey Wolf'
    addDesign(store, first.spec)
    const copy = currentDesign(store)
    expect(copy.projectNo).toBe(102)
    expect(copy.spec).toEqual(first.spec)
    copy.spec.hull.glacisAngleDeg = 50
    copy.spec.armour.belly.push({ material: 'rolledSteel', mm: 10 })
    expect(first.spec.hull.glacisAngleDeg).toBe(BASELINE_SPEC.hull.glacisAngleDeg)
    expect(first.spec.armour.belly).toEqual(BASELINE_SPEC.armour.belly)
  })

  it('opens a design that is on file and ignores one that is not', () => {
    const store = newStore()
    addDesign(store)
    openDesign(store, 101)
    expect(store.current).toBe(101)
    openDesign(store, 999)
    expect(store.current).toBe(101)
  })

  it('never reuses a project number after a design is scrapped', () => {
    const store = newStore()
    addDesign(store)
    scrapDesign(store, 102)
    expect(store.current).toBe(101)
    addDesign(store)
    expect(currentDesign(store).projectNo).toBe(103)
  })

  it('leaves a fresh design when the last one is scrapped', () => {
    const store = newStore()
    currentDesign(store).spec.name = 'Doomed'
    scrapDesign(store, 101)
    expect(store.designs).toHaveLength(1)
    expect(currentDesign(store).projectNo).toBe(102)
    expect(currentDesign(store).spec.name).toBe('')
  })

  it('stops taking designs when it is full', () => {
    const store = newStore()
    while (store.designs.length < MAX_DESIGNS) expect(addDesign(store)).toBe(true)
    const before = store.current
    expect(addDesign(store)).toBe(false)
    expect(store.designs).toHaveLength(MAX_DESIGNS)
    expect(store.current).toBe(before)
  })
})

describe('keeping designs on the device', () => {
  it('reads back what it wrote', () => {
    const store = newStore()
    currentDesign(store).spec.name = 'Grey Wolf'
    currentDesign(store).spec.hull.glacisAngleDeg = 62
    addDesign(store)
    openDesign(store, 101)
    expect(decodeStore(encodeStore(store))).toEqual(store)
  })

  it('uses only its own storage key', () => {
    const storage = fakeStorage()
    expect(saveStore(storage, newStore())).toBe(true)
    expect([...storage.data.keys()]).toEqual([DESIGNS_KEY])
    expect(DESIGNS_KEY.startsWith('hulldown.')).toBe(true)
    expect(loadStore(storage)).toEqual(newStore())
  })

  it('starts afresh from nothing or from rubbish', () => {
    for (const text of [null, '', 'not json', '42', '{"designs":"none"}', '{"designs":[]}', '{"designs":[null,{"projectNo":-1}]}']) {
      expect(decodeStore(text)).toEqual(newStore())
    }
  })

  it('mends a damaged store', () => {
    const text = JSON.stringify({
      format: 1,
      current: 555,
      nextProjectNo: 2,
      designs: [
        { projectNo: 104, spec: { name: '  Wolf  ' } },
        { projectNo: 104, spec: { name: 'Twin' } },
        { projectNo: 1.5, spec: {} },
        { projectNo: 107, spec: 'broken' },
      ],
    })
    const store = decodeStore(text)
    expect(store.designs.map((design) => design.projectNo)).toEqual([104, 107])
    expect(store.designs[0]?.spec.name).toBe('Wolf')
    expect(store.current).toBe(104)
    expect(store.nextProjectNo).toBe(108)
  })

  it('keeps no more designs than the chest holds', () => {
    const designs = Array.from({ length: MAX_DESIGNS + 5 }, (_, i) => ({ projectNo: 200 + i, spec: {} }))
    expect(decodeStore(JSON.stringify({ designs })).designs).toHaveLength(MAX_DESIGNS)
  })

  it('carries on in memory when the browser blocks storage', () => {
    expect(loadStore(blocked)).toEqual(newStore())
    expect(saveStore(blocked, newStore())).toBe(false)
  })
})

describe('prototype revisions', () => {
  it('keeps the design as it stood each time a prototype is built', () => {
    const design = currentDesign(newStore())
    expect(lastRevision(design)).toBeUndefined()
    expect(keepRevision(design).no).toBe(1)
    design.spec.powerpack.fuelL += 100
    expect(keepRevision(design).no).toBe(2)
    expect(design.revisions.map((each) => each.no)).toEqual([1, 2])
    // A revision is a copy: the board can move on without changing it.
    design.spec.powerpack.fuelL += 100
    expect(design.revisions[1]!.spec.powerpack.fuelL).toBe(design.spec.powerpack.fuelL - 100)
  })

  it('does not build the same tank twice, and does not count a new name as a change', () => {
    const design = currentDesign(newStore())
    keepRevision(design)
    expect(keepRevision(design).no).toBe(1)
    design.spec.name = 'Bison'
    expect(sameBuild(design.spec, design.revisions[0]!.spec)).toBe(true)
    expect(keepRevision(design).no).toBe(1)
    expect(design.revisions).toHaveLength(1)
  })

  it('lets the oldest go past the limit, and never uses a number twice', () => {
    const design = currentDesign(newStore())
    for (let n = 0; n < MAX_REVISIONS + 3; n++) {
      // Back and forth, so the tank stays inside its limits.
      design.spec.powerpack.fuelL += n % 2 === 0 ? -100 : 100
      keepRevision(design)
    }
    expect(design.revisions).toHaveLength(MAX_REVISIONS)
    expect(design.revisions[0]!.no).toBe(4)
    expect(lastRevision(design)!.no).toBe(MAX_REVISIONS + 3)
  })

  it('puts a revision back on the board', () => {
    const design = currentDesign(newStore())
    const first = design.spec.powerpack.fuelL
    keepRevision(design)
    design.spec.powerpack.fuelL += 200
    keepRevision(design)
    expect(restoreRevision(design, 1)).toBe(true)
    expect(design.spec.powerpack.fuelL).toBe(first)
    expect(restoreRevision(design, 9)).toBe(false)
    // The board is a copy too.
    design.spec.powerpack.fuelL += 50
    expect(design.revisions[0]!.spec.powerpack.fuelL).toBe(first)
    // Going back to an old build and sending it again is a new prototype.
    expect(keepRevision(design).no).toBe(3)
  })

  it('survives being saved, and reads an older save as having none', () => {
    const store = newStore()
    const design = currentDesign(store)
    keepRevision(design)
    design.spec.powerpack.fuelL += 100
    keepRevision(design)
    const back = decodeStore(encodeStore(store))!
    expect(currentDesign(back).revisions).toEqual(design.revisions)

    const old = JSON.parse(encodeStore(newStore())) as { designs: Record<string, unknown>[] }
    for (const each of old.designs) delete each.revisions
    expect(currentDesign(decodeStore(JSON.stringify(old))!).revisions).toEqual([])
  })

  it('throws away revision data that cannot be trusted', () => {
    const raw = JSON.parse(encodeStore(newStore())) as { designs: { revisions: unknown }[] }
    const good = cleanSpec(BASELINE_SPEC)
    raw.designs[0]!.revisions = [{ no: 2, spec: good }, { no: -1, spec: good }, 'x', { no: 1, spec: good }, { no: 2, spec: good }, { no: 3 }]
    const read = currentDesign(decodeStore(JSON.stringify(raw))!).revisions
    // Numbers must rise, and a revision with no design in it is no revision.
    expect(read.map((each) => each.no)).toEqual([2])
    raw.designs[0]!.revisions = 'nonsense'
    expect(currentDesign(decodeStore(JSON.stringify(raw))!).revisions).toEqual([])
  })
})
