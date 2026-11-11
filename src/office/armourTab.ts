// The Armour tab: pick a zone, see what it stops, and build its stack of
// layers. A section view shows the layers to scale with a level shot.
import { SECTION } from '../data/drawing'
import { MATERIALS, MATERIAL_IDS, ZONES, ZONE_FACING, type MaterialId, type ZoneId } from '../data/materials'
import { STRINGS, fill } from '../data/strings'
import { TUNING } from '../data/tuning'
import { layerWorth, type StatSheet, type VehicleSpec } from '../sim/vehicle'
import { el } from '../ui/dom'
import { fixed, money } from '../ui/format'
import {
  addLayer, canAddLayer, layerCost, layerRange, removeLayer, sectionOf, setLayerMaterial, setLayerMm,
} from './armour'
import type { ControlId } from './controls'
import { issueText } from './readouts'

const SVG = 'http://www.w3.org/2000/svg'
const A = STRINGS.office.armour
const D = STRINGS.dataSheet

/** What the tab remembers between redraws. */
export interface ArmourTabState {
  zone: ZoneId
  /** How far the row of zones has been scrolled sideways. */
  zonesScroll: number
}

export interface ArmourTabHost {
  spec: VehicleSpec
  sheet: StatSheet
  state: ArmourTabState
  /** Apply a change to the design and redraw everything. */
  commit(change: (spec: VehicleSpec) => void): void
  /** Apply a change and redraw everything but this panel. Gives back the new stat sheet. */
  nudge(change: (spec: VehicleSpec) => void): StatSheet
  /** Redraw this panel without changing the design. */
  redraw(): void
  goTo(id: ControlId): void
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag)
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value)
  return node
}

/**
 * Hatching for each material, in the manner of a technical drawing, so the
 * layers can be told apart without colour. `unit` is the size of one screen
 * pixel in the drawing's own units.
 */
function hatchDefs(prefix: string, unit: number): SVGDefsElement {
  const defs = svg('defs', {})
  const n = (value: number): string => String(Math.round(value * unit * 100) / 100)
  const tile = (material: MaterialId, size: number, marks: SVGElement[]): void => {
    const pattern = svg('pattern', {
      id: `${prefix}-${material}`, width: n(size), height: n(size), patternUnits: 'userSpaceOnUse', class: 'hatch',
    })
    pattern.append(...marks)
    defs.append(pattern)
  }
  const stroke = (x0: number, y0: number, x1: number, y1: number): SVGElement =>
    svg('line', { x1: n(x0), y1: n(y0), x2: n(x1), y2: n(y1), 'stroke-width': n(1) })
  /** A diagonal that joins up from one tile to the next. */
  const rising = (size: number): SVGElement[] => [
    stroke(0, size, size, 0), stroke(-1, 1, 1, -1), stroke(size - 1, size + 1, size + 1, size - 1),
  ]
  const falling = (size: number): SVGElement[] => [
    stroke(0, 0, size, size), stroke(-1, size - 1, 1, size + 1), stroke(size - 1, -1, size + 1, 1),
  ]
  const dot = (x: number, y: number): SVGElement => svg('circle', { cx: n(x), cy: n(y), r: n(0.9) })

  tile('rolledSteel', 8, rising(8))
  tile('highHardSteel', 4, rising(4))
  tile('castSteel', 7, [dot(1.75, 1.75), dot(5.25, 5.25)])
  tile('compositeInsert', 8, [...rising(8), ...falling(8)])
  tile('airGap', 8, [])
  return defs
}

function swatch(material: MaterialId): SVGSVGElement {
  const box = svg('svg', { class: 'swatch', viewBox: '0 0 28 28', 'aria-hidden': 'true' })
  box.append(svg('rect', { x: '1', y: '1', width: '26', height: '26', fill: `url(#sw-${material})`, class: `slab slab-${material}` }))
  return box
}

function mm(value: number): string {
  return fixed(value, 0)
}

export function renderArmourTab(host: ArmourTabHost): HTMLElement {
  const { spec, state } = host
  const zone = state.zone
  let sheet = host.sheet
  const text = STRINGS.zones[zone]
  const layers = spec.armour[zone]
  const root = el('div', 'armour')

  // Hatch tiles for the little squares beside each layer.
  const tiles = svg('svg', { class: 'swatch-defs', width: '0', height: '0', 'aria-hidden': 'true' })
  tiles.append(hatchDefs('sw', 1))
  root.append(tiles)

  // --- The row of zones ---------------------------------------------------
  const zones = el('div', 'zones')
  zones.setAttribute('role', 'group')
  zones.setAttribute('aria-label', A.zonesLabel)
  for (const id of ZONES) {
    const name = STRINGS.zones[id].name
    const faulty = sheet.issues.some((issue) => issue.part === `armour.${id}`)
    const button = el('button', id === zone ? 'zone zone-on' : 'zone', faulty ? `${name} !` : name)
    button.type = 'button'
    button.dataset.key = `zone:${id}`
    button.setAttribute('aria-pressed', id === zone ? 'true' : 'false')
    if (faulty) button.setAttribute('aria-label', fill(A.zoneHasFaults, { name }))
    button.addEventListener('click', () => {
      state.zone = id
      host.redraw()
    })
    zones.append(button)
  }
  zones.addEventListener('scroll', () => {
    state.zonesScroll = zones.scrollLeft
  }, { passive: true })
  root.append(zones)

  // --- What the zone stops ------------------------------------------------
  const summary = el('section', 'ctl')
  summary.dataset.control = 'armour'
  const title = el('h3', 'ctl-label', text.name)
  const weight = el('output', 'num-value')
  title.append(weight)
  summary.append(title, el('p', 'ctl-note', text.note))
  for (const issue of sheet.issues) {
    if (issue.part !== `armour.${zone}` && issue.part !== 'armour') continue
    summary.classList.add('ctl-faulty')
    const line = el('p', 'ctl-issue')
    line.append(el('strong', '', issue.severity === 'error' ? D.error : D.warning), ` ${issueText(issue)}`)
    summary.append(line)
  }

  const values = el('dl', 'prot')
  const value = (label: string): HTMLElement => {
    const box = el('div', 'prot-box')
    const number = el('dd', 'prot-value')
    box.append(el('dt', 'chip-label', label), number)
    values.append(box)
    return number
  }
  const kinetic = value(A.kinetic)
  const shaped = value(A.shaped)
  // The two numbers sit between the sections so they can stay in view while the layers scroll.
  const detail = el('section', 'ctl')
  detail.append(el('p', 'ctl-note', fill(A.worth, { from: A.from[ZONE_FACING[zone]] })))

  const slopeDeg = sheet.protection[zone].slopeDeg
  detail.append(el('p', 'ctl-note', slopeDeg > 0
    ? fill(A.sloped, { deg: fixed(slopeDeg, 0), x: fixed(sheet.protection[zone].pathFactor, 1) })
    : A.square))
  const link = (label: string, id: ControlId): void => {
    const button = el('button', 'btn', label)
    button.type = 'button'
    button.dataset.key = `armour-go:${id}`
    button.addEventListener('click', () => host.goTo(id))
    detail.append(button)
  }
  if (zone === 'upperGlacis') link(A.changeGlacis, 'hull.glacisAngleDeg')
  if (zone === 'turretFrontLeft' || zone === 'turretFrontRight' || zone === 'turretSides') link(A.changeTurret, 'turret.shape')

  const figure = el('figure', 'sec')
  const drawing = el('div', 'sec-drawing')
  const ends = el('div', 'sec-ends')
  ends.append(el('span', '', A.outside), el('span', '', A.inside))
  const caption = el('figcaption', 'bp-caption')
  figure.append(drawing, ends, caption)
  detail.append(figure)
  root.append(summary, values, detail)

  function drawSummary(): void {
    const protection = sheet.protection[zone]
    weight.textContent = fill(A.zoneWeight, { n: fixed(sheet.rollup.zoneMassT[zone], 2) })
    kinetic.textContent = fill(D.units.mm, { n: mm(protection.keMm) })
    shaped.textContent = fill(D.units.mm, { n: mm(protection.ceMm) })

    const section = sectionOf(layers, protection.slopeDeg)
    const { box, shot } = section
    const described = layers.length === 0
      ? A.sectionEmpty
      : layers.map((layer) => fill(A.sectionLayer, { mm: mm(layer.mm), material: STRINGS.materials[layer.material].name })).join(', ')
    const picture = svg('svg', {
      class: 'sec-svg', viewBox: `${box.x} ${box.y} ${box.w} ${box.h}`, role: 'img',
      'aria-label': fill(A.sectionLabel, { zone: text.name, layers: described }),
    })
    picture.style.aspectRatio = `${box.w} / ${box.h}`
    // Hatching is sized for a drawing about as wide as a phone.
    picture.append(hatchDefs('sec', box.w / 330))
    for (const slab of section.slabs) {
      picture.append(svg('polygon', {
        points: slab.points.map(([x, y]) => `${x},${y}`).join(' '),
        fill: `url(#sec-${slab.material})`, class: `slab slab-${slab.material}`,
      }))
    }
    const arrow = SECTION.arrowMm
    picture.append(
      svg('line', { x1: String(shot.startX), y1: String(shot.y), x2: String(shot.endX), y2: String(shot.y), class: 'sec-shot' }),
      svg('polygon', {
        points: `${shot.enterX},${shot.y} ${shot.enterX - arrow},${shot.y - arrow / 2.5} ${shot.enterX - arrow},${shot.y + arrow / 2.5}`,
        class: 'sec-arrow',
      }),
    )
    drawing.replaceChildren(picture)
    caption.textContent = layers.length === 0 ? A.none : fill(A.sectionCaption, { mm: mm(section.pathMm) })
  }

  // --- The layers ---------------------------------------------------------
  const stack = el('section', 'ctl')
  const stackTitle = el('h3', 'ctl-label', A.layersTitle)
  stackTitle.append(el('span', 'num-value', fill(A.layerCount, { n: String(layers.length), max: String(TUNING.limits.maxLayersPerZone) })))
  stack.append(stackTitle)

  layers.forEach((layer, index) => {
    const n = String(index + 1)
    const range = layerRange(layer.material)
    const material = STRINGS.materials[layer.material]
    const box = el('div', 'layer')

    const head = el('div', 'layer-head')
    const thickness = el('output', 'num-value')
    head.append(el('span', 'layer-name', fill(A.layer, { n })), thickness)

    const pick = el('div', 'layer-pick')
    const select = el('select', 'layer-material')
    select.dataset.key = `layer-material:${index}`
    select.setAttribute('aria-label', fill(A.materialOf, { n }))
    for (const id of MATERIAL_IDS) {
      const option = el('option', '', STRINGS.materials[id].name)
      option.value = id
      option.selected = id === layer.material
      select.append(option)
    }
    select.addEventListener('change', () => host.commit((s) => setLayerMaterial(s, zone, index, select.value)))
    const remove = el('button', 'num-step', '×')
    remove.type = 'button'
    remove.dataset.key = `layer-remove:${index}`
    remove.setAttribute('aria-label', fill(A.remove, { n }))
    remove.addEventListener('click', () => host.commit((s) => removeLayer(s, zone, index)))
    pick.append(swatch(layer.material), select, remove)

    const row = el('div', 'num')
    const step = (direction: number, sign: string, aria: string): HTMLButtonElement => {
      const button = el('button', 'num-step', sign)
      button.type = 'button'
      button.dataset.key = `layer-mm:${index}:${direction}`
      button.setAttribute('aria-label', fill(aria, { n }))
      button.addEventListener('click', () => host.commit((s) => setLayerMm(s, zone, index, layer.mm + direction * range.step)))
      return button
    }
    const slider = el('input', 'num-slider')
    slider.type = 'range'
    slider.min = String(range.min)
    slider.max = String(range.max)
    slider.step = String(range.step)
    slider.value = String(layer.mm)
    slider.dataset.key = `layer-mm:${index}`
    slider.setAttribute('aria-label', fill(A.thicknessOf, { n }))
    const note = el('p', 'layer-note')
    const drawLayer = (): void => {
      const worth = layerWorth(layer, sheet.protection[zone].pathFactor)
      const cost = layerCost(sheet.geometry, zone, layer)
      thickness.textContent = fill(D.units.mm, { n: mm(layer.mm) })
      note.textContent = fill(A.layerNote, {
        ke: mm(worth.keMm), ce: mm(worth.ceMm), mass: fixed(cost.massT, 2), cost: money(cost.costKr),
      })
    }
    // While the thumb is being dragged only the numbers and the section move.
    // The panel is redrawn when the thumb is let go.
    slider.addEventListener('input', () => {
      sheet = host.nudge((s) => setLayerMm(s, zone, index, Number(slider.value)))
      drawLayer()
      drawSummary()
    })
    slider.addEventListener('change', () => host.commit(() => undefined))
    row.append(step(-1, '−', A.thinner), slider, step(1, '+', A.thicker))
    drawLayer()

    box.append(
      head, pick, row, note,
      el('p', 'layer-note layer-about', fill(A.materialNote, { note: material.note, max: String(MATERIALS[layer.material].maxMm) })),
    )
    stack.append(box)
  })

  if (layers.length === 0) stack.append(el('p', 'ctl-note', A.none))
  const add = el('button', 'btn', A.add)
  add.type = 'button'
  add.dataset.key = 'layer-add'
  add.disabled = !canAddLayer(spec, zone)
  add.addEventListener('click', () => host.commit((s) => addLayer(s, zone)))
  stack.append(add)
  if (add.disabled) stack.append(el('p', 'ctl-note', A.full))
  root.append(stack)

  drawSummary()
  // The row of zones is rebuilt on every draw; put it back where it was.
  queueMicrotask(() => {
    zones.scrollLeft = state.zonesScroll
  })
  return root
}
