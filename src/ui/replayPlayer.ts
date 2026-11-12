// The controls under a replay in the report: play and pause, a scrub bar,
// a readout and a close button. The replay draws itself; this keeps the clock.
import { STRINGS } from '../data/strings'
import { el } from './dom'
import { fixed } from './format'

const V = STRINGS.range.view
const SVG = 'http://www.w3.org/2000/svg'

/** One SVG element with its attributes, and its text if it has any. */
export function svg(tag: string, attrs: Record<string, string>, text?: string): SVGElement {
  const node = document.createElementNS(SVG, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  if (text !== undefined) node.textContent = text
  return node
}

export interface ReplayClock {
  /** Names the controls apart from another replay's, for keeping focus. */
  key: string
  /** Seconds the replay lasts, in the trial's own time. */
  endS: number
  /** Seconds of the trial played in each second watched. */
  speed: number
  /** Draws the replay at `atS` seconds; returns the readout's words. */
  draw: (atS: number) => string
  onClose: () => void
}

/** The control rows, playing from the start once `box` is on the page. */
export function replayControls(box: HTMLElement, clock: ReplayClock): HTMLElement[] {
  const { key, endS, speed } = clock
  const scrubRow = el('div', 'rg-view-row')
  const toggle = el('button', 'btn rg-view-toggle', V.pause)
  toggle.type = 'button'
  toggle.dataset.key = `range-toggle:${key}`
  const scrub = el('input', 'rg-view-scrub')
  scrub.type = 'range'
  scrub.min = '0'
  scrub.max = fixed(endS, 0)
  scrub.step = '1'
  scrub.value = '0'
  scrub.dataset.key = `range-scrub:${key}`
  scrub.setAttribute('aria-label', V.scrub)
  scrubRow.append(toggle, scrub)

  const bar = el('div', 'rg-view-row rg-replay-bar')
  const readout = el('span', 'rg-view-readout')
  const shut = el('button', 'btn', V.close)
  shut.type = 'button'
  shut.dataset.key = `range-close:${key}`
  bar.append(readout, shut)

  const draw = (atS: number): void => {
    const at = Math.min(atS, endS)
    readout.textContent = clock.draw(at)
    scrub.value = fixed(at, 0)
  }

  let atS = 0
  let playing = true
  let lastMs: number | null = null
  let frameId = 0
  const setPlaying = (on: boolean): void => {
    playing = on
    lastMs = null
    toggle.textContent = on ? V.pause : atS >= endS ? V.again : V.play
    if (on) frameId = requestAnimationFrame(tick)
    else cancelAnimationFrame(frameId)
  }
  const tick = (ms: number): void => {
    if (!box.isConnected) return
    if (lastMs !== null) atS = Math.min(endS, atS + ((ms - lastMs) / 1000) * speed)
    lastMs = ms
    draw(atS)
    if (atS >= endS) setPlaying(false)
    else if (playing) frameId = requestAnimationFrame(tick)
  }
  toggle.addEventListener('click', () => {
    if (playing) setPlaying(false)
    else {
      if (atS >= endS) atS = 0
      setPlaying(true)
    }
  })
  scrub.addEventListener('input', () => {
    if (playing) setPlaying(false)
    atS = Number(scrub.value)
    toggle.textContent = atS >= endS ? V.again : V.play
    draw(atS)
  })
  shut.addEventListener('click', () => {
    cancelAnimationFrame(frameId)
    clock.onClose()
  })
  draw(0)
  frameId = requestAnimationFrame(tick)
  return [scrubRow, bar]
}
