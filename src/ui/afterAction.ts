// The after-action report on the armour trial: what decided it, every round
// in order, the picked round's path drawn on the cutaway with what it met on
// the way, and what the crew and the parts came to.
import { STATION_IDS } from '../data/crew'
import type { ZoneId } from '../data/materials'
import { STRINGS, fill } from '../data/strings'
import { cutawayPicture } from '../office/blueprint'
import { afterAction, type AfterAction, type Finding, type RangeReport, type ShotLine } from '../sim/trials'
import { OUTCOMES, type HitResult, type StatSheet, type VehicleSpec, type Vec } from '../sim/vehicle'
import { el } from './dom'
import { fixed } from './format'

const R = STRINGS.range.afterAction
const T = STRINGS.range.armour
const A = STRINGS.office.armour
const ITEMS = A.behind.items
const NAMES = STRINGS.dataSheet.stations.names
const SVG = 'http://www.w3.org/2000/svg'

type FixPart = keyof typeof STRINGS.controls

export interface AfterActionKit {
  fixButton(part: FixPart, key: string): HTMLButtonElement
  fixZone(zone: ZoneId, key: string): HTMLButtonElement
}

function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  return node
}

const count = (words: { one: string; many: string }, n: number): string => (n === 1 ? words.one : fill(words.many, { n: String(n) }))

function listOf(words: string[]): string {
  if (words.length < 2) return words.join('')
  return words.slice(0, -1).join(', ') + A.behind.and + words[words.length - 1]!
}

const crewList = (hit: HitResult): string => listOf(hit.crewOut.map((station) => NAMES[station].toLowerCase()))

/** One of the things that decided the trial, in a sentence or two. */
export function findingText(finding: Finding, spec: VehicleSpec): string {
  const F = R.findings
  const slots = {
    zone: finding.zone ? STRINGS.zones[finding.zone].name : '',
    count: String(finding.count),
    of: String(finding.of),
    rounds: count(R.rounds, finding.kind === 'magazine' ? finding.of : finding.count),
    times: count(R.times, finding.count),
    fires: count(R.fires, finding.count),
    item: finding.item ? ITEMS[finding.item].toLowerCase() : '',
    mm: fixed(Math.max(0, finding.spareMm ?? 0), 0),
  }
  if (finding.kind === 'burned') return fill(spec.protection.fireSuppression ? F.burned : F.burnedNoSystem, slots)
  const text = fill(F[finding.kind], slots)
  if (finding.kind !== 'gateFailed' && finding.kind !== 'weakPlate') return text
  const worst: Partial<Record<NonNullable<Finding['worst']>, string>> = T.worst
  const then = finding.worst ? worst[finding.worst] : undefined
  return then ? `${text} ${then}` : text
}

/** What one round came to, in a sentence. */
export function resultText(hit: HitResult): string {
  return fill(R.results[hit.outcome], { list: crewList(hit) })
}

export interface ShotRow {
  name: string
  value: string
  /** Set on the row where the round was stopped, or where it did real harm. */
  grave: boolean
  /** Set on a layer the round never got to. */
  off: boolean
}

/** One round step by step: the plate, each layer, and whatever it reached inside. */
export function shotRows(line: ShotLine, spec: VehicleSpec): ShotRow[] {
  const { hit } = line.shot
  const rows: ShotRow[] = []
  const row = (name: string, value: string, grave = false, off = false): void => void rows.push({ name, value, grave, off })
  const mm = (value: number): string => fixed(value, 0)
  const armour = hit.armour
  if (hit.track) row(R.track, hit.trackBroken ? R.trackBroken : R.trackHit, hit.trackBroken)
  if (!armour || !hit.zone) return rows

  row(R.struck, fill(R.struckValue, { deg: fixed((Math.acos(Math.min(1, Math.max(0, armour.cosine))) * 180) / Math.PI, 0) }))
  row(A.stepArrives, fill(A.stepCanCross, { mm: mm(armour.penMm) }))
  if (armour.ricochet) row(R.skids, '', true)
  if (!hit.tile && spec.era[hit.zone] !== 0) row(A.stepTile, R.tileSpent, false, true)
  const layers = spec.armour[hit.zone]
  for (const step of armour.steps) {
    const layer = step.layer === undefined ? undefined : layers[step.layer]
    const name = layer
      ? fill(A.stepLayer, { n: String((step.layer ?? 0) + 1), material: STRINGS.materials[layer.material].name, mm: mm(layer.mm) })
      : A.stepTile
    if (step.fate === 'through') row(name, fill(A.stepTakes, { mm: mm(step.worthMm), left: mm(step.leftMm) }))
    else if (step.fate === 'stopped') row(name, A.stepStops, true)
    else row(name, A.stepNotReached, false, true)
  }
  if (!hit.through) return rows

  for (const each of hit.reached) row(ITEMS[each.id], R.effects[each.effect], each.effect !== 'holed' && each.effect !== 'binHeld')
  row(R.round, hit.exits ? R.exits : R.stops)
  if (hit.spalled.length > 0) {
    row(R.fragments, fill(R.fragmentsValue, { list: listOf(hit.spalled.map((station) => NAMES[station].toLowerCase())) }), true)
  }
  if (hit.fire !== 'none') row(R.fire, hit.fire === 'putOut' ? R.firePutOut : R.fireBurned, hit.fire === 'burned')
  return rows
}

/** Which way to look at a round: from above when it comes in mostly from the side, else from the side. */
export function viewOf(hit: HitResult): 'side' | 'top' {
  const d = hit.direction
  return Math.abs(d.z) > Math.abs(d.x) && Math.abs(d.z) >= Math.abs(d.y) ? 'top' : 'side'
}

/** The cutaway with the round's path on it. */
function picture(line: ShotLine, sheet: StatSheet, spec: VehicleSpec): HTMLElement {
  const { hit } = line.shot
  const view = viewOf(hit)
  const { root, box } = cutawayPicture(spec, sheet.geometry, view, sheet.interior, 'aa')
  const d = hit.direction
  /** A point of the tank on the page. */
  const at = (v: Vec): [number, number] => (view === 'side' ? [v.x, -v.y] : [v.x, -v.z])
  const move = (v: Vec, metres: number): Vec => ({ x: v.x + d.x * metres, y: v.y + d.y * metres, z: v.z + d.z * metres })

  const entry = hit.entry ?? line.shot.line.aim
  const from = at(move(entry, -1.6))
  const strike = at(entry)
  const end = hit.through && hit.end ? at(hit.end) : null
  const beyond = hit.through && hit.end && hit.exits ? at(move(hit.end, 0.7)) : null
  const reached = hit.through ? hit.reached.map((each) => at(each.at)) : []

  // Room for the path outside the tank.
  const pad = 0.25
  const all = [from, strike, ...(end ? [end] : []), ...(beyond ? [beyond] : [])]
  const x0 = Math.min(box.x, ...all.map((p) => p[0] - pad))
  const y0 = Math.min(box.y, ...all.map((p) => p[1] - pad))
  const x1 = Math.max(box.x + box.w, ...all.map((p) => p[0] + pad))
  const y1 = Math.max(box.y + box.h, ...all.map((p) => p[1] + pad))
  root.setAttribute('viewBox', `${fixed(x0, 3)} ${fixed(y0, 3)} ${fixed(x1 - x0, 3)} ${fixed(y1 - y0, 3)}`)
  root.style.aspectRatio = `${fixed(x1 - x0, 3)} / ${fixed(y1 - y0, 3)}`
  root.classList.add('aa-svg')
  root.setAttribute('role', 'img')
  root.setAttribute('aria-label', fill(R.pictureLabel, { view: R.views[view], n: String(line.index + 1), result: resultText(hit) }))

  /** About one screen pixel, in metres. */
  const px = (x1 - x0) / 330
  const n = (value: number): string => fixed(value, 3)
  const p = (point: readonly [number, number]): string => `${n(point[0])} ${n(point[1])}`
  // The way the round runs across the page. Seen end on it has none, so it is drawn as running in from the left.
  const run = [strike[0] - from[0], strike[1] - from[1]] as const
  const length = Math.hypot(run[0], run[1])
  const u: readonly [number, number] = length > 1e-6 ? [run[0] / length, run[1] / length] : [1, 0]
  const w: readonly [number, number] = [-u[1], u[0]]
  const off = (point: readonly [number, number], alongPx: number, acrossPx: number): [number, number] => [
    point[0] + (u[0] * alongPx + w[0] * acrossPx) * px,
    point[1] + (u[1] * alongPx + w[1] * acrossPx) * px,
  ]
  const head = (tip: readonly [number, number]): SVGElement =>
    svg('path', { d: `M${p(tip)}L${p(off(tip, -9, 4.5))}L${p(off(tip, -9, -4.5))}Z`, class: 'aa-head' })

  const marks = svg('g', { class: 'aa-marks' })
  marks.append(svg('path', { d: `M${p(from)}L${p(strike)}`, class: 'aa-path' }))
  if (!end) {
    // Stopped at the plate: an arrowhead up against a bar.
    marks.append(head(strike), svg('path', { d: `M${p(off(strike, 0, 9))}L${p(off(strike, 0, -9))}`, class: 'aa-bar' }))
  } else {
    marks.append(svg('path', { d: `M${p(strike)}L${p(beyond ?? end)}`, class: 'aa-path aa-path-in' }))
    for (const point of reached) {
      const r = 4.5 * px
      marks.append(svg('path', {
        d: `M${n(point[0] - r)} ${n(point[1])}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`, class: 'aa-reach',
      }))
    }
    if (beyond) marks.append(head(beyond))
    else {
      marks.append(svg('path', {
        d: `M${p(off(end, -5, -5))}L${p(off(end, 5, 5))}M${p(off(end, -5, 5))}L${p(off(end, 5, -5))}`, class: 'aa-cross',
      }))
    }
  }
  root.append(marks)

  const frame = el('div', 'rg-chart-box aa-picture')
  frame.append(root)
  return frame
}

/** Every round as a mark on one line: a tick above for a round the armour stopped, a bar below for one that got through. */
function timeline(report: AfterAction, at: number, pick: (index: number) => void): HTMLElement {
  const w = 320
  const h = 58
  const pad = 4
  const gap = 3
  const base = 20
  const serials = (report.shots.at(-1)?.serialNo ?? 0) + 1
  const slot = (w - 2 * pad - gap * (serials - 1)) / Math.max(1, report.shots.length)
  const left = (line: ShotLine): number => pad + line.index * slot + line.serialNo * gap
  const chart = svg('svg', { viewBox: `0 0 ${w} ${h}`, class: 'rg-chart aa-timeline', role: 'img' })
  chart.setAttribute('aria-label', `${fill(R.timelineLabel, { n: String(report.shots.length), at: String(at + 1) })} ${R.timelineKey}`)
  chart.append(svg('line', { x1: String(pad), x2: String(w - pad), y1: String(base), y2: String(base), class: 'rg-axis' }))
  const worst = OUTCOMES.length - 1
  const least = OUTCOMES.indexOf('noHarm')
  for (const line of report.shots) {
    const x = left(line)
    const { hit } = line.shot
    if (line.index === at) {
      chart.append(
        svg('rect', { x: fixed(x - 1, 1), y: '2', width: fixed(slot + 2, 1), height: String(h - 12), class: 'aa-picked' }),
        svg('path', { d: `M${fixed(x + slot / 2 - 4, 1)} ${h - 1}L${fixed(x + slot / 2 + 4, 1)} ${h - 1}L${fixed(x + slot / 2, 1)} ${h - 8}Z`, class: 'aa-caret' }),
      )
    }
    if (hit.through) {
      const depth = 7 + ((OUTCOMES.indexOf(hit.outcome) - least) / (worst - least)) * 18
      chart.append(svg('rect', { x: fixed(x + 1, 1), y: String(base + 1), width: fixed(slot - 2, 1), height: fixed(depth, 1), class: 'aa-through' }))
    } else {
      chart.append(svg('rect', { x: fixed(x + slot / 2 - 1, 1), y: String(base - 10), width: '2', height: '9', class: 'aa-stopped' }))
    }
  }
  // A tap anywhere picks the round under it. The buttons below do the same job for a keyboard.
  chart.addEventListener('click', (event) => {
    const rect = chart.getBoundingClientRect()
    if (rect.width === 0) return
    const x = (((event as MouseEvent).clientX - rect.left) / rect.width) * w
    let best = report.shots[0]
    for (const line of report.shots) {
      if (!best || Math.abs(left(line) + slot / 2 - x) < Math.abs(left(best) + slot / 2 - x)) best = line
    }
    if (best) pick(best.index)
  })
  const frame = el('div', 'rg-chart-box')
  frame.append(chart)
  return frame
}

function stepList(rows: { name: string; value: string; grave?: boolean; off?: boolean }[]): HTMLElement {
  const list = el('ol', 'shot-steps')
  for (const each of rows) {
    const item = el('li', `shot-step${each.grave ? ' shot-step-stop' : ''}${each.off ? ' shot-step-off' : ''}`)
    item.append(el('span', 'shot-step-name', each.name), el('span', 'shot-step-value', each.value))
    list.append(item)
  }
  return list
}

/** The report, or nothing when the trial fired no rounds. */
export function afterActionCard(range: RangeReport, sheet: StatSheet, spec: VehicleSpec, kit: AfterActionKit): HTMLElement | null {
  const report = afterAction(range.armour, spec)
  if (report.shots.length === 0) return null
  const total = report.shots.length
  let at = report.worstIndex ?? 0

  const box = el('section', 'rg-card aa')
  const top = el('div', 'rg-card-head')
  top.append(el('h3', 'rg-card-title', R.title))
  const tally = [fill(R.tally, { n: String(total), stopped: String(report.stopped), through: String(report.through) })]
  if (report.tracks > 0) tally.push(fill(R.tallyTracks, { n: String(report.tracks) }))
  box.append(top, el('p', 'ctl-note', R.about), el('p', 'aa-tally', tally.join(' ')))

  const strip = el('div', 'aa-strip')
  const shotBox = el('div', 'aa-shot')
  const label = el('span', 'aa-position')
  label.setAttribute('role', 'status')
  const stepper = (text: string, name: string, by: number): HTMLButtonElement => {
    const button = el('button', 'btn aa-step', text)
    button.type = 'button'
    button.dataset.key = `aa-${by < 0 ? 'prev' : 'next'}`
    button.setAttribute('aria-label', name)
    button.addEventListener('click', () => pick(at + by))
    return button
  }
  const prev = stepper('‹', R.prev, -1)
  const next = stepper('›', R.next, 1)
  const worst = el('button', 'btn aa-worst', R.worst)
  worst.type = 'button'
  worst.dataset.key = 'aa-worst'
  worst.addEventListener('click', () => pick(report.worstIndex ?? 0))

  const draw = (): void => {
    const line = report.shots[at]!
    const { hit } = line.shot
    const { serial } = line
    strip.replaceChildren(timeline(report, at, pick))
    label.textContent = fill(R.position, { n: String(at + 1), total: String(total) })
    prev.disabled = at === 0
    next.disabled = at === total - 1
    worst.disabled = at === (report.worstIndex ?? 0)

    const head = el('div', 'rg-line-head')
    head.append(
      el('h4', 'aa-shot-title', STRINGS.zones[hit.zone ?? serial.zone].name),
      el('span', `rg-verdict ${hit.through ? 'rg-fail' : 'rg-pass'}`, hit.through ? `✗ ${R.through}` : `✓ ${R.stopped}`),
    )
    const setup = fill(T.setup, {
      round: STRINGS.threats[serial.threat].name,
      range: String(serial.rangeM),
      angle: serial.angleDeg === 0 ? T.square : fill(T.off, { n: String(serial.angleDeg) }),
    })
    shotBox.replaceChildren(
      head,
      el('p', 'rg-line-text', `${setup}. ${fill(R.serialRound, { n: String(line.roundNo + 1), of: String(serial.shots.length) })}`),
      picture(line, sheet, spec),
      el('p', 'ctl-note aa-key', R.pictureKey),
      el('p', 'aa-result', resultText(hit)),
      stepList(shotRows(line, spec)),
    )
    if (hit.through && hit.zone) shotBox.append(kit.fixZone(hit.zone, 'aa-shot'))
  }
  function pick(index: number): void {
    at = Math.min(total - 1, Math.max(0, index))
    draw()
  }

  // What decided it.
  const decided = el('ol', 'aa-findings')
  report.findings.forEach((finding, n) => {
    const item = el('li', 'aa-finding')
    const see = el('button', 'btn', fill(R.seeRound, { n: String(finding.shotIndex + 1) }))
    see.type = 'button'
    see.dataset.key = `aa-see-${n}`
    see.addEventListener('click', () => {
      pick(finding.shotIndex)
      shotBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    const buttons = el('div', 'aa-finding-buttons')
    buttons.append(see)
    if (finding.fix && 'zone' in finding.fix) buttons.append(kit.fixZone(finding.fix.zone, `aa-finding-${n}`))
    else if (finding.fix) {
      const fix = kit.fixButton(finding.fix.control, `aa-finding-${n}`)
      fix.textContent = R.fixes[finding.fix.control]
      buttons.append(fix)
    }
    item.append(el('p', 'aa-finding-text', findingText(finding, spec)), buttons)
    decided.append(item)
  })
  box.append(el('h4', 'rg-sub', R.decided), decided)

  // Round by round.
  const controls = el('div', 'aa-controls')
  controls.append(prev, label, next)
  box.append(el('h4', 'rg-sub', R.timeline), strip, el('p', 'ctl-note aa-key', R.timelineKey), controls, worst, shotBox)

  // Crew, by station, and the parts that were hit.
  const fitted = STATION_IDS.filter((id) => sheet.interior.items.some((item) => item.station === id))
  box.append(el('h4', 'rg-sub', R.crew), stepList(fitted.map((id) => {
    const rounds = report.crewOut[id]
    return rounds > 0
      ? { name: NAMES[id], value: `✗ ${fill(R.crewOut, { rounds: count(R.rounds, rounds) })}`, grave: true }
      : { name: NAMES[id], value: `✓ ${R.crewSafe}` }
  })))
  box.append(el('h4', 'rg-sub', R.parts))
  if (report.parts.length === 0) box.append(el('p', 'rg-line-text', R.partsNone))
  else box.append(stepList(report.parts.map((part) => ({ name: ITEMS[part.id], value: count(R.rounds, part.rounds) }))))
  box.append(el('p', 'ctl-note rg-note', R.note))

  draw()
  return box
}
