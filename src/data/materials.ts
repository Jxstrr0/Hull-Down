// Armour materials for generation one. PR 1 uses only weight and cost;
// PR 3 adds how well each resists kinetic and shaped-charge threats.
// Game-level abstractions, not engineering data.

export interface Material {
  /** Tonnes per cubic metre. */
  densityTM3: number
  /** Korona per tonne, shaped and fitted. */
  costPerTKr: number
}

export const MATERIALS = {
  rolledSteel: { densityTM3: 7.85, costPerTKr: 9_000 },
  highHardSteel: { densityTM3: 7.85, costPerTKr: 16_000 },
  castSteel: { densityTM3: 7.8, costPerTKr: 7_000 },
  airGap: { densityTM3: 0, costPerTKr: 0 },
  compositeInsert: { densityTM3: 4.2, costPerTKr: 38_000 },
} as const satisfies Record<string, Material>
export type MaterialId = keyof typeof MATERIALS

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
