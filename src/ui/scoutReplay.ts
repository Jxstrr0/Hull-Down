// Spot and report played back: the route from above with the car on its way
// round the three lookouts, and beside it the view from the lookout, with
// the commander's search sweeping the ground ahead and each hidden vehicle
// boxed in as it is found or marked as it sees the car. The drives are a
// time-lapse; the clock shows the trial's own time. Plain SVG.
import { SCOUT_TRIAL } from '../data/scout'
import { STRINGS, fill } from '../data/strings'
import type { ScoutResult } from '../sim/trials'
import { el } from './dom'
import { fixed } from './format'
import { replayControls, svg } from './replayPlayer'
import { scoutFrame, scoutTimeline, type ScoutFrame, type ScoutTimeline } from './scoutTimeline'

const K = STRINGS.range.scout
const P = K.replay
const S = SCOUT_TRIAL
const R = S.replay
const SIZE = 200
/** The route drawn as a sketch: the start line and the three lookouts. Only for the picture. */
const START = { x: 100, y: 184 }
const LOOKOUTS = [{ x: 46, y: 128 }, { x: 72, y: 62 }, { x: 152, y: 30 }]
/** The car on the crest in the view from a lookout. */
const CAR = { x: SIZE / 2, y: 186 }
const PER_M = (CAR.y - 14) / R.viewM
const RINGS_KM = [1, 2, 3]

const kmOf = (leg: { roadKm: number; crossKm: number }): number => leg.roadKm + leg.crossKm
const legOf = (stop: number) => S.lookouts[stop] ?? S.home
const pointOf = (stop: number) => LOOKOUTS[stop] ?? START
/** The first target of each lookout in the run's numbering, for its name. */
const firstTarget = (stop: number): number => S.lookouts.slice(0, stop).reduce((n, lookout) => n + lookout.targets.length, 0)
const nameOf = (stop: number, target: number): string => K.targetNames[firstTarget(stop) + target] ?? ''

/** Where a hidden vehicle lies in the view from its lookout. */
function inView(stop: number, target: number, rangeM: number): { x: number; y: number } {
  const b = ((R.bearingsDeg[stop]?.[target] ?? 0) * Math.PI) / 180
  return { x: CAR.x + rangeM * Math.sin(b) * PER_M, y: CAR.y - rangeM * Math.cos(b) * PER_M }
}

/** Where the car is on the route map: the road part of each leg first, then open country. */
function onRoute(frame: ScoutFrame, stops: number): { x: number; y: number } {
  const toStop = frame.phase === 'home' || frame.phase === 'back' ? stops : frame.stop
  const to = pointOf(toStop)
  if (frame.phase === 'watch') return to
  if (frame.phase === 'back') return START
  const from = toStop === 0 ? START : pointOf(toStop - 1)
  return { x: from.x + (to.x - from.x) * frame.along, y: from.y + (to.y - from.y) * frame.along }
}

const clockOf = (s: number): string => fill(P.clock, { m: String(Math.floor(s / 60)), s: String(Math.floor(s % 60)) })

/** What the caption says at one moment. */
function captionOf(run: ScoutResult, frame: ScoutFrame): string {
  const stops = run.stops ?? []
  const tally = (stop: number) => {
    const targets = stops[stop]?.targets ?? []
    return { k: String(targets.filter((target) => target.foundS !== null).length), of: String(targets.length) }
  }
  switch (frame.phase) {
    case 'drive': return frame.stop === 0
      ? fill(P.away, { km: String(kmOf(legOf(0))) })
      : fill(P.onTo, { prev: String(frame.stop), n: String(frame.stop + 1), km: String(kmOf(legOf(frame.stop))), ...tally(frame.stop - 1) })
    case 'watch': {
      const event = frame.event
      if (!event) return fill(P.search, { n: String(frame.stop + 1) })
      const sighting = stops[frame.stop]!.targets[event.target]!
      const name = nameOf(frame.stop, event.target)
      if (event.kind === 'found') return fill(K.targetFound, { name, m: String(sighting.rangeM), s: fixed(event.s, 0) })
      return fill(event.first ? P.sawFirst : P.saw, { name, s: fixed(event.s, 0) })
    }
    case 'home': return fill(P.home, { prev: String(stops.length), km: String(kmOf(S.home)), ...tally(stops.length - 1) })
    case 'back': return fill(P.back, {
      min: fixed((run.totalS ?? 0) / 60, 0), n: String(run.found), of: String(run.hidden),
      seen: run.seen === 0 ? K.seenNone : run.seen === 1 ? K.seenOne : fill(K.seenMany, { n: String(run.seen) }),
    })
  }
}

/** A button that opens the replay, and the place it opens in. Nothing when the car never got round. */
export function scoutReplay(run: ScoutResult): HTMLElement[] {
  const line = scoutTimeline(run)
  if (!line) return []
  const slot = el('div', 'rg-view-slot')
  const button = el('button', 'btn rg-watch', P.watch)
  button.type = 'button'
  button.dataset.key = 'range-watch:scout'
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

function openReplay(run: ScoutResult, line: ScoutTimeline, onClose: () => void): HTMLElement {
  const stops = run.stops ?? []
  const box = el('div', 'rg-view rg-replay')
  box.setAttribute('role', 'group')
  box.setAttribute('aria-label', P.label)

  // The route: what stays put is drawn once.
  const route = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'rg-chart rg-replay-area', role: 'img', 'aria-label': P.routeLabel })
  for (let stop = 0; stop <= stops.length; stop++) {
    const from = stop === 0 ? START : pointOf(stop - 1)
    const to = pointOf(stop)
    const leg = legOf(stop)
    const road = leg.roadKm / kmOf(leg)
    const mid = { x: from.x + (to.x - from.x) * road, y: from.y + (to.y - from.y) * road }
    route.append(
      svg('line', { x1: fixed(from.x, 1), y1: fixed(from.y, 1), x2: fixed(mid.x, 1), y2: fixed(mid.y, 1), class: 'rg-scout-road' }),
      svg('line', { x1: fixed(mid.x, 1), y1: fixed(mid.y, 1), x2: fixed(to.x, 1), y2: fixed(to.y, 1), class: 'rg-scout-cross' }),
    )
  }
  route.append(
    svg('line', { x1: String(START.x - 12), y1: String(START.y), x2: String(START.x + 12), y2: String(START.y), class: 'rg-replay-barrel' }),
    svg('text', { x: String(START.x + 15), y: String(START.y + 4), class: 'rg-chart-text' }, P.start),
  )
  const posts = LOOKOUTS.slice(0, stops.length).map((at, n) => {
    const shape = svg('path', { d: `M${at.x} ${at.y - 7} L${at.x + 7} ${at.y + 5} L${at.x - 7} ${at.y + 5} Z`, class: 'rg-replay-grid' })
    const label = svg('text', { x: String(at.x + 10), y: String(at.y + 4), class: 'rg-chart-text' }, String(n + 1))
    route.append(shape, label)
    return { shape, label }
  })
  const car = svg('rect', { width: '8', height: '8', class: 'rg-replay-gun' })
  route.append(car)

  // The view from the lookout: the crest, the range rings, and the hidden vehicles.
  const view = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'rg-chart rg-replay-close', role: 'img', 'aria-label': P.viewLabel })
  view.append(svg('path', { d: `M0 ${CAR.y + 8} Q${CAR.x} ${CAR.y - 6} ${SIZE} ${CAR.y + 8}`, class: 'rg-leg' }))
  for (const km of RINGS_KM) {
    const r = km * 1000 * PER_M
    // Each ring is named just inside it, off to the right of the hidden vehicles, or where it runs off the edge.
    const b = Math.min(Math.asin(Math.min(1, (SIZE / 2 - 4) / r)), (50 * Math.PI) / 180)
    view.append(
      svg('circle', { cx: String(CAR.x), cy: String(CAR.y), r: fixed(r, 1), class: 'rg-replay-reach' }),
      svg('text', {
        x: fixed(CAR.x + r * Math.sin(b) - 2, 1), y: fixed(CAR.y - r * Math.cos(b) + 10, 1), 'text-anchor': 'end', class: 'rg-chart-text',
      }, fill(P.km, { n: String(km) })),
    )
  }
  const sweep = svg('line', { x1: String(CAR.x), y1: String(CAR.y), class: 'rg-replay-trail' })
  view.append(sweep, svg('rect', { x: String(CAR.x - 5), y: String(CAR.y - 4), width: '10', height: '8', rx: '2', class: 'rg-replay-gun' }))
  const marks = svg('g', {})
  view.append(marks)
  const viewKey = el('p', 'rg-board-key')

  const maps = el('div', 'rg-replay-maps')
  const routeBox = el('div', 'rg-replay-close-box')
  routeBox.append(route, el('p', 'rg-board-key', P.routeKey))
  const viewBox = el('div', 'rg-replay-close-box')
  viewBox.append(view, viewKey)
  maps.append(routeBox, viewBox)

  const caption = el('p', 'rg-replay-caption')
  caption.setAttribute('aria-live', 'polite')
  box.append(maps, caption)

  let lastCaption = ''
  let lastStop = -1
  const draw = (at: number): string => {
    const frame = scoutFrame(run, line, at)
    const n = frame.stop

    for (const [stop, post] of posts.entries()) {
      // The lookout being driven to or watched from is drawn heavier, its number bold.
      const now = stop === n && (frame.phase === 'drive' || frame.phase === 'watch')
      post.shape.classList.toggle('rg-replay-now', now)
      post.label.classList.toggle('rg-replay-now-label', now)
    }
    const where = onRoute(frame, stops.length)
    car.setAttribute('x', fixed(where.x - 4, 1))
    car.setAttribute('y', fixed(where.y - 4, 1))

    // The commander's search sweeps to and fro while the car is on the crest.
    if (frame.phase === 'watch') {
      const turn = (frame.watchS % R.sweepS) / R.sweepS
      const deg = R.sweepDeg * (turn < 0.5 ? 4 * turn - 1 : 3 - 4 * turn)
      const b = (deg * Math.PI) / 180
      const reach = R.viewM * PER_M
      sweep.setAttribute('x2', fixed(CAR.x + Math.sin(b) * reach, 1))
      sweep.setAttribute('y2', fixed(CAR.y - Math.cos(b) * reach, 1))
      sweep.setAttribute('visibility', 'visible')
    } else sweep.setAttribute('visibility', 'hidden')

    // The hidden vehicles: dashed until found, and a ! with a line back to the car once one has seen it.
    marks.replaceChildren()
    for (const [target, sighting] of (stops[n]?.targets ?? []).entries()) {
      const p = inView(n, target, sighting.rangeM)
      const found = frame.targetFound[target] ?? false
      const noticed = frame.targetNoticed[target] ?? false
      if (noticed) marks.append(svg('line', { x1: fixed(p.x, 1), y1: fixed(p.y, 1), x2: String(CAR.x), y2: String(CAR.y), class: 'rg-scout-seen' }))
      marks.append(
        svg('rect', { x: fixed(p.x - 6, 1), y: fixed(p.y - 4, 1), width: '12', height: '8', class: found ? 'rg-replay-grid rg-replay-now' : 'rg-replay-grid rg-replay-grid-out' }),
        svg('text', { x: fixed(p.x + 9, 1), y: fixed(p.y + 4, 1), class: 'rg-chart-text' }, String(firstTarget(n) + target + 1)),
      )
      if (noticed) marks.append(svg('text', { x: fixed(p.x - 13, 1), y: fixed(p.y + 4, 1), class: 'rg-scout-alert' }, '!'))
    }
    if (n !== lastStop) {
      viewKey.textContent = fill(P.viewKey, { n: String(n + 1) })
      lastStop = n
    }

    const words = captionOf(run, frame)
    if (words !== lastCaption) {
      caption.textContent = words
      lastCaption = words
    }
    return fill(P.readout, { clock: clockOf(frame.clockS), n: String(frame.found), of: String(run.hidden) })
  }

  box.append(...replayControls(box, { key: 'scout', endS: line.endAt, speed: R.speed, draw, onClose }))
  return box
}
