// The proving ground report: what the range found, test by test, with a link
// back to the part that would fix each failure. The 3D range joins this
// screen later; for now it is the numbers and a speed chart.
import { GROUNDS, RANGE } from '../data/range'
import { STRINGS, fill } from '../data/strings'
import { runProvingGround, type AccelerationRun, type ObstacleResult, type RangeReport } from '../sim/trials'
import type { StatSheet } from '../sim/vehicle'
import { el } from './dom'
import { fixed } from './format'

const R = STRINGS.range
const SVG = 'http://www.w3.org/2000/svg'

/** A design-office control a failure points back to. */
type FixPart = keyof typeof STRINGS.controls

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

export function renderRangeScreen(args: RangeScreenArgs): HTMLElement {
  const { sheet } = args
  const report: RangeReport = runProvingGround(sheet)
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

  root.append(head, summary, accel, course, el('p', 'ds-note', R.note))
  return root
}
