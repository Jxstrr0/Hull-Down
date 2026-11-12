// The squad drop played back: a map from above with the vehicle at the foot,
// the squad getting out of the back and the targets ahead, the tracer going
// out to them, and the gunner's sight on the target being fired at. Faster
// than it happened; the clock shows the trial's own seconds. Plain SVG.
import { SQUAD_TRIAL } from '../data/squad'
import { STRINGS, fill } from '../data/strings'
import type { SquadResult } from '../sim/trials'
import { el } from './dom'
import { fixed } from './format'
import { replayControls, svg } from './replayPlayer'
import { squadFrame, squadTimeline, type SquadFrame, type SquadTimeline } from './squadTimeline'

const Q = STRINGS.range.squad
const P = Q.replay
const S = SQUAD_TRIAL
const R = S.replay
const SIZE = 200
const NOSE = { x: SIZE / 2, y: 160 }
const DOOR = { x: SIZE / 2, y: 180 }
const TURRET = { x: SIZE / 2, y: 168 }
const PER_M = (NOSE.y - 14) / R.mapM
const rounds = (n: number): string => n === 1 ? Q.rounds.one : fill(Q.rounds.many, { n: String(n) })
const nameOf = (n: number): string => Q.targetNames[n] ?? ''

/** Where a target lies on the map. */
function onMap(rangeM: number, n: number): { x: number; y: number } {
  const b = ((R.bearingsDeg[n] ?? 0) * Math.PI) / 180
  return { x: NOSE.x + rangeM * Math.sin(b) * PER_M, y: NOSE.y - rangeM * Math.cos(b) * PER_M }
}

/** Where each soldier takes cover, in a line either side of the door. */
function coverAt(n: number, of: number): { x: number; y: number } {
  return { x: DOOR.x + (n - (of - 1) / 2) * 12, y: SIZE - 8 }
}

/** What the caption says at one moment. */
function captionOf(run: SquadResult, line: SquadTimeline, frame: SquadFrame, atS: number): string {
  const n = frame.target
  const target = run.targets[n]!
  const standing = frame.down.filter((down) => !down).length
  switch (frame.phase) {
    case 'halt': return run.driveS === null ? P.halt : fill(P.haltAfter, { s: fixed(run.driveS, 0) })
    case 'fire': return fill(P.fire, {
      name: nameOf(n), m: String(target.rangeM),
      rounds: rounds(line.rounds.filter((round) => round.target === n && round.atS <= atS).length), h: String(frame.hits[n] ?? 0),
    })
    case 'down': return fill(P.down, { name: nameOf(n) })
    case 'clear': return fill(P.clear, { s: fixed(Math.max(...run.targets.map((each) => each.downS ?? 0)), 0) })
    case 'dry': return fill(P.dry, { n: String(standing) })
    case 'time': return fill(P.time, { n: String(run.targets.length - standing), of: String(run.targets.length) })
  }
}

/** A button that opens the replay, and the place it opens in. */
export function squadReplay(run: SquadResult): HTMLElement[] {
  const slot = el('div', 'rg-view-slot')
  const button = el('button', 'btn rg-watch', P.watch)
  button.type = 'button'
  button.dataset.key = 'range-watch:squad'
  button.addEventListener('click', () => {
    button.hidden = true
    slot.append(openReplay(run, () => {
      slot.replaceChildren()
      button.hidden = false
      button.focus()
    }))
  })
  return [button, slot]
}

function openReplay(run: SquadResult, onClose: () => void): HTMLElement {
  const line = squadTimeline(run)
  const box = el('div', 'rg-view rg-replay')
  box.setAttribute('role', 'group')
  box.setAttribute('aria-label', P.label)

  // The map: what stays put is drawn once.
  const area = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'rg-chart rg-replay-area', role: 'img', 'aria-label': P.areaLabel })
  const marks = run.targets.map((target, n) => {
    const at = onMap(target.rangeM, n)
    const shape = svg('rect', { x: fixed(at.x - 6, 1), y: fixed(at.y - 4, 1), width: '12', height: '8', class: 'rg-replay-grid' })
    // Crossed out once it is out of action: not colour alone.
    const cross = svg('path', { d: `M${fixed(at.x - 8, 1)} ${fixed(at.y - 6, 1)} L${fixed(at.x + 8, 1)} ${fixed(at.y + 6, 1)} M${fixed(at.x - 8, 1)} ${fixed(at.y + 6, 1)} L${fixed(at.x + 8, 1)} ${fixed(at.y - 6, 1)}`, class: 'rg-replay-down' })
    const label = svg('text', { x: fixed(at.x + 11, 1), y: fixed(at.y + 4, 1), class: 'rg-chart-text' }, String(n + 1))
    area.append(shape, cross, label)
    return { shape, cross, label, at }
  })
  const barrel = svg('line', { x1: String(TURRET.x), y1: String(TURRET.y), x2: String(TURRET.x), y2: String(TURRET.y - 16), class: 'rg-replay-barrel' })
  area.append(
    svg('rect', { x: String(NOSE.x - 6), y: String(NOSE.y), width: '12', height: String(DOOR.y - NOSE.y), rx: '2', class: 'rg-replay-gun' }),
    barrel,
  )
  const moving = svg('g', {})
  area.append(moving)

  // The gunner's sight on the target being fired at.
  const scale = SIZE / R.sightM
  const mid = SIZE / 2
  const sight = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'rg-chart rg-board rg-replay-close', role: 'img', 'aria-label': P.sightLabel })
  sight.append(
    svg('line', { x1: '0', y1: String(mid), x2: String(SIZE), y2: String(mid), class: 'rg-leg' }),
    svg('line', { x1: String(mid), y1: '0', x2: String(mid), y2: String(SIZE), class: 'rg-leg' }),
  )
  const sightTarget = svg('rect', { class: 'rg-board-target' })
  sight.append(sightTarget)
  const landed = svg('g', {})
  sight.append(landed)
  const sightKey = el('p', 'rg-board-key')

  const maps = el('div', 'rg-replay-maps')
  const sightBox = el('div', 'rg-replay-close-box')
  sightBox.append(sight, sightKey)
  maps.append(area, sightBox)

  const caption = el('p', 'rg-replay-caption')
  caption.setAttribute('aria-live', 'polite')
  box.append(maps, caption)

  const half = R.sightM / 2
  const clamp = (m: number): number => Math.max(-half, Math.min(half, m))
  let lastCaption = ''
  const draw = (atS: number): string => {
    const frame = squadFrame(run, line, atS)
    const n = frame.target
    for (const [targetNo, mark] of marks.entries()) {
      // The target being fired at is drawn heavier and its number bold.
      const now = targetNo === n && (frame.phase === 'fire' || frame.phase === 'halt')
      mark.shape.classList.toggle('rg-replay-now', now)
      mark.label.classList.toggle('rg-replay-now-label', now)
      mark.cross.setAttribute('visibility', frame.down[targetNo] ? 'visible' : 'hidden')
    }
    // The turret swings onto the target.
    const aim = marks[n]!.at
    const length = Math.hypot(aim.x - TURRET.x, aim.y - TURRET.y)
    barrel.setAttribute('x2', fixed(TURRET.x + ((aim.x - TURRET.x) / length) * 16, 1))
    barrel.setAttribute('y2', fixed(TURRET.y + ((aim.y - TURRET.y) / length) * 16, 1))

    moving.replaceChildren()
    // The squad: each soldier runs from the door to cover once out.
    for (const [soldier, outS] of line.outS.entries()) {
      if (outS > atS) continue
      const to = coverAt(soldier, line.outS.length)
      const along = Math.min(1, (atS - outS) / R.walkS)
      moving.append(svg('circle', {
        cx: fixed(DOOR.x + (to.x - DOOR.x) * along, 1), cy: fixed(DOOR.y + (to.y - DOOR.y) * along, 1), r: '2.6', class: 'rg-replay-shell',
      }))
    }
    // Tracer out to the target, then a burst where it fell.
    for (const round of line.rounds) {
      const since = atS - round.atS
      if (since < 0 || since > R.tracerS + R.burstS) continue
      const at = marks[round.target]!.at
      const end = { x: at.x + clamp(round.acrossM) * 2, y: at.y - clamp(round.upM) * 2 }
      if (since <= R.tracerS) {
        const along = since / R.tracerS
        const back = Math.max(0, along - 0.3)
        moving.append(svg('line', {
          x1: fixed(NOSE.x + (end.x - NOSE.x) * back, 1), y1: fixed(NOSE.y + (end.y - NOSE.y) * back, 1),
          x2: fixed(NOSE.x + (end.x - NOSE.x) * along, 1), y2: fixed(NOSE.y + (end.y - NOSE.y) * along, 1), class: 'rg-replay-trail',
        }))
      } else {
        const grow = (since - R.tracerS) / R.burstS
        moving.append(svg('circle', { cx: fixed(end.x, 1), cy: fixed(end.y, 1), r: fixed(2 + grow * 5, 1), class: 'rg-replay-burst' }))
      }
    }

    // The sight picture: the target's own size, and where each round on it fell.
    const shape = S.targets[n]!
    sightTarget.setAttribute('x', fixed(mid - (shape.widthM / 2) * scale, 1))
    sightTarget.setAttribute('y', fixed(mid - (shape.heightM / 2) * scale, 1))
    sightTarget.setAttribute('width', fixed(shape.widthM * scale, 1))
    sightTarget.setAttribute('height', fixed(shape.heightM * scale, 1))
    landed.replaceChildren()
    for (const round of line.rounds) {
      if (round.target !== n || round.atS > atS) continue
      const x = mid + clamp(round.acrossM) * scale
      const y = mid - clamp(round.upM) * scale
      if (round.hit) landed.append(svg('circle', { cx: fixed(x, 1), cy: fixed(y, 1), r: '4', class: 'rg-board-hit' }))
      else {
        const arm = 4
        landed.append(svg('path', {
          d: `M${fixed(x - arm, 1)} ${fixed(y - arm, 1)} L${fixed(x + arm, 1)} ${fixed(y + arm, 1)} M${fixed(x - arm, 1)} ${fixed(y + arm, 1)} L${fixed(x + arm, 1)} ${fixed(y - arm, 1)}`,
          class: 'rg-board-miss',
        }))
      }
      if (atS - round.atS < R.burstS) {
        const grow = (atS - round.atS) / R.burstS
        landed.append(svg('circle', { cx: fixed(x, 1), cy: fixed(y, 1), r: fixed(4 + grow * 12, 1), class: 'rg-replay-burst' }))
      }
    }
    sightKey.textContent = fill(P.sightKey, { name: nameOf(n) })

    const words = captionOf(run, line, frame, atS)
    if (words !== lastCaption) {
      caption.textContent = words
      lastCaption = words
    }
    const s = fixed(atS, 0)
    return run.troops > 0 ? fill(P.readout, { s, n: String(frame.out), of: String(run.troops) }) : fill(P.readoutNone, { s })
  }

  box.append(...replayControls(box, { key: 'squad', endS: line.endS, speed: R.speed, draw, onClose }))
  return box
}
