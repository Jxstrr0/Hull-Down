// The challenge of the day, at the top of the bureau page: the day's brief, a
// switch that puts the office to work on it, and a button that enters the
// design on the sheet. The best try of the day is kept on this device.
import { STRINGS } from '../data/strings'
import type { Marks } from '../data/range'
import type { KeyValue } from '../persist/designs'
import { loadDaily, saveDaily, type DailyBest, type DailyState } from '../persist/dailyStore'
import type { BidLine } from '../sim/career/career'
import { betterTry, dailyChallenge, dailyRivals, dayNumber, enterDaily, type DailyChallenge, type DailyResult } from '../sim/career/daily'
import type { Limits, VehicleSpec } from '../sim/vehicle/spec'
import { axesLine, bidLine, bidderName } from '../ui/careerWords'
import { bestLine, briefLine, dateLine, resultLine, shareText, weightsLine } from '../ui/dailyWords'
import { el } from '../ui/dom'
import { fill } from '../data/strings'

const D = STRINGS.daily

export interface DailyOptions {
  storage: KeyValue
  /** The design on the sheet. */
  spec: () => VehicleSpec
  /** The switch was thrown: the office's limits have changed. */
  changed: () => void
  redraw: () => void
}

export interface Daily {
  on: () => boolean
  /** Switch the challenge off, as when the sandbox is switched on. */
  stop: () => void
  /** The limits of the day: that tender's technology with nothing locked. */
  limits: () => Limits
  marks: () => Marks
  draw: () => HTMLElement
}

/** The day by the player's own clock. */
function today(): number {
  const now = new Date()
  return dayNumber({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() })
}

export function createDaily(options: DailyOptions): Daily {
  const { storage } = options
  let state: DailyState = loadDaily(storage, today())
  let challenge: DailyChallenge = dailyChallenge(state.day)
  /** The rivals' bids for the day: slow to work out, so kept. */
  let rivals: BidLine[] | null = null
  let last: DailyResult | null = null
  /** The design last entered, so entering it again unchanged is not another try. */
  let lastSpec: string | null = null
  let said: { text: string; bad: boolean } | null = null

  /** Past midnight the old day's challenge, tries and result are gone. */
  function roll(): void {
    const day = today()
    if (day === state.day) return
    state = { on: state.on, day, tries: 0, best: null }
    challenge = dailyChallenge(day)
    rivals = null
    last = null
    lastSpec = null
    said = null
    saveDaily(storage, state)
  }

  function enter(): void {
    roll()
    const entered = JSON.stringify(options.spec())
    if (last && entered === lastSpec) return
    lastSpec = entered
    rivals ??= dailyRivals(challenge)
    last = enterDaily(options.spec(), challenge, rivals)
    const made: DailyBest = { place: last.place, of: last.bids.length, total: last.mine.total, legal: last.mine.legal }
    const best = state.best
    const better = betterTry(last, best ? { place: best.place, mine: best } : null)
    state = { ...state, tries: state.tries + 1, best: better ? made : best }
    said = null
    saveDaily(storage, state)
    options.redraw()
  }

  function button(key: string, label: string, className: string): HTMLButtonElement {
    const node = el('button', className, label)
    node.type = 'button'
    node.dataset.key = key
    return node
  }

  function drawSwitch(): HTMLElement {
    const toggle = button('daily-switch', '', state.on ? 'opt opt-on' : 'opt')
    toggle.setAttribute('role', 'switch')
    toggle.setAttribute('aria-checked', state.on ? 'true' : 'false')
    const head = el('span', 'opt-head')
    head.append(el('span', 'opt-name', D.switch.name), el('span', state.on ? 'opt-tag' : 'opt-tag opt-tag-off', state.on ? D.on : D.off))
    toggle.append(head, el('span', 'opt-note', D.switch.note))
    toggle.addEventListener('click', () => {
      roll()
      state = { ...state, on: !state.on }
      saveDaily(storage, state)
      options.changed()
    })
    return toggle
  }

  function drawOrder(result: DailyResult): HTMLElement {
    const order = el('ol', 'bu-order')
    result.bids.forEach((line, index) => {
      const item = el('li', line.who === 'bureau' ? 'bu-bid bu-bid-mine' : 'bu-bid')
      item.append(
        el('span', 'bu-bid-place', fill(STRINGS.career.decision.place, { n: String(index + 1) })),
        el('span', 'bu-bid-name', bidderName(line.who)),
        el('span', 'bu-bid-sum', bidLine(line)),
        el('span', 'bu-bid-sum', axesLine(line.axes)),
      )
      order.append(item)
    })
    return order
  }

  function drawShare(best: DailyBest): HTMLElement[] {
    const text = shareText(challenge, best, state.tries)
    const label = el('label', 'bu-sub', D.shareLabel)
    label.htmlFor = 'daily-share'
    const out = el('textarea', 'sv-code')
    out.id = 'daily-share'
    out.readOnly = true
    out.rows = 4
    out.value = text
    out.dataset.key = 'daily-share'
    out.addEventListener('focus', () => out.select())
    const copy = button('daily-copy', D.copy, 'btn')
    copy.addEventListener('click', () => {
      void (async () => {
        try {
          await navigator.clipboard.writeText(text)
          said = { text: D.copied, bad: false }
        } catch {
          said = { text: D.copyByHand, bad: true }
        }
        options.redraw()
      })()
    })
    return [label, out, copy]
  }

  function draw(): HTMLElement {
    roll()
    const box = el('section', 'ctl')
    box.dataset.key = 'daily'
    box.append(
      el('h3', 'ctl-label', D.title),
      el('p', 'ctl-note', D.note),
      el('p', 'bu-proto-name', dateLine(challenge.day)),
      el('p', 'ctl-note', `${briefLine(challenge)} ${D.wishes[challenge.wish]}`),
      el('p', 'bu-bid-sum', weightsLine(challenge)),
      drawSwitch(),
    )
    const best = el('p', 'ctl-note', bestLine(state.best, state.tries))
    best.dataset.key = 'daily-best'
    box.append(best)
    if (!state.on) return box

    const go = button('daily-enter', D.enter, 'btn btn-go')
    go.addEventListener('click', enter)
    box.append(go)
    if (last) {
      const mine: DailyBest = { place: last.place, of: last.bids.length, total: last.mine.total, legal: last.mine.legal }
      const line = el('p', last.mine.legal ? 'sv-said' : 'ctl-issue', last.mine.legal ? resultLine(mine) : `${D.thrownOut} ${D.seeFaults}`)
      line.setAttribute('role', 'status')
      line.dataset.key = 'daily-result'
      box.append(el('h4', 'bu-sub', D.last), line, el('h4', 'bu-sub', D.order), drawOrder(last))
    }
    if (state.best) box.append(...drawShare(state.best))
    if (said) {
      const line = el('p', said.bad ? 'ctl-issue' : 'sv-said', said.text)
      line.setAttribute('role', 'status')
      box.append(line)
    }
    return box
  }

  return {
    on: () => state.on,
    stop: () => {
      if (!state.on) return
      state = { ...state, on: false }
      saveDaily(storage, state)
    },
    limits: () => {
      roll()
      return { ...challenge.tender.limits, locked: [] }
    },
    marks: () => challenge.tender.marks,
    draw,
  }
}
