// Technology generations: which parts and materials a tender's year allows.
// A part not listed here has been there since generation one.
// Game-level abstractions, not engineering data.

/** One: the 1980s and 90s. Two: 2000 to 2010. Three: 2016 onward. */
export type Generation = 1 | 2 | 3

export const GENERATIONS: readonly Generation[] = [1, 2, 3]

/** The first tender year of each generation. */
export const GENERATION_FROM_YEAR = { 1: 1980, 2: 2000, 3: 2016 } as const satisfies Record<Generation, number>

/** The spec fields that take a part from a list, by the path the checks name them. */
export const TECH_FIELDS = ['fireControl.computer', 'fireControl.night', 'ammo.kinetic', 'ammo.shaped', 'material', 'protection.active'] as const
export type TechField = (typeof TECH_FIELDS)[number]

/** The parts that came after generation one, and the generation each came with. */
export const LATER_PARTS: Record<TechField, Readonly<Record<string, Generation>>> = {
  'fireControl.computer': { digital: 2 },
  'fireControl.night': { thermal: 2 },
  'ammo.kinetic': { longRod: 2 },
  'ammo.shaped': { tandem: 2, gunMissile: 2 },
  material: { layeredComposite: 2 },
  'protection.active': { softKill: 2, hardKill: 3 },
}
