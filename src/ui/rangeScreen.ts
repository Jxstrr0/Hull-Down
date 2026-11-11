// The proving ground report: what the range found, test by test, with a link
// back to the part that would fix each failure. The 3D range joins this
// screen later; for now it is the numbers and a speed chart.
import { GROUNDS, RANGE, RUN_PART_IDS, type RunPartId } from '../data/range'
import { STRINGS, fill } from '../data/strings'
import {
  runProvingGround, type AccelerationRun, type EnduranceEvent, type EnduranceRun, type ObstacleResult, type RangeReport,
} from '../sim/trials'
import type { StatSheet } from '../sim/vehicle'
import { el } from './dom'
import { fixed } from './format'

const R = STRINGS.range
const SVG = 'http://www.w3.org/2000/svg'

/** A design-office control a failure points back to. */
type FixPart = keyof typeof STRINGS.controls

/** The control that takes the load off each part of the endurance run. The cooling itself has no rated load. */
const ENDURANCE_FIX: Record<RunPartId, FixPart | null> = {
  engine: 'powerpack.cooling',
  cooling: null,
  transmission: 'powerpack.transmission',
  suspension: 'runningGear.suspension',
  tracks: 'runningGear.trackWidthMm',
}

export interface RangeScreenArgs {
  sheet: StatSheet
  projectNo: number
  back(): void
  /** Leave the range and open the control that fixes a failure. */
  fix(part: FixPart): void
}

function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  return node
}

/** A pass or fail mark that reads without colour: a tick or a cross and the word. */
function verdict(passed: boolean, big = false): HTMLElement {
  const words = big ? (passed ? R.passed : R.failed) : passed ? R.pass : R.fail
  return el('span', `rg-verdict ${passed ? 'rg-pass' : 'rg-fail'}${big ? ' rg-stamp' : ''}`, `${passed ? '✓' : '✗'} ${words}`)
}

/** Speed against time, with the top speed mark as a dashed line. */
function speedChart(run: AccelerationRun, markKmh: number): HTMLElement {
  const w = 320
  const h = 96
  const pad = { left: 4, right: 4, top: 14, bottom: 4 }
  const { vMs, stepS } = run.trace
  const spanS = (vMs.length - 1) * stepS
  const peakKmh = Math.max(run.topKmh, markKmh) * 1.08
  const px = (index: number): number => pad.left + ((index * stepS) / spanS) * (w - pad.left - pad.right)
  const py = (kmh: number): number => h - pad.bottom - (kmh / peakKmh) * (h - pad.top - pad.bottom)

  // A phone does not need every point of the record.
  const every = Math.max(1, Math.floor(vMs.length / 160))
  const points: string[] = []
  vMs.forEach((v, index) => {
    if (index % every === 0 || index === vMs.length - 1) points.push(`${fixed(px(index), 1)},${fixed(py(v * 3.6), 1)}`)
  })

  const chart = svg('svg', { viewBox: `0 0 ${w} ${h}`, class: 'rg-chart', role: 'img' })
  chart.setAttribute('aria-label', fill(R.acceleration.chartLabel, { top: fixed(run.topKmh, 0), time: fixed(run.timeS, 0) }))
  const markY = fixed(py(markKmh), 1)
  chart.append(
    svg('line', { x1: String(pad.left), x2: String(w - pad.right), y1: String(h - pad.bottom), y2: String(h - pad.bottom), class: 'rg-axis' }),
    svg('line', { x1: String(pad.left), x2: String(w - pad.right), y1: markY, y2: markY, class: 'rg-mark' }),
    svg('polyline', { points: points.join(' '), class: 'rg-line' }),
  )
  const markText = svg('text', { x: String(pad.left + 2), y: fixed(py(markKmh) - 4, 1), class: 'rg-chart-text' })
  markText.textContent = fill(R.acceleration.chartMark, { n: String(markKmh) })
  const endText = svg('text', { x: String(w - pad.right - 2), y: String(h - pad.bottom - 5), class: 'rg-chart-text', 'text-anchor': 'end' })
  endText.textContent = fill(R.acceleration.chartEnd, { n: fixed(run.timeS, 0) })
  chart.append(markText, endText)

  const box = el('div', 'rg-chart-box')
  box.append(chart)
  return box
}

/** A stretch of time in hours, in words: `45 min`, `2 h`, `9 h 40 min`. */
function hours(h: number): string {
  const E = R.endurance
  const minutes = Math.round(h * 60)
  const whole = Math.floor(minutes / 60)
  const min = minutes % 60
  if (whole === 0) return fill(E.timeM, { min: String(min) })
  if (min === 0) return fill(E.timeH, { h: String(whole) })
  return fill(E.time, { h: String(whole), min: String(min) })
}

/** A load and its rating, to one decimal place, or two when one would make them look the same. */
function loadPair(have: number, rated: number, places: number): { have: string; rated: string } {
  const pair = { have: fixed(have, places), rated: fixed(rated, places) }
  return pair.have === pair.rated ? { have: fixed(have, places + 1), rated: fixed(rated, places + 1) } : pair
}

/** The run laid out leg by leg, with a mark where each thing broke: a triangle for a stop, a cross for the end. */
function runChart(run: EnduranceRun): HTMLElement {
  const E = R.endurance
  const w = 320
  const h = 62
  const pad = 6
  const top = 20
  const deep = 14
  const px = (km: number): number => pad + (km / run.lengthKm) * (w - 2 * pad)

  const chart = svg('svg', { viewBox: `0 0 ${w} ${h}`, class: 'rg-chart', role: 'img' })
  chart.setAttribute('aria-label', fill(E.chartLabel, {
    km: String(run.reachedKm), total: String(run.lengthKm), n: String(run.events.length),
  }))
  chart.append(svg('rect', {
    x: String(pad), y: String(top), width: fixed(px(run.reachedKm) - pad, 1), height: String(deep), class: 'rg-run',
  }))
  for (const leg of run.legs) {
    chart.append(svg('rect', {
      x: fixed(px(leg.fromKm), 1), y: String(top), width: fixed(px(leg.toKm) - px(leg.fromKm), 1), height: String(deep), class: 'rg-leg',
    }))
    const name = svg('text', {
      x: fixed((px(leg.fromKm) + px(leg.toKm)) / 2, 1), y: String(top + deep + 12), class: 'rg-chart-text', 'text-anchor': 'middle',
    })
    name.textContent = E.legShort[leg.id]
    chart.append(name)
  }
  for (const event of run.events) {
    const x = px(event.km)
    const y = top - 3
    chart.append(svg('path', {
      d: event.ended
        ? `M${fixed(x - 5, 1)} ${y - 10}L${fixed(x + 5, 1)} ${y}M${fixed(x + 5, 1)} ${y - 10}L${fixed(x - 5, 1)} ${y}`
        : `M${fixed(x - 4, 1)} ${y - 8}L${fixed(x + 4, 1)} ${y - 8}L${fixed(x, 1)} ${y}Z`,
      class: event.ended ? 'rg-event rg-event-end' : 'rg-event',
    }))
  }
  const end = svg('text', { x: String(w - pad), y: String(h - 3), class: 'rg-chart-text', 'text-anchor': 'end' })
  end.textContent = fill(E.chartEnd, { n: String(run.lengthKm) })
  chart.append(end)

  const box = el('div', 'rg-chart-box')
  box.append(chart)
  return box
}

export function renderRangeScreen(args: RangeScreenArgs): HTMLElement {
  const { sheet } = args
  const report: RangeReport = runProvingGround(sheet, { seed: args.projectNo })
  const root = el('section', 'range')
  root.setAttribute('aria-label', R.label)
  root.tabIndex = -1

  const fixButton = (part: FixPart, key: string): HTMLButtonElement => {
    const button = el('button', 'fix rg-fix', fill(R.fix, { part: STRINGS.controls[part].label }))
    button.type = 'button'
    button.dataset.key = `range-fix:${key}`
    button.addEventListener('click', () => args.fix(part))
    return button
  }

  // --- Head ---------------------------------------------------------------
  const head = el('div', 'rg-head')
  const back = el('button', 'btn rg-back', `‹ ${R.back}`)
  back.type = 'button'
  back.dataset.key = 'range-back'
  back.setAttribute('aria-label', R.backLabel)
  back.addEventListener('click', () => args.back())
  const titles = el('div', 'rg-titles')
  titles.append(
    el('h2', 'rg-title', R.title),
    el('p', 'rg-subject', fill(R.subject, { n: String(args.projectNo), name: sheet.name || STRINGS.office.designs.unnamed, mass: fixed(sheet.massT, 1) })),
  )
  head.append(back, titles)

  const summary = el('p', `rg-summary ${report.passes === report.tests ? 'rg-pass' : 'rg-fail'}`,
    fill(R.summary, { passes: String(report.passes), tests: String(report.tests) }))

  /** One test: a title, a stamp, and whatever the test has to show. */
  const card = (title: string, about: string, passed: boolean): HTMLElement => {
    const box = el('section', 'rg-card')
    const top = el('div', 'rg-card-head')
    top.append(el('h3', 'rg-card-title', title), verdict(passed, true))
    box.append(top, el('p', 'ctl-note', about))
    return box
  }

  /** One measured thing: its name, what it came to, the mark, and a fix when it failed. */
  const line = (name: string, words: string[], passed: boolean, fix?: HTMLButtonElement): HTMLElement => {
    const item = el('li', `rg-line-item${passed ? '' : ' rg-line-failed'}`)
    const top = el('div', 'rg-line-head')
    top.append(el('span', 'rg-line-name', name), verdict(passed))
    item.append(top)
    for (const text of words) item.append(el('p', 'rg-line-text', text))
    if (!passed && fix) item.append(fix)
    return item
  }

  // --- Acceleration and top speed -----------------------------------------
  const a = report.acceleration
  const A = R.acceleration
  const accel = card(A.title, fill(A.about, { strip: String(RANGE.acceleration.stripM) }), a.passed)
  const accelLines = el('ul', 'rg-lines')
  accelLines.append(
    line(
      fill(A.sprint, { kmh: String(RANGE.acceleration.sprintKmh) }),
      [
        a.sprintS === null ? A.sprintNever : fill(A.sprintValue, { n: fixed(a.sprintS, 1) }),
        fill(A.sprintMark, { n: String(report.marks.sprintS) }),
      ],
      a.sprintPassed, fixButton('powerpack.engine', 'sprint'),
    ),
    line(
      A.top,
      [fill(A.topValue, { n: fixed(a.topKmh, 0) }), fill(A.topMark, { n: String(report.marks.topKmh) })],
      a.topPassed, fixButton(a.gearLimited ? 'powerpack.transmission' : 'powerpack.engine', 'top'),
    ),
  )
  const accelNotes = [sheet.drive.shiftS > 0 ? fill(A.shifts, { n: String(a.shifts) }) : A.noShifts]
  if (a.gearLimited) accelNotes.push(fill(A.gearHeld, { n: fixed(a.topKmh, 0) }))
  accel.append(speedChart(a, report.marks.topKmh), accelLines, ...accelNotes.map((text) => el('p', 'ctl-note rg-note', text)))

  // --- Obstacle course ----------------------------------------------------
  const O = R.obstacles
  const c = RANGE.course
  const cm = (metres: number): string => fixed(metres * 100, 0)
  const obstacleLine = (result: ObstacleResult): HTMLElement => {
    const slots = {
      have: fixed(result.have, result.id === 'mud' || result.id === 'slope' ? 1 : 2),
      need: fixed(result.need, result.id === 'mud' || result.id === 'slope' ? 1 : 2),
      time: fixed(result.timeS, 0),
      reached: fixed(result.reachedM, 0),
      sink: cm(result.sinkM),
      clearance: cm(sheet.drive.clearanceM),
    }
    const sagging = sheet.stress.suspension > 1
    if (result.id === 'trench') {
      return line(fill(O.names.trench, { n: fixed(c.trench.widthM, 1) }), [fill(result.passed ? O.trenchPass : O.trenchFail, slots)],
        result.passed, fixButton('hull.size', 'trench'))
    }
    if (result.id === 'step') {
      const words = [fill(result.passed ? O.stepPass : O.stepFail, slots)]
      if (!result.passed && sagging) words.push(O.stepSag)
      return line(fill(O.names.step, { n: fixed(c.step.heightM, 1) }), words, result.passed,
        fixButton(sagging ? 'runningGear.suspension' : 'hull.size', 'step'))
    }
    if (result.id === 'mud') {
      const failed = result.cause === 'belly' ? O.mudBelly : result.cause === 'pull' ? O.mudPull : O.mudTracks
      const words = [fill(result.passed ? O.mudPass : failed, slots)]
      words.push(fill(O.mudPressure, { pressure: fixed(sheet.drive.pressureKgCm2, 2), bearing: fixed(GROUNDS.mud.bearingKgCm2, 1) }))
      return line(fill(O.names.mud, { n: String(c.mud.lengthM) }), words, result.passed,
        fixButton(result.cause === 'pull' ? 'powerpack.engine' : 'runningGear.trackWidthMm', 'mud'))
    }
    return line(
      fill(O.names.slope, { n: String(c.slope.angleDeg) }),
      [fill(result.passed ? O.slopePass : result.cause === 'grip' ? O.slopeGrip : O.slopePull, slots)],
      result.passed, result.cause === 'grip' ? undefined : fixButton('powerpack.engine', 'slope'),
    )
  }
  const course = card(O.title, O.about, report.obstacles.passed)
  const courseLines = el('ul', 'rg-lines')
  courseLines.append(...report.obstacles.results.map(obstacleLine))
  course.append(courseLines)

  // --- Endurance run ------------------------------------------------------
  const E = R.endurance
  const e = report.endurance
  const tonnes = (id: RunPartId): boolean => id !== 'engine'
  const eventText = (event: EnduranceEvent): string => {
    const load = e.loads[event.part]
    const slots = {
      part: E.parts[event.part],
      km: String(event.km),
      leg: E.legs[event.leg],
      time: hours(event.haltH),
      ...(load.rated === null ? {} : loadPair(load.have, load.rated, tonnes(event.part) ? 1 : 0)),
    }
    const broke: Partial<Record<RunPartId, string>> = E.broke
    return fill((event.load > 1 && broke[event.part]) || E.fault, slots)
  }
  const long = card(E.title, fill(E.about, { km: String(e.lengthKm) }), e.passed)
  const longLines = el('ul', 'rg-lines')
  const last = e.events.find((event) => event.ended)
  longLines.append(
    line(
      E.distance,
      last
        ? [fill(E.ended, { km: String(e.reachedKm), total: String(e.lengthKm) }), eventText(last)]
        : [fill(E.finished, { km: String(e.lengthKm), time: hours(e.movingH), speed: fixed(e.lengthKm / e.movingH, 0) })],
      e.finished,
    ),
    line(
      E.stopsName,
      [
        e.stops === 0 ? E.noStops : fill(e.stops === 1 ? E.stopsOne : E.stopsMany, { n: String(e.stops), time: hours(e.haltedH) }),
        ...e.events.filter((event) => !event.ended).map(eventText),
        fill(E.stopsMark, { n: String(report.marks.enduranceStops) }),
      ],
      e.stops <= report.marks.enduranceStops,
    ),
  )
  // Every overloaded part is listed with its fix, whether or not it broke this time.
  const over = RUN_PART_IDS.filter((id) => e.loads[id].load > 1)
  for (const id of over) {
    const load = e.loads[id]
    const item = el('li', 'rg-line-item rg-line-failed')
    const names: Partial<Record<RunPartId, string>> = E.overName
    const top = el('div', 'rg-line-head')
    top.append(
      el('span', 'rg-line-name', names[id] ?? E.parts[id]),
      el('span', 'rg-verdict rg-fail', fill(E.overMark, { pct: String(Math.max(101, Math.round(load.load * 100))) })),
    )
    const words: Partial<Record<RunPartId, string>> = E.over
    item.append(top, el('p', 'rg-line-text', fill(words[id] ?? '', {
      leg: E.legs[load.leg], ...loadPair(load.have, load.rated ?? 0, tonnes(id) ? 1 : 0),
    })))
    const part = ENDURANCE_FIX[id]
    if (part) item.append(fixButton(part, `endurance-${id}`))
    longLines.append(item)
  }
  long.append(runChart(e), longLines)
  if (over.length === 0) long.append(el('p', 'ctl-note rg-note', E.allWithin))
  long.append(el('p', 'ctl-note rg-note', E.note))

  root.append(head, summary, accel, course, long, el('p', 'ds-note', R.note))
  return root
}
