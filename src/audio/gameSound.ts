// The one sound of the game, switched on or off by the button in the header.
import { loadSound, saveSound } from '../persist/soundStore'
import { createSound } from './sound'

export const sound = createSound(loadSound())

/** The player switches the sound, and the choice is kept. */
export function switchSound(on: boolean): void {
  sound.setOn(on)
  saveSound(on)
}

// A page put in the background stops drawing; its engine should not hum on.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) sound.still()
  })
}
