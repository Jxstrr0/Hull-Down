// The office's small sounds: which one a moment calls for. Plain logic, no
// browser sound here, so it can be tested.
import { AUDIO, type CueId } from '../data/audio'

export type OfficeCue = keyof typeof AUDIO.office.gain

/**
 * Listens to the office. `say` is called by whatever just happened (a design
 * changed, a stamp came down); `tap` is called afterwards for every press on
 * the page, and gives a click only when the press made no sound of its own.
 */
export interface OfficeEar {
  /** Something happened at `nowS` seconds. Gives the sound to play, or null when it came too soon after the same one. */
  say(id: OfficeCue, nowS: number): CueId | null
  /** A press on the page at `nowS`. Gives the click, or null if the press already made a sound. */
  tap(nowS: number): CueId | null
}

export function createOfficeEar(): OfficeEar {
  const last = new Map<OfficeCue, number>()
  /** When something last made a sound of its own. A press just after it stays quiet. */
  let spokeS: number | null = null
  const due = (id: OfficeCue, nowS: number): boolean => {
    const before = last.get(id)
    if (before !== undefined && nowS >= before && nowS - before < AUDIO.office.gapS) return false
    last.set(id, nowS)
    return true
  }
  return {
    say(id, nowS) {
      spokeS = nowS
      return due(id, nowS) ? id : null
    },
    tap(nowS) {
      const quiet = spokeS !== null && nowS >= spokeS && nowS - spokeS < AUDIO.office.gapS
      spokeS = null
      return !quiet && due('tap', nowS) ? 'tap' : null
    },
  }
}

/** The sound for a change to the design: a warning the moment it goes over the weight limit, the pencil otherwise. */
export function changeCue(wasOver: boolean, isOver: boolean): OfficeCue {
  return isOver && !wasOver ? 'warn' : 'pencil'
}
