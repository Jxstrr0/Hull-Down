// Save slots: whole saves kept on this device in the IndexedDB database
// `hulldown`. The game never touches a database of any other name. Where
// the browser will not give it a database (private mode on some phones)
// the slots live in memory and the screen says they will not last.
import { SAVES } from '../data/saves'
import { TENDERS } from '../data/tenders'
import { tenderIdOf } from '../sim/career/career'
import { readSave, SAVE_FORMAT, type SaveFile } from './saveCode'

export const DB_NAME = 'hulldown'
const STORE = 'slots'

/** The little a slot needs from wherever it is kept, so tests can pass a stand-in. */
export interface SlotBackend {
  /** False when the slots will be gone once the page is closed. */
  lasting: boolean
  get(key: number): Promise<unknown>
  set(key: number, value: unknown): Promise<void>
  delete(key: number): Promise<void>
}

export function memoryBackend(): SlotBackend {
  const kept = new Map<number, string>()
  return {
    lasting: false,
    get: (key) => Promise.resolve(kept.has(key) ? (JSON.parse(kept.get(key)!) as unknown) : undefined),
    set: (key, value) => {
      kept.set(key, JSON.stringify(value))
      return Promise.resolve()
    },
    delete: (key) => {
      kept.delete(key)
      return Promise.resolve()
    },
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

/** The device's own database, or memory when the browser will not open one. */
export async function openBackend(): Promise<SlotBackend> {
  try {
    const open = indexedDB.open(DB_NAME, 1)
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE)
    }
    const db = await request(open)
    const store = (mode: IDBTransactionMode): IDBObjectStore => db.transaction(STORE, mode).objectStore(STORE)
    return {
      lasting: true,
      get: (key) => request<unknown>(store('readonly').get(key)),
      set: async (key, value) => { await request(store('readwrite').put(value, key)) },
      delete: async (key) => { await request(store('readwrite').delete(key)) },
    }
  } catch {
    return memoryBackend()
  }
}

/** What the slot list shows for one slot. */
export interface SlotInfo {
  slot: number
  /** When it was saved, as an ISO date and time. */
  savedAt: string
  /** The tender the career is on, or null when the slot holds a plan chest and no career. */
  year: number | null
  /** Null while the tender is open; then whether it was won. */
  won: boolean | null
  designs: number
}

function validSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 1 && slot <= SAVES.slots
}

function infoOf(slot: number, savedAt: string, save: SaveFile): SlotInfo {
  const career = save.career
  return {
    slot,
    savedAt,
    year: career ? TENDERS[tenderIdOf(career)].year : null,
    won: career?.outcome ? career.outcome.won : null,
    designs: save.designs.designs.length,
  }
}

/** Keeps a save in a slot. False when the slot does not exist or the browser would not keep it. */
export async function writeSlot(backend: SlotBackend, slot: number, save: SaveFile, now: Date): Promise<boolean> {
  if (!validSlot(slot)) return false
  try {
    await backend.set(slot, { savedAt: now.toISOString(), save: { ...save, format: SAVE_FORMAT } })
    return true
  } catch {
    return false
  }
}

/** The save in a slot, cleaned and brought up to date. Null when the slot is empty or cannot be read. */
export async function readSlot(backend: SlotBackend, slot: number): Promise<{ info: SlotInfo; save: SaveFile } | null> {
  if (!validSlot(slot)) return null
  let raw: unknown
  try {
    raw = await backend.get(slot)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const { savedAt, save } = raw as { savedAt?: unknown; save?: unknown }
  const read = readSave(save)
  if (!read.ok) return null
  const when = typeof savedAt === 'string' && !Number.isNaN(Date.parse(savedAt)) ? savedAt : new Date(0).toISOString()
  return { info: infoOf(slot, when, read.save), save: read.save }
}

/** Every slot in order, null for an empty one. */
export async function listSlots(backend: SlotBackend): Promise<(SlotInfo | null)[]> {
  const out: (SlotInfo | null)[] = []
  for (let slot = 1; slot <= SAVES.slots; slot++) out.push((await readSlot(backend, slot))?.info ?? null)
  return out
}

export async function clearSlot(backend: SlotBackend, slot: number): Promise<boolean> {
  if (!validSlot(slot)) return false
  try {
    await backend.delete(slot)
    return true
  } catch {
    return false
  }
}
