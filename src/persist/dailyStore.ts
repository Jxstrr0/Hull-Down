// The challenge of the day on this device: whether the office is working on
// it, how many tries were made today, and the best of them. A new day starts
// a clean sheet.
import type { KeyValue } from './designs'

export const DAILY_KEY = 'hulldown.daily'

export interface DailyBest {
  place: number
  /** How many bids there were. */
  of: number
  total: number
  legal: boolean
}

export interface DailyState {
  on: boolean
  day: number
  tries: number
  best: DailyBest | null
}

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0

function parseBest(value: unknown): DailyBest | null {
  if (typeof value !== 'object' || value === null) return null
  const { place, of, total, legal } = value as Record<string, unknown>
  if (!whole(place) || !whole(of) || place < 1 || place > of) return null
  if (typeof total !== 'number' || !Number.isFinite(total) || typeof legal !== 'boolean') return null
  return { place, of, total, legal }
}

/** What a stored value means today. Anything unreadable, or from another day, is a clean sheet. */
export function parseDaily(stored: string | null, today: number): DailyState {
  const clean: DailyState = { on: false, day: today, tries: 0, best: null }
  let read: unknown
  try {
    read = JSON.parse(stored ?? '')
  } catch {
    return clean
  }
  if (typeof read !== 'object' || read === null) return clean
  const { on, day, tries, best } = read as Record<string, unknown>
  clean.on = on === true
  if (day !== today || !whole(tries)) return clean
  return { ...clean, tries, best: parseBest(best) }
}

/** Storage can be blocked (private mode), so never throw. */
export function loadDaily(storage: KeyValue, today: number): DailyState {
  try {
    return parseDaily(storage.getItem(DAILY_KEY), today)
  } catch {
    return parseDaily(null, today)
  }
}

export function saveDaily(storage: KeyValue, state: DailyState): boolean {
  try {
    storage.setItem(DAILY_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}
