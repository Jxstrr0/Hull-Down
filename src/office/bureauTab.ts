// The bureau: the tender in hand, the money and standing, the chief
// engineer, the prototype shop and the army's decision. It draws into the
// design office's panel and keeps the career between visits.
import { ADVISOR_MODES, type AdvisorMode } from '../data/advisor'
import { BODIES } from '../data/career'
import { STRINGS, fill } from '../data/strings'
import { SCORE_AXES, SCORING, TENDER_RULES } from '../data/tenders'
import { briefing, type Remark } from '../sim/career/advisor'
import {
  buildBlock, buildPrototype, enterTender, newCareer, prototypeCostKr, prototypeTrial, tenderIdOf, tenderOf, type Career,
} from '../sim/career/career'
import type { BidScore, Trialled } from '../sim/career/score'
import type { VehicleSpec } from '../sim/vehicle'
import { loadAdvisorMode, loadCareer, saveAdvisorMode, saveCareer } from '../persist/careerStore'
import type { KeyValue } from '../persist/designs'
import { remarkLink, remarkText } from '../ui/advisorWords'
import {
  axesLine, bidLine, bidderName, blockLine, failedLine, mark, revisionsLine, standingChanges, standingLine, verdictLine,
} from '../ui/careerWords'
import { el } from '../ui/dom'
import { fixed, money } from '../ui/format'

const C = STRINGS.career
const A = STRINGS.advisor

export interface BureauOptions {
  storage: KeyValue
  /** The design on the drawing board, as it stands now. */
  spec: () => VehicleSpec
  /** Open the part of the design a remark points at. */
  goToPart: (part: string) => void
  /** Open the list of faults. */
  toFaults: () => void
  /** Draw the panel again: something here has changed. */
  redraw: () => void
}

export interface Bureau {
  draw: () => HTMLElement
}

/** A seed for a new career. The sim never rolls its own: it is handed this. */
function freshSeed(): number {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1
  } catch {
    return (Math.random() * 0xffffffff) >>> 0
  }
}

export function createBureau(options: BureauOptions): Bureau {
  const { storage } = options
  let career: Career = loadCareer(storage) ?? newCareer(freshSeed())
  let kept = saveCareer(storage, career)
  let mode: AdvisorMode = loadAdvisorMode(storage)

  /** What the range made of each prototype, worked out once. */
  let trials = new Map<number, { bid: Trialled; score: BidScore }>()
  /** The chief engineer's last reading, and the design it was a reading of. */
  let read: { key: string; remarks: Remark[]; more: number } | null = null
  /** The design he was last asked about, when he only speaks when asked. */
  let askedKey = ''
  /** The prototype whose "enter" button has been tapped once. */
  let armed: number | null = null
  let restartArmed = false
  let deciding = false
  let working = false

  function keep(next: Career): void {
    career = next
    kept = saveCareer(storage, career)
  }

  /** Do a slow piece of work after the screen has had the chance to say so. */
  function later(work: () => void): void {
    if (working) return
    working = true
    setTimeout(() => {
      working = false
      work()
      options.redraw()
    }, 30)
  }

  function button(key: string, label: string, className = 'btn'): HTMLButtonElement {
    const node = el('button', className, label)
    node.type = 'button'
    node.dataset.key = key
    return node
  }

  function row(list: HTMLElement, label: string, value: string): void {
    const box = el('div', 'bu-row')
    box.append(el('dt', 'bu-label', label), el('dd', 'bu-value', value))
    list.append(box)
  }

  function drawTender(): HTMLElement {
    const T = C.tender
    const tender = tenderOf(career)
    const words = STRINGS.tenders[tenderIdOf(career)]
    const box = el('section', 'bu')
    box.append(
      el('h3', 'ds-group-title', fill(T.heading, { year: String(tender.year), name: words.name })),
      el('p', 'ctl-note', words.brief),
    )
    const limits = el('dl', 'bu-rows')
    row(limits, T.mass, fill(T.massValue, { n: fixed(tender.limits.maxMassT, 0) }))
    row(limits, T.cost, fill(T.costValue, { n: money(tender.limits.maxUnitCostKr) }))
    row(limits, T.grant, money(tender.grantKr))
    row(limits, T.revisions, fill(T.revisionsValue, { n: String(TENDER_RULES.revisions) }))
    row(limits, T.threats, tender.threats.map((id) => STRINGS.opponents.threats[id].name).join(', '))
    box.append(limits)
    box.append(el('h4', 'bu-sub', T.weighs), el('p', 'ctl-note', fill(T.weighsAbout, { n: String(SCORING.failedTest) })))
    const weights = el('dl', 'bu-rows')
    for (const axis of SCORE_AXES) row(weights, C.axes[axis], fill(T.weight, { n: String(tender.weights[axis]) }))
    box.append(weights)
    return box
  }

  function drawBureau(): HTMLElement {
    const B = C.bureau
    const box = el('section', 'bu')
    box.append(el('h3', 'ds-group-title', B.heading))
    if (!kept) box.append(el('p', 'ctl-issue', B.notKept))
    const money_ = el('dl', 'bu-rows')
    row(money_, B.budget, money(career.budgetKr))
    for (const tank of career.adopted) {
      row(money_, B.adopted, fill(B.adoptedLine, { designation: tank.designation, name: tank.name || STRINGS.office.designs.unnamed }))
    }
    box.append(money_, el('h4', 'bu-sub', B.standingHeading))
    const standing = el('dl', 'bu-rows')
    for (const body of BODIES) {
      const line = el('div', 'bu-row')
      const label = el('dt', 'bu-label', C.bodies[body])
      label.append(el('span', 'bu-wants', C.bodyWants[body]))
      line.append(label, el('dd', 'bu-value', standingLine(career, body)))
      standing.append(line)
    }
    box.append(standing)
    return box
  }

  function drawAdvisor(spec: VehicleSpec): HTMLElement {
    const box = el('section', 'bu')
    box.append(el('h3', 'ds-group-title', A.heading), el('p', 'ctl-note', fill(A.about, { name: A.name })))

    const modes = el('div', 'seg')
    modes.setAttribute('role', 'group')
    modes.setAttribute('aria-label', A.modeLabel)
    for (const id of ADVISOR_MODES) {
      const pick = button(`advisor:${id}`, A.modes[id], id === mode ? 'seg-item seg-on' : 'seg-item')
      pick.setAttribute('aria-pressed', id === mode ? 'true' : 'false')
      pick.addEventListener('click', () => {
        mode = id
        saveAdvisorMode(storage, mode)
        options.redraw()
      })
      modes.append(pick)
    }
    box.append(el('p', 'bu-label', A.modeLabel), modes)
    if (mode === 'off' || career.outcome) return box

    const key = JSON.stringify(spec)
    if (mode === 'ask' && askedKey !== key) {
      const ask = button('advisor:ask', fill(A.ask, { name: A.name }))
      ask.addEventListener('click', () => {
        askedKey = key
        options.redraw()
      })
      box.append(ask)
      return box
    }
    if (!read || read.key !== key) {
      box.append(el('p', 'bu-busy', C.advisorReading))
      later(() => {
        const now = options.spec()
        read = { key: JSON.stringify(now), ...briefing(now, tenderOf(career)) }
      })
      return box
    }
    if (read.remarks.length === 0) {
      box.append(el('p', 'bu-said', A.none))
      return box
    }
    const list = el('ul', 'bu-remarks')
    read.remarks.forEach((remark, index) => {
      const item = el('li', 'bu-remark')
      item.append(el('p', 'bu-said', remarkText(remark)))
      const link = remarkLink(remark)
      if (link !== null) {
        const look = button(`look:${index}`, link)
        look.addEventListener('click', () => options.goToPart(remark.part))
        item.append(look)
      }
      list.append(item)
    })
    box.append(list)
    if (read.more > 0) box.append(el('p', 'ctl-note', fill(A.more, { n: String(read.more) })))
    return box
  }

  function drawShop(spec: VehicleSpec): HTMLElement {
    const S = C.build
    const box = el('section', 'bu')
    box.append(el('h3', 'ds-group-title', S.heading), el('p', 'ctl-note', S.about))
    if (career.outcome) {
      box.append(el('p', 'ctl-note', S.blocks.decided))
      return box
    }
    box.append(
      el('p', 'bu-board', fill(S.board, { name: spec.name || STRINGS.office.designs.unnamed })),
      el('p', 'ctl-note', fill(S.cost, { cost: money(prototypeCostKr(career, spec)), budget: money(career.budgetKr) })),
      el('p', 'ctl-note', revisionsLine(career)),
    )
    const block = buildBlock(career, spec)
    if (block) {
      box.append(el('p', 'ctl-issue', blockLine(block)))
      if (block === 'illegal') {
        const faults = button('bureau:faults', S.toFaults)
        faults.addEventListener('click', options.toFaults)
        box.append(faults)
      }
      return box
    }
    const build = button('bureau:build', fill(S.build, { n: String(career.prototypes.length + 1) }), 'btn btn-go')
    build.addEventListener('click', () => {
      const now = options.spec()
      if (buildBlock(career, now)) return
      keep(buildPrototype(career, now))
      armed = null
      options.redraw()
    })
    box.append(build)
    return box
  }

  function drawPrototypes(): HTMLElement {
    const M = C.marks
    const box = el('section', 'bu')
    box.append(el('h3', 'ds-group-title', M.heading))
    if (career.prototypes.length === 0) {
      box.append(el('p', 'ctl-note', M.none))
      return box
    }
    const list = el('ul', 'bu-protos')
    // The newest first: it is the one being worked on.
    for (const prototype of [...career.prototypes].reverse()) {
      const item = el('li', 'bu-proto')
      const name = prototype.spec.name || STRINGS.office.designs.unnamed
      item.append(el('p', 'bu-proto-name', fill(M.title, { n: String(prototype.no), name })))
      const trial = trials.get(prototype.no)
      if (!trial) {
        item.append(el('p', 'bu-busy', M.running))
        later(() => {
          const result = prototypeTrial(career, prototype.no)
          if (result) trials.set(prototype.no, result)
        })
        list.append(item)
        continue
      }
      item.append(
        el('p', 'bu-proto-sum', fill(M.cost, { cost: money(prototype.costKr), unit: money(trial.bid.sheet.unitCostKr) })),
        el('p', 'bu-proto-sum', axesLine(trial.score.axes)),
        el('p', trial.score.failed > 0 ? 'bu-proto-fail' : 'bu-proto-sum', failedLine(trial.score, trial.bid.range)),
        el('p', 'bu-proto-total', trial.score.legal ? fill(M.total, { n: mark(trial.score.total) }) : M.illegal),
      )
      if (career.outcome) {
        if (career.outcome.entered === prototype.no) item.append(el('p', 'bu-stamp', M.entered))
      } else if (deciding) {
        if (armed === prototype.no) {
          item.append(el('p', 'bu-busy', M.deciding))
          later(() => {
            keep(enterTender(career, prototype.no))
            deciding = false
            armed = null
          })
        }
      } else {
        const on = armed === prototype.no
        const enter = button(`enter:${prototype.no}`, on ? M.confirm : fill(M.enter, { n: String(prototype.no) }), on ? 'btn btn-armed' : 'btn')
        enter.addEventListener('click', () => {
          if (armed !== prototype.no) armed = prototype.no
          else deciding = true
          options.redraw()
        })
        item.append(enter)
      }
      list.append(item)
    }
    box.append(list)
    return box
  }

  function drawDecision(): HTMLElement | null {
    const outcome = career.outcome
    if (!outcome) return null
    const D = C.decision
    const box = el('section', 'bu')
    box.append(
      el('h3', 'ds-group-title', D.heading),
      el('p', outcome.won ? 'bu-verdict bu-verdict-won' : 'bu-verdict', verdictLine(outcome)),
      el('h4', 'bu-sub', D.order),
    )
    const order = el('ol', 'bu-order')
    outcome.bids.forEach((line, index) => {
      const item = el('li', line.who === 'bureau' ? 'bu-bid bu-bid-mine' : 'bu-bid')
      item.append(
        el('span', 'bu-bid-place', fill(D.place, { n: String(index + 1) })),
        el('span', 'bu-bid-name', bidderName(line.who)),
        el('span', 'bu-bid-sum', bidLine(line)),
        el('span', 'bu-bid-sum', axesLine(line.axes)),
      )
      order.append(item)
    })
    box.append(order, el('h4', 'bu-sub', D.standing))
    const changes = el('ul', 'bu-changes')
    for (const change of standingChanges(outcome)) changes.append(el('li', 'bu-change', change.text))
    box.append(changes, el('p', 'ctl-note', D.next))
    return box
  }

  function drawRestart(): HTMLElement {
    const R = C.restart
    const box = el('section', 'bu')
    box.append(el('p', 'ctl-note', R.about))
    const again = button('bureau:restart', restartArmed ? R.confirm : R.button, restartArmed ? 'btn btn-armed' : 'btn')
    again.addEventListener('click', () => {
      if (!restartArmed) {
        restartArmed = true
        options.redraw()
        return
      }
      restartArmed = false
      armed = null
      trials = new Map()
      read = null
      askedKey = ''
      keep(newCareer(freshSeed()))
      options.redraw()
    })
    box.append(again)
    return box
  }

  function draw(): HTMLElement {
    const spec = options.spec()
    const box = el('div', 'bureau')
    const decision = drawDecision()
    if (decision) box.append(decision)
    box.append(drawTender(), drawBureau(), drawAdvisor(spec), drawShop(spec), drawPrototypes(), drawRestart())
    return box
  }

  return { draw }
}
