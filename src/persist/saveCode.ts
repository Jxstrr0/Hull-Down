// The save code: a whole save as one line of text that can be copied, kept
// in a file or pasted into another device. It starts `HD1:`, then says how
// it is packed (`d` deflated, `p` plain for a browser that cannot deflate),
// then the save in base64url, then a checksum of the save as it was before
// packing:  HD1:d.<base64url>.<checksum>
import type { Career } from '../sim/career/career'
import { cleanCareer } from './careerCodec'
import { cleanStore, type DesignStore } from './designs'

export const SAVE_PREFIX = 'HD1:'
/** The layout of a save. Raise it when the layout changes, and add a step to `MIGRATIONS`. */
export const SAVE_FORMAT = 1

/** Everything one save slot holds. */
export interface SaveFile {
  format: number
  /** Null before a career is begun: the plan chest alone. */
  career: Career | null
  designs: DesignStore
}

export const SAVE_ERRORS = ['notACode', 'damaged', 'newer'] as const
/** Why a code could not be read: not one of ours, spoiled in copying, or from a later version of the game. */
export type SaveError = (typeof SAVE_ERRORS)[number]

export type Decoded = { ok: true; save: SaveFile } | { ok: false; error: SaveError }

/** One step up from each old layout to the next. Format 1 is the first, so there are none yet. */
export type Migrations = Record<number, (old: Record<string, unknown>) => Record<string, unknown>>
export const MIGRATIONS: Migrations = {}

function isObject(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
}

/**
 * Brings a save of any known layout up to today's and cleans it. A save
 * from a later version of the game is refused, not guessed at.
 */
export function readSave(raw: unknown, migrations: Migrations = MIGRATIONS, latest: number = SAVE_FORMAT): Decoded {
  if (!isObject(raw)) return { ok: false, error: 'damaged' }
  let save = raw
  let format = typeof save.format === 'number' && Number.isInteger(save.format) ? save.format : 0
  if (format < 1) return { ok: false, error: 'damaged' }
  if (format > latest) return { ok: false, error: 'newer' }
  while (format < latest) {
    const step = migrations[format]
    if (!step) return { ok: false, error: 'damaged' }
    save = { ...step(save), format: format + 1 }
    format++
  }
  return { ok: true, save: { format: latest, career: cleanCareer(save.career), designs: cleanStore(save.designs) } }
}

// --- bytes and text --------------------------------------------------------

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export function toBase64Url(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    out += ALPHABET[a >> 2]
    out += ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)]
    if (b !== undefined) out += ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)]
    if (c !== undefined) out += ALPHABET[c & 63]
  }
  return out
}

/** Null when the text is not base64url. */
export function fromBase64Url(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null
  const bytes = new Uint8Array(Math.floor((text.length * 3) / 4))
  let at = 0
  for (let i = 0; i < text.length; i += 4) {
    const n = [0, 1, 2, 3].map((k) => (i + k < text.length ? ALPHABET.indexOf(text[i + k]!) : 0))
    if (n.some((value) => value < 0)) return null
    bytes[at++] = (n[0]! << 2) | (n[1]! >> 4)
    if (i + 2 < text.length) bytes[at++] = ((n[1]! & 15) << 4) | (n[2]! >> 2)
    if (i + 3 < text.length) bytes[at++] = ((n[2]! & 3) << 6) | n[3]!
  }
  return bytes
}

/** A 32-bit FNV-1a sum of the bytes, as eight hex figures. */
export function checksum(bytes: Uint8Array): string {
  let h = 0x811c9dc5
  for (const byte of bytes) {
    h ^= byte
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

async function pipe(bytes: Uint8Array, stream: { readable: ReadableStream<Uint8Array>; writable: WritableStream<BufferSource> }): Promise<Uint8Array> {
  const writer = stream.writable.getWriter()
  // Errors on the write side also show on the read side, which is the one awaited.
  void writer.write(bytes as BufferSource).catch(() => undefined)
  void writer.close().catch(() => undefined)
  return new Uint8Array(await new Response(stream.readable).arrayBuffer())
}

function canDeflate(): boolean {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function'
}

/** The save as a code. `deflate: false` leaves it unpacked, as an old browser would. */
export async function encodeSave(save: SaveFile, deflate: boolean = canDeflate()): Promise<string> {
  const plain = new TextEncoder().encode(JSON.stringify({ ...save, format: SAVE_FORMAT }))
  const sum = checksum(plain)
  if (!deflate) return `${SAVE_PREFIX}p.${toBase64Url(plain)}.${sum}`
  const packed = await pipe(plain, new CompressionStream('deflate-raw'))
  return `${SAVE_PREFIX}d.${toBase64Url(packed)}.${sum}`
}

/** Reads a code. Spaces and line breaks picked up in copying are ignored. */
export async function decodeSave(text: string): Promise<Decoded> {
  const code = text.replace(/\s+/g, '')
  if (!code.startsWith(SAVE_PREFIX)) return { ok: false, error: 'notACode' }
  const parts = code.slice(SAVE_PREFIX.length).split('.')
  const [kind, body, sum] = parts
  if (parts.length !== 3 || (kind !== 'd' && kind !== 'p') || !body || !sum) return { ok: false, error: 'damaged' }
  const bytes = fromBase64Url(body)
  if (!bytes) return { ok: false, error: 'damaged' }
  let plain = bytes
  if (kind === 'd') {
    if (!canDeflate()) return { ok: false, error: 'damaged' }
    try {
      plain = await pipe(bytes, new DecompressionStream('deflate-raw'))
    } catch {
      return { ok: false, error: 'damaged' }
    }
  }
  if (checksum(plain) !== sum) return { ok: false, error: 'damaged' }
  let raw: unknown
  try {
    raw = JSON.parse(new TextDecoder().decode(plain))
  } catch {
    return { ok: false, error: 'damaged' }
  }
  return readSave(raw)
}
