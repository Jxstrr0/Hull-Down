// Armour materials: weight, cost, and how well each
// resists the two kinds of threat.
// Game-level abstractions, not engineering data.

export interface Material {
  /** Tonnes per cubic metre. */
  densityTM3: number
  /** Korona per tonne, shaped and fitted. */
  costPerTKr: number
  /** Millimetres of rolled steel that one millimetre is worth against kinetic rounds. */
  ke: number
  /** The same against shaped-charge warheads. */
  ce: number
  /** Thickest single layer that can be made, millimetres. */
  maxMm: number
  /** An insert or a gap: it needs a solid plate on both sides. */
  needsPlates: boolean
}

export const MATERIALS = {
  rolledSteel: { densityTM3: 7.85, costPerTKr: 9_000, ke: 1, ce: 1, maxMm: 300, needsPlates: false },
  highHardSteel: { densityTM3: 7.85, costPerTKr: 16_000, ke: 1.3, ce: 1, maxMm: 60, needsPlates: false },
  castSteel: { densityTM3: 7.8, costPerTKr: 7_000, ke: 0.9, ce: 0.9, maxMm: 600, needsPlates: false },
  // The gap itself is empty; the weight and cost are its brackets and spacers.
  airGap: { densityTM3: 0.3, costPerTKr: 20_000, ke: 0, ce: 0.2, maxMm: 200, needsPlates: true },
  compositeInsert: { densityTM3: 4.2, costPerTKr: 38_000, ke: 0.7, ce: 1.3, maxMm: 300, needsPlates: true },
  // Generation two (src/data/tech.ts).
  layeredComposite: { densityTM3: 4.6, costPerTKr: 64_000, ke: 0.95, ce: 1.7, maxMm: 300, needsPlates: true },
} as const satisfies Record<string, Material>
export type MaterialId = keyof typeof MATERIALS
export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[]

/** The armour zones, front to back, hull then turret. */
export const ZONES = [
  'upperGlacis',
  'lowerGlacis',
  'hullSideFront',
  'hullSideRear',
  'hullRear',
  'hullRoof',
  'belly',
  'turretFrontLeft',
  'turretFrontRight',
  'mantlet',
  'turretSides',
  'turretRear',
  'turretRoof',
] as const
export type ZoneId = (typeof ZONES)[number]

/** The direction each zone faces. Its protection is quoted against a level shot from there. */
export type Facing = 'front' | 'side' | 'rear' | 'top' | 'bottom'

export const ZONE_FACING = {
  upperGlacis: 'front',
  lowerGlacis: 'front',
  hullSideFront: 'side',
  hullSideRear: 'side',
  hullRear: 'rear',
  hullRoof: 'top',
  belly: 'bottom',
  turretFrontLeft: 'front',
  turretFrontRight: 'front',
  mantlet: 'front',
  turretSides: 'side',
  turretRear: 'rear',
  turretRoof: 'top',
} as const satisfies Record<ZoneId, Facing>
