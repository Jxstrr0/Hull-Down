// The design office, first version: pick parts, watch the weight bar move,
// read the faults and jump to the part that fixes them.
// The blueprint drawing joins the top panel in the next PR.
import { BASELINE_SPEC } from '../data/baseline'
import { STRINGS, fill } from '../data/strings'
import { AREAS, buildStatSheet, type Issue, type Limits, type StatSheet, type VehicleSpec } from '../sim/vehicle'
import { el } from '../ui/dom'
import { fixed, money, signed, signedMoney } from '../ui/format'
import {
  CONTROLS, PART_TABS, fixTarget, preview, type ChoiceControl, type Control, type ControlId, type NumberControl,
  type PartTab, type Preview, type ToggleControl,
} from './controls'
import { issueText, renderReadouts } from './readouts'

const O = STRINGS.office
const D = STRINGS.dataSheet

const TABS = [...PART_TABS, 'readouts', 'faults'] as const
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
  let spec: VehicleSpec = structuredClone(BASELINE_SPEC)
  let sheet: StatSheet = buildStatSheet(spec, limits)
  let tab: Tab = 'hull'
  /** A control to scroll to and mark after the next panel draw. */
  let flagged: ControlId | undefined

  const root = el('section', 'office')
  root.setAttribute('aria-label', O.label)

  // --- Top panel: name, weight bar, headline numbers ---------------------
  const top = el('div', 'office-top')
  const head = el('div', 'office-head')
  const titles = el('div', 'office-titles')
  titles.append(el('h2', 'office-name', O.designName), el('p', 'office-based', fill(O.basedOn, { name: BASELINE_SPEC.name })))
  const reset = el('button', 'office-reset', O.reset)
  reset.type = 'button'
  head.append(titles, reset)

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
  top.append(head, bar, chips)

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
      panel.scrollTop = 0
      drawTabs()
      drawPanel()
    })
    tabButtons.set(id, button)
    tabList.append(button)
  }

  root.append(top, tabList, panel)

  // --- Drawing ------------------------------------------------------------
  function issuesFor(id: string): Issue[] {
    return sheet.issues.filter((issue) => issue.part === id)
  }

  function drawTop(): void {
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
      } else if (isPartTab(id)) {
        const faulty = CONTROLS.some((control) => control.tab === id && issuesFor(control.id).length > 0)
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
    if (sheet.issues.length === 0) {
      box.append(el('p', 'ds-clear', D.noFaults))
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
      const target = fixTarget(issue.part)
      if (target) {
        const fix = el('button', 'fix', O.fixIt)
        fix.type = 'button'
        fix.dataset.key = `fix:${issue.code}`
        fix.addEventListener('click', () => {
          tab = target.tab
          flagged = target.id
          drawTabs()
          drawPanel()
        })
        item.append(fix)
      }
      list.append(item)
    }
    box.append(list)
    if (sheet.issues.some((issue) => issue.part.startsWith('armour'))) box.append(el('p', 'ctl-note', O.armourLater))
    return box
  }

  function drawPanel(): void {
    const scroll = panel.scrollTop
    const active = document.activeElement
    const focusKey = active instanceof HTMLElement && panel.contains(active) ? active.dataset.key : undefined

    const parts: HTMLElement[] = []
    if (tab === 'readouts') parts.push(renderReadouts(sheet, limits))
    else if (tab === 'faults') parts.push(drawFaults())
    else {
      for (const control of CONTROLS) {
        if (control.tab !== tab) continue
        if (control.kind === 'choice') parts.push(drawChoice(control))
        else if (control.kind === 'number') parts.push(drawNumber(control))
        else parts.push(drawToggle(control))
      }
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

  // --- Start again: two taps, so a slip of the thumb does not lose a design.
  let armed = false
  let disarm: number | undefined
  reset.addEventListener('click', () => {
    if (!armed) {
      armed = true
      reset.textContent = O.resetConfirm
      reset.classList.add('office-reset-armed')
      disarm = window.setTimeout(() => {
        armed = false
        reset.textContent = O.reset
        reset.classList.remove('office-reset-armed')
      }, 4000)
      return
    }
    window.clearTimeout(disarm)
    armed = false
    reset.textContent = O.reset
    reset.classList.remove('office-reset-armed')
    spec = structuredClone(BASELINE_SPEC)
    commit(() => undefined)
  })

  drawTop()
  drawTabs()
  drawPanel()
  return root
}
