// The fire mission played back: an area map with the gun at the foot and
// the grids beyond the hill, the shells flying out to them, and a close-up
// of the grid being fired on. Faster than it happened; the clock shows the
// trial's own seconds. Plain SVG, no 3D.
import { FIRE_MISSION } from '../data/fireMission'
import { STRINGS, fill } from '../data/strings'
import type { FireMissionResult } from '../sim/trials'
import { el } from './dom'
import { fixed } from './format'
import { missionFrame, missionTimeline, type MissionFrame, type MissionTimeline } from './missionTimeline'
import { replayControls, svg } from './replayPlayer'

const M = STRINGS.range.fireMission
const P = M.replay
const F = FIRE_MISSION
const SIZE = 200

const GUN = { x: SIZE / 2, y: SIZE - 10 }
const PER_KM = (SIZE - 20) / F.replay.mapKm

/** Where a point lies on the area map, from its range and bearing. */
function onArea(km: number, bearingDeg: number): { x: number; y: number } {
  const b = (bearingDeg * Math.PI) / 180
  return { x: GUN.x + km * Math.sin(b) * PER_KM, y: GUN.y - km * Math.cos(b) * PER_KM }
}

/** What the caption says at one moment. */
function captionOf(run: FireMissionResult, line: MissionTimeline, frame: MissionFrame, atS: number): string {
  const grid = run.grids[frame.grid]
  const n = String(frame.grid + 1)
  const km = String(grid?.rangeKm ?? 0)
  switch (frame.phase) {
    case 'emplace': return P.emplace
    case 'plot': return fill((line.grids[frame.grid]?.turnS ?? 0) > 0.5 ? P.turn : P.plot, { n, km })
    case 'fire': return fill(P.fire, { n, k: String(line.shells.filter((s) => s.grid === frame.grid && s.landS <= atS).length) })
    case 'out': return fill(P.out, { n, km })
    case 'left': return fill(P.left, { n })
    case 'done': return fill(P.done, { k: String(line.shells.length), s: fixed(line.shells.at(-1)?.landS ?? line.endS, 0) })
  }
}

/** A button that opens the replay, and the place it opens in. */
export function missionReplay(run: FireMissionResult, reachKm: number): HTMLElement[] {
  const slot = el('div', 'rg-view-slot')
  const button = el('button', 'btn rg-watch', P.watch)
  button.type = 'button'
  button.dataset.key = 'range-watch:fireMission'
  button.addEventListener('click', () => {
    button.hidden = true
    slot.append(openReplay(run, reachKm, () => {
      slot.replaceChildren()
      button.hidden = false
      button.focus()
    }))
  })
  return [button, slot]
}

function openReplay(run: FireMissionResult, reachKm: number, onClose: () => void): HTMLElement {
  const line = missionTimeline(run)
  const box = el('div', 'rg-view rg-replay')
  box.setAttribute('role', 'group')
  box.setAttribute('aria-label', P.label)

  // The area map: what stays put is drawn once.
  const area = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'rg-chart rg-replay-area', role: 'img', 'aria-label': P.areaLabel })
  const reachR = Math.min(reachKm, F.replay.mapKm * 1.2) * PER_KM
  area.append(svg('circle', { cx: String(GUN.x), cy: String(GUN.y), r: fixed(reachR, 1), class: 'rg-replay-reach' }))
  const gridMarks = run.grids.map((grid, gridNo) => {
    const at = onArea(grid.rangeKm, grid.bearingDeg)
    const square = svg('rect', {
      x: fixed(at.x - 7, 1), y: fixed(at.y - 7, 1), width: '14', height: '14',
      class: grid.reached ? 'rg-replay-grid' : 'rg-replay-grid rg-replay-grid-out',
    })
    const label = svg('text', { x: fixed(at.x + 10, 1), y: fixed(at.y + 4, 1), class: 'rg-chart-text' }, String(gridNo + 1))
    area.append(square, label)
    return { square, label, at }
  })
  area.append(
    svg('path', { d: `M${GUN.x - 5} ${GUN.y + 4} L${GUN.x} ${GUN.y - 6} L${GUN.x + 5} ${GUN.y + 4} Z`, class: 'rg-replay-gun' }),
    svg('text', { x: String(GUN.x + 8), y: String(GUN.y + 4), class: 'rg-chart-text' }, P.gun),
  )
  const flying = svg('g', {})
  area.append(flying)

  // The close-up of the grid being fired on.
  const reach = F.plotM
  const scale = SIZE / (reach * 2)
  const mid = SIZE / 2
  const close = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'rg-chart rg-board rg-replay-close', role: 'img', 'aria-label': P.closeLabel })
  close.append(
    svg('line', { x1: '0', y1: String(mid), x2: String(SIZE), y2: String(mid), class: 'rg-leg' }),
    svg('line', { x1: String(mid), y1: '0', x2: String(mid), y2: String(SIZE), class: 'rg-leg' }),
    svg('circle', { cx: String(mid), cy: String(mid), r: fixed(run.marks.missM * scale, 1), class: 'rg-board-target' }),
  )
  const landed = svg('g', {})
  close.append(landed)
  const closeKey = el('p', 'rg-board-key')

  const maps = el('div', 'rg-replay-maps')
  const closeBox = el('div', 'rg-replay-close-box')
  closeBox.append(close, closeKey)
  maps.append(area, closeBox)

  const caption = el('p', 'rg-replay-caption')
  caption.setAttribute('aria-live', 'polite')

  box.append(maps, caption)

  const clamp = (m: number): number => Math.max(-reach, Math.min(reach, m))
  let lastCaption = ''
  const draw = (atS: number): string => {
    const frame = missionFrame(line, atS)
    for (const [gridNo, mark] of gridMarks.entries()) {
      // The grid being called for is drawn heavier and its number bold: not colour alone.
      const now = gridNo === frame.grid && frame.phase !== 'done'
      mark.square.classList.toggle('rg-replay-now', now)
      mark.label.classList.toggle('rg-replay-now-label', now)
    }
    flying.replaceChildren()
    for (const { shell, along } of frame.flying) {
      const to = gridMarks[shell.grid]!.at
      const x = GUN.x + (to.x - GUN.x) * along
      const y = GUN.y + (to.y - GUN.y) * along
      const back = Math.max(0, along - 0.15)
      flying.append(
        svg('line', {
          x1: fixed(GUN.x + (to.x - GUN.x) * back, 1), y1: fixed(GUN.y + (to.y - GUN.y) * back, 1),
          x2: fixed(x, 1), y2: fixed(y, 1), class: 'rg-replay-trail',
        }),
        svg('circle', { cx: fixed(x, 1), cy: fixed(y, 1), r: '2.2', class: 'rg-replay-shell' }),
      )
    }
    for (const shell of line.shells) {
      if (shell.landS > atS || atS - shell.landS > F.replay.burstS) continue
      const at = gridMarks[shell.grid]!.at
      const grow = (atS - shell.landS) / F.replay.burstS
      flying.append(svg('circle', { cx: fixed(at.x, 1), cy: fixed(at.y, 1), r: fixed(4 + grow * 8, 1), class: 'rg-replay-burst' }))
    }
    landed.replaceChildren()
    for (const shell of line.shells) {
      if (shell.grid !== frame.grid || shell.landS > atS) continue
      const x = mid + clamp(shell.acrossM) * scale
      const y = mid - clamp(shell.beyondM) * scale
      if (shell.first) landed.append(svg('rect', { x: fixed(x - 3.5, 1), y: fixed(y - 3.5, 1), width: '7', height: '7', class: 'rg-board-target' }))
      if (shell.missM <= run.marks.missM) landed.append(svg('circle', { cx: fixed(x, 1), cy: fixed(y, 1), r: '2.6', class: 'rg-board-hit' }))
      else {
        const arm = 3
        landed.append(svg('path', {
          d: `M${fixed(x - arm, 1)} ${fixed(y - arm, 1)} L${fixed(x + arm, 1)} ${fixed(y + arm, 1)} M${fixed(x - arm, 1)} ${fixed(y + arm, 1)} L${fixed(x + arm, 1)} ${fixed(y - arm, 1)}`,
          class: 'rg-board-miss',
        }))
      }
      if (atS - shell.landS < F.replay.burstS) {
        const grow = (atS - shell.landS) / F.replay.burstS
        landed.append(svg('circle', { cx: fixed(x, 1), cy: fixed(y, 1), r: fixed(3 + grow * 10, 1), class: 'rg-replay-burst' }))
      }
    }
    closeKey.textContent = fill(P.closeKey, { n: String(frame.grid + 1), m: String(run.marks.missM) })
    const words = captionOf(run, line, frame, atS)
    if (words !== lastCaption) {
      caption.textContent = words
      lastCaption = words
    }
    return fill(P.readout, { s: fixed(atS, 0) })
  }

  box.append(...replayControls(box, { key: 'fireMission', endS: line.endS, speed: F.replay.speed, draw, onClose }))
  return box
}
