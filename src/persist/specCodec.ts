// Turns anything read from storage into a spec the game can trust. Unknown
// parts fall back to the baseline's, numbers are pulled into range, and the
// name is cleaned. Old or damaged saves load as far as they can.
import { BASELINE_SPEC } from '../data/baseline'
import { MATERIALS, ZONES, type MaterialId } from '../data/materials'
import { TUNING } from '../data/tuning'
import { CONTROLS } from '../office/controls'
import { cleanTiles, type ArmourLayer, type VehicleSpec } from '../sim/vehicle'

export const NAME_MAX = 28

/** A design name: one line, no odd spacing, not too long. */
export function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  // \p{Cc} is control characters; \p{Cf} is invisible formatting marks.
  return raw.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim()
}

function isMaterial(id: unknown): id is MaterialId {
  return typeof id === 'string' && Object.hasOwn(MATERIALS, id)
}

function cleanLayers(raw: unknown, fallback: ArmourLayer[]): ArmourLayer[] {
  if (!Array.isArray(raw)) return fallback
  const layers: ArmourLayer[] = []
  for (const item of raw as unknown[]) {
    if (layers.length >= TUNING.limits.maxLayersPerZone) break
    if (typeof item !== 'object' || item === null) continue
    const { material, mm } = item as { material?: unknown; mm?: unknown }
    if (!isMaterial(material) || typeof mm !== 'number' || !(mm > 0)) continue
    const most = Math.min(TUNING.limits.maxLayerMm, MATERIALS[material].maxMm)
    layers.push({ material, mm: Math.min(most, Math.max(TUNING.limits.minLayerMm, Math.round(mm))) })
  }
  return layers
}

export function cleanSpec(raw: unknown): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.name = ''
  if (typeof raw !== 'object' || raw === null) return spec
  const source = raw as VehicleSpec

  for (const control of CONTROLS) {
    let value: unknown
    try {
      value = control.get(source)
    } catch {
      continue // That part of the save is missing; keep the baseline's.
    }
    if (control.kind === 'choice' && typeof value === 'string') control.set(spec, value)
    else if (control.kind === 'number' && typeof value === 'number') control.set(spec, value)
    else if (control.kind === 'toggle' && typeof value === 'boolean') control.set(spec, value)
  }

  const armour: unknown = (raw as { armour?: unknown }).armour
  if (typeof armour === 'object' && armour !== null) {
    for (const zone of ZONES) spec.armour[zone] = cleanLayers((armour as Record<string, unknown>)[zone], spec.armour[zone])
  }
  const era: unknown = (raw as { era?: unknown }).era
  if (typeof era === 'object' && era !== null) {
    for (const zone of ZONES) spec.era[zone] = cleanTiles(zone, (era as Record<string, unknown>)[zone])
  }
  spec.name = cleanName((raw as { name?: unknown }).name)
  return spec
}
