// The plan chest: the designs kept on this device. They live in localStorage
// for now because they are small. Careers (PR 8) move to IndexedDB.
import { BASELINE_SPEC } from '../data/baseline'
import { cleanPaint, DEFAULT_PAINT, type PaintId } from '../data/paint'
import type { VehicleSpec } from '../sim/vehicle'
import { cleanSpec } from './specCodec'

export const DESIGNS_KEY = 'hulldown.designs'
export const FIRST_PROJECT_NO = 101
export const MAX_DESIGNS = 30
/** Prototype revisions kept for each design. When one more is built the oldest goes. */
export const MAX_REVISIONS = 12
const FORMAT = 1

/** A design as it stood when a prototype of it went to the range. */
export interface Revision {
  /** Counts up from one for each design and is never reused. */
  no: number
  spec: VehicleSpec
}

export interface SavedDesign {
  /** The bureau's project number. Never reused, so it also tells designs apart. */
  projectNo: number
  spec: VehicleSpec
  /** The prototypes built from it, oldest first. */
  revisions: Revision[]
  /** The paint it wears. Looks only, so it is kept beside the spec and a repaint is not a new build. Left out means the default. */
  paint?: PaintId
}

/** The paint a design wears. */
export function paintOf(design: SavedDesign): PaintId {
  return design.paint ?? DEFAULT_PAINT
}

/** Repaint a design. The default is not written down, so old saves and new ones read alike. */
export function setPaint(design: SavedDesign, paint: PaintId): void {
  if (paint === DEFAULT_PAINT) delete design.paint
  else design.paint = paint
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
  return { designs: [{ projectNo: FIRST_PROJECT_NO, spec: blank(), revisions: [] }], current: FIRST_PROJECT_NO, nextProjectNo: FIRST_PROJECT_NO + 1 }
}

export function currentDesign(store: DesignStore): SavedDesign {
  const found = store.designs.find((design) => design.projectNo === store.current) ?? store.designs[0]
  if (found) return found
  // A store always holds at least one design; mend it if it somehow does not.
  const design: SavedDesign = { projectNo: store.nextProjectNo++, spec: blank(), revisions: [] }
  store.designs.push(design)
  store.current = design.projectNo
  return design
}

/** True when two specs build the same tank. The name is paint: it does not count. */
export function sameBuild(a: VehicleSpec, b: VehicleSpec): boolean {
  return JSON.stringify({ ...cleanSpec(a), name: '' }) === JSON.stringify({ ...cleanSpec(b), name: '' })
}

/** The newest prototype of a design, if any has been built. */
export function lastRevision(design: SavedDesign): Revision | undefined {
  return design.revisions[design.revisions.length - 1]
}

/**
 * Builds a prototype of the design as it stands and keeps it as a revision.
 * A design that has not changed since the last prototype is that prototype
 * again: no new revision is made. Gives back the revision the design now matches.
 */
export function keepRevision(design: SavedDesign): Revision {
  const last = lastRevision(design)
  if (last && sameBuild(last.spec, design.spec)) {
    last.spec = cleanSpec(design.spec)
    return last
  }
  const revision = { no: (last?.no ?? 0) + 1, spec: cleanSpec(design.spec) }
  design.revisions.push(revision)
  if (design.revisions.length > MAX_REVISIONS) design.revisions.splice(0, design.revisions.length - MAX_REVISIONS)
  return revision
}

/** Puts a kept revision back on the drawing board. False when the design has no such revision. */
export function restoreRevision(design: SavedDesign, no: number): boolean {
  const revision = design.revisions.find((each) => each.no === no)
  if (!revision) return false
  design.spec = cleanSpec(revision.spec)
  return true
}

/** Start a design and put it on the board. `from` copies an existing spec. False when the chest is full. */
export function addDesign(store: DesignStore, from?: VehicleSpec): boolean {
  if (store.designs.length >= MAX_DESIGNS) return false
  const design: SavedDesign = { projectNo: store.nextProjectNo++, spec: from ? cleanSpec(from) : blank(), revisions: [] }
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
    store.designs.push({ projectNo: store.nextProjectNo++, spec: blank(), revisions: [] })
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

/** The revisions of one design read from a save: numbered upwards, oldest first, no more than the chest keeps. */
function cleanRevisions(raw: unknown): Revision[] {
  if (!Array.isArray(raw)) return []
  const kept: Revision[] = []
  let highest = 0
  for (const item of raw as unknown[]) {
    if (typeof item !== 'object' || item === null) continue
    const { no, spec } = item as { no?: unknown; spec?: unknown }
    if (!wholeNumber(no) || no <= highest || typeof spec !== 'object' || spec === null) continue
    highest = no
    kept.push({ no, spec: cleanSpec(spec) })
  }
  return kept.slice(-MAX_REVISIONS)
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
  return cleanStore(raw)
}

/** A store from anything read out of a save. Anything that cannot be trusted is dropped. */
export function cleanStore(raw: unknown): DesignStore {
  if (typeof raw !== 'object' || raw === null) return newStore()
  const { designs, current, nextProjectNo } = raw as { designs?: unknown; current?: unknown; nextProjectNo?: unknown }
  if (!Array.isArray(designs)) return newStore()

  const kept: SavedDesign[] = []
  const seen = new Set<number>()
  for (const item of designs as unknown[]) {
    if (kept.length >= MAX_DESIGNS) break
    if (typeof item !== 'object' || item === null) continue
    const { projectNo, spec, revisions, paint } = item as { projectNo?: unknown; spec?: unknown; revisions?: unknown; paint?: unknown }
    if (!wholeNumber(projectNo) || seen.has(projectNo)) continue
    seen.add(projectNo)
    const design: SavedDesign = { projectNo, spec: cleanSpec(spec), revisions: cleanRevisions(revisions) }
    setPaint(design, cleanPaint(paint))
    kept.push(design)
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
