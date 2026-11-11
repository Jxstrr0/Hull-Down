// The design office, first version: pick parts, watch the weight bar move,
// read the faults and jump to the part that fixes them.
// The blueprint on top is drawn from the same spec, and tapping it opens a part.
import { BASELINE_SPEC } from '../data/baseline'
import { STRINGS, fill } from '../data/strings'
import {
  AREAS, buildStatSheet, gunRounds, penetrationAt, tiledVerdictsAgainst, tileGrid, verdictsAgainst, type Issue, type Limits,
  type StatSheet, type VehicleSpec,
} from '../sim/vehicle'
import { el } from '../ui/dom'
import { fixed, money, signed, signedMoney } from '../ui/format'
import {
  CONTROLS, PART_TABS, fixTarget, preview, type ChoiceControl, type Control, type ControlId, type NumberControl,
  type PartTab, type Preview, type ToggleControl,
} from './controls'
import { DEFAULT_THREAT, THREATS, type Round } from '../data/ammo'
import { ZONES, type ZoneId } from '../data/materials'
import { GUNS } from '../data/parts'
import { TUNING } from '../data/tuning'
import { renderArmourTab, type ArmourTabState } from './armourTab'
import { renderBlueprint, type ZoneTiles } from './blueprint'
import { VIEWS, ZONE_VIEW, type View } from './drawing'
import {
  MAX_DESIGNS, addDesign, currentDesign, keepRevision, lastRevision, loadStore, openDesign, restoreRevision, sameBuild, saveStore,
  scrapDesign, type KeyValue,
} from '../persist/designs'
import { NAME_MAX, cleanName, cleanSpec } from '../persist/specCodec'
import { issueText, renderGunnery, renderReadouts, renderStations } from './readouts'
import { renderRangeScreen } from '../ui/rangeScreen'
import { renderCompareScreen, type CompareSide } from '../ui/compareScreen'
import { renderDuelScreen } from '../ui/duelScreen'
import { DUEL } from '../data/duel'

const O = STRINGS.office
const D = STRINGS.dataSheet
const X = STRINGS.office.designs

const TABS = ['hull', 'turret', 'armour', 'gun', 'fireControl', 'powerpack', 'runningGear', 'crew', 'readouts', 'faults', 'trials', 'designs'] as const
type Tab = (typeof TABS)[number]

/** The weight bar is drawn a little longer than the limit, so going over shows. */
const BAR_SCALE = 1.15

function isPartTab(tab: Tab): tab is PartTab {
  return (PART_TABS as readonly string[]).includes(tab)
}

function deltaText(change: Preview): string {
  const mass = fill(O.deltaTonnes, { n: signed(change.massDeltaT, 2) })
  const cost = signedMoney(change.costDeltaKr)
  if (Number(fixed(Math.abs(change.massDeltaT), 2)) === 0 && Math.abs(change.costDeltaKr) < 500) return O.noChange
  return fill(O.delta, { mass, cost })
}

export function renderDesignScreen(limits: Limits): HTMLElement {
  // The browser's storage can be blocked. Touch it only inside these, where failure is handled.
  const storage: KeyValue = {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  }
  const store = loadStore(storage)
  let design = currentDesign(store)
  let spec: VehicleSpec = design.spec
  let sheet: StatSheet = buildStatSheet(spec, limits)
  /** False once the browser has refused to keep a design. */
  let kept = true
  let tab: Tab = 'hull'
  /** A control to scroll to and mark after the next panel draw. */
  let flagged: ControlId | undefined
  let view: View = 'side'
  const armourState: ArmourTabState = {
    zone: 'upperGlacis', zonesScroll: 0, threat: DEFAULT_THREAT, rangeM: TUNING.protection.defaultRangeM, mapOpen: false,
    angleDeg: 0, atTile: true,
  }

  const root = el('section', 'office')
  root.setAttribute('aria-label', O.label)

  // --- Top panel: name, weight bar, headline numbers ---------------------
  const top = el('div', 'office-top')
  const head = el('div', 'office-head')
  const viewSwitch = el('div', 'views')
  viewSwitch.setAttribute('role', 'group')
  viewSwitch.setAttribute('aria-label', O.viewsLabel)
  const viewButtons = VIEWS.map((id) => {
    const button = el('button', 'view', O.views[id])
    button.type = 'button'
    button.addEventListener('click', () => {
      view = id
      drawBlueprint()
    })
    viewSwitch.append(button)
    return button
  })
  /** True while the drawing shows what is inside the armour. */
  let cutaway = false
  const cutButton = el('button', 'view view-cut', O.cutaway.button)
  cutButton.type = 'button'
  cutButton.setAttribute('aria-label', O.cutaway.buttonLabel)
  cutButton.addEventListener('click', () => {
    cutaway = !cutaway
    drawBlueprint()
  })
  viewSwitch.append(cutButton)
  const titles = el('div', 'office-titles')
  const projectLine = el('p', 'office-project')
  const nameLine = el('h2', 'office-name')
  titles.append(projectLine, nameLine)
  head.append(titles, viewSwitch)
  const blueprint = el('div', 'bp')
  const reset = el('button', 'btn', O.reset)
  reset.type = 'button'

  const bar = el('div', 'wbar')
  bar.setAttribute('role', 'img')
  const track = el('div', 'wbar-track')
  const segments = AREAS.map((area, index) => {
    const segment = el('div', index % 2 === 0 ? 'wbar-seg' : 'wbar-seg wbar-seg-alt')
    segment.title = D.areas[area]
    track.append(segment)
    return segment
  })
  const limitMark = el('div', 'wbar-limit')
  limitMark.style.left = `${fixed(100 / BAR_SCALE, 2)}%`
  track.append(limitMark)
  const barText = el('div', 'wbar-text')
  const barMass = el('span', 'wbar-mass')
  const barSpare = el('span', 'wbar-spare')
  barText.append(barMass, barSpare)
  bar.append(track, barText)

  const chips = el('dl', 'chips')
  const chip = (label: string): HTMLElement => {
    const box = el('div', 'chip')
    const value = el('dd', 'chip-value')
    box.append(el('dt', 'chip-label', label), value)
    chips.append(box)
    return value
  }
  const chipCost = chip(O.chips.cost)
  const chipSpeed = chip(O.chips.speed)
  const chipRange = chip(O.chips.range)
  const chipPower = chip(O.chips.powerToWeight)
  const chipReliability = chip(O.chips.reliability)
  const chipSpace = chip(O.chips.space)
  top.append(head, blueprint, bar, chips)

  // --- Tabs and the panel under them -------------------------------------
  const tabList = el('div', 'tabs')
  tabList.setAttribute('role', 'tablist')
  tabList.setAttribute('aria-label', O.tabsLabel)
  const panel = el('div', 'panel')
  panel.setAttribute('role', 'tabpanel')
  panel.tabIndex = -1
  const tabButtons = new Map<Tab, HTMLButtonElement>()
  for (const id of TABS) {
    const button = el('button', 'tab')
    button.type = 'button'
    button.setAttribute('role', 'tab')
    button.addEventListener('click', () => {
      tab = id
      // The armour's drawing is the protection map: turn it to the zone being worked on.
      if (id === 'armour') view = ZONE_VIEW[armourState.zone] ?? view
      panel.scrollTop = 0
      drawBlueprint()
      drawTabs()
      drawPanel()
    })
    tabButtons.set(id, button)
    tabList.append(button)
  }

  /** The proving ground takes over the whole screen while it is open. */
  const range = el('div', 'range-holder')
  root.append(top, tabList, panel, range)

  // --- Drawing ------------------------------------------------------------
  function issuesFor(id: string): Issue[] {
    return sheet.issues.filter((issue) => issue.part === id)
  }

  /** Slide the row of tabs so the open one can be seen. */
  function showTab(): void {
    const button = tabButtons.get(tab)
    if (button) tabList.scrollLeft = button.offsetLeft - (tabList.clientWidth - button.offsetWidth) / 2
  }

  /** Open a control's tab and mark the control. */
  function goTo(id: ControlId): void {
    const target = fixTarget(id)
    if (!target) return
    tab = target.tab
    flagged = target.id
    drawBlueprint()
    drawTabs()
    drawPanel()
    showTab()
  }

  /** Work on an armour zone, turning the blueprint to the view that shows it square on. */
  function pickZone(zone: ZoneId): void {
    armourState.zone = zone
    view = ZONE_VIEW[zone] ?? view
    drawBlueprint()
    drawPanel()
  }

  /** The armour zone a fault's part names, if it names one. `armour` alone means the armour as a whole. */
  function armourZoneOf(part: string): ZoneId | 'any' | undefined {
    if (part === 'armour') return 'any'
    return ZONES.find((zone) => part === `armour.${zone}`)
  }

  /** Open the place where a fault is fixed. False when the design office has none for it. */
  function goToPart(part: string): boolean {
    const zone = armourZoneOf(part)
    if (zone) {
      if (zone !== 'any') armourState.zone = zone
      tab = 'armour'
      view = ZONE_VIEW[armourState.zone] ?? view
      panel.scrollTop = 0
      drawBlueprint()
      drawTabs()
      drawPanel()
      showTab()
      panel.focus({ preventScroll: true })
      return true
    }
    const target = fixTarget(part)
    if (target) goTo(target.id)
    return target !== undefined
  }

  /** The reactive tiles to draw on the map, with how a tile stands up to the chosen round. */
  function tilesOnDrawing(threat: Round | undefined): Partial<Record<ZoneId, ZoneTiles>> {
    const verdicts = threat && tiledVerdictsAgainst(sheet.protection, sheet.rollup.era, threat, armourState.rangeM)
    const tiles: Partial<Record<ZoneId, ZoneTiles>> = {}
    for (const zone of ZONES) {
      const grid = tileGrid(zone)
      if (grid && sheet.rollup.era[zone].tiles > 0) tiles[zone] = { grid, fitted: spec.era[zone], verdict: verdicts?.[zone] }
    }
    return tiles
  }

  function drawBlueprint(): void {
    VIEWS.forEach((id, index) => {
      const button = viewButtons[index]
      if (!button) return
      button.classList.toggle('view-on', id === view)
      button.setAttribute('aria-pressed', id === view ? 'true' : 'false')
    })
    // While the armour is being worked on, the drawing is the protection map.
    const threat = armourState.threat === 'none' ? undefined : THREATS[armourState.threat]
    const map = tab === 'armour'
      ? {
          selected: armourState.zone,
          verdicts: threat && verdictsAgainst(sheet.protection, threat, armourState.rangeM),
          tiles: tilesOnDrawing(threat),
          pick: pickZone,
        }
      : undefined
    cutButton.classList.toggle('view-on', cutaway)
    cutButton.setAttribute('aria-pressed', cutaway ? 'true' : 'false')
    blueprint.replaceChildren(...renderBlueprint(spec, sheet.geometry, view, goTo, map, cutaway ? sheet.interior : undefined))
  }

  function drawTitle(): void {
    projectLine.textContent = fill(O.project, { n: String(design.projectNo) })
    nameLine.textContent = spec.name || X.unnamed
  }

  function drawTop(): void {
    drawTitle()
    drawBlueprint()
    const scale = limits.maxMassT * BAR_SCALE
    AREAS.forEach((area, index) => {
      const segment = segments[index]
      if (segment) segment.style.width = `${fixed(Math.min(100, (sheet.rollup.massT[area] / scale) * 100), 2)}%`
    })
    const spare = limits.maxMassT - sheet.massT
    const over = spare < 0
    bar.classList.toggle('wbar-over', over)
    bar.setAttribute('aria-label', fill(O.weightBarLabel, { mass: fixed(sheet.massT, 1), limit: fixed(limits.maxMassT, 1) }))
    barMass.textContent = fill(O.weightOf, { mass: fixed(sheet.massT, 1), limit: fixed(limits.maxMassT, 1) })
    barSpare.textContent = fill(over ? O.weightOver : O.weightSpare, { n: fixed(Math.abs(spare), 1) })

    const u = D.units
    chipCost.textContent = money(sheet.unitCostKr)
    chipSpeed.textContent = fill(u.kmh, { n: fixed(sheet.mobility.topSpeedKmh, 0) })
    chipRange.textContent = fill(u.km, { n: fixed(sheet.mobility.rangeKm, 0) })
    chipPower.textContent = fill(u.hpPerTonne, { n: fixed(sheet.mobility.powerToWeightHpT, 1) })
    chipReliability.textContent = fill(u.outOf100, { n: fixed(sheet.reliabilityIndex, 0) })
    chipSpace.textContent = fill(u.cubicMetres, { n: fixed(sheet.growth.volumeM3, 1) })
    chipSpace.classList.toggle('chip-bad', sheet.growth.volumeM3 < 0)
  }

  function drawTabs(): void {
    for (const [id, button] of tabButtons) {
      const name = O.tabs[id]
      let text: string = name
      let label: string = name
      if (id === 'faults') {
        if (sheet.issues.length > 0) text = label = fill(O.faultsCount, { name, count: String(sheet.issues.length) })
      } else if (id === 'armour' || isPartTab(id)) {
        const faulty = id === 'armour'
          ? sheet.issues.some((issue) => armourZoneOf(issue.part) !== undefined)
          : CONTROLS.some((control) => control.tab === id && issuesFor(control.id).length > 0)
        if (faulty) {
          text = `${name} !`
          label = fill(O.tabHasFaults, { name })
        }
      }
      button.textContent = text
      button.setAttribute('aria-label', label)
      button.setAttribute('aria-selected', id === tab ? 'true' : 'false')
      button.classList.toggle('tab-on', id === tab)
      button.classList.toggle('tab-faulty', id === 'faults' && sheet.issues.some((issue) => issue.severity === 'error'))
    }
  }

  /** Apply a change to the design and redraw everything. */
  function commit(change: (spec: VehicleSpec) => void): void {
    change(spec)
    kept = saveStore(storage, store)
    sheet = buildStatSheet(spec, limits)
    drawTop()
    drawTabs()
    drawPanel()
  }

  function optionButton(key: string, on: boolean, text: { name: string; note: string }, change: Preview | undefined): HTMLButtonElement {
    const button = el('button', on ? 'opt opt-on' : 'opt')
    button.type = 'button'
    button.dataset.key = key
    button.setAttribute('aria-checked', on ? 'true' : 'false')
    const headRow = el('span', 'opt-head')
    headRow.append(el('span', 'opt-name', text.name))
    if (on) headRow.append(el('span', 'opt-tag', O.fitted))
    button.append(headRow)
    if (text.note) button.append(el('span', 'opt-note', text.note))
    if (change) {
      button.append(el('span', 'opt-delta', deltaText(change)))
      const first = change.newErrors[0]
      if (first) button.append(el('span', 'opt-warn', fill(O.wouldCause, { issue: issueText(first) })))
    }
    return button
  }

  function frame(control: Control): HTMLElement {
    const text = STRINGS.controls[control.id]
    const box = el('section', 'ctl')
    box.dataset.control = control.id
    box.append(el('h3', 'ctl-label', text.label))
    if (text.note) box.append(el('p', 'ctl-note', text.note))
    for (const issue of issuesFor(control.id)) {
      box.classList.add('ctl-faulty')
      const line = el('p', 'ctl-issue')
      line.append(el('strong', '', issue.severity === 'error' ? D.error : D.warning), ` ${issueText(issue)}`)
      box.append(line)
    }
    return box
  }

  function drawChoice(control: ChoiceControl): HTMLElement {
    const box = frame(control)
    const group = el('div', 'opts')
    group.setAttribute('role', 'radiogroup')
    group.setAttribute('aria-label', STRINGS.controls[control.id].label)
    const current = control.get(spec)
    for (const option of control.options) {
      const text = control.text[option]
      if (!text) continue
      const on = option === current
      const change = on ? undefined : preview(spec, limits, sheet, (copy) => control.set(copy, option))
      const button = optionButton(`${control.id}:${option}`, on, text, change)
      button.setAttribute('role', 'radio')
      button.addEventListener('click', () => commit((s) => control.set(s, option)))
      group.append(button)
    }
    box.append(group)
    return box
  }

  function drawToggle(control: ToggleControl): HTMLElement {
    const box = frame(control)
    const on = control.get(spec)
    const change = preview(spec, limits, sheet, (copy) => control.set(copy, !on))
    const button = optionButton(control.id, on, control.text, change)
    if (!on) button.querySelector('.opt-head')?.append(el('span', 'opt-tag opt-tag-off', O.notFitted))
    button.setAttribute('role', 'switch')
    button.addEventListener('click', () => commit((s) => control.set(s, !on)))
    box.append(button)
    return box
  }

  function drawNumber(control: NumberControl): HTMLElement {
    const box = frame(control)
    const label = STRINGS.controls[control.id].label
    const show = (value: number): string => fill(O.numberUnits[control.unit], { n: String(value) })
    const value = el('output', 'num-value', show(control.get(spec)))
    box.querySelector('.ctl-label')?.append(value)

    const row = el('div', 'num')
    const step = (direction: number, text: string, aria: string): HTMLButtonElement => {
      const button = el('button', 'num-step', text)
      button.type = 'button'
      button.dataset.key = `${control.id}:${direction}`
      button.setAttribute('aria-label', fill(aria, { name: label }))
      button.addEventListener('click', () => commit((s) => control.set(s, control.get(s) + direction * control.step)))
      return button
    }
    const slider = el('input', 'num-slider')
    slider.type = 'range'
    slider.min = String(control.min)
    slider.max = String(control.max)
    slider.step = String(control.step)
    slider.value = String(control.get(spec))
    slider.dataset.key = control.id
    slider.setAttribute('aria-label', label)
    // While the thumb is being dragged, only the numbers move. The panel is
    // redrawn when the thumb is let go, so the slider is not replaced mid-drag.
    slider.addEventListener('input', () => {
      control.set(spec, Number(slider.value))
      sheet = buildStatSheet(spec, limits)
      value.textContent = show(control.get(spec))
      drawTop()
      drawTabs()
    })
    slider.addEventListener('change', () => commit(() => undefined))
    row.append(step(-1, '−', O.less), slider, step(1, '+', O.more))
    box.append(row)
    return box
  }

  function drawFaults(): HTMLElement {
    const box = el('div', 'faults')
    const startAgain = el('div', 'again')
    startAgain.append(el('p', 'ctl-note', fill(O.basedOn, { name: BASELINE_SPEC.name })), reset)
    if (sheet.issues.length === 0) {
      box.append(el('p', 'ds-clear', D.noFaults), startAgain)
      return box
    }
    const list = el('ul', 'ds-faults')
    for (const issue of sheet.issues) {
      const item = el('li', `ds-fault ds-fault-${issue.severity}`)
      const words = el('div', 'ds-fault-words')
      words.append(
        el('span', 'ds-fault-kind', issue.severity === 'error' ? D.error : D.warning),
        el('span', 'ds-fault-text', issueText(issue)),
      )
      item.append(words)
      if (fixTarget(issue.part) || armourZoneOf(issue.part)) {
        const fix = el('button', 'fix', O.fixIt)
        fix.type = 'button'
        fix.dataset.key = `fix:${issue.code}:${issue.part}`
        fix.addEventListener('click', () => goToPart(issue.part))
        item.append(fix)
      }
      list.append(item)
    }
    box.append(list)
    box.append(startAgain)
    return box
  }

  function closeRange(): void {
    root.classList.remove('office-away')
    range.replaceChildren()
  }

  function openRange(): void {
    // The shop builds a prototype of the design as it stands, and keeps it.
    keepRevision(design)
    kept = saveStore(storage, store)
    drawPanel()
    const screen = renderRangeScreen({
      spec,
      limits,
      sheet,
      projectNo: design.projectNo,
      back: () => {
        closeRange()
        panel.querySelector<HTMLElement>('[data-key="to-range"]')?.focus({ preventScroll: true })
      },
      fix: (part) => {
        closeRange()
        goToPart(part)
      },
      fixZone: (zone) => {
        closeRange()
        goToPart(`armour.${zone}`)
      },
    })
    range.replaceChildren(screen)
    root.classList.add('office-away')
    screen.focus({ preventScroll: true })
  }

  /** One against one, against the rivals and the threat tanks. */
  function openDuels(): void {
    const screen = renderDuelScreen({
      spec,
      limits,
      projectNo: design.projectNo,
      name: spec.name || X.unnamed,
      back: () => {
        closeRange()
        panel.querySelector<HTMLElement>('[data-key="to-duels"]')?.focus({ preventScroll: true })
      },
      fix: (part) => {
        closeRange()
        goToPart(part)
      },
      fixZone: (zone) => {
        closeRange()
        goToPart(`armour.${zone}`)
      },
    })
    range.replaceChildren(screen)
    root.classList.add('office-away')
    screen.focus({ preventScroll: true })
  }

  /** The way to the proving ground. A design the shop cannot build does not go. */
  function drawTrials(): HTMLElement {
    const T = O.trials
    const box = el('div', 'trials')
    box.append(el('h3', 'ds-group-title', T.title), el('p', 'ctl-note', T.about))
    if (sheet.issues.some((issue) => issue.severity === 'error')) {
      const toFaults = actionButton('to-faults', T.toFaults)
      toFaults.addEventListener('click', () => {
        tab = 'faults'
        panel.scrollTop = 0
        drawTabs()
        drawPanel()
        showTab()
      })
      box.append(el('p', 'ctl-issue', T.blocked), toFaults)
    } else {
      const send = actionButton('to-range', T.send)
      send.classList.add('btn-go')
      send.addEventListener('click', openRange)
      box.append(send)
    }
    const E = STRINGS.duel.entry
    const duels = el('section', 'protos')
    duels.append(el('h3', 'ds-group-title', E.title), el('p', 'ctl-note', fill(E.about, { n: String(DUEL.runs) })))
    if (sheet.issues.some((issue) => issue.severity === 'error')) duels.append(el('p', 'ctl-issue', T.blocked))
    else {
      const toDuels = actionButton('to-duels', E.send)
      toDuels.addEventListener('click', openDuels)
      duels.append(toDuels)
    }
    box.append(duels)
    box.append(drawPrototypes())
    return box
  }

  /** Which two builds the comparison is set to, by revision number; nought is the drawing board. */
  let pickEarlier: number | null = null
  let pickLater: number | null = null

  function openCompare(earlier: CompareSide, later: CompareSide): void {
    const screen = renderCompareScreen({
      earlier,
      later,
      limits,
      seed: design.projectNo,
      back: () => {
        closeRange()
        panel.querySelector<HTMLElement>('[data-key="compare-go"]')?.focus({ preventScroll: true })
      },
    })
    range.replaceChildren(screen)
    root.classList.add('office-away')
    screen.focus({ preventScroll: true })
  }

  /** The prototypes built from this design, and the way to set two of them side by side. */
  function drawPrototypes(): HTMLElement {
    const P = O.compare
    const box = el('section', 'protos')
    box.append(el('h3', 'ds-group-title', P.title), el('p', 'ctl-note', P.about))
    const revisions = design.revisions
    const last = lastRevision(design)
    if (!last) {
      box.append(el('p', 'ctl-note', P.none))
      return box
    }
    // The newest revision the board is the same build as, if it is any of them.
    const match = [...revisions].reverse().find((revision) => sameBuild(revision.spec, spec))
    const boardChanged = !match
    const where = match === last ? P.boardSame : match ? P.boardBack : P.boardChanged
    box.append(el('p', 'ctl-note', fill(where, { n: String((match ?? last).no) })))

    const sides = new Map<number, CompareSide>()
    for (const revision of revisions) {
      sides.set(revision.no, {
        label: fill(P.revision, { n: String(revision.no) }),
        build: { spec: revision.spec, sheet: buildStatSheet(revision.spec, limits) },
      })
    }
    if (boardChanged) sides.set(0, { label: P.board, build: { spec, sheet } })

    const list = el('ol', 'proto-list')
    list.setAttribute('aria-label', P.listLabel)
    for (const revision of revisions) {
      const side = sides.get(revision.no)!
      const item = el('li', 'proto')
      const words = el('div', 'proto-words')
      words.append(
        el('span', 'proto-name', revision === last ? `${side.label} · ${P.latest}` : side.label),
        el('span', 'proto-sum', fill(P.summary, { mass: fixed(side.build.sheet.massT, 1), cost: money(side.build.sheet.unitCostKr) })),
      )
      item.append(words)
      if (!sameBuild(revision.spec, spec)) {
        const restore = actionButton(`proto-restore-${revision.no}`, P.restore)
        twoTap(restore, P.restore, P.restoreConfirm, () => {
          restoreRevision(design, revision.no)
          showCurrent()
        })
        item.append(restore)
      }
      list.append(item)
    }
    box.append(list)

    // The order the two are offered in: oldest first, the board last.
    const order = [...sides.keys()].sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b))
    if (order.length < 2) return box
    if (pickEarlier === null || !sides.has(pickEarlier)) pickEarlier = order[order.length - 2]!
    if (pickLater === null || !sides.has(pickLater)) pickLater = order[order.length - 1]!

    const pickers = el('div', 'proto-pick')
    const picker = (key: string, label: string, chosen: number, set: (no: number) => void): HTMLElement => {
      const wrap = el('label', 'proto-picker')
      wrap.append(el('span', 'proto-pick-label', label))
      const select = el('select', 'proto-select')
      select.dataset.key = key
      for (const no of order) {
        const option = el('option', '', sides.get(no)!.label)
        option.value = String(no)
        option.selected = no === chosen
        select.append(option)
      }
      select.addEventListener('change', () => set(Number(select.value)))
      wrap.append(select)
      return wrap
    }
    pickers.append(
      picker('compare-earlier', P.pickEarlier, pickEarlier, (no) => { pickEarlier = no }),
      picker('compare-later', P.pickLater, pickLater, (no) => { pickLater = no }),
    )
    const go = actionButton('compare-go', P.go)
    go.addEventListener('click', () => {
      const earlier = sides.get(pickEarlier ?? -1)
      const later = sides.get(pickLater ?? -1)
      if (earlier && later) openCompare(earlier, later)
    })
    box.append(pickers, go)
    return box
  }

  /** The rounds the fitted gun fires. Read only for now: the load for a trial is chosen later. */
  function drawAmmo(): HTMLElement {
    const R = STRINGS.ammo
    const gun = GUNS[spec.gun]
    const supplied = limits.allowedCalibresMm.includes(gun.calibreMm)
    const box = el('section', 'ctl')
    box.append(el('h3', 'ctl-label', supplied ? R.title : R.ownTitle))
    if (!supplied) box.append(el('p', 'ctl-note', R.notSupplied))
    const list = el('dl', 'ds-rows')
    for (const { id, round } of gunRounds(spec)) {
      const row = el('div', 'ammo')
      const line = round.kind === 'kinetic'
        ? fill(R.kinetic, {
            kind: R.kinds.kinetic, speed: String(round.speedMs), pen: fixed(round.penMm, 0),
            far: fixed(penetrationAt(round, 2000), 0),
          })
        : fill(R.shaped, { kind: R.kinds.shaped, speed: String(round.speedMs), pen: fixed(round.penMm, 0) })
      row.append(el('dt', 'opt-name', STRINGS.rounds[id]), el('dd', 'ammo-line', line))
      list.append(row)
    }
    box.append(list, el('p', 'ctl-note', R.note))
    return box
  }

  /** A button that acts on the second tap, so a slip of the thumb does not lose a design. */
  function twoTap(button: HTMLButtonElement, label: string, confirm: string, action: () => void): void {
    let armed = false
    let disarm: number | undefined
    const rest = (): void => {
      armed = false
      button.textContent = label
      button.classList.remove('btn-armed')
    }
    button.addEventListener('click', () => {
      window.clearTimeout(disarm)
      if (!armed) {
        armed = true
        button.textContent = confirm
        button.classList.add('btn-armed')
        disarm = window.setTimeout(rest, 4000)
        return
      }
      rest()
      action()
    })
  }

  /** Put whichever design the store says is current on the board. */
  function showCurrent(): void {
    design = currentDesign(store)
    pickEarlier = null
    pickLater = null
    spec = design.spec
    panel.scrollTop = 0
    commit(() => undefined)
  }

  function actionButton(key: string, label: string): HTMLButtonElement {
    const button = el('button', 'btn', label)
    button.type = 'button'
    button.dataset.key = key
    return button
  }

  function faultCount(count: number): string {
    if (count === 0) return X.noFaults
    return count === 1 ? X.oneFault : fill(X.manyFaults, { n: String(count) })
  }

  function drawDesigns(): HTMLElement {
    const box = el('div', 'designs')

    const naming = el('section', 'ctl')
    const label = el('label', 'ctl-label', X.nameLabel)
    label.htmlFor = 'design-name'
    const input = el('input', 'name-input')
    input.id = 'design-name'
    input.type = 'text'
    input.maxLength = NAME_MAX
    input.placeholder = X.namePlaceholder
    input.autocomplete = 'off'
    input.enterKeyHint = 'done'
    input.value = spec.name
    input.dataset.key = 'design-name'
    // Typing changes the name at once, but the box is only tidied when the
    // player leaves it, so a space can be typed without being trimmed away.
    input.addEventListener('input', () => {
      spec.name = cleanName(input.value)
      kept = saveStore(storage, store)
      drawTitle()
    })
    input.addEventListener('change', () => commit(() => undefined))
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') input.blur()
    })
    naming.append(label, input)
    const note = el('p', kept ? 'ctl-note' : 'ctl-issue', `${fill(O.project, { n: String(design.projectNo) })}. ${kept ? X.kept : X.notKept}`)
    naming.append(note)

    const actions = el('div', 'actions')
    const full = store.designs.length >= MAX_DESIGNS
    const fresh = actionButton('design-new', X.newDesign)
    const copy = actionButton('design-copy', X.copy)
    fresh.disabled = copy.disabled = full
    fresh.addEventListener('click', () => {
      if (addDesign(store)) showCurrent()
    })
    copy.addEventListener('click', () => {
      const from = structuredClone(spec)
      if (from.name) from.name = fill(X.copyName, { name: from.name })
      if (addDesign(store, from)) showCurrent()
    })
    const scrap = actionButton('design-scrap', X.scrap)
    const scrapNo = design.projectNo
    twoTap(scrap, X.scrap, X.scrapConfirm, () => {
      scrapDesign(store, scrapNo)
      showCurrent()
    })
    actions.append(fresh, copy, scrap)
    if (full) actions.append(el('p', 'ctl-issue', X.full))

    const list = el('section', 'ctl')
    const title = el('h3', 'ctl-label', X.listTitle)
    title.append(el('span', 'num-value', fill(X.listCount, { n: String(store.designs.length), max: String(MAX_DESIGNS) })))
    const rows = el('div', 'opts')
    for (const item of store.designs) {
      const on = item.projectNo === design.projectNo
      const stats = on ? sheet : buildStatSheet(item.spec, limits)
      const row = el('button', on ? 'opt opt-on' : 'opt')
      row.type = 'button'
      row.dataset.key = `design:${item.projectNo}`
      if (on) row.setAttribute('aria-current', 'true')
      const headRow = el('span', 'opt-head')
      headRow.append(el('span', 'opt-name', item.spec.name || X.unnamed))
      if (on) headRow.append(el('span', 'opt-tag', X.onTheBoard))
      row.append(
        headRow,
        el('span', 'opt-note', fill(O.project, { n: String(item.projectNo) })),
        el('span', 'opt-delta', fill(X.summary, {
          mass: fixed(stats.massT, 1), cost: money(stats.unitCostKr), faults: faultCount(stats.issues.length),
        })),
      )
      row.addEventListener('click', () => {
        openDesign(store, item.projectNo)
        showCurrent()
      })
      rows.append(row)
    }
    list.append(title, rows)

    box.append(naming, actions, list)
    return box
  }

  function drawPanel(): void {
    const scroll = panel.scrollTop
    const active = document.activeElement
    const focusKey = active instanceof HTMLElement && panel.contains(active) ? active.dataset.key : undefined

    const parts: HTMLElement[] = []
    if (tab === 'readouts') parts.push(renderReadouts(sheet, limits))
    else if (tab === 'faults') parts.push(drawFaults())
    else if (tab === 'designs') parts.push(drawDesigns())
    else if (tab === 'trials') parts.push(drawTrials())
    else if (tab === 'armour') {
      parts.push(renderArmourTab({
        spec, sheet, state: armourState, commit, goTo, pickZone,
        refresh: () => {
          drawBlueprint()
          drawPanel()
        },
        nudge: (change) => {
          change(spec)
          sheet = buildStatSheet(spec, limits)
          drawTop()
          drawTabs()
          return sheet
        },
      }))
    }
    else {
      for (const control of CONTROLS) {
        if (control.tab !== tab) continue
        if (control.kind === 'choice') parts.push(drawChoice(control))
        else if (control.kind === 'number') parts.push(drawNumber(control))
        else parts.push(drawToggle(control))
      }
      if (tab === 'gun') parts.push(drawAmmo())
      if (tab === 'gun' || tab === 'fireControl') parts.push(renderGunnery(sheet))
      if (tab === 'crew' || tab === 'fireControl') parts.push(renderStations(sheet))
    }
    panel.replaceChildren(...parts)
    panel.setAttribute('aria-label', O.tabs[tab])
    panel.scrollTop = scroll

    if (flagged) {
      const box = panel.querySelector<HTMLElement>(`[data-control="${flagged}"]`)
      flagged = undefined
      if (box) {
        box.classList.add('ctl-flag')
        box.scrollIntoView({ block: 'start' })
        box.querySelector<HTMLElement>('button, input')?.focus({ preventScroll: true })
      }
    } else if (focusKey) {
      panel.querySelector<HTMLElement>(`[data-key="${focusKey}"]`)?.focus({ preventScroll: true })
    }
  }

  // --- Start again: back to the baseline's parts, keeping the name and number.
  twoTap(reset, O.reset, O.resetConfirm, () => {
    const name = spec.name
    design.spec = cleanSpec(BASELINE_SPEC)
    design.spec.name = name
    spec = design.spec
    commit(() => undefined)
  })

  drawTop()
  drawTabs()
  drawPanel()
  return root
}
