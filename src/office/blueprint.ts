// Puts a drawing on the page as SVG, with tap zones that open a control.
// While the armour is being worked on it becomes the protection map: each
// zone that a view shows square on is hatched by how it stands up to a round,
// and its reactive tiles are drawn where they are fitted.
import type { TileGrid } from '../data/era'
import type { ZoneId } from '../data/materials'
import { STRINGS, fill } from '../data/strings'
import { hasTile, type Geometry, type VehicleSpec, type Verdict } from '../sim/vehicle'
import { el } from '../ui/dom'
import { fixed } from '../ui/format'
import type { ControlId } from './controls'
import { drawingOf, type View } from './drawing'

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

/** The drawing and its caption, ready to put in the blueprint box. */
export function renderBlueprint(
  spec: VehicleSpec, geo: Geometry, view: View, go: (id: ControlId) => void, map?: BlueprintMap,
): Element[] {
  const drawing = drawingOf(spec, geo, view)
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

  for (const shape of drawing.shapes) {
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
    return [root, legend]
  }
  const caption = el('p', 'bp-caption', fill(O.captions[view], {
    l: fixed(drawing.hullLengthM, 2),
    g: fixed(drawing.overallLengthM, 2),
    w: fixed(drawing.widthM, 2),
    h: fixed(drawing.heightM, 2),
  }))
  return [root, caption]
}
