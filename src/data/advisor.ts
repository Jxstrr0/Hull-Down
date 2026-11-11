// The chief engineer: what he looks at when he reviews a design, and when
// he speaks up. He points at problems; he never designs the tank.

export const ADVISOR_MODES = ['off', 'ask', 'always'] as const
/** Off; only when asked; or after every change. */
export type AdvisorMode = (typeof ADVISOR_MODES)[number]

export const ADVISOR = {
  /** Early tenders start with him looking over every change. */
  defaultMode: 'always' as AdvisorMode,
  /** Firing tests he rehearses on paper to judge whether the tank will make its hits. */
  rehearsals: 4,
  /** He remarks on a reliability figure below this. */
  reliabilityIndex: 60,
  /** He remarks on a unit cost above this share of the tender's ceiling. */
  costShare: 0.9,
  /** The most he says at once: the worst first. */
  remarks: 6,
} as const
