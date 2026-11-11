// The Armour tab: pick a zone, see what it stops, build its stack of layers
// and bolt reactive tiles over it. A section view shows the layers to scale
// with a level shot.
import { THREATS, THREAT_IDS, type RoundKind, type ThreatId } from '../data/ammo'
import { SECTION } from '../data/drawing'
import { ERA_GRID_VIEW, ERA_TILE } from '../data/era'
import { MATERIALS, MATERIAL_IDS, ZONES, ZONE_FACING, type MaterialId, type ZoneId } from '../data/materials'
import { STRINGS, fill } from '../data/strings'
import type { Generation } from '../data/tech'
import { TUNING } from '../data/tuning'
import { generationOf } from '../sim/vehicle/tech'
import {
  allTiles, hasTile, layerWorth, paperShot, penetrationAt, setTile, shotCosine, targetOf, testShot, tiledWorth, tileGrid,
  verdictOf,
  worthAgainst, type ShotResult, type StatSheet, type VehicleSpec, type Verdict,
} from '../sim/vehicle'
import { el } from '../ui/dom'
import { fixed, money } from '../ui/format'
import {
  addLayer, canAddLayer, layerCost, layerRange, removeLayer, sectionOf, setLayerMaterial, setLayerMm,
} from './armour'
import { behindOf } from './behind'
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
  /** The round the protection map is drawn against. */
  threat: ThreatId | 'none'
  rangeM: number
  /** Whether the protection map's settings are unfolded. */
  mapOpen: boolean
  /** How far off square the test shot comes in, degrees. */
  angleDeg: number
  /** Whether the test shot is aimed at a reactive tile, when the zone has any. */
  atTile: boolean
}

export interface ArmourTabHost {
  spec: VehicleSpec
  sheet: StatSheet
  /** The newest technology the tender allows. */
  generation: Generation
  state: ArmourTabState
  /** Apply a change to the design and redraw everything. */
  commit(change: (spec: VehicleSpec) => void): void
  /** Apply a change and redraw everything but this panel. Gives back the new stat sheet. */
  nudge(change: (spec: VehicleSpec) => void): StatSheet
  /** Redraw this panel and the blueprint without changing the design. */
  refresh(): void
  /** Work on another zone, and turn the blueprint to the view that shows it. */
  pickZone(zone: ZoneId): void
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
  tile('layeredComposite', 5, [...rising(5), ...falling(5), dot(2.5, 2.5)])
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

  // --- The round the map is drawn against ----------------------------------
  const threat = state.threat === 'none' ? undefined : THREATS[state.threat]
  const pen = threat ? penetrationAt(threat, state.rangeM) : 0
  /** How a zone stands against the chosen round, on the numbers in `sheet`. */
  const verdictFor = (id: ZoneId): Verdict | undefined =>
    threat ? verdictOf(worthAgainst(sheet.protection[id], threat.kind), pen) : undefined
  /** The same where the shot meets a reactive tile. Nothing when the zone has no tiles. */
  const tiledVerdictFor = (id: ZoneId): Verdict | undefined =>
    threat && sheet.rollup.era[id].tiles > 0 ? verdictOf(tiledWorth(sheet.protection[id], threat), pen) : undefined

  const mapBox = el('details', 'mapbox')
  mapBox.open = state.mapOpen
  mapBox.addEventListener('toggle', () => {
    state.mapOpen = mapBox.open
  })
  const mapHead = el('summary', 'mapbox-head')
  mapHead.dataset.key = 'map-head'
  const threatName = state.threat === 'none' ? A.mapOff : STRINGS.threats[state.threat].name
  mapHead.append(
    el('span', 'layer-name', A.mapTitle),
    el('span', 'mapbox-now', threat?.kind === 'kinetic'
      ? fill(A.mapKinetic, { round: threatName, range: String(state.rangeM) })
      : fill(A.mapShaped, { round: threatName })),
  )
  mapBox.append(mapHead)

  const pickLabel = el('label', 'layer-name', A.threatLabel)
  pickLabel.htmlFor = 'map-threat'
  const pickThreat = el('select', 'layer-material')
  pickThreat.id = 'map-threat'
  pickThreat.dataset.key = 'map-threat'
  const none = el('option', '', A.mapOff)
  none.value = 'none'
  none.selected = state.threat === 'none'
  pickThreat.append(none)
  for (const [kind, title] of [['kinetic', A.kineticGroup], ['shaped', A.shapedGroup]] as [RoundKind, string][]) {
    const group = el('optgroup', '')
    group.label = title
    for (const id of THREAT_IDS) {
      if (THREATS[id].kind !== kind) continue
      const option = el('option', '', STRINGS.threats[id].name)
      option.value = id
      option.selected = id === state.threat
      group.append(option)
    }
    pickThreat.append(group)
  }
  pickThreat.addEventListener('change', () => {
    state.threat = THREAT_IDS.find((id) => id === pickThreat.value) ?? 'none'
    host.refresh()
  })
  mapBox.append(pickLabel, pickThreat)

  if (threat && state.threat !== 'none') {
    mapBox.append(el('p', 'ctl-note', STRINGS.threats[state.threat].note))
    if (threat.kind === 'kinetic') {
      const ranges: readonly number[] = TUNING.protection.mapRangesM
      const at = ranges.indexOf(state.rangeM)
      const row = el('div', 'num maprange')
      const step = (direction: number, sign: string, label: string): HTMLButtonElement => {
        const button = el('button', 'num-step', sign)
        button.type = 'button'
        button.dataset.key = `map-range:${direction}`
        button.setAttribute('aria-label', label)
        const next = ranges[at + direction]
        button.disabled = next === undefined
        button.addEventListener('click', () => {
          if (next === undefined) return
          state.rangeM = next
          host.refresh()
        })
        return button
      }
      const shown = el('output', 'maprange-value')
      shown.append(el('span', 'layer-name', A.rangeLabel), el('span', 'num-value', fill(A.rangeValue, { n: String(state.rangeM) })))
      row.append(step(-1, '−', A.nearer), shown, step(1, '+', A.further))
      mapBox.append(row)
    }
    mapBox.append(
      el('p', 'layer-note', fill(threat.kind === 'kinetic' ? A.goesThrough : A.goesThroughShaped, { mm: mm(pen) })),
      el('p', 'ctl-note', fill(A.mapNote, { pct: fixed(TUNING.protection.marginShare * 100, 0) })),
    )
    const list = el('div', 'zrows')
    list.setAttribute('role', 'group')
    list.setAttribute('aria-label', A.mapZones)
    for (const id of ZONES) {
      const verdict = verdictFor(id)
      if (!verdict) continue
      const row = el('button', id === zone ? 'zrow zrow-on' : 'zrow')
      row.type = 'button'
      row.dataset.key = `zrow:${id}`
      const name = el('span', 'zrow-name', STRINGS.zones[id].name)
      const tiled = tiledVerdictFor(id)
      if (tiled) {
        name.append(el('span', `zrow-sub verdict-${tiled}`, fill(A.zoneRowTiled, {
          mark: A.verdictMarks[tiled], mm: mm(tiledWorth(sheet.protection[id], threat)), verdict: A.verdicts[tiled],
        })))
      }
      row.append(
        el('span', `zrow-mark verdict-${verdict}`, A.verdictMarks[verdict]),
        name,
        el('span', 'zrow-value', fill(A.zoneRow, {
          mm: mm(worthAgainst(sheet.protection[id], threat.kind)), verdict: A.verdicts[verdict],
        })),
      )
      row.addEventListener('click', () => host.pickZone(id))
      list.append(row)
    }
    mapBox.append(list, el('p', 'ctl-note', A.notOnDrawing))
    if (ZONES.some((id) => sheet.rollup.era[id].tiles > 0)) mapBox.append(el('p', 'ctl-note', A.mapTiles))
  }
  root.append(mapBox)

  // --- The row of zones ---------------------------------------------------
  const zones = el('div', 'zones')
  zones.setAttribute('role', 'group')
  zones.setAttribute('aria-label', A.zonesLabel)
  for (const id of ZONES) {
    const name = STRINGS.zones[id].name
    const faulty = sheet.issues.some((issue) => issue.part === `armour.${id}`)
    const verdict = verdictFor(id)
    const shown = verdict ? `${A.verdictMarks[verdict]} ${name}` : name
    const button = el('button', id === zone ? 'zone zone-on' : 'zone', faulty ? `${shown} !` : shown)
    button.type = 'button'
    button.dataset.key = `zone:${id}`
    button.setAttribute('aria-pressed', id === zone ? 'true' : 'false')
    const tiles = sheet.rollup.era[id].tiles
    const tiled = tiledVerdictFor(id)
    if (tiles > 0) {
      button.append(el('span', 'zone-tiles', tiled ? `${A.verdictMarks[tiled]} ${String(tiles)}` : String(tiles)))
    }
    const spoken: string[] = [name]
    if (verdict) spoken.push(A.verdicts[verdict])
    if (tiles > 0) spoken.push(tiled ? fill(A.zoneTiled, { n: String(tiles), verdict: A.verdicts[tiled] }) : fill(A.zoneTiles, { n: String(tiles) }))
    if (faulty) spoken.push(A.hasFaults)
    if (spoken.length > 1) button.setAttribute('aria-label', spoken.join(', '))
    button.addEventListener('click', () => host.pickZone(id))
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
  /** The line under a number that says how it stands against the chosen round. */
  let standing: HTMLElement | undefined
  const value = (label: string, kind: RoundKind): HTMLElement => {
    const box = el('div', 'prot-box')
    const number = el('dd', 'prot-value')
    box.append(el('dt', 'chip-label', label), number)
    if (threat?.kind === kind) {
      standing = el('dd', 'prot-verdict')
      box.append(standing)
    }
    values.append(box)
    return number
  }
  const kinetic = value(A.kinetic, 'kinetic')
  const shaped = value(A.shaped, 'shaped')
  /** What the zone is worth where a tile sits. Only there when the zone has tiles. */
  const underTile = el('dd', 'prot-era')
  if (sheet.rollup.era[zone].tiles > 0) {
    const row = el('div', 'prot-row')
    row.append(el('dt', 'chip-label', A.underTile), underTile)
    values.append(row)
  }
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

  // --- The test shot --------------------------------------------------------
  const shotBox = el('section', 'ctl')
  shotBox.dataset.control = 'shot'
  shotBox.append(el('h3', 'ctl-label', A.shotTitle))
  shotBox.append(el('p', 'ctl-note', threat
    ? fill(A.shotSetup, {
        round: threat.kind === 'kinetic'
          ? fill(A.mapKinetic, { round: threatName, range: String(state.rangeM) })
          : fill(A.mapShaped, { round: threatName }),
      })
    : A.shotNone))

  const angles: readonly number[] = TUNING.protection.shotAnglesDeg
  const angleAt = angles.indexOf(state.angleDeg)
  const angleRow = el('div', 'num maprange')
  const turnShot = (direction: number, sign: string, label: string): HTMLButtonElement => {
    const button = el('button', 'num-step', sign)
    button.type = 'button'
    button.dataset.key = `shot-angle:${direction}`
    button.setAttribute('aria-label', label)
    const next = angles[angleAt + direction]
    button.disabled = next === undefined
    button.addEventListener('click', () => {
      if (next === undefined) return
      state.angleDeg = next
      host.refresh()
    })
    return button
  }
  const angleShown = el('output', 'maprange-value')
  angleShown.append(
    el('span', 'layer-name', A.angleLabel),
    el('span', 'num-value', state.angleDeg === 0 ? A.angleSquare : fill(A.angleValue, { n: String(state.angleDeg) })),
  )
  angleRow.append(turnShot(-1, '−', A.angleLess), angleShown, turnShot(1, '+', A.angleMore))
  shotBox.append(angleRow)

  /** Whether the shot meets a tile: only when the zone has tiles and the player aims at one. */
  const aimedAtTile = sheet.rollup.era[zone].tiles > 0 && state.atTile
  if (sheet.rollup.era[zone].tiles > 0) {
    const aim = el('div', 'seg')
    aim.setAttribute('role', 'group')
    aim.setAttribute('aria-label', A.aimLabel)
    for (const [atTile, label] of [[true, A.aimTile], [false, A.aimPlate]] as [boolean, string][]) {
      const button = el('button', state.atTile === atTile ? 'seg-item seg-on' : 'seg-item', label)
      button.type = 'button'
      button.dataset.key = `shot-aim:${atTile ? 'tile' : 'plate'}`
      button.setAttribute('aria-pressed', state.atTile === atTile ? 'true' : 'false')
      button.addEventListener('click', () => {
        state.atTile = atTile
        host.refresh()
      })
      aim.append(button)
    }
    shotBox.append(aim)
  }

  const figure = el('figure', 'sec')
  const drawing = el('div', 'sec-drawing')
  const ends = el('div', 'sec-ends')
  ends.append(el('span', '', A.outside), el('span', '', A.inside))
  const caption = el('figcaption', 'bp-caption')
  figure.append(drawing, ends, caption)
  const meets = el('p', 'ctl-note shot-meets')
  const steps = el('ol', 'shot-steps')
  const outcome = el('p', 'shot-result')
  outcome.setAttribute('role', 'status')
  const behind = el('div', 'shot-behind')
  shotBox.append(figure, meets, steps, outcome, behind)
  if (threat) shotBox.append(el('p', 'ctl-note', fill(A.shotNote, { pct: fixed(TUNING.protection.marginShare * 100, 0) })))
  root.append(summary, values, detail, shotBox)

  /** A small arrowhead with its point at (x, y), flying along (dx, dy). */
  const arrowHead = (x: number, y: number, dx: number, dy: number): SVGPolygonElement => {
    const size = SECTION.arrowMm
    const length = Math.hypot(dx, dy) || 1
    const ux = dx / length
    const uy = dy / length
    const backX = x - ux * size
    const backY = y - uy * size
    const half = size / 2.5
    return svg('polygon', {
      points: `${x},${y} ${backX - uy * half},${backY + ux * half} ${backX + uy * half},${backY - ux * half}`,
      class: 'sec-arrow',
    })
  }

  /** What the shot did, in a sentence. */
  const outcomeText = (result: ShotResult): string => {
    if (result.ricochet) {
      return fill(A.shotSkids, {
        deg: fixed((Math.acos(result.cosine) * 180) / Math.PI, 0), limit: String(TUNING.protection.ricochetDeg),
      })
    }
    const spare = mm(Math.abs(result.spareMm))
    if (result.verdict === 'marginal') return fill(result.spareMm >= 0 ? A.shotCloseStopped : A.shotCloseThrough, { mm: spare })
    if (result.verdict === 'fails') return fill(A.shotThrough, { mm: spare })
    const stop = result.steps.find((step) => step.fate === 'stopped')
    if (!stop) return A.shotSpent
    if (stop.what === 'tile') return fill(A.shotStoppedTile, { mm: spare })
    return fill(A.shotStopped, { n: String((stop.layer ?? 0) + 1), mm: spare })
  }

  /** The section view, with the test shot drawn as far as it gets. `fired` plays the shot in. */
  function drawShot(fired: boolean): void {
    const slopeDeg = sheet.protection[zone].slopeDeg
    const section = sectionOf(layers, slopeDeg, state.angleDeg, aimedAtTile)
    const result = threat
      ? testShot(layers, slopeDeg, { round: threat, rangeM: state.rangeM, angleDeg: state.angleDeg, tile: aimedAtTile })
      : undefined
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
      const points = slab.points.map(([x, y]) => `${x},${y}`).join(' ')
      picture.append(slab.material === 'tile'
        ? svg('polygon', { points, class: 'slab slab-tile' })
        : svg('polygon', { points, fill: `url(#sec-${slab.material})`, class: `slab slab-${slab.material}` }))
    }

    // How far the shot gets: to the first thing in its way, to where it stops, or out the far side.
    const firstX = section.slabs[0]?.enterX ?? shot.enterX
    const path: [number, number][] = [[shot.startX, shot.y]]
    const marks: SVGElement[] = []
    const stopAt = result?.steps.findIndex((step) => step.fate === 'stopped') ?? -1
    const stopSlab = section.slabs[stopAt]
    const stopStep = result?.steps[stopAt]
    if (!result) {
      path.push([shot.endX, shot.y])
      marks.push(arrowHead(firstX, shot.y, 1, 0))
    } else if (result.ricochet) {
      // It skids up the face of the plate.
      const k = SECTION.skidShare
      const endX = firstX + section.leanMm * k
      const endY = shot.y - SECTION.stripMm * k
      path.push([firstX, shot.y], [endX, endY])
      marks.push(arrowHead(endX, endY, section.leanMm, -SECTION.stripMm))
    } else if (stopSlab && stopStep) {
      const x = stopSlab.enterX + stopStep.crossed * (stopSlab.exitX - stopSlab.enterX)
      const tick = SECTION.arrowMm / 2
      path.push([x, shot.y])
      marks.push(
        svg('line', { x1: String(x - tick), y1: String(shot.y - tick), x2: String(x + tick), y2: String(shot.y + tick), class: 'sec-stop' }),
        svg('line', { x1: String(x - tick), y1: String(shot.y + tick), x2: String(x + tick), y2: String(shot.y - tick), class: 'sec-stop' }),
      )
    } else {
      path.push([shot.endX, shot.y])
      marks.push(arrowHead(shot.endX, shot.y, 1, 0))
    }
    const classes = ['sec-shot']
    if (result) classes.push('sec-shot-live')
    // A shot too close to call is drawn broken. Any other plays in when the panel is drawn afresh.
    const unsure = result?.verdict === 'marginal'
    if (unsure) classes.push('sec-shot-unsure')
    else if (result && fired) classes.push('sec-shot-fired')
    const line = svg('polyline', { points: path.map(([x, y]) => `${x},${y}`).join(' '), class: classes.join(' ') })
    // Measured as one unit long, so the stylesheet can draw it in from nothing.
    if (!unsure) line.setAttribute('pathLength', '1')
    picture.append(line, ...marks)
    drawing.replaceChildren(picture)
    caption.textContent = layers.length === 0 ? A.none : fill(A.sectionCaption, { mm: mm(section.pathMm) })

    const cosine = shotCosine(slopeDeg, state.angleDeg)
    meets.hidden = state.angleDeg === 0
    meets.textContent = fill(A.shotMeets, {
      angle: String(state.angleDeg), deg: fixed((Math.acos(cosine) * 180) / Math.PI, 0), x: fixed(1 / cosine, 1),
    })

    steps.replaceChildren()
    behind.replaceChildren()
    steps.hidden = !result
    outcome.hidden = !result
    behind.hidden = true
    if (!result || !threat) return
    const row = (name: string, value: string, cls = 'shot-step'): void => {
      const item = el('li', cls)
      item.append(el('span', 'shot-step-name', name), el('span', 'shot-step-value', value))
      steps.append(item)
    }
    row(A.stepArrives, fill(A.stepCanCross, { mm: mm(result.penMm) }))
    for (const step of result.steps) {
      const layer = step.layer === undefined ? undefined : layers[step.layer]
      const name = layer
        ? fill(A.stepLayer, {
            n: String((step.layer ?? 0) + 1), material: STRINGS.materials[layer.material].name, mm: mm(layer.mm),
          })
        : A.stepTile
      if (step.fate === 'through') row(name, fill(A.stepTakes, { mm: mm(step.worthMm), left: mm(step.leftMm) }))
      else if (step.fate === 'stopped') row(name, A.stepStops, 'shot-step shot-step-stop')
      else row(name, A.stepNotReached, 'shot-step shot-step-off')
    }
    outcome.className = `shot-result verdict-${result.verdict}`
    outcome.textContent = `${A.verdictMarks[result.verdict]} ${outcomeText(result)}`

    // On behind the armour, when the round gets that far.
    const traced = paperShot(targetOf(spec, sheet.geometry, sheet.interior), sheet.geometry, zone, {
      round: threat, rangeM: state.rangeM, angleDeg: state.angleDeg, tile: aimedAtTile,
    })
    const inside = behindOf(traced, spec, sheet.crewCount)
    if (!inside) return
    behind.hidden = false
    const list = el('ol', 'shot-steps')
    list.setAttribute('aria-label', A.behind.listLabel)
    for (const each of inside.rows) {
      const item = el('li', each.grave ? 'shot-step shot-step-stop' : 'shot-step')
      item.append(el('span', 'shot-step-name', each.name), el('span', 'shot-step-value', each.value))
      list.append(item)
    }
    behind.append(el('h4', 'shot-behind-title', A.behind.title), list, el('p', 'shot-behind-sum', inside.sum))
    for (const note of [...inside.notes, A.behind.note]) behind.append(el('p', 'ctl-note', note))
  }

  function drawSummary(fired = false): void {
    const protection = sheet.protection[zone]
    weight.textContent = fill(A.zoneWeight, { n: fixed(sheet.rollup.zoneMassT[zone], 2) })
    kinetic.textContent = fill(D.units.mm, { n: mm(protection.keMm) })
    shaped.textContent = fill(D.units.mm, { n: mm(protection.ceMm) })
    const verdict = verdictFor(zone)
    if (standing && verdict) {
      standing.className = `prot-verdict verdict-${verdict}`
      standing.textContent = `${A.verdictMarks[verdict]} ${fill(A.against, { verdict: A.verdicts[verdict], mm: mm(pen) })}`
    }

    const zoneEra = sheet.rollup.era[zone]
    const tiled = tiledVerdictFor(zone)
    const pct = fixed(zoneEra.coverage * 100, 0)
    underTile.textContent = tiled && threat
      ? fill(A.underTileVerdict, {
          mm: mm(tiledWorth(protection, threat)), mark: A.verdictMarks[tiled], verdict: A.verdicts[tiled], pct,
        })
      : fill(A.underTileValue, { ke: mm(tiledWorth(protection, { kind: 'kinetic' })), ce: mm(tiledWorth(protection, { kind: 'shaped' })), pct })
    underTile.className = tiled ? `prot-era verdict-${tiled}` : 'prot-era'

    drawShot(fired)
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
      const comes = generationOf('material', id)
      const locked = comes > host.generation && id !== layer.material
      const name = STRINGS.materials[id].name
      const option = el('option', '', locked ? fill(A.lockedMaterial, { name, n: String(comes) }) : name)
      option.value = id
      option.selected = id === layer.material
      option.disabled = locked
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

  // --- Reactive tiles ------------------------------------------------------
  const tilesBox = el('section', 'ctl')
  tilesBox.dataset.control = 'tiles'
  const grid = tileGrid(zone)
  const zoneEra = sheet.rollup.era[zone]
  const tilesTitle = el('h3', 'ctl-label', A.tilesTitle)
  tilesBox.append(tilesTitle)
  if (!grid) {
    tilesBox.append(el('p', 'ctl-note', STRINGS.eraGaps[zone]))
  } else {
    tilesTitle.append(el('span', 'num-value', fill(A.tilesCount, { n: String(zoneEra.tiles), max: String(zoneEra.open) })))
    tilesBox.append(el('p', 'ctl-note', fill(A.tilesAbout, { ce: String(ERA_TILE.ceMm) })))
    const fitted = spec.era[zone]
    const board = el('div', 'tiles')
    board.style.gridTemplateColumns = `repeat(${grid.cols}, minmax(44px, 56px))`
    board.setAttribute('role', 'group')
    board.setAttribute('aria-label', fill(A.tilesGrid, { zone: text.name }))
    for (let place = 0; place < grid.cols * grid.rows; place++) {
      const where = { row: String(Math.floor(place / grid.cols) + 1), col: String((place % grid.cols) + 1) }
      if (grid.gaps.includes(place)) {
        const blocked = el('span', 'tile tile-gap')
        blocked.setAttribute('role', 'img')
        blocked.setAttribute('aria-label', fill(A.tileBlocked, where))
        board.append(blocked)
        continue
      }
      const on = hasTile(fitted, place)
      const button = el('button', on ? 'tile tile-on' : 'tile')
      button.type = 'button'
      button.dataset.key = `tile:${place}`
      button.setAttribute('aria-pressed', on ? 'true' : 'false')
      button.setAttribute('aria-label', fill(A.tilePlace, where))
      button.addEventListener('click', () => host.commit((s) => {
        s.era[zone] = setTile(zone, s.era[zone], place, !on)
      }))
      board.append(button)
    }
    const gaps = STRINGS.eraGaps[zone]
    tilesBox.append(board, el('p', 'layer-note', `${A.tilesViews[ERA_GRID_VIEW[zone]]} ${A.tilesKey}${gaps ? ` ${gaps}` : ''}`))

    const all = allTiles(zone)
    const bulk = el('div', 'tiles-bulk')
    const act = (label: string, key: string, to: number): void => {
      const button = el('button', 'btn', label)
      button.type = 'button'
      button.dataset.key = key
      button.disabled = fitted === to
      button.addEventListener('click', () => host.commit((s) => {
        s.era[zone] = to
      }))
      bulk.append(button)
    }
    act(A.tilesFit, 'tiles-fit', all)
    act(A.tilesStrip, 'tiles-strip', 0)
    tilesBox.append(bulk, el('p', 'layer-note', zoneEra.tiles === 0 ? A.tilesNone : fill(A.tilesSum, {
      n: String(zoneEra.tiles), pct: fixed(zoneEra.coverage * 100, 0), mass: fixed(zoneEra.massT, 2), cost: money(zoneEra.costKr),
    })))
  }
  root.append(tilesBox)

  drawSummary(true)
  // The row of zones is rebuilt on every draw; put it back where it was.
  queueMicrotask(() => {
    zones.scrollLeft = state.zonesScroll
  })
  return root
}
