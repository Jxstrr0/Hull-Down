// The bureau: the tender in hand, the money and standing, the chief
// engineer, the prototype shop and the army's decision. It draws into the
// design office's panel and keeps the career between visits.
import { ADVISOR_MODES, type AdvisorMode } from '../data/advisor'
import { BODIES } from '../data/career'
import { CUSTOMER_IDS, CUSTOMERS, EXPORT_DESK, NEED_KINDS, type NeedId } from '../data/export'
import { RESEARCH } from '../data/research'
import { BUILD_QUALITIES, BUILD_RATES, SERVICE, type Production } from '../data/service'
import { STRINGS, fill } from '../data/strings'
import { SCORE_AXES, SCORING, TENDER_IDS, TENDER_RULES, type Tender } from '../data/tenders'
import { briefing, type Remark } from '../sim/career/advisor'
import { customerChecks, exportOpen, saleBlock, saleFeeKr, secrets, sell } from '../sim/career/exportDesk'
import { intelFiles } from '../sim/career/intel'
import {
  buildBlock, buildPrototype, enterTender, research, researchBlock, researchOpen, fitUpgrade, newCareer, nextTender, tendersLeft, prototypeCostKr, prototypeTrial, reportOf, serviceDesignation,
  serviceSpec, serviceYear, serviceYearsLeft, startProduction, tenderIdOf, tenderOf, upgradeBlock, upgradesLeft, type Adopted,
  type Career,
} from '../sim/career/career'
import type { BidScore, Trialled } from '../sim/career/score'
import { fileRecord, serviceRecord, type ServiceRecord } from '../sim/career/record'
import type { FieldReport } from '../sim/career/service'
import { buildStatSheet, type VehicleSpec } from '../sim/vehicle'
import { TENDERS } from '../data/tenders'
import { loadArchive, saveArchive } from '../persist/archiveStore'
import { loadAdvisorMode, loadCareer, saveAdvisorMode, saveCareer } from '../persist/careerStore'
import type { KeyValue } from '../persist/designs'
import { remarkLink, remarkText } from '../ui/advisorWords'
import { packageLines, recordRows, recordTitle, servedLine, yearLine } from '../ui/archiveWords'
import {
  axesLine, bidLine, bidderName, blockLine, failedLine, mark, revisionsLine, standingChanges, standingLine, verdictLine,
} from '../ui/careerWords'
import { el } from '../ui/dom'
import {
  askText, complaintText, exerciseLine, feeLine, fittedLine, fleetLine, lessonLines, productionLines, productionSummary,
  rateLine, reportStanding, runningLines, serviceTitle, shootLine, upgradeCheck, yearsLeftLine,
} from '../ui/serviceWords'
import { fixed, money } from '../ui/format'

const C = STRINGS.career
const A = STRINGS.advisor
const V = STRINGS.service

export interface BureauOptions {
  storage: KeyValue
  /** The design on the drawing board, as it stands now. */
  spec: () => VehicleSpec
  /** Open the part of the design a remark points at. */
  goToPart: (part: string) => void
  /** Open the list of faults. */
  toFaults: () => void
  /** Put a tank on the drawing board in place of the design that is there. */
  load: (spec: VehicleSpec) => void
  /** The career has moved on to another tender, or research is done: the office works to new limits from now on. */
  tender: (tender: Tender) => void
  /** Draw the panel again: something here has changed. */
  redraw: () => void
}

export interface Bureau {
  draw: () => HTMLElement
  /** The career as it stands now. */
  career: () => Career
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
  /** True once "go on to the next tender" has been tapped once. */
  let nextArmed = false
  let deciding = false
  let working = false
  /** The rate and quality picked for a tank whose production has not started. */
  let picked: Production = { ...SERVICE.defaultProduction }
  let startArmed = false
  /** Field reports worked out so far, by tank and year. */
  let reports = new Map<string, FieldReport>()
  /** The tank whose next report has been asked for. */
  let reporting: number | null = null
  /** The upgrade button that has been tapped once: "load:0" or "fit:0". */
  let upgradeArmed = ''

  /** The service records of the bureau's tanks, this career's and earlier ones'. */
  let archive: ServiceRecord[] = loadArchive(storage)
  let archiveKept = true

  function keep(next: Career): void {
    const moved = tenderIdOf(next) !== tenderIdOf(career) || next.researched.length !== career.researched.length
    career = next
    if (moved) options.tender(tenderOf(career))
    kept = saveCareer(storage, career)
    career.adopted.forEach((_, index) => file(index))
  }

  /** Bring a tank's page in the archive up to date with what is known of it. */
  function file(index: number): void {
    const tank = career.adopted[index]
    if (!tank) return
    const known: FieldReport[] = []
    for (let year = 1; year <= tank.years; year++) {
      const report = reports.get(`${index}:${year}`)
      if (report) known.push(report)
    }
    const record = serviceRecord(career, index, known)
    if (!record) return
    const next = fileRecord(archive, record, SERVICE.archive.most)
    if (JSON.stringify(next) === JSON.stringify(archive)) return
    archive = next
    archiveKept = saveArchive(storage, archive)
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

  /** What is known of the Accord tanks the tender names, and how surely. */
  function drawIntel(): HTMLElement {
    const I = C.intel
    const box = el('section', 'bu')
    box.append(el('h3', 'ds-group-title', I.heading), el('p', 'ctl-note', I.about))
    for (const file of intelFiles(career)) {
      box.append(el('h4', 'bu-sub', fill(I.file, { name: STRINGS.opponents.threats[file.threat].name, grade: I.grades[file.grade] })))
      box.append(el('p', 'ctl-note', I.gradeNotes[file.grade]))
      const rows = el('dl', 'bu-rows')
      for (const figure of file.figures) {
        const unit = I.units[figure.fact]
        const value = figure.low === figure.high
          ? fill(I.exact, { n: String(figure.low), unit })
          : fill(I.range, { low: String(figure.low), high: String(figure.high), unit })
        row(rows, I.facts[figure.fact], value)
      }
      box.append(rows)
    }
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
      row(money_, B.adopted, fill(B.adoptedLine, { designation: serviceDesignation(tank), name: tank.name || STRINGS.office.designs.unnamed }))
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

  /** The research the tender's generation offers. Nothing when it offers none. */
  function drawResearch(): HTMLElement | null {
    const open = researchOpen(career)
    if (open.length === 0) return null
    const R = C.research
    const box = el('section', 'bu')
    box.append(el('h3', 'ds-group-title', R.heading), el('p', 'ctl-note', fill(R.about, { budget: money(career.budgetKr) })))
    const list = el('ul', 'bu-protos')
    for (const id of open) {
      const project = RESEARCH[id]
      const words = R.projects[id]
      const item = el('li', 'bu-proto')
      item.append(el('p', 'bu-proto-name', words.name), el('p', 'ctl-note', words.about))
      const block = researchBlock(career, id)
      if (block === 'done') item.append(el('p', 'bu-stamp', R.done))
      else {
        item.append(el('p', 'bu-proto-sum', fill(R.cost, { cost: money(project.costKr) })))
        if (block === 'needs') {
          const first = project.needs.filter((need) => !career.researched.includes(need)).map((need) => R.projects[need].name)
          item.append(el('p', 'ctl-issue', fill(R.needs, { names: first.join(', ') })))
        } else if (block) item.append(el('p', 'ctl-issue', R.noMoney))
        else {
          const pay = button(`bureau:research:${id}`, fill(R.pay, { cost: money(project.costKr) }), 'btn btn-go')
          pay.addEventListener('click', () => {
            if (researchBlock(career, id)) return
            keep(research(career, id))
            options.redraw()
          })
          item.append(pay)
        }
      }
      list.append(item)
    }
    box.append(list)
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
    box.append(changes)
    if (outcome.won) box.append(el('p', 'ctl-note', D.nextWon))
    if (!tendersLeft(career)) {
      box.append(el('p', 'ctl-note', D.next))
      return box
    }
    // The next tender: tap twice, since the prototypes stay behind.
    const after = TENDERS[TENDER_IDS[career.tenderNo + 1]!]
    const words = STRINGS.tenders[TENDER_IDS[career.tenderNo + 1]!]
    box.append(el('p', 'ctl-note', fill(D.onward, { year: String(after.year), name: words.name, grant: money(after.grantKr) })))
    const go = button('bureau:next', nextArmed ? D.goConfirm : fill(D.go, { year: String(after.year) }), nextArmed ? 'btn btn-armed' : 'btn')
    go.addEventListener('click', () => {
      if (!nextArmed) {
        nextArmed = true
        options.redraw()
        return
      }
      nextArmed = false
      armed = null
      trials = new Map()
      read = null
      askedKey = ''
      keep(nextTender(career))
      options.redraw()
    })
    box.append(go)
    return box
  }

  /** A row of choices, one of them on. */
  function choices<Id extends string>(
    key: string, label: string, ids: readonly Id[], on: Id, name: (id: Id) => string, pick: (id: Id) => void,
  ): HTMLElement {
    const seg = el('div', 'seg')
    seg.setAttribute('role', 'group')
    seg.setAttribute('aria-label', label)
    for (const id of ids) {
      const item = button(`${key}:${id}`, name(id), id === on ? 'seg-item seg-on' : 'seg-item')
      item.setAttribute('aria-pressed', id === on ? 'true' : 'false')
      item.addEventListener('click', () => {
        pick(id)
        startArmed = false
        options.redraw()
      })
      seg.append(item)
    }
    return seg
  }

  function drawProduction(tank: Adopted, index: number): HTMLElement[] {
    const P = V.production
    const sheet = buildStatSheet(tank.spec, TENDERS[tank.tender].limits)
    if (tank.production) {
      return [el('h4', 'bu-sub', P.heading), el('p', 'bu-proto-sum', productionSummary(tank.production, sheet.unitCostKr))]
    }
    const out: HTMLElement[] = [el('h4', 'bu-sub', P.heading), el('p', 'ctl-note', P.about)]
    out.push(
      el('p', 'bu-label', P.rateLabel),
      choices('rate', P.rateLabel, BUILD_RATES, picked.rate, (id) => P.rates[id].name, (id) => { picked = { ...picked, rate: id } }),
      el('p', 'ctl-note', rateLine(picked.rate)),
      el('p', 'bu-label', P.qualityLabel),
      choices('quality', P.qualityLabel, BUILD_QUALITIES, picked.quality, (id) => P.qualities[id].name, (id) => { picked = { ...picked, quality: id } }),
      el('p', 'ctl-note', P.qualities[picked.quality].line),
    )
    const rows = el('dl', 'bu-rows')
    const lines = productionLines(tank, sheet, picked)
    for (const line of lines) if (!line.bad) row(rows, line.label, line.value)
    out.push(rows)
    for (const line of lines) if (line.bad) out.push(el('p', 'ctl-issue', line.value))
    if (sheet.crewCount < 4) out.push(el('p', 'ctl-note', P.threeMen))
    const start = button(`service:start:${index}`, startArmed ? P.confirm : P.start, startArmed ? 'btn btn-armed' : 'btn btn-go')
    start.addEventListener('click', () => {
      if (!startArmed) startArmed = true
      else {
        startArmed = false
        keep(startProduction(career, index, picked))
      }
      options.redraw()
    })
    out.push(start)
    return out
  }

  function drawReport(report: FieldReport, open: boolean): HTMLElement {
    const R = V.report
    const fold = el('details', 'cmp-fold sv-report')
    fold.dataset.key = `service:report:${report.year}`
    fold.open = open
    fold.append(el('summary', 'cmp-fold-title', fill(R.title, { n: String(report.year) })))
    const body = el('div', 'sv-body')
    const list = (lines: readonly string[], className = 'sv-line'): HTMLElement => {
      const ul = el('ul', 'sv-lines')
      for (const line of lines) ul.append(el('li', className, line))
      return ul
    }
    body.append(
      el('p', 'bu-proto-sum', fleetLine(report)),
      el('h5', 'sv-sub', R.running), list(runningLines(report)),
      el('h5', 'sv-sub', R.crews),
      report.complaints.length ? list(report.complaints.map(complaintText)) : el('p', 'sv-line', R.content),
      el('h5', 'sv-sub', R.shoot), el('p', 'sv-line', shootLine(report)),
      el('h5', 'sv-sub', R.exercise), el('p', 'sv-line', exerciseLine(report)),
    )
    const lessons = lessonLines(report)
    if (lessons.length === 0) body.append(el('p', 'sv-line', R.noLessons))
    else {
      const ul = el('ul', 'sv-lines')
      ul.setAttribute('aria-label', R.lessons)
      for (const lesson of lessons) {
        const item = el('li', 'sv-line')
        const marks = STRINGS.duel.marks
        item.append(el('span', 'duel-finding-mark', `${lesson.good ? '▲' : '▼'} ${lesson.good ? marks.for : marks.against}`), el('span', '', lesson.text))
        ul.append(item)
      }
      body.append(ul)
    }
    const standing = reportStanding(report)
    if (standing.length) body.append(el('h5', 'sv-sub', R.standing), list(standing.map((each) => each.text)))
    body.append(el('p', 'bu-proto-sum', feeLine(report)))
    fold.append(body)
    return fold
  }

  function drawYears(tank: Adopted, index: number): HTMLElement[] {
    const Y = V.years
    const out: HTMLElement[] = [el('h4', 'bu-sub', Y.heading)]
    if (tank.years === 0) out.push(el('p', 'ctl-note', Y.none))
    if (reporting === index) {
      out.push(el('p', 'bu-busy', Y.working))
      later(() => {
        reporting = null
        if (serviceYearsLeft(career.adopted[index]!) > 0) keep(serviceYear(career, index))
      })
    } else if (serviceYearsLeft(tank) > 0) {
      const next = button(`service:year:${index}`, fill(Y.next, { n: String(tank.years + 1) }), 'btn btn-go')
      next.addEventListener('click', () => {
        reporting = index
        options.redraw()
      })
      out.push(next)
    }
    out.push(el('p', 'ctl-note', yearsLeftLine(tank)))
    // The newest first, and open: it is the one just asked for.
    for (let year = tank.years; year >= 1; year--) {
      const key = `${index}:${year}`
      const report = reports.get(key)
      if (report) {
        out.push(drawReport(report, year === tank.years))
        continue
      }
      out.push(el('p', 'bu-busy', Y.working))
      later(() => {
        const made = reportOf(career, index, year)
        if (made) reports.set(key, made)
        file(index)
      })
      break // One at a time: the rest follow as each is done.
    }
    if (serviceYearsLeft(tank) > 0) out.push(el('p', 'ctl-note', Y.about))
    return out
  }

  /** The contract the army has open on a tank, the board judged against it, and the packages fitted so far. */
  function drawUpgrade(tank: Adopted, index: number, spec: VehicleSpec): HTMLElement[] {
    const U = V.upgrade
    const out: HTMLElement[] = [el('h4', 'bu-sub', U.heading)]
    if (tank.upgrades.length > 0) {
      const list = el('ul', 'sv-lines')
      list.setAttribute('aria-label', U.fitted)
      for (const upgrade of tank.upgrades) list.append(el('li', 'sv-line', fittedLine(tank, upgrade)))
      out.push(list)
    }
    const check = upgradeCheck(career, index, spec)
    if (!tank.contract || !check) {
      if (upgradesLeft(tank) === 0) out.push(el('p', 'ctl-note', fill(U.spent, { n: String(SERVICE.upgrade.letters.length) })))
      else if (serviceYearsLeft(tank) > 0) out.push(el('p', 'ctl-note', U.none))
      return out.length > 1 ? out : []
    }
    out.push(
      el('p', 'bu-said', askText(tank.contract)),
      el('p', 'ctl-note', U.rules),
      el('p', 'bu-board', fill(U.board, { name: spec.name || STRINGS.office.designs.unnamed })),
    )
    const rows = el('dl', 'bu-rows')
    for (const line of check.rows) row(rows, line.label, line.value)
    out.push(rows, el('p', check.met ? 'sv-said' : 'ctl-note', check.met ? `✓ ${U.met}` : `✗ ${U.notMet}`))
    if (check.block) {
      out.push(el('p', 'ctl-issue', check.blockText))
      if (check.block === 'illegal') {
        const faults = button(`upgrade:faults:${index}`, C.build.toFaults)
        faults.addEventListener('click', options.toFaults)
        out.push(faults)
      }
    }
    const acts = el('div', 'sv-actions')
    const loadKey = `load:${index}`
    const load = button(`upgrade:${loadKey}`, upgradeArmed === loadKey ? U.loadConfirm : U.load, upgradeArmed === loadKey ? 'btn btn-armed' : 'btn')
    load.addEventListener('click', () => {
      if (upgradeArmed !== loadKey) {
        upgradeArmed = loadKey
        options.redraw()
        return
      }
      upgradeArmed = ''
      options.load(serviceSpec(career.adopted[index]!))
    })
    if (check.block !== 'same') acts.append(load)
    if (!check.block) {
      const fitKey = `fit:${index}`
      const on = upgradeArmed === fitKey
      const fit = button(`upgrade:${fitKey}`, on ? U.fitConfirm : fill(U.fit, { designation: check.designation }), on ? 'btn btn-armed' : 'btn btn-go')
      fit.addEventListener('click', () => {
        if (upgradeArmed !== fitKey) upgradeArmed = fitKey
        else {
          upgradeArmed = ''
          const now = options.spec()
          if (upgradeBlock(career, index, now) === null) keep(fitUpgrade(career, index, now))
        }
        options.redraw()
      })
      acts.append(fit)
    }
    out.push(acts)
    return out
  }

  /** One section for each tank the army has adopted, the newest first. */
  function drawService(spec: VehicleSpec): HTMLElement[] {
    return career.adopted.map((tank, index) => {
      const box = el('section', 'bu sv')
      box.dataset.key = `service:${index}`
      box.append(el('h3', 'ds-group-title', fill(V.heading, { designation: serviceDesignation(tank) })))
      if (tank.name) box.append(el('p', 'bu-board', serviceTitle(tank)))
      box.append(...drawProduction(tank, index))
      if (tank.production) box.append(...drawUpgrade(tank, index, spec), ...drawYears(tank, index))
      return box
    }).reverse()
  }

  /** A need's figure in words: a part fitted or not, money, or a number with its unit. */
  function needText(need: NeedId, value: number): string {
    const X = C.exportDesk
    if (NEED_KINDS[need] === 'fitted') return value >= 1 ? X.fitted : X.notFitted
    if (need === 'unitCostKr') return money(value)
    const places = need === 'groundPressure' ? 2 : need === 'rangeKm' ? 0 : 1
    return fill(X.figure, { n: fixed(value, places), unit: X.units[need as keyof typeof X.units] })
  }

  /** The customers abroad, what each asks, and how the bureau's tanks in service measure up. */
  function drawExport(): HTMLElement | null {
    if (!exportOpen(career)) return null
    const X = C.exportDesk
    const box = el('section', 'bu')
    box.dataset.key = 'export'
    box.append(el('h3', 'ds-group-title', X.heading), el('p', 'ctl-note', X.about))
    const tanks = career.adopted.map((tank, index) => {
      const spec = serviceSpec(tank)
      return { index, name: serviceDesignation(tank), spec, sheet: buildStatSheet(spec, TENDERS[tank.tender].limits) }
    }).reverse()
    for (const id of CUSTOMER_IDS) {
      const customer = CUSTOMERS[id]
      const words = X.customers[id]
      box.append(el('h4', 'bu-sub', fill(X.title, { name: words.name, climate: X.climates[customer.climate] })))
      box.append(el('p', 'ctl-note', `${words.line} ${fill(X.order, { n: String(customer.tanks) })}`))
      const rows = el('dl', 'bu-rows')
      const first = tanks[0]
      if (first) for (const check of customerChecks(id, first.spec, first.sheet)) row(rows, X.needs[check.need], needText(check.need, check.want))
      box.append(rows)
      const order = career.sales.find((sale) => sale.customer === id)
      if (order) {
        box.append(el('p', 'bu-stamp', X.licensed))
        box.append(el('p', 'bu-proto-sum', fill(X.sold, { n: String(order.tanks), tank: order.designation, fee: money(order.feeKr) })))
        continue
      }
      const list = el('ul', 'sv-lines')
      for (const tank of tanks) {
        const checks = customerChecks(id, tank.spec, tank.sheet)
        const missed = checks.filter((check) => !check.met)
        if (missed.length === 0) {
          const item = el('li', 'sv-line', fill(X.suits, { tank: tank.name }))
          const block = saleBlock(career, tank.index, id)
          if (block === 'noLine') item.append(el('p', 'ctl-issue', fill(X.noLine, { tank: tank.name })))
          else if (block === 'secret') {
            const names = secrets(tank.spec).map((project) => C.research.projects[project].name).join(', ')
            item.append(el('p', 'ctl-issue', fill(X.secret, { tank: tank.name, names })))
          } else if (block === 'standing') {
            item.append(el('p', 'ctl-issue', fill(X.standing, { have: String(career.reputation.ministry), want: String(EXPORT_DESK.ministryStanding) })))
          } else if (block === null) {
            const fee = money(saleFeeKr(customer.tanks, tank.sheet.unitCostKr))
            const go = button(`bureau:sell:${id}:${tank.index}`, fill(X.sell, { tank: tank.name, fee }), 'btn btn-go')
            go.addEventListener('click', () => {
              if (saleBlock(career, tank.index, id)) return
              keep(sell(career, tank.index, id))
              options.redraw()
            })
            item.append(go)
          }
          list.append(item)
          continue
        }
        const item = el('li', 'sv-line', fill(X.short, { tank: tank.name, n: String(missed.length), of: String(checks.length) }))
        const why = el('ul', 'sv-lines')
        for (const check of missed) {
          const line = NEED_KINDS[check.need] === 'fitted'
            ? fill(X.lacks, { need: X.needs[check.need] })
            : fill(X.has, { need: X.needs[check.need], have: needText(check.need, check.have) })
          why.append(el('li', 'sv-line', line))
        }
        item.append(why)
        list.append(item)
      }
      box.append(list)
    }
    return box
  }

  /** The archive: one page a tank, the newest first. */
  function drawArchive(): HTMLElement {
    const A = STRINGS.archive
    const box = el('section', 'bu')
    box.dataset.key = 'archive'
    box.append(el('h3', 'ds-group-title', A.heading), el('p', 'ctl-note', A.about))
    if (!archiveKept) box.append(el('p', 'ctl-issue', A.notKept))
    if (archive.length === 0) {
      box.append(el('p', 'ctl-note', A.none))
      return box
    }
    for (const record of archive) {
      const fold = el('details', 'cmp-fold sv-report')
      fold.dataset.key = `archive:${record.id}`
      fold.append(el('summary', 'cmp-fold-title', recordTitle(record)))
      const body = el('div', 'sv-body')
      body.append(el('p', 'bu-proto-sum', servedLine(record)))
      const rows = el('dl', 'bu-rows')
      for (const line of recordRows(record)) row(rows, line.label, line.value)
      const packages = packageLines(record)
      row(rows, A.packages, packages.length ? String(packages.length) : A.noPackages)
      body.append(rows)
      if (packages.length) {
        const list = el('ul', 'sv-lines')
        for (const line of packages) list.append(el('li', 'sv-line', line))
        body.append(list)
      }
      if (record.years.length) {
        const list = el('ul', 'sv-lines')
        list.setAttribute('aria-label', A.years)
        for (const year of record.years) list.append(el('li', 'sv-line', yearLine(year)))
        body.append(el('h5', 'sv-sub', A.years), list)
      }
      fold.append(body)
      box.append(fold)
    }
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
      nextArmed = false
      armed = null
      trials = new Map()
      reports = new Map()
      reporting = null
      startArmed = false
      upgradeArmed = ''
      picked = { ...SERVICE.defaultProduction }
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
    box.append(...drawService(spec))
    const desk = drawExport()
    if (desk) box.append(desk)
    box.append(drawTender(), drawIntel(), drawBureau())
    const lab = drawResearch()
    if (lab) box.append(lab)
    box.append(drawAdvisor(spec), drawShop(spec), drawPrototypes(), drawArchive(), drawRestart())
    return box
  }

  return { draw, career: () => career }
}
