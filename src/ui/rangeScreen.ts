// The proving ground report: what the range found, test by test, with a link
// back to the part that would fix each failure. A run can be watched in 3D;
// that code is only fetched when the player asks for it.
import { GROUNDS, RANGE, RUN_PART_IDS, type Marks, type RunPartId } from '../data/range'
import type { TierId } from '../data/graphics'
import type { PaintId } from '../data/paint'
import { RENDER } from '../data/render'
import { STRINGS, fill } from '../data/strings'
import {
  afterAction, type AccelerationRun, type EnduranceEvent, type EnduranceRun, type GunneryRun, type ObstacleResult, type RangeReport,
} from '../sim/trials'
import type { ZoneId } from '../data/materials'
import type { Limits, StatSheet, VehicleSpec } from '../sim/vehicle'
import { VIEWS, type ViewId } from '../render/director'
import type { RangeView, RunSource } from '../render/rangeScene'
import type { ReelFrame } from '../render/shootReel'
import { createShootEar, droneAt, voiceOf } from '../audio/cues'
import { sound } from '../audio/gameSound'
import { afterActionCard } from './afterAction'
import { armourCards } from './armourCards'
import { el } from './dom'
import { fixed } from './format'
import { placeOf } from './gunneryAdvice'
import { gunneryCards } from './gunneryCards'
import { runRange } from './rangeRunner'
import { cardFacts, shareBlock } from './shareCard'

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

/** How a 3D view learns how finely to draw, and reports how fast it is drawing. */
export interface GraphicsLink {
  /** The tier to draw at now. */
  tier(): TierId
  /** A view has timed its frames. Gives back the tier to draw at from here on. */
  measured(fps: number): TierId
}

export interface RangeScreenArgs {
  spec: VehicleSpec
  /** The limits the design was built to. The range builds the tank again from the design. */
  limits: Limits
  /** What the tender asks of a prototype. */
  marks: Marks
  sheet: StatSheet
  projectNo: number
  /** The paint the prototype wears in the 3D views. */
  paint: PaintId
  graphics: GraphicsLink
  back(): void
  /** Leave the range and open the control that fixes a failure. */
  fix(part: FixPart): void
  /** Leave the range and open the Armour tab at one zone. */
  fixZone(zone: ZoneId): void
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
  const root = el('section', 'range')
  root.setAttribute('aria-label', R.label)
  root.tabIndex = -1

  // --- The 3D view ----------------------------------------------------------
  // One run is watched at a time. The 3D code is fetched the first time it is asked for.
  const V = R.view
  let closeView = (): void => {}

  /** A breakdown in a few words, for the caption on the 3D view. The report has the long form. */
  const haltText = (event: EnduranceEvent): string => {
    const halt: Partial<Record<RunPartId, string>> = V.halt
    return fill((event.load > 1 && halt[event.part]) || V.halt.fault, {
      part: R.endurance.parts[event.part], km: String(event.km), time: hours(event.haltH),
    })
  }

  /** What is happening in a shoot, in a few words, for the caption on the 3D view. */
  const shootText = (run: GunneryRun, reel: ReelFrame): string => {
    const W = V.shoot
    if (reel.done) return fill(W.done, { hits: String(run.hits), n: String(run.targets.length) })
    const shot = run.targets[reel.targetIndex]?.shots[reel.shotIndex]
    if (reel.phase === 'unseen') return W.unseen
    if (reel.phase === 'tooSlow') return W.tooSlow
    if (reel.phase === 'working') {
      if (shot?.jammed) return W.jam
      if (reel.shotIndex > 0) return W.loading
      return run.halted ? W.workingHalt : W.working
    }
    if (reel.phase === 'strike' && shot) {
      if (shot.hit) return W.hit
      const fell = placeOf(shot)
      return fill(W.miss, { dist: fixed(fell.distM, 1), place: R.gunnery.place[fell.place] })
    }
    return ''
  }

  const voice = voiceOf(args.spec)

  const openView = async (source: RunSource, slot: HTMLElement, opener: HTMLButtonElement): Promise<void> => {
    closeView()
    // Opened by a tap, which is when a browser lets sound begin.
    sound.wake()
    const ear = createShootEar()
    const test = source.test
    const box = el('div', 'rg-view')
    const stage = el('div', 'rg-view-stage')
    const status = el('p', 'rg-view-status', V.loading)
    // Words over the foot of the picture when the endurance run stops for a breakdown, and when it ends.
    const caption = el('p', 'rg-view-caption')
    caption.setAttribute('role', 'status')
    caption.hidden = true

    // Play or pause, and the bar that shows how far through the run it is.
    const scrubRow = el('div', 'rg-view-row')
    const toggle = el('button', 'btn rg-view-toggle', V.pause)
    toggle.type = 'button'
    toggle.dataset.key = `range-toggle:${test}`
    const scrub = el('input', 'rg-view-scrub')
    scrub.type = 'range'
    scrub.min = '0'
    scrub.step = String(RENDER.scrubStepS)
    scrub.value = '0'
    scrub.dataset.key = `range-scrub:${test}`
    scrub.setAttribute('aria-label', V.scrub)
    scrubRow.append(toggle, scrub)

    const bar = el('div', 'rg-view-row')
    const readout = el('span', 'rg-view-readout')
    const close = el('button', 'btn', V.close)
    close.type = 'button'
    close.dataset.key = `range-close:${test}`
    bar.append(readout, close)

    // Which camera. The chosen one is marked by weight and by aria-pressed, not by colour alone.
    let chosen: ViewId = 'director'
    const views = el('div', 'seg rg-view-views')
    views.setAttribute('role', 'group')
    views.setAttribute('aria-label', V.cameraLabel)
    const viewButtons = VIEWS.map((id) => {
      const button = el('button', 'seg-item', V.camera[id])
      button.type = 'button'
      button.dataset.key = `range-view:${test}:${id}`
      button.addEventListener('click', () => {
        chosen = id
        markViews()
        view?.setView(id)
      })
      views.append(button)
      return { id, button }
    })
    const markViews = (): void => {
      for (const each of viewButtons) {
        each.button.classList.toggle('seg-on', each.id === chosen)
        each.button.setAttribute('aria-pressed', String(each.id === chosen))
      }
    }
    markViews()

    const controls = [toggle, scrub, ...viewButtons.map((each) => each.button)]
    for (const control of controls) control.disabled = true
    stage.append(status, caption)
    box.append(stage, scrubRow, bar, views)
    slot.replaceChildren(box)
    opener.hidden = true

    let view: RangeView | undefined
    let closed = false
    let playing = false
    /** True while a finger holds the scrub bar, and the run was playing when it took hold. */
    let heldWhilePlaying = false
    closeView = (): void => {
      closed = true
      view?.dispose()
      sound.still()
      slot.replaceChildren()
      opener.hidden = false
      closeView = (): void => {}
    }
    close.addEventListener('click', () => {
      closeView()
      opener.focus({ preventScroll: true })
    })
    toggle.addEventListener('click', () => {
      heldWhilePlaying = false
      sound.wake()
      if (playing) view?.pause()
      else view?.play()
    })
    // Dragging the bar holds the run still under the finger, then lets it go on.
    const letGo = (): void => {
      if (!heldWhilePlaying) return
      heldWhilePlaying = false
      view?.play()
    }
    scrub.addEventListener('pointerdown', () => {
      if (!playing) return
      heldWhilePlaying = true
      view?.pause()
      // The finger may come up anywhere, and a tap that moves nothing sends no `change`.
      window.addEventListener('pointerup', letGo, { once: true })
      window.addEventListener('pointercancel', letGo, { once: true })
    })
    scrub.addEventListener('change', letGo)
    scrub.addEventListener('input', () => view?.seek(Number(scrub.value)))
    box.scrollIntoView({ block: 'nearest' })

    try {
      const { openRangeView } = await import('../render/rangeScene')
      if (closed) return
      view = openRangeView({
        host: stage,
        label: V.label[test],
        source,
        view: chosen,
        spec: args.spec,
        geometry: sheet.geometry,
        paint: args.paint,
        quality: args.graphics.tier(),
        onMeasured: (fps) => view?.setQuality(args.graphics.measured(fps)),
        onFrame: (frame) => {
          // The bar follows the run, except under a finger.
          if (!heldWhilePlaying) scrub.value = String(frame.timeS)
          // The tank is heard while the run plays, and not while it is held still.
          if (playing) sound.drone(voice, droneAt(voice, frame.speedKmh))
          if ('fire' in source && frame.shoot) for (const cue of ear.hear(source.run, frame.shoot, playing)) sound.cue(cue, voice.calibreMm)
          if (source.test === 'endurance' && frame.lapse) {
            const lapse = frame.lapse
            const km = fixed(lapse.km, 0)
            const leg = source.run.legs[lapse.legIndex]!
            readout.textContent = fill(V.lapseReadout, { time: hours(lapse.hours), km, leg: R.endurance.legShort[leg.id] })
            scrub.setAttribute('aria-valuetext', fill(V.lapseValue, { km, total: String(source.run.lengthKm) }))
            const words = lapse.event ? haltText(lapse.event) : lapse.done && source.run.finished ? fill(V.lapseDone, { km }) : ''
            if (caption.textContent !== words) caption.textContent = words
            caption.hidden = words === ''
            return
          }
          if ('fire' in source && frame.shoot) {
            const reel = frame.shoot
            const run = source.run
            const target = run.targets[reel.targetIndex]
            const slots = { n: String(reel.targetIndex + 1), total: String(run.targets.length) }
            readout.textContent = fill(V.shootReadout, { ...slots, range: String(target?.rangeM ?? 0), time: fixed(reel.clockS, 0) })
            scrub.setAttribute('aria-valuetext', fill(V.shootValue, slots))
            const words = shootText(run, reel)
            if (caption.textContent !== words) caption.textContent = words
            caption.hidden = words === ''
            return
          }
          const time = fixed(frame.timeS, 1)
          readout.textContent = fill(V.readout, { time, speed: fixed(frame.speedKmh, 0), dist: fixed(frame.distanceM, 0) })
          scrub.setAttribute('aria-valuetext', fill(V.scrubValue, { time, length: fixed(Number(scrub.max), 1) }))
        },
        onState: (state) => {
          playing = state.playing
          if (heldWhilePlaying) return
          toggle.textContent = state.playing ? V.pause : state.ended ? V.again : V.play
        },
      })
      scrub.max = String(view.lengthS)
      for (const control of controls) control.disabled = false
      status.remove()
    } catch {
      // No 3D on this device, or the code could not be fetched. The report still says it all.
      if (!closed) status.textContent = V.failed
    }
  }

  /** A button that opens the 3D view of a run, and the place the view goes. */
  const watch = (source: RunSource): HTMLElement[] => {
    const slot = el('div', 'rg-view-slot')
    const button = el('button', 'btn rg-watch', V.watch)
    button.type = 'button'
    button.dataset.key = `range-watch:${source.test}`
    button.addEventListener('click', () => void openView(source, slot, button))
    return [button, slot]
  }

  const fixButton = (part: FixPart, key: string): HTMLButtonElement => {
    const button = el('button', 'fix rg-fix', fill(R.fix, { part: STRINGS.controls[part].label }))
    button.type = 'button'
    button.dataset.key = `range-fix:${key}`
    button.addEventListener('click', () => {
      closeView()
      args.fix(part)
    })
    return button
  }

  const fixZone = (zone: ZoneId, key: string): HTMLButtonElement => {
    const button = el('button', 'fix rg-fix', fill(R.armour.fixZone, { zone: STRINGS.zones[zone].name }))
    button.type = 'button'
    button.dataset.key = `range-fix:${key}`
    button.addEventListener('click', () => {
      closeView()
      args.fixZone(zone)
    })
    return button
  }

  // --- Head ---------------------------------------------------------------
  const head = el('div', 'rg-head')
  const back = el('button', 'btn rg-back', `‹ ${R.back}`)
  back.type = 'button'
  back.dataset.key = 'range-back'
  back.setAttribute('aria-label', R.backLabel)
  back.addEventListener('click', () => {
    closeView()
    args.back()
  })
  const titles = el('div', 'rg-titles')
  titles.append(
    el('h2', 'rg-title', R.title),
    el('p', 'rg-subject', fill(R.subject, { n: String(args.projectNo), name: sheet.name || STRINGS.office.designs.unnamed, mass: fixed(sheet.massT, 1) })),
  )
  head.append(back, titles)

  const waiting = el('p', 'rg-waiting', R.running)
  waiting.setAttribute('role', 'status')
  root.append(head, waiting)

  const drawReport = (report: RangeReport): void => {
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
    accel.append(...watch({ test: 'acceleration', record: a.trace }), speedChart(a, report.marks.topKmh), accelLines, ...accelNotes.map((text) => el('p', 'ctl-note rg-note', text)))

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
    course.append(...watch({ test: 'obstacles', record: report.obstacles.trace }), courseLines)

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
    long.append(...watch({ test: 'endurance', run: e }), runChart(e), longLines)
    if (over.length === 0) long.append(el('p', 'ctl-note rg-note', E.allWithin))
    long.append(el('p', 'ctl-note rg-note', E.note))
    root.append(
      summary, accel, course, long,
      ...gunneryCards(report, sheet, args.spec, { card, line, fixButton, watch }),
      ...armourCards(report, sheet, args.spec, { card, line, fixButton, watch, fixZone }),
    )
    const after = afterAction(report.armour, args.spec)
    const debrief = afterActionCard(after, sheet, args.spec, { fixButton, fixZone })
    if (debrief) {
      debrief.append(shareBlock(() => ({ facts: cardFacts(report, after, sheet, args.spec, args.projectNo), sheet, spec: args.spec })))
      root.append(debrief)
    }
    root.append(el('p', 'ds-note', R.note))
  }

  // The tests run on another thread, so a long trial never freezes the page.
  void runRange({ spec: args.spec, limits: args.limits, setup: { seed: args.projectNo, marks: args.marks } }).then((report) => {
    // The player may have gone back to the office before the range answered.
    if (!root.isConnected) return
    waiting.remove()
    drawReport(report)
  })
  return root
}
