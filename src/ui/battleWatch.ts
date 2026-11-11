// The button that opens the 3D view of one battle, and the view's controls:
// play and pause, a bar to drag through the battle, and which tank the camera
// stays with. three.js and the scene are fetched only when the button is
// pressed. What the camera is doing is always written under the picture.
import { battleCuesBetween, battleSpeedKmh } from '../audio/battleCues'
import { droneAt, voiceOf } from '../audio/cues'
import { sound } from '../audio/gameSound'
import { AUDIO } from '../data/audio'
import { STRINGS, fill } from '../data/strings'
import type { BattleView, TankLook } from '../render/battleScene'
import type { GraphicsLink } from './rangeScreen'
import type { BattleResult } from '../sim/battle/battle'
import { tankName } from './battleWords'
import { el } from './dom'
import { onHold } from './hold'
import { fixed } from './format'

const W = STRINGS.battle.watch

export interface BattleWatch {
  root: HTMLElement
  /** Closes the view and gives back what it held. Call before throwing this away. */
  stop(): void
}

export function createBattleWatch(battle: BattleResult, battleNo: number, mine: TankLook, theirs: TankLook, graphics: GraphicsLink): BattleWatch {
  const root = el('div', 'bw')
  const opener = el('button', 'btn bw-open', W.open)
  opener.type = 'button'
  opener.dataset.key = 'battle-watch'
  const slot = el('div', 'bw-slot')
  root.append(opener, slot)

  let view: BattleView | undefined
  let closed = true
  // How each side sounds: its engine, its gearbox and its gun.
  const voices = [voiceOf(mine.spec), voiceOf(theirs.spec)] as const
  const calibres = [voices[0].calibreMm, voices[1].calibreMm] as const

  let unhold = (): void => {}
  const stop = (): void => {
    closed = true
    unhold()
    view?.dispose()
    sound.still()
    view = undefined
    slot.replaceChildren()
    opener.hidden = false
  }

  const open = async (): Promise<void> => {
    closed = false
    opener.hidden = true
    // Opened by a tap, which is when a browser lets sound begin.
    sound.wake()
    const box = el('div', 'rg-view bw-view')
    const stage = el('div', 'rg-view-stage')
    const status = el('p', 'rg-view-status', W.loading)
    status.setAttribute('role', 'status')
    stage.append(status)

    const row = el('div', 'bm-controls')
    const toggle = el('button', 'btn bm-play', W.pause)
    toggle.type = 'button'
    toggle.dataset.key = 'battle-watch-play'
    const scrub = el('input', 'bm-slider')
    scrub.type = 'range'
    scrub.min = '0'
    scrub.max = String(battle.endS)
    scrub.step = '0.5'
    scrub.dataset.key = 'battle-watch-time'
    scrub.setAttribute('aria-label', W.slider)
    row.append(toggle, scrub)

    // Which tank the camera stays with: the director's choice, or one of yours.
    const mineIndexes = battle.tanks.map((tank, index) => ({ tank, index })).filter(({ tank }) => tank.side === 0)
    let follow: number | null = null
    const cams = el('div', 'seg bw-cams')
    cams.setAttribute('role', 'group')
    cams.setAttribute('aria-label', W.camera)
    const camButtons = [null, ...mineIndexes.map(({ index }) => index)].map((id) => {
      const tank = id === null ? null : battle.tanks[id]
      const button = el('button', 'seg-item', tank ? fill(W.tank, { n: String(tank.no + 1) }) : W.director)
      button.type = 'button'
      button.dataset.key = `battle-watch-cam-${id === null ? 'director' : String(id)}`
      if (tank) button.setAttribute('aria-label', fill(W.tankLabel, { n: String(tank.no + 1) }))
      button.addEventListener('click', () => {
        follow = id
        markCams()
        view?.setFollow(id)
      })
      cams.append(button)
      return { id, button }
    })
    const markCams = (): void => {
      for (const each of camButtons) {
        each.button.classList.toggle('seg-on', each.id === follow)
        each.button.setAttribute('aria-pressed', String(each.id === follow))
      }
    }
    markCams()

    const readout = el('p', 'bm-status')
    readout.setAttribute('role', 'status')
    const close = el('button', 'btn bw-close', W.close)
    close.type = 'button'
    close.dataset.key = 'battle-watch-close'
    close.addEventListener('click', () => {
      stop()
      opener.focus({ preventScroll: true })
    })

    const controls = [toggle, scrub, ...camButtons.map((each) => each.button)]
    for (const control of controls) control.disabled = true
    box.append(stage, row, cams, readout, el('p', 'ctl-note', W.note), close)
    slot.replaceChildren(box)

    let playing = false
    let held = false
    unhold()
    unhold = onHold(() => {
      if (!closed && playing) view?.pause()
    })
    toggle.addEventListener('click', () => {
      held = false
      sound.wake()
      if (playing) view?.pause()
      else view?.play()
    })
    // Dragging the bar holds the battle still under the finger, then lets it go on.
    const letGo = (): void => {
      if (!held) return
      held = false
      view?.play()
    }
    scrub.addEventListener('pointerdown', () => {
      if (!playing) return
      held = true
      view?.pause()
      window.addEventListener('pointerup', letGo, { once: true })
      window.addEventListener('pointercancel', letGo, { once: true })
    })
    scrub.addEventListener('change', letGo)
    scrub.addEventListener('input', () => view?.seek(Number(scrub.value)))

    let said = ''
    /** The moment of the battle the last picture showed, for hearing what happened since. */
    let heardS = 0
    try {
      const { openBattleView } = await import('../render/battleScene')
      if (closed) return
      view = openBattleView({
        host: stage,
        label: fill(W.label, { at: String(battleNo) }),
        battle,
        mine,
        theirs,
        follow,
        quality: graphics.tier(),
        onMeasured: (fps) => view?.setQuality(graphics.measured(fps)),
        onFrame: (frame) => {
          if (!held) scrub.value = String(frame.timeS)
          // The battle is heard from beside the tank the camera is with, while it plays.
          if (playing) {
            sound.air()
            for (const cue of battleCuesBetween(battle, heardS, frame.timeS, frame.tank, calibres)) sound.cue(cue.id, cue)
            const voice = voices[battle.tanks[frame.tank]?.side ?? 0]
            const drone = droneAt(voice, battleSpeedKmh(battle, frame.tank, frame.timeS))
            const share = AUDIO.battle.droneShare
            sound.drone(voice, { ...drone, engineGain: drone.engineGain * share, trackGain: drone.trackGain * share })
          }
          heardS = frame.timeS
          const who = tankName(battle, frame.tank)
          const words = `${fill(W.time, { at: fixed(frame.timeS, 0), n: fixed(battle.endS, 0) })} · ${
            fill(frame.look === 'close' ? W.beside : W.with, { who })}`
          // Only when it changes, so a screen reader is not told sixty times a second.
          if (words !== said) {
            said = words
            readout.textContent = words
          }
        },
        onState: (state) => {
          playing = state.playing
          if (held) return
          toggle.textContent = state.playing ? W.pause : state.ended ? W.again : W.play
        },
      })
      for (const control of controls) control.disabled = false
      status.remove()
    } catch {
      // No 3D on this device, or the code could not be fetched. The map and the list still say it all.
      if (!closed) status.textContent = W.failed
    }
  }

  opener.addEventListener('click', () => void open())
  return { root, stop }
}
