// Puts a drawing on the page as SVG, with tap zones that open a control.
// While the armour is being worked on it becomes the protection map: each
// zone that a view shows square on is hatched by how it stands up to a round,
// and its reactive tiles are drawn where they are fitted.
import { DRAWING } from '../data/drawing'
import type { TileGrid } from '../data/era'
import type { ZoneId } from '../data/materials'
import { STRINGS, fill } from '../data/strings'
import { hasTile, type Geometry, type Interior, type VehicleSpec, type Verdict } from '../sim/vehicle'
import { el } from '../ui/dom'
import { fixed } from '../ui/format'
import type { ControlId } from './controls'
import { CUT_KINDS, VIEWS, drawingOf, type Drawing, type View } from './drawing'
import { insideLines } from './inside'

const SVG = 'http://www.w3.org/2000/svg'
const O = STRINGS.office
const VERDICTS: readonly Verdict[] = ['holds', 'marginal', 'fails']

export interface BlueprintMap {
  /** The zone being worked on. It is outlined. */
  selected: ZoneId
  /** Each zone's verdict against the chosen round. Left out when no round is chosen. */
  verdicts?: Record<ZoneId, Verdict>
  /** The zones that have reactive tiles: where they sit, and how a tile stands up to the round. */
  tiles?: Partial<Record<ZoneId, ZoneTiles>>
  pick(zone: ZoneId): void
}

export interface ZoneTiles {
  grid: TileGrid
  /** The spec number: bit n is set when tile place n has a tile. */
  fitted: number
  verdict?: Verdict
}

/** How much of a tile place the tile's edge takes, each side. */
const TILE_EDGE = 0.14

/**
 * Two cut-outs in the shape of a zone's tiles, measured in shares of the
 * face's own box so no sizes are needed: one for the whole tiles and one for
 * their middles. Painting ink through the first and paper through the second
 * leaves each tile with an edge.
 */
function tileClips(zone: ZoneId, tiles: ZoneTiles): SVGClipPathElement[] {
  const { grid, fitted } = tiles
  const w = 1 / grid.cols
  const h = 1 / grid.rows
  const clip = (id: string, inset: number): SVGClipPathElement => {
    const node = svg('clipPath', { id: `${id}-${zone}`, clipPathUnits: 'objectBoundingBox' })
    for (let place = 0; place < grid.cols * grid.rows; place++) {
      if (!hasTile(fitted, place)) continue
      const x = (place % grid.cols) * w
      const y = Math.floor(place / grid.cols) * h
      node.append(svg('rect', {
        x: String(x + w * inset), y: String(y + h * inset), width: String(w * (1 - 2 * inset)), height: String(h * (1 - 2 * inset)),
      }))
    }
    return node
  }
  return [clip('tiles', TILE_EDGE / 4), clip('tiles-in', TILE_EDGE)]
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag)
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value)
  return node
}

/**
 * Hatching for the verdicts, so the map does not rely on colour: crossed
 * lines for fails, single lines for marginal, a plain tint for holds.
 * `unit` is the size of one screen pixel in the drawing's own units.
 */
function verdictDefs(unit: number): SVGDefsElement {
  const defs = svg('defs', {})
  const n = (value: number): string => String(Math.round(value * unit * 1000) / 1000)
  const size = 5
  const stroke = (x0: number, y0: number, x1: number, y1: number): SVGElement =>
    svg('line', { x1: n(x0), y1: n(y0), x2: n(x1), y2: n(y1), 'stroke-width': n(1.1) })
  const rising = [stroke(0, size, size, 0), stroke(-1, 1, 1, -1), stroke(size - 1, size + 1, size + 1, size - 1)]
  const falling = [stroke(0, 0, size, size), stroke(-1, size - 1, 1, size + 1), stroke(size - 1, -1, size + 1, 1)]
  const tile = (verdict: Verdict, marks: SVGElement[]): void => {
    const pattern = svg('pattern', {
      id: `map-${verdict}`, width: n(size), height: n(size), patternUnits: 'userSpaceOnUse', class: `map-tile map-${verdict}`,
    })
    pattern.append(svg('rect', { width: n(size), height: n(size), class: 'map-ground' }), ...marks)
    defs.append(pattern)
  }
  tile('fails', [...rising, ...falling])
  tile('marginal', rising)
  return defs
}

/**
 * Hatching for what is inside, so the cutaway does not rely on colour: slanted lines for ammunition, level lines for fuel.
 * `ids` starts every name it defines, so two cutaways on one page never share any.
 */
function cutDefs(unit: number, body: readonly string[], ids = 'cut'): SVGDefsElement {
  const defs = svg('defs', {})
  const n = (value: number): string => String(Math.round(value * unit * 1000) / 1000)
  const size = 4
  const tile = (kind: string, x0: number, y0: number, x1: number, y1: number): void => {
    const pattern = svg('pattern', { id: `${ids}-${kind}`, width: n(size), height: n(size), patternUnits: 'userSpaceOnUse', class: `cut-tile cut-${kind}` })
    pattern.append(
      svg('rect', { width: n(size), height: n(size), class: 'map-ground' }),
      svg('line', { x1: n(x0), y1: n(y0), x2: n(x1), y2: n(y1), 'stroke-width': n(1.2) }),
    )
    defs.append(pattern)
  }
  tile('ammo', 0, size, size, 0)
  tile('fuel', 0, size / 2, size, size / 2)
  // The cut armour's hatching is finer than the stowage marks, as on a drawing-office section.
  const fine = size * 0.6
  const section = svg('pattern', { id: `${ids}-section`, width: n(fine), height: n(fine), patternUnits: 'userSpaceOnUse', class: 'cut-tile cut-section' })
  section.append(
    svg('rect', { width: n(fine), height: n(fine), class: 'map-ground' }),
    svg('line', { x1: '0', y1: '0', x2: n(fine), y2: n(fine), 'stroke-width': n(0.7) }),
  )
  defs.append(section)
  if (body.length > 0) {
    const clip = svg('clipPath', { id: `${ids}-body` })
    for (const d of body) clip.append(svg('path', { d }))
    defs.append(clip)
  }
  return defs
}

function tapZone(
  root: SVGSVGElement, zone: { x: number; y: number; w: number; h: number }, label: string, act: () => void,
): void {
  const rect = svg('rect', {
    x: String(zone.x), y: String(zone.y), width: String(zone.w), height: String(zone.h),
    class: 'bp-zone', role: 'button', tabindex: '0', 'aria-label': label,
  })
  rect.addEventListener('click', act)
  rect.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    act()
  })
  root.append(rect)
}

/**
 * The cutaway on its own, with nothing to tap: the picture a report draws its
 * shot paths on. Its box is in metres, so a point of the tank goes straight on
 * it: back from the nose across the page, and up (side) or out to the right (top) up the page.
 */
export function cutawayPicture(
  spec: VehicleSpec, geo: Geometry, view: 'side' | 'top', interior: Interior, ids: string,
): { root: SVGSVGElement; box: { x: number; y: number; w: number; h: number } } {
  const drawing = drawingOf(spec, geo, view, interior)
  const { box } = drawing
  const root = svg('svg', { class: 'bp-svg', viewBox: `${box.x} ${box.y} ${box.w} ${box.h}`, preserveAspectRatio: 'xMidYMid meet' })
  root.append(cutDefs(box.w / 330, drawing.body, ids))
  const inside = svg('g', { class: 'bp-inside' })
  if (drawing.body.length > 0) inside.style.clipPath = `url(#${ids}-body)`
  inside.append(...sectionBand(drawing.body, `${ids}-section`))
  for (const shape of drawing.shapes) {
    if (shape.item) {
      const mark = svg('path', { d: shape.d, class: `bp-item bp-item-${shape.item}` })
      if (shape.item === 'ammo' || shape.item === 'fuel') mark.style.fill = `url(#${ids}-${shape.item})`
      inside.append(mark)
    } else if (!shape.zone) {
      root.append(svg('path', { d: shape.d, class: `bp-${shape.line}` }))
    }
  }
  root.append(inside)
  return { root, box }
}

/**
 * The armour where the cutaway slices through it, hatched at 45 degrees in the
 * drawing-office way. The band runs along the armour's outline; the group it sits
 * in is clipped to the inside, so only the inner half shows, as the wall.
 */
function sectionBand(body: readonly string[], pattern: string): SVGPathElement[] {
  return body.map((d) => {
    const band = svg('path', { d, class: 'bp-section', 'stroke-width': String(DRAWING.sectionWallM) })
    band.style.stroke = `url(#${pattern})`
    return band
  })
}

/**
 * The drawing on its sheet: a box the drawing's own shape, a thin border with
 * corner ticks, and the dimension figures laid over it as text, so they stay a
 * readable size however small the drawing is.
 */
function onSheet(root: SVGSVGElement, drawing: Drawing): HTMLElement {
  const { box } = drawing
  const sheet = el('div', 'bp-sheet')
  sheet.style.aspectRatio = `${box.w} / ${box.h}`
  sheet.style.setProperty('--bp-ratio', String(box.w / box.h))
  const inset = Math.min(box.w, box.h) * 0.015
  const tick = Math.min(box.w, box.h) * 0.06
  const [x0, y0, x1, y1] = [box.x + inset, box.y + inset, box.x + box.w - inset, box.y + box.h - inset]
  let corners = ''
  for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]] as const) {
    corners += `M${x + dx * tick} ${y} L${x} ${y} L${x} ${y + dy * tick} `
  }
  root.prepend(svg('path', { d: corners.trim(), class: 'bp-frame' }))
  sheet.append(root)
  const figures = el('div', 'bp-dims')
  figures.setAttribute('aria-hidden', 'true')
  for (const dim of drawing.dimensions) {
    const figure = el('span', dim.vertical ? 'bp-dim bp-dim-up' : 'bp-dim', fill(O.sheet.figure, { n: fixed(dim.m, 2) }))
    figure.style.left = `${((dim.x - box.x) / box.w) * 100}%`
    figure.style.top = `${((dim.y - box.y) / box.h) * 100}%`
    figures.append(figure)
  }
  sheet.append(figures)
  return sheet
}

/** The title strip: which view, which sheet, and the unit. Reads out the measurements for a screen reader. */
function titleStrip(view: View, drawing: Drawing): HTMLElement {
  const strip = el('p', 'bp-title')
  strip.setAttribute('aria-label', fill(O.captions[view], {
    l: fixed(drawing.hullLengthM, 2),
    g: fixed(drawing.overallLengthM, 2),
    w: fixed(drawing.widthM, 2),
    h: fixed(drawing.heightM, 2),
  }))
  const S = O.sheet
  strip.append(
    el('span', 'bp-title-cell bp-title-main', S.views[view]),
    el('span', 'bp-title-cell', fill(S.number, { n: String(VIEWS.indexOf(view) + 1), of: String(VIEWS.length) })),
    el('span', 'bp-title-cell', S.units),
  )
  return strip
}

/** The drawing and its caption, ready to put in the blueprint box. */
export function renderBlueprint(
  spec: VehicleSpec, geo: Geometry, view: View, go: (id: ControlId) => void, map?: BlueprintMap, interior?: Interior,
): Element[] {
  const drawing = drawingOf(spec, geo, view, interior)
  const { box } = drawing
  const root = svg('svg', {
    class: 'bp-svg',
    viewBox: `${box.x} ${box.y} ${box.w} ${box.h}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'group',
    'aria-label': fill(O.drawingLabel, { view: O.views[view] }),
  })
  // The box takes the drawing's own shape, up to the height the stylesheet allows.
  root.style.aspectRatio = `${box.w} / ${box.h}`
  if (map?.verdicts) root.append(verdictDefs(box.w / 330))

  // What is inside goes on last, over the running gear, and only within the armour.
  const inside = svg('g', { class: 'bp-inside' })
  if (interior) {
    root.append(cutDefs(box.w / 330, drawing.body))
    if (drawing.body.length > 0) inside.style.clipPath = 'url(#cut-body)'
    inside.append(...sectionBand(drawing.body, 'cut-section'))
  }

  for (const shape of drawing.shapes) {
    if (shape.item) {
      const mark = svg('path', { d: shape.d, class: `bp-item bp-item-${shape.item}` })
      if (shape.item === 'ammo' || shape.item === 'fuel') mark.style.fill = `url(#cut-${shape.item})`
      inside.append(mark)
      continue
    }
    if (!shape.zone) {
      root.append(svg('path', { d: shape.d, class: `bp-${shape.line}` }))
      continue
    }
    if (!map) continue
    const verdict = map.verdicts?.[shape.zone]
    const classes = ['bp-face']
    if (verdict) classes.push(`bp-face-${verdict}`)
    if (shape.zone === map.selected) classes.push('bp-face-on')
    const face = svg('path', { d: shape.d, class: classes.join(' ') })
    // Set as a style, not an attribute, so the stylesheet's plain fill does not win.
    if (verdict && verdict !== 'holds') face.style.fill = `url(#map-${verdict})`
    root.append(face)

    const tiles = map.tiles?.[shape.zone]
    if (!tiles) continue
    root.append(...tileClips(shape.zone, tiles))
    const layer = (cls: string, clip: string): SVGPathElement => {
      const path = svg('path', { d: shape.d, class: cls })
      path.style.clipPath = `url(#${clip}-${shape.zone})`
      root.append(path)
      return path
    }
    layer('bp-tile-edge', 'tiles')
    const middle = layer(tiles.verdict ? `bp-tile bp-tile-${tiles.verdict}` : 'bp-tile', 'tiles-in')
    // The hatching already has paper behind it.
    if (tiles.verdict && tiles.verdict !== 'holds') middle.style.fill = `url(#map-${tiles.verdict})`
    // The tiles would hide the outline of the zone being worked on, so draw it again on top.
    if (shape.zone === map.selected) root.append(svg('path', { d: shape.d, class: 'bp-face bp-face-on' }))
  }

  if (interior) root.append(inside)

  if (map) {
    for (const tap of drawing.armourTaps) {
      tapZone(root, tap, fill(O.armour.pickZone, { name: STRINGS.zones[tap.zone].name }), () => map.pick(tap.zone))
    }
  } else {
    for (const zone of drawing.zones) {
      tapZone(root, zone, fill(O.zoneLabel, { name: STRINGS.controls[zone.go].label }), () => go(zone.go))
    }
  }

  if (map?.verdicts) {
    const legend = el('p', 'bp-caption bp-legend')
    legend.setAttribute('aria-label', O.mapLegend)
    for (const verdict of VERDICTS) {
      const item = el('span', 'bp-key')
      item.append(el('span', `bp-swatch bp-swatch-${verdict}`), O.armour.verdicts[verdict])
      legend.append(item)
    }
    if (map.tiles && Object.keys(map.tiles).length > 0) {
      const item = el('span', 'bp-key')
      item.append(el('span', 'bp-swatch bp-swatch-tile'), O.armour.legendTiles)
      legend.append(item)
    }
    return [onSheet(root, drawing), legend]
  }
  if (interior) {
    const C = O.cutaway
    if (view === 'front') return [onSheet(root, drawing), el('p', 'bp-caption', C.frontNote)]
    const legend = el('p', 'bp-caption bp-legend')
    legend.setAttribute('aria-label', C.legendLabel)
    for (const kind of CUT_KINDS) {
      const item = el('span', 'bp-key')
      item.append(el('span', `bp-swatch bp-swatch-${kind}`), C.kinds[kind])
      legend.append(item)
    }
    const list = el('ul', 'bp-inside-list')
    for (const line of insideLines(interior)) list.append(el('li', 'bp-inside-line', line))
    return [onSheet(root, drawing), legend, list]
  }
  return [onSheet(root, drawing), titleStrip(view, drawing)]
}
