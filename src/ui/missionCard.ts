// The fire mission in the range report: reach, the time to the first round,
// the rate and how close the shells landed, with every shell on one map.
import { FIRE_MISSION } from '../data/fireMission'
import { STRINGS, fill } from '../data/strings'
import type { FireMissionResult, RangeReport } from '../sim/trials'
import { el } from './dom'
import { fixed } from './format'
import type { CardKit } from './gunneryCards'
import { missionReplay } from './missionReplay'

const M = STRINGS.range.fireMission
const SVG = 'http://www.w3.org/2000/svg'

function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  return node
}

/** Every shell on one map, each grid laid over the middle. Near is a dot, far a cross, and a first round a square: no colour needed. */
function missionMap(run: FireMissionResult): HTMLElement {
  const reach = FIRE_MISSION.plotM
  const size = 200
  const scale = size / (reach * 2)
  const mid = size / 2
  const box = el('div', 'rg-chart-box rg-board-box')
  const chart = svg('svg', { viewBox: `0 0 ${size} ${size}`, class: 'rg-chart rg-board', role: 'img' })
  chart.append(
    svg('line', { x1: '0', y1: String(mid), x2: String(size), y2: String(mid), class: 'rg-leg' }),
    svg('line', { x1: String(mid), y1: '0', x2: String(mid), y2: String(size), class: 'rg-leg' }),
    svg('circle', { cx: String(mid), cy: String(mid), r: fixed(run.marks.missM * scale, 1), class: 'rg-board-target' }),
  )
  const clamp = (m: number): number => Math.max(-reach, Math.min(reach, m))
  let near = 0
  let far = 0
  for (const grid of run.grids) {
    for (const [n, shell] of grid.shells.entries()) {
      const x = mid + clamp(shell.acrossM) * scale
      const y = mid - clamp(shell.beyondM) * scale
      const close = shell.missM <= run.marks.missM
      if (close) near++
      else far++
      if (n === 0) {
        chart.append(svg('rect', { x: fixed(x - 3.5, 1), y: fixed(y - 3.5, 1), width: '7', height: '7', class: 'rg-board-target' }))
      }
      if (close) chart.append(svg('circle', { cx: fixed(x, 1), cy: fixed(y, 1), r: '2.6', class: 'rg-board-hit' }))
      else {
        const arm = 3
        chart.append(svg('path', {
          d: `M${fixed(x - arm, 1)} ${fixed(y - arm, 1)} L${fixed(x + arm, 1)} ${fixed(y + arm, 1)} M${fixed(x - arm, 1)} ${fixed(y + arm, 1)} L${fixed(x + arm, 1)} ${fixed(y - arm, 1)}`,
          class: 'rg-board-miss',
        }))
      }
    }
  }
  chart.setAttribute('aria-label', fill(M.mapLabel, { near: String(near), far: String(far), m: String(run.marks.missM) }))
  box.append(chart, el('p', 'rg-board-key', fill(M.mapKey, { m: String(run.marks.missM) })))
  return box
}

/** The fire mission's card, or nothing when the range did not run one. */
export function missionCards(report: RangeReport, reachKm: number, kit: CardKit): HTMLElement[] {
  const run = report.fireMission
  if (!run) return []
  const ranges = run.grids.map((grid) => grid.rangeKm)
  const box = kit.card(M.title, fill(M.about, {
    n: String(run.grids.length), near: String(Math.min(...ranges)), far: String(Math.max(...ranges)),
  }), run.passed)
  const km = fixed(reachKm, 1)
  const out = run.grids.filter((grid) => !grid.reached)
  const lines = el('ul', 'rg-lines')
  lines.append(
    kit.line(M.reach, [
      out.length === 0 ? fill(M.reachAll, { km })
        : out.length === run.grids.length ? fill(M.reachNone, { km })
          : fill(M.reachShort, { km, grids: out.map((grid) => String(grid.rangeKm)).join(', ') }),
    ], run.reachPassed, run.reachPassed ? undefined : kit.fixButton(out.length === run.grids.length ? 'gun' : 'barrel', 'mission-reach')),
    kit.line(M.first, [
      run.firstRoundS === null ? M.firstNone : fill(M.firstValue, { s: fixed(run.firstRoundS, 0) }),
      fill(M.firstMark, { n: String(run.marks.firstRoundS) }),
    ], run.timePassed, run.timePassed ? undefined : kit.fixButton('fireControl.computer', 'mission-first')),
    kit.line(M.rate, [
      fill(M.rateValue, { n: fixed(run.rpm, 1) }),
      fill(M.rateMark, { n: String(run.marks.rpm) }),
    ], run.ratePassed, run.ratePassed ? undefined : kit.fixButton('loading', 'mission-rate')),
    kit.line(M.close, [
      run.missM === null ? M.closeNone
        : fill(M.closeValue, { m: fixed(run.missM, 0), n: String(run.grids.reduce((sum, grid) => sum + grid.shells.length, 0)) }),
      fill(M.closeMark, { n: String(run.marks.missM) }),
    ], run.closePassed, run.closePassed ? undefined : kit.fixButton('fireControl.computer', 'mission-close')),
  )
  for (const grid of run.grids) {
    const name = fill(M.grid, { km: String(grid.rangeKm), deg: String(Math.abs(grid.bearingDeg)), side: grid.bearingDeg < 0 ? M.left : M.right })
    const [first, ...rest] = grid.shells
    let words: string
    if (!grid.reached) words = M.gridOut
    else if (!first || grid.firstRoundS === null) words = M.gridLeft
    else {
      const after = rest.length > 0 ? rest.reduce((sum, shell) => sum + shell.missM, 0) / rest.length : first.missM
      words = fill(M.gridShot, { s: fixed(grid.firstRoundS, 0), f: fixed(first.missM, 0), n: String(grid.shells.length), m: fixed(after, 0) })
    }
    // Each grid is told as it went: it has no mark of its own, so no verdict.
    const item = el('li', 'rg-line-item')
    const head = el('div', 'rg-line-head')
    head.append(el('span', 'rg-line-name', name))
    item.append(head, el('p', 'rg-line-text', words))
    lines.append(item)
  }
  if (run.grids.some((grid) => grid.shells.length > 0)) box.append(...missionReplay(run, reachKm))
  box.append(lines)
  if (run.grids.some((grid) => grid.shells.length > 0)) box.append(missionMap(run))
  const notes: string[] = []
  const turnS = run.grids.reduce((sum, grid) => sum + grid.turnS, 0)
  if (turnS > 0.5) notes.push(fill(M.turned, { s: fixed(turnS, 0) }))
  if (run.ranOut) notes.push(M.ranOut)
  if (!run.closePassed || !run.timePassed) notes.push(M.firstOff)
  box.append(...notes.map((text) => el('p', 'ctl-note rg-note', text)))
  return [box]
}
