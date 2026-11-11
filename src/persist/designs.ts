// The plan chest: the designs kept on this device. They live in localStorage
// for now because they are small. Careers (PR 8) move to IndexedDB.
import { BASELINE_SPEC } from '../data/baseline'
import type { VehicleSpec } from '../sim/vehicle'
import { cleanSpec } from './specCodec'

export const DESIGNS_KEY = 'hulldown.designs'
export const FIRST_PROJECT_NO = 101
export const MAX_DESIGNS = 30
const FORMAT = 1

export interface SavedDesign {
  /** The bureau's project number. Never reused, so it also tells designs apart. */
  projectNo: number
  spec: VehicleSpec
}

export interface DesignStore {
  designs: SavedDesign[]
  /** Project number of the design on the drawing board. */
  current: number
  nextProjectNo: number
}

function blank(): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.name = ''
  return spec
}

export function newStore(): DesignStore {
  return { designs: [{ projectNo: FIRST_PROJECT_NO, spec: blank() }], current: FIRST_PROJECT_NO, nextProjectNo: FIRST_PROJECT_NO + 1 }
}

export function currentDesign(store: DesignStore): SavedDesign {
  const found = store.designs.find((design) => design.projectNo === store.current) ?? store.designs[0]
  if (found) return found
  // A store always holds at least one design; mend it if it somehow does not.
  const design = { projectNo: store.nextProjectNo++, spec: blank() }
  store.designs.push(design)
  store.current = design.projectNo
  return design
}

/** Start a design and put it on the board. `from` copies an existing spec. False when the chest is full. */
export function addDesign(store: DesignStore, from?: VehicleSpec): boolean {
  if (store.designs.length >= MAX_DESIGNS) return false
  const design = { projectNo: store.nextProjectNo++, spec: from ? cleanSpec(from) : blank() }
  store.designs.push(design)
  store.current = design.projectNo
  return true
}

export function openDesign(store: DesignStore, projectNo: number): void {
  if (store.designs.some((design) => design.projectNo === projectNo)) store.current = projectNo
}

/** Scrap a design. The chest never goes empty: scrapping the last one leaves a fresh design. */
export function scrapDesign(store: DesignStore, projectNo: number): void {
  store.designs = store.designs.filter((design) => design.projectNo !== projectNo)
  if (store.designs.length === 0) {
    store.designs.push({ projectNo: store.nextProjectNo++, spec: blank() })
  }
  if (!store.designs.some((design) => design.projectNo === store.current)) {
    store.current = store.designs[store.designs.length - 1]?.projectNo ?? FIRST_PROJECT_NO
  }
}

export function encodeStore(store: DesignStore): string {
  return JSON.stringify({ format: FORMAT, ...store })
}

function wholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/** Read a store from text. Anything that cannot be trusted is dropped; nothing at all gives a new store. */
export function decodeStore(text: string | null): DesignStore {
  if (!text) return newStore()
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return newStore()
  }
  if (typeof raw !== 'object' || raw === null) return newStore()
  const { designs, current, nextProjectNo } = raw as { designs?: unknown; current?: unknown; nextProjectNo?: unknown }
  if (!Array.isArray(designs)) return newStore()

  const kept: SavedDesign[] = []
  const seen = new Set<number>()
  for (const item of designs as unknown[]) {
    if (kept.length >= MAX_DESIGNS) break
    if (typeof item !== 'object' || item === null) continue
    const { projectNo, spec } = item as { projectNo?: unknown; spec?: unknown }
    if (!wholeNumber(projectNo) || seen.has(projectNo)) continue
    seen.add(projectNo)
    kept.push({ projectNo, spec: cleanSpec(spec) })
  }
  if (kept.length === 0) return newStore()

  let highest = 0
  for (const design of kept) highest = Math.max(highest, design.projectNo)
  const store: DesignStore = {
    designs: kept,
    current: wholeNumber(current) && seen.has(current) ? current : (kept[0]?.projectNo ?? FIRST_PROJECT_NO),
    nextProjectNo: wholeNumber(nextProjectNo) && nextProjectNo > highest ? nextProjectNo : highest + 1,
  }
  return store
}

/** The little bit of Storage this file needs, so tests can pass a stand-in. */
export interface KeyValue {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function loadStore(storage: KeyValue): DesignStore {
  try {
    return decodeStore(storage.getItem(DESIGNS_KEY))
  } catch {
    return newStore() // Storage is blocked. Work in memory.
  }
}

/** False when the browser would not keep it (private mode, or storage is full). */
export function saveStore(storage: KeyValue, store: DesignStore): boolean {
  try {
    storage.setItem(DESIGNS_KEY, encodeStore(store))
    return true
  } catch {
    return false
  }
}
