// Offline play and the home screen. The service worker (scripts/sw.template.js)
// keeps a copy of the game so it opens with no signal. A new version downloads
// quietly and is swapped in only when the game is next opened, under the
// splash, so a design or a trial is never interrupted.
import { STRINGS } from '../data/strings'
import { el } from './dom'

/** Tells a waiting service worker to take over. The worker listens for the same words. */
export const SKIP_MESSAGE = 'hulldown-skip-waiting'
const WORKER_URL = './sw.js'

const S = STRINGS.offline

/** How this browser can put the game on the home screen. */
export type InstallWay = 'installed' | 'prompt' | 'iphone' | 'menu'

export function installWay(state: { standalone: boolean; canPrompt: boolean; iphone: boolean }): InstallWay {
  if (state.standalone) return 'installed'
  if (state.canPrompt) return 'prompt'
  return state.iphone ? 'iphone' : 'menu'
}

/** Whether the copy for offline play is in place. */
export type Kept = 'getting' | 'ready' | 'cannot'

/** The browser's own install question, held until the player asks for it. */
interface InstallPrompt extends Event {
  prompt: () => Promise<unknown>
}

let held: InstallPrompt | null = null
let installed = false
let kept: Kept = 'getting'
let redraw: (() => void) | null = null

function changed(): void {
  redraw?.()
}

function standalone(): boolean {
  const apple = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return installed || apple || window.matchMedia('(display-mode: standalone)').matches
}

function iphone(): boolean {
  const agent = navigator.userAgent
  // An iPad says it is a Mac, but a Mac has no touch screen.
  return /iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)
}

async function register(): Promise<void> {
  const workers = navigator.serviceWorker
  try {
    const controlled = workers.controller !== null
    const registration = await workers.register(WORKER_URL)
    // A newer version was downloaded during an earlier visit: use it from now on.
    if (registration.waiting && controlled) {
      workers.addEventListener('controllerchange', () => location.reload(), { once: true })
      registration.waiting.postMessage(SKIP_MESSAGE)
    }
    await workers.ready
    kept = 'ready'
  } catch {
    kept = 'cannot'
  }
  changed()
}

/** Call once when the page starts. */
export function startOffline(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    held = event as InstallPrompt
    changed()
  })
  window.addEventListener('appinstalled', () => {
    held = null
    installed = true
    changed()
  })
  // The dev server has no service worker; neither has a browser that lacks them.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    kept = 'cannot'
    return
  }
  void register()
}

/** The offline section of the Saves tab. `again` redraws the tab when something changes. */
export function drawOffline(again: () => void): HTMLElement {
  redraw = again
  const box = el('section', 'bu')
  box.append(el('h3', 'ds-group-title', S.heading), el('p', 'ctl-note', S.about))
  const status = el('p', 'ctl-note', S.kept[kept])
  status.dataset.key = 'offline:kept'
  box.append(status)

  const way = installWay({ standalone: standalone(), canPrompt: held !== null, iphone: iphone() })
  if (way === 'prompt') {
    const add = el('button', 'btn', S.add)
    add.type = 'button'
    add.dataset.key = 'offline:add'
    add.addEventListener('click', () => {
      const ask = held
      held = null
      void ask?.prompt().finally(changed)
    })
    box.append(add)
  } else {
    const line = el('p', 'ctl-note', S.ways[way])
    line.dataset.key = 'offline:way'
    box.append(line)
  }
  return box
}
