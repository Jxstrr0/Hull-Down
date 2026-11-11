// The guided first contract: which tender it runs on and the part it
// points a newcomer at. The words are in `STRINGS.guide`.

export const GUIDE = {
  /** The tender the guide runs on, counting from nought. */
  tenderNo: 0,
  /** The control it sends the player to first: the Type 1 fails the night shoot. */
  part: 'fireControl.night',
} as const

export const GUIDE_STEPS = ['night', 'faults', 'build', 'trial', 'revise', 'enter', 'won', 'lost'] as const
export type GuideStep = (typeof GUIDE_STEPS)[number]
