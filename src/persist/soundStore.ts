// Whether the sound is on, kept on this device. On until the player says otherwise.
import type { KeyValue } from './designs'

export const SOUND_KEY = 'hulldown.sound'

const OFF = 'off'
const ON = 'on'

/** What a stored value means. Anything but a clear "off" is on. */
export function parseSound(stored: string | null): boolean {
  return stored !== OFF
}

/** Storage can be blocked (private mode), so never throw. */
export function loadSound(storage: KeyValue | undefined = safeStorage()): boolean {
  try {
    return parseSound(storage?.getItem(SOUND_KEY) ?? null)
  } catch {
    return true
  }
}

export function saveSound(on: boolean, storage: KeyValue | undefined = safeStorage()): void {
  try {
    storage?.setItem(SOUND_KEY, on ? ON : OFF)
  } catch {
    // Not saved; the choice still holds for this visit.
  }
}

function safeStorage(): KeyValue | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}
