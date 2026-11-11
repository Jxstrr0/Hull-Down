// The bureau's research: projects it pays for, each unlocking a part of the
// generation the tender is in. A part with no project here is to be had as
// soon as its generation is. Game-level numbers.
import type { TechField } from './tech'

export const RESEARCH_IDS = ['digitalComputer', 'thermalSight', 'layeredArmour'] as const
export type ResearchId = (typeof RESEARCH_IDS)[number]

export interface Project {
  /** The part the project unlocks: a spec field and the part's id in its table. */
  field: TechField
  part: string
  costKr: number
  /** Projects that must be done first. */
  needs: readonly ResearchId[]
}

export const RESEARCH: Record<ResearchId, Project> = {
  digitalComputer: { field: 'fireControl.computer', part: 'digital', costKr: 4_000_000, needs: [] },
  // The thermal picture is made by the digital computer's electronics.
  thermalSight: { field: 'fireControl.night', part: 'thermal', costKr: 6_000_000, needs: ['digitalComputer'] },
  layeredArmour: { field: 'material', part: 'layeredComposite', costKr: 5_000_000, needs: [] },
}
