// The one sound of the game, switched on or off by the button in the header.
import { AUDIO } from '../data/audio'
import { loadSound, saveSound } from '../persist/soundStore'
import { createOfficeEar, type OfficeCue } from './office'
import { createSound } from './sound'

export const sound = createSound(loadSound())

/** The player switches the sound, and the choice is kept. */
export function switchSound(on: boolean): void {
  sound.setOn(on)
  saveSound(on)
}

const ear = createOfficeEar()
const nowS = (): number => (typeof performance === 'undefined' ? 0 : performance.now() / 1000)

/** One of the office's sounds: the pencil, the stamp, the warning. */
export function officeSound(id: OfficeCue): void {
  const cue = ear.say(id, nowS())
  if (cue) sound.cue(cue, { gain: AUDIO.office.gain[id] })
}

// Every press on the page clicks, unless it made a sound of its own. A press
// is also when a browser lets sound begin, so each one wakes it.
if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element) || !target.closest(AUDIO.office.tapOn)) return
    sound.wake()
    const cue = ear.tap(nowS())
    if (cue) sound.cue(cue, { gain: AUDIO.office.gain.tap })
  })
}

// A page put in the background stops drawing; its engine should not hum on.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) sound.still()
  })
}
