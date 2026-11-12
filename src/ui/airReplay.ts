// The air defence trial played back: each raider in turn on two maps from
// above, the vehicle at the foot of both. The far map shows the raider coming
// in from the horizon and how far out the radar, or the crew's eyes, can find
// it; the near map shows the gun's reach, the bursts fired and the raider
// brought down or getting through. Shapes and marks, not colour alone, tell
// a jet from a helicopter or a drone, and found from not yet found. Plain SVG.
import { AIR_TRIAL } from '../data/airDefence'
import { STRINGS, fill } from '../data/strings'
import type { AirResult } from '../sim/trials'
import type { AirRaider } from '../sim/trials/airDefence'
import { airFrame, airTimeline, type AirFrame, type AirTimeline } from './airTimeline'
import { el } from './dom'
import { fixed } from './format'
import { replayControls, svg } from './replayPlayer'

const K = STRINGS.range.air
const P = K.replay
const A = AIR_TRIAL
const R = A.replay
const SIZE = 200
/** The vehicle at the foot of each map. */
const CAR = { x: SIZE / 2, y: 186 }
const FAR_RINGS_KM = [5, 10, 15]
const NEAR_RINGS_KM = [1, 2, 3]

/** Metres to the nearest hundred, as the card tells them. */
const hundreds = (m: number): string => String(Math.round(m / 100) * 100)

interface MapView {
  svg: SVGElement
  perM: number
  /** Redrawn each frame. */
  marks: SVGElement
}

/** One map from above, out to `m` metres, with its rings named. */
function mapOf(m: number, ringsKm: number[], label: string): MapView {
  const perM = (CAR.y - 14) / m
  const view = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'rg-chart rg-replay-close', role: 'img', 'aria-label': label })
  for (const km of ringsKm) {
    const r = km * 1000 * perM
    // Each ring is named just inside it on the right, or where it runs off the edge.
    const b = Math.min(Math.asin(Math.min(1, (SIZE / 2 - 4) / r)), (50 * Math.PI) / 180)
    view.append(
      svg('circle', { cx: String(CAR.x), cy: String(CAR.y), r: fixed(r, 1), class: 'rg-leg' }),
      svg('text', {
        x: fixed(CAR.x + r * Math.sin(b) - 2, 1), y: fixed(CAR.y - r * Math.cos(b) + 10, 1), 'text-anchor': 'end', class: 'rg-chart-text',
      }, fill(P.km, { n: String(km) })),
    )
  }
  const marks = svg('g', {})
  view.append(marks, svg('rect', { x: String(CAR.x - 5), y: String(CAR.y - 4), width: '10', height: '8', rx: '2', class: 'rg-replay-gun' }))
  return { svg: view, perM, marks }
}

/** Where a raider is on a map. */
function pointOn(map: MapView, raider: number, rangeM: number): { x: number; y: number } {
  const b = ((R.bearingsDeg[raider] ?? 0) * Math.PI) / 180
  return { x: CAR.x + rangeM * Math.sin(b) * map.perM, y: CAR.y - rangeM * Math.cos(b) * map.perM }
}

/** A ring round the vehicle, with a word low on its left, clear of the raiders coming in ahead. Too small a ring has no room for it. */
function ring(map: MapView, m: number, dash: string, word: string): SVGElement[] {
  const r = m * map.perM
  const circle = svg('circle', { cx: String(CAR.x), cy: String(CAR.y), r: fixed(r, 1), class: dash })
  if (r < 24) return [circle]
  const b = Math.min(Math.asin(Math.min(1, (SIZE / 2 - 4) / r)), (60 * Math.PI) / 180)
  return [circle, svg('text', { x: fixed(CAR.x - r * Math.sin(b) + 3, 1), y: fixed(CAR.y - r * Math.cos(b) - 3, 1), class: 'rg-chart-text' }, word)]
}

/** A raider's mark: a jet a dart, a helicopter a disc under its rotor, a drone a diamond. Dashed until found. */
function raiderMark(kind: AirRaider['kind'], at: { x: number; y: number }, found: boolean): SVGElement[] {
  const cls = found ? 'rg-replay-grid rg-replay-now' : 'rg-replay-grid rg-replay-grid-out'
  const x = (dx: number): string => fixed(at.x + dx, 1)
  const y = (dy: number): string => fixed(at.y + dy, 1)
  switch (kind) {
    case 'jet': return [svg('path', { d: `M${x(0)} ${y(7)} L${x(6)} ${y(-6)} L${x(0)} ${y(-2)} L${x(-6)} ${y(-6)} Z`, class: cls })]
    case 'helicopter': return [
      svg('circle', { cx: x(0), cy: y(1), r: '4', class: cls }),
      svg('line', { x1: x(-8), y1: y(-5), x2: x(8), y2: y(-5), class: cls }),
    ]
    case 'drone': return [svg('path', { d: `M${x(0)} ${y(-5)} L${x(5)} ${y(0)} L${x(0)} ${y(5)} L${x(-5)} ${y(0)} Z`, class: cls })]
  }
}

/** What happened to a raider in the end, in the card's own words. */
function endWords(raider: AirRaider): string {
  if (raider.foundM === null) return K.notFound
  if (raider.reactionS === null) return raider.dry ? K.dryAt : K.tooLate
  const k = raider.bursts === 1 ? K.burstOne : fill(K.burstsMany, { n: String(raider.bursts) })
  if (raider.downedM !== null) return fill(K.downedAt, { m: hundreds(raider.downedM), k })
  const K1 = k.charAt(0).toUpperCase() + k.slice(1)
  return fill(raider.dry ? K.dryAfter : K.gotThrough, { K: K1 })
}

/** What the caption says at one moment. */
function captionOf(run: AirResult, frame: AirFrame): string {
  if (frame.over) return fill(P.over, { of: String(run.raiders.length), n: String(run.downed), b: String(run.bursts) })
  const raider = run.raiders[frame.raider]!
  switch (frame.event) {
    case 'shows': return fill(P.shows, {
      n: String(frame.raider + 1), of: String(run.raiders.length), name: K.names[raider.kind], km: fixed(A.kinds[raider.kind].appearM / 1000, 1),
    })
    case 'found': return fill(raider.byRadar ? K.foundRadar : K.foundEye, { m: hundreds(raider.foundM!) })
    case 'fires': {
      const first = raider.reactionS! < 0.05 ? K.firstWaiting : fill(K.firstAfter, { s: fixed(raider.reactionS!, 1) })
      return frame.bursts > 1 ? `${first} ${fill(P.bursts, { n: String(frame.bursts) })}` : first
    }
    case 'downed':
    case 'through': return endWords(raider)
  }
}

/** A button that opens the replay, and the place it opens in. */
export function airReplay(run: AirResult): HTMLElement[] {
  if (run.raiders.length === 0) return []
  const line = airTimeline(run)
  const slot = el('div', 'rg-view-slot')
  const button = el('button', 'btn rg-watch', P.watch)
  button.type = 'button'
  button.dataset.key = 'range-watch:air'
  button.addEventListener('click', () => {
    button.hidden = true
    slot.append(openReplay(run, line, () => {
      slot.replaceChildren()
      button.hidden = false
      button.focus()
    }))
  })
  return [button, slot]
}

function openReplay(run: AirResult, line: AirTimeline, onClose: () => void): HTMLElement {
  const box = el('div', 'rg-view rg-replay')
  box.setAttribute('role', 'group')
  box.setAttribute('aria-label', P.label)

  const far = mapOf(R.farM, FAR_RINGS_KM, fill(P.farLabel, { km: String(R.farM / 1000) }))
  const near = mapOf(R.nearM, NEAR_RINGS_KM, fill(P.nearLabel, { km: String(R.nearM / 1000) }))
  // The radar's sweep, to and fro over the ground ahead.
  const sweep = svg('line', { x1: String(CAR.x), y1: String(CAR.y), class: 'rg-replay-trail' })
  if (run.radar) far.svg.insertBefore(sweep, far.marks)

  const maps = el('div', 'rg-replay-maps')
  const farBox = el('div', 'rg-replay-close-box')
  farBox.append(far.svg, el('p', 'rg-board-key', run.radar ? P.farRadar : P.farEye))
  const nearBox = el('div', 'rg-replay-close-box')
  nearBox.append(near.svg, el('p', 'rg-board-key', P.nearKey))
  maps.append(farBox, nearBox)

  const caption = el('p', 'rg-replay-caption')
  caption.setAttribute('aria-live', 'polite')
  box.append(maps, caption)

  let lastCaption = ''
  const draw = (at: number): string => {
    const frame = airFrame(run, line, at)
    const n = frame.raider
    const raider = run.raiders[n]!
    const kind = A.kinds[raider.kind]

    if (run.radar) {
      const turn = (at % R.sweepS) / R.sweepS
      const b = ((R.sweepDeg * (turn < 0.5 ? 4 * turn - 1 : 3 - 4 * turn)) * Math.PI) / 180
      const reach = Math.min(kind.radarM, R.farM) * far.perM
      sweep.setAttribute('x2', fixed(CAR.x + Math.sin(b) * reach, 1))
      sweep.setAttribute('y2', fixed(CAR.y - Math.cos(b) * reach, 1))
    }

    // The far map: how far out this raider can be found, and where it is.
    far.marks.replaceChildren(...ring(far, run.radar ? kind.radarM : kind.eyeM, 'rg-replay-reach', run.radar ? P.radar : P.eye))
    // The near map: where the gun opens fire on a raider that closes, and its line.
    near.marks.replaceChildren()
    if (kind.speedMs > 0 && raider.openS !== null) near.marks.append(...ring(near, kind.appearM - kind.speedMs * raider.openS, 'rg-replay-reach', P.gun))
    if (kind.lineM > 0) near.marks.append(...ring(near, kind.lineM, 'rg-air-line', P.line))

    for (const map of [far, near]) {
      // Off the near map until it comes within it.
      if (frame.rangeM > R.farM * 1.02 || (map === near && frame.rangeM > R.nearM * 1.02)) continue
      const p = pointOn(map, n, frame.rangeM)
      if (frame.tracer && map === near) {
        map.marks.append(
          svg('line', { x1: String(CAR.x), y1: String(CAR.y - 4), x2: fixed(p.x, 1), y2: fixed(p.y, 1), class: 'rg-air-tracer' }),
          svg('circle', { cx: fixed(p.x, 1), cy: fixed(p.y, 1), r: '9', class: 'rg-replay-burst' }),
        )
      }
      map.marks.append(...raiderMark(raider.kind, p, frame.found))
      map.marks.append(svg('text', { x: fixed(p.x + 9, 1), y: fixed(p.y + 4, 1), class: 'rg-chart-text' }, String(n + 1)))
      if (frame.downed) {
        map.marks.append(svg('path', {
          d: `M${fixed(p.x - 8, 1)} ${fixed(p.y - 8, 1)} L${fixed(p.x + 8, 1)} ${fixed(p.y + 8, 1)} M${fixed(p.x - 8, 1)} ${fixed(p.y + 8, 1)} L${fixed(p.x + 8, 1)} ${fixed(p.y - 8, 1)}`,
          class: 'rg-replay-down',
        }))
      }
      if (frame.through) map.marks.append(svg('text', { x: fixed(p.x - 14, 1), y: fixed(p.y + 4, 1), class: 'rg-scout-alert' }, '!'))
    }

    const words = captionOf(run, frame)
    if (words !== lastCaption) {
      caption.textContent = words
      lastCaption = words
    }
    return fill(P.readout, { n: String(n + 1), of: String(run.raiders.length), km: fixed(frame.rangeM / 1000, 1), k: String(frame.downedSoFar) })
  }

  box.append(...replayControls(box, { key: 'air', endS: line.endAt, speed: R.speed, draw, onClose }))
  return box
}
