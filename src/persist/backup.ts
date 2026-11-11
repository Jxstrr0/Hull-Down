// The backup file and the reminder to take one. A phone's browser can clear
// a site's storage without asking, so the game asks the browser to keep it,
// and every fortnight suggests saving a copy outside the browser.
import { SAVES } from '../data/saves'
import type { KeyValue } from './designs'
import { SAVE_PREFIX } from './saveCode'

/** When the last backup was taken, and when the game was first played, as ISO dates. */
export const BACKUP_KEY = 'hulldown.backupAt'
export const FIRST_PLAYED_KEY = 'hulldown.firstPlayedAt'

const DAY_MS = 24 * 60 * 60 * 1000

function two(value: number): string {
  return String(value).padStart(2, '0')
}

/** `hull-down-backup-YYYY-MM-DD.txt`, by the player's own calendar. */
export function backupFileName(now: Date): string {
  return `hull-down-backup-${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}.txt`
}

/** What goes in the file: two lines for a person, then the code on a line of its own. */
export function backupFileText(code: string, now: Date, heading: string, hint: string): string {
  return `${heading} ${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}\n${hint}\n\n${code}\n`
}

/**
 * The save code in a backup file or in whatever was pasted. Gives the text
 * back unchanged when no line of it starts like a code, so the reader can
 * say what is wrong with it.
 */
export function codeIn(text: string): string {
  const lines = text.split(/\r?\n/).map((line) => line.trim())
  const start = lines.findIndex((line) => line.startsWith(SAVE_PREFIX))
  if (start < 0) return text
  // A code broken over several lines by an editor or a message app: take the lines up to the next gap.
  const end = lines.findIndex((line, index) => index > start && line === '')
  return lines.slice(start, end < 0 ? undefined : end).join('')
}

function dateAt(storage: KeyValue, key: string): number | null {
  try {
    const at = Date.parse(storage.getItem(key) ?? '')
    return Number.isNaN(at) ? null : at
  } catch {
    return null
  }
}

function note(storage: KeyValue, key: string, now: Date): boolean {
  try {
    storage.setItem(key, now.toISOString())
    return true
  } catch {
    return false
  }
}

/** Marks the day the game was first played here, once. The reminder counts from it until a backup is taken. */
export function noteFirstPlayed(storage: KeyValue, now: Date): void {
  if (dateAt(storage, FIRST_PLAYED_KEY) === null) note(storage, FIRST_PLAYED_KEY, now)
}

export function noteBackup(storage: KeyValue, now: Date): boolean {
  return note(storage, BACKUP_KEY, now)
}

/** Whole days since the last backup, or since the game was first played here if none was taken. Null when neither is known. */
export function daysSinceBackup(storage: KeyValue, now: Date): number | null {
  const from = dateAt(storage, BACKUP_KEY) ?? dateAt(storage, FIRST_PLAYED_KEY)
  return from === null ? null : Math.max(0, Math.floor((now.getTime() - from) / DAY_MS))
}

/** True when it is time to remind the player to take a backup. */
export function backupDue(storage: KeyValue, now: Date): boolean {
  const days = daysSinceBackup(storage, now)
  return days !== null && days >= SAVES.remindDays
}

/** Asks the browser not to clear the game's storage when space runs short. True when it agrees. */
export async function askToPersist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

/** Hands the player a text file to keep. */
export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
