// Puts a drawing on the page as SVG, with tap zones that open a control.
import { STRINGS, fill } from '../data/strings'
import type { Geometry, VehicleSpec } from '../sim/vehicle'
import { el } from '../ui/dom'
import { fixed } from '../ui/format'
import type { ControlId } from './controls'
import { drawingOf, type View } from './drawing'

const SVG = 'http://www.w3.org/2000/svg'
const O = STRINGS.office

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag)
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value)
  return node
}

/** The drawing and its caption, ready to put in the blueprint box. */
export function renderBlueprint(spec: VehicleSpec, geo: Geometry, view: View, go: (id: ControlId) => void): Element[] {
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
  for (const shape of drawing.shapes) root.append(svg('path', { d: shape.d, class: `bp-${shape.line}` }))

  for (const zone of drawing.zones) {
    const name = STRINGS.controls[zone.go].label
    const rect = svg('rect', {
      x: String(zone.x), y: String(zone.y), width: String(zone.w), height: String(zone.h),
      class: 'bp-zone', role: 'button', tabindex: '0', 'aria-label': fill(O.zoneLabel, { name }),
    })
    rect.addEventListener('click', () => go(zone.go))
    rect.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      go(zone.go)
    })
    root.append(rect)
  }

  const caption = el('p', 'bp-caption', fill(O.captions[view], {
    l: fixed(drawing.hullLengthM, 2),
    g: fixed(drawing.overallLengthM, 2),
    w: fixed(drawing.widthM, 2),
    h: fixed(drawing.heightM, 2),
  }))
  return [root, caption]
}
