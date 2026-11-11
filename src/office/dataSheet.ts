// A read-only data sheet: the stat sheet for one design, laid out for a phone.
import { STRINGS, fill } from '../data/strings'
import { AREAS, type Issue, type IssueCode, type Limits, type StatSheet } from '../sim/vehicle'
import { el } from '../ui/dom'
import { fixed, money, plain } from '../ui/format'

const D = STRINGS.dataSheet
const ISSUE_TEXT: Record<IssueCode, string> = STRINGS.issues

function unit(template: string, value: number, places: number): string {
  return fill(template, { n: fixed(value, places) })
}

function group(title: string, rows: [string, string][]): HTMLElement {
  const box = el('section', 'ds-group')
  box.append(el('h3', 'ds-group-title', title))
  const list = el('dl', 'ds-rows')
  for (const [label, value] of rows) {
    const row = el('div', 'ds-row')
    row.append(el('dt', 'ds-label', label), el('dd', 'ds-value', value))
    list.append(row)
  }
  box.append(list)
  return box
}

/** The sentence for one issue, with its numbers filled in. */
export function issueText(issue: Issue): string {
  const show = issue.code === 'overCostLimit' ? money : plain
  return fill(ISSUE_TEXT[issue.code], {
    value: issue.value === undefined ? '' : show(issue.value),
    limit: issue.limit === undefined ? '' : show(issue.limit),
  })
}

function weightGroup(sheet: StatSheet): HTMLElement {
  const box = el('section', 'ds-group')
  box.append(el('h3', 'ds-group-title', D.groups.weight))
  const list = el('ul', 'ds-bars')
  let heaviest = 0
  for (const area of AREAS) heaviest = Math.max(heaviest, sheet.rollup.massT[area])
  for (const area of AREAS) {
    const tonnes = sheet.rollup.massT[area]
    const item = el('li', 'ds-bar')
    const head = el('div', 'ds-bar-head')
    head.append(
      el('span', 'ds-label', D.areas[area]),
      el('span', 'ds-value', fill(D.units.share, { t: fixed(tonnes, 1), pct: fixed((tonnes / sheet.massT) * 100, 0) })),
    )
    const track = el('div', 'ds-bar-track')
    const bar = el('div', 'ds-bar-fill')
    bar.style.width = `${fixed((tonnes / heaviest) * 100, 1)}%`
    track.append(bar)
    item.append(head, track)
    list.append(item)
  }
  box.append(list)
  return box
}

function faultsGroup(issues: Issue[]): HTMLElement {
  const box = el('section', 'ds-group')
  box.append(el('h3', 'ds-group-title', D.groups.faults))
  if (issues.length === 0) {
    box.append(el('p', 'ds-clear', D.noFaults))
    return box
  }
  const list = el('ul', 'ds-faults')
  for (const issue of issues) {
    const item = el('li', `ds-fault ds-fault-${issue.severity}`)
    item.append(
      el('span', 'ds-fault-kind', issue.severity === 'error' ? D.error : D.warning),
      el('span', 'ds-fault-text', issueText(issue)),
    )
    list.append(item)
  }
  box.append(list)
  return box
}

export function renderDataSheet(sheet: StatSheet, limits: Limits): HTMLElement {
  const r = D.rows
  const u = D.units
  const root = el('article', 'ds')

  const head = el('header', 'ds-head')
  const titles = el('div', 'ds-titles')
  titles.append(el('h2', 'ds-name', sheet.name), el('p', 'ds-intro', D.intro))
  head.append(titles, el('p', 'sheet-stamp', D.stamp))

  const weight = el('p', 'ds-weight', fill(D.weightLine, { mass: fixed(sheet.massT, 1), limit: fixed(limits.maxMassT, 1) }))

  const m = sheet.mobility
  const f = sheet.firepower
  root.append(
    head,
    weight,
    group(D.groups.general, [
      [r.mass, unit(u.tonnes, sheet.massT, 1)],
      [r.cost, money(sheet.unitCostKr)],
      [r.crew, String(sheet.crewCount)],
      [r.width, fill(u.widthOfLimit, { n: fixed(sheet.geometry.widthM, 2), limit: fixed(limits.maxWidthM, 2) })],
      [r.height, unit(u.metres, sheet.geometry.heightM, 2)],
    ]),
    group(D.groups.mobility, [
      [r.powerToWeight, unit(u.hpPerTonne, m.powerToWeightHpT, 1)],
      [r.topSpeed, unit(m.gearLimited ? u.kmhGearLimited : u.kmh, m.topSpeedKmh, 0)],
      [r.range, unit(u.km, m.rangeKm, 0)],
      [r.groundPressure, unit(u.kgCm2, m.groundPressureKgCm2, 2)],
    ]),
    group(D.groups.firepower, [
      [r.gun, unit(u.mm, f.calibreMm, 0)],
      [r.rounds, String(f.rounds)],
      [r.rateOfFire, unit(u.perMinute, f.rateOfFireRpm, 0)],
      [r.depression, unit(u.degrees, f.gunDepressionDeg, 1)],
    ]),
    group(D.groups.condition, [
      [r.reliability, unit(u.outOf100, sheet.reliabilityIndex, 0)],
      [r.workload, unit(u.outOf100, sheet.crewWorkload, 0)],
    ]),
    group(D.groups.growth, [
      [r.spareMass, unit(u.tonnes, sheet.growth.massT, 1)],
      [r.spareVolume, unit(u.cubicMetres, sheet.growth.volumeM3, 1)],
      [r.spareCooling, unit(u.hp, sheet.growth.coolingHp, 0)],
    ]),
    weightGroup(sheet),
    faultsGroup(sheet.issues),
    el('p', 'ds-note', D.note),
  )
  return root
}
