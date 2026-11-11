// Editing a zone's armour, and the section view of it as plain data.
// No DOM in here, so it can be tested.
import { SECTION } from '../data/drawing'
import { MATERIALS, type MaterialId, type ZoneId } from '../data/materials'
import { TUNING } from '../data/tuning'
import type { ArmourLayer, Geometry, VehicleSpec } from '../sim/vehicle'

const L = TUNING.limits

function isMaterial(id: string): id is MaterialId {
  return Object.hasOwn(MATERIALS, id)
}

/** The thicknesses a layer of this material can have. */
export function layerRange(material: MaterialId): { min: number; max: number; step: number } {
  return { min: L.minLayerMm, max: Math.min(L.maxLayerMm, MATERIALS[material].maxMm), step: L.layerStepMm }
}

function snap(material: MaterialId, mm: number): number {
  const { min, max, step } = layerRange(material)
  return Math.min(max, Math.max(min, Math.round(mm / step) * step))
}

export function canAddLayer(spec: VehicleSpec, zone: ZoneId): boolean {
  return spec.armour[zone].length < L.maxLayersPerZone
}

/** A new steel plate on the inside of the stack. Does nothing when the zone is full. */
export function addLayer(spec: VehicleSpec, zone: ZoneId): void {
  if (canAddLayer(spec, zone)) spec.armour[zone].push({ material: 'rolledSteel', mm: L.newLayerMm })
}

export function removeLayer(spec: VehicleSpec, zone: ZoneId, index: number): void {
  if (Number.isInteger(index) && index >= 0) spec.armour[zone].splice(index, 1)
}

/** Ignores a material that does not exist. The thickness is pulled into what the new material allows. */
export function setLayerMaterial(spec: VehicleSpec, zone: ZoneId, index: number, material: string): void {
  const layer = spec.armour[zone][index]
  if (!layer || !isMaterial(material)) return
  layer.material = material
  layer.mm = snap(material, layer.mm)
}

/** Clamps to the material's range and snaps to the step. */
export function setLayerMm(spec: VehicleSpec, zone: ZoneId, index: number, mm: number): void {
  const layer = spec.armour[zone][index]
  if (!layer || !Number.isFinite(mm)) return
  layer.mm = snap(layer.material, mm)
}

/** Weight and cost of one layer over its whole zone. */
export function layerCost(geo: Geometry, zone: ZoneId, layer: ArmourLayer): { massT: number; costKr: number } {
  const material = MATERIALS[layer.material]
  const massT = geo.zoneAreaM2[zone] * (layer.mm / 1000) * material.densityTM3
  return { massT, costKr: massT * material.costPerTKr }
}

// --- Section view ---------------------------------------------------------

export interface Slab {
  material: MaterialId
  /** Corners in SVG space (millimetres, y down), outer bottom corner first. */
  points: [number, number][]
}

export interface Section {
  box: { x: number; y: number; w: number; h: number }
  /** Outside layer first. */
  slabs: Slab[]
  /** The level shot: where it starts, meets the plate, leaves it and stops. */
  shot: { y: number; startX: number; enterX: number; exitX: number; endX: number }
  /** How far the shot travels inside the armour. */
  pathMm: number
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * A strip of the zone's plate, cut through and drawn to scale, leaning at its
 * slope, with a level shot coming from the left.
 */
export function sectionOf(layers: readonly ArmourLayer[], slopeDeg: number): Section {
  const S = SECTION
  const slope = (slopeDeg * Math.PI) / 180
  const factor = 1 / Math.cos(slope)
  /** How far the top of the strip sits behind its bottom. */
  const lean = S.stripMm * Math.tan(slope)

  const slabs: Slab[] = []
  let x = 0
  for (const layer of layers) {
    const across = layer.mm * factor
    slabs.push({
      material: layer.material,
      points: [
        [round(x), S.stripMm],
        [round(x + across), S.stripMm],
        [round(x + across + lean), 0],
        [round(x + lean), 0],
      ],
    })
    x += across
  }

  const enterX = lean / 2
  const exitX = enterX + x
  const left = -S.leadMm - S.marginMm
  const right = Math.max(x + lean, exitX + S.tailMm) + S.marginMm
  return {
    box: { x: round(left), y: -S.marginMm, w: round(Math.max(S.minWidthMm, right - left)), h: S.stripMm + 2 * S.marginMm },
    slabs,
    shot: { y: S.stripMm / 2, startX: -S.leadMm, enterX: round(enterX), exitX: round(exitX), endX: round(exitX + S.tailMm) },
    pathMm: x,
  }
}
