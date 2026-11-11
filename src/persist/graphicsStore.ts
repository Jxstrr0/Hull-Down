// The picture quality kept on this device: what the player picked, what the
// game settled on when left to itself, and the last frame rate it measured.
import { FIRST_TIER, GRAPHICS_SETTINGS, TIER_IDS, type GraphicsSetting, type TierId } from '../data/graphics'
import { tierAfter } from '../render/frameMeter'
import type { KeyValue } from './designs'

export const GRAPHICS_KEY = 'hulldown.graphics'

export interface Graphics {
  setting: GraphicsSetting
  /** The tier the game has settled on by itself. Used while the setting is auto. */
  auto: TierId
  /** The last frame rate measured, frames a second, and the tier it was measured at. */
  measured: { fps: number; tier: TierId } | null
}

export function newGraphics(): Graphics {
  return { setting: 'auto', auto: FIRST_TIER, measured: null }
}

/** The tier the 3D views are drawn at. */
export function tierOf(graphics: Graphics): TierId {
  return graphics.setting === 'auto' ? graphics.auto : graphics.setting
}

/** The player picks a setting. Picking auto starts the game finding a tier again from the top. */
export function pickGraphics(graphics: Graphics, setting: GraphicsSetting): Graphics {
  return { ...graphics, setting, auto: setting === 'auto' ? FIRST_TIER : graphics.auto }
}

/** A view has measured its frame rate. Left to itself the game steps down when the device is not keeping up. */
export function withMeasure(graphics: Graphics, fps: number): Graphics {
  const tier = tierOf(graphics)
  const measured = { fps: Math.round(fps), tier }
  return graphics.setting === 'auto' ? { ...graphics, auto: tierAfter(tier, fps), measured } : { ...graphics, measured }
}

/** Graphics from anything read out of storage. Anything that cannot be trusted is dropped. */
export function cleanGraphics(raw: unknown): Graphics {
  const fresh = newGraphics()
  if (typeof raw !== 'object' || raw === null) return fresh
  const { setting, auto, measured } = raw as { setting?: unknown; auto?: unknown; measured?: unknown }
  const tier = (value: unknown): TierId | undefined => TIER_IDS.find((id) => id === value)
  const out: Graphics = {
    setting: GRAPHICS_SETTINGS.find((id) => id === setting) ?? fresh.setting,
    auto: tier(auto) ?? fresh.auto,
    measured: null,
  }
  if (typeof measured === 'object' && measured !== null) {
    const { fps, tier: at } = measured as { fps?: unknown; tier?: unknown }
    const where = tier(at)
    if (typeof fps === 'number' && Number.isFinite(fps) && fps > 0 && fps < 1000 && where) out.measured = { fps: Math.round(fps), tier: where }
  }
  return out
}

export function loadGraphics(storage: KeyValue): Graphics {
  try {
    const text = storage.getItem(GRAPHICS_KEY)
    return text === null ? newGraphics() : cleanGraphics(JSON.parse(text))
  } catch {
    return newGraphics() // Storage is blocked, or what is there cannot be read.
  }
}

/** False when the browser would not keep it. */
export function saveGraphics(storage: KeyValue, graphics: Graphics): boolean {
  try {
    storage.setItem(GRAPHICS_KEY, JSON.stringify(graphics))
    return true
  } catch {
    return false
  }
}
