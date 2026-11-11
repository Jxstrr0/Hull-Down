// The bureau's archive: the service records of the tanks the army adopted,
// kept apart from the career so they are still there after a new one starts.
import { BUILD_QUALITIES, BUILD_RATES, SERVICE } from '../data/service'
import { ZONES } from '../data/materials'
import { TENDER_IDS } from '../data/tenders'
import type { RecordPackage, RecordYear, ServiceRecord } from '../sim/career/record'
import { UPGRADE_ASK_KINDS } from '../sim/career/upgrade'
import type { KeyValue } from './designs'
import { cleanName } from './specCodec'

export const ARCHIVE_KEY = 'hulldown.archive'

function isObject(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
}

function whole(raw: unknown, min: number, max: number): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= min && raw <= max ? raw : null
}

const MOST = 1_000_000_000

function cleanYear(raw: unknown): RecordYear | null {
  if (!isObject(raw)) return null
  const year = whole(raw.year, 1, SERVICE.years)
  if (year === null) return null
  const count = (value: unknown): number => whole(value, 0, MOST) ?? 0
  const change = (value: unknown): number => whole(value, -100, 100) ?? 0
  return {
    year, built: count(raw.built), fleet: count(raw.fleet), tanks: count(raw.tanks), stops: count(raw.stops), towed: count(raw.towed),
    won: count(raw.won), lost: count(raw.lost), drawn: count(raw.drawn), army: change(raw.army), ministry: change(raw.ministry),
    royaltyKr: count(raw.royaltyKr),
  }
}

function cleanPackage(raw: unknown, letter: string): RecordPackage | null {
  if (!isObject(raw) || !isObject(raw.ask)) return null
  const ask = raw.ask
  const kind = UPGRADE_ASK_KINDS.find((id) => id === ask.kind)
  const afterYear = whole(raw.afterYear, 0, SERVICE.years)
  if (!kind || afterYear === null) return null
  const zone = ZONES.find((id) => id === ask.zone)
  if (kind === 'protection') return zone ? { letter, afterYear, ask: { kind, zone } } : null
  return { letter, afterYear, ask: { kind } }
}

function cleanRecord(raw: unknown): ServiceRecord | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !/^\d{1,10}:\d{1,3}$/.test(raw.id)) return null
  const tender = TENDER_IDS.find((id) => id === raw.tender)
  const production = isObject(raw.production) ? raw.production : {}
  const rate = BUILD_RATES.find((id) => id === production.rate)
  const quality = BUILD_QUALITIES.find((id) => id === production.quality)
  const year = whole(raw.year, 1900, 2100)
  const designation = cleanName(raw.designation)
  if (!tender || !rate || !quality || year === null || designation === '') return null
  const years: RecordYear[] = []
  for (const item of Array.isArray(raw.years) ? (raw.years as unknown[]) : []) {
    const line = cleanYear(item)
    if (line && !years.some((each) => each.year === line.year)) years.push(line)
  }
  years.sort((a, b) => a.year - b.year)
  const packages: RecordPackage[] = []
  for (const item of Array.isArray(raw.packages) ? (raw.packages as unknown[]) : []) {
    const letter = SERVICE.upgrade.letters[packages.length]
    if (!letter) break
    const one = cleanPackage(item, letter)
    if (one) packages.push(one)
  }
  return { id: raw.id, designation, name: cleanName(raw.name), year, tender, production: { rate, quality }, years, packages }
}

/** Whatever was stored, as a list of records that can be trusted. */
export function cleanArchive(raw: unknown): ServiceRecord[] {
  if (!Array.isArray(raw)) return []
  const kept: ServiceRecord[] = []
  for (const item of raw as unknown[]) {
    const record = cleanRecord(item)
    if (record && !kept.some((each) => each.id === record.id)) kept.push(record)
    if (kept.length >= SERVICE.archive.most) break
  }
  return kept
}

/** The archive kept here. Empty when there is none or it cannot be read. */
export function loadArchive(storage: KeyValue): ServiceRecord[] {
  try {
    const text = storage.getItem(ARCHIVE_KEY)
    return text === null ? [] : cleanArchive(JSON.parse(text))
  } catch {
    return []
  }
}

/** False when the browser would not keep it. */
export function saveArchive(storage: KeyValue, archive: readonly ServiceRecord[]): boolean {
  try {
    storage.setItem(ARCHIVE_KEY, JSON.stringify(archive))
    return true
  } catch {
    return false
  }
}
