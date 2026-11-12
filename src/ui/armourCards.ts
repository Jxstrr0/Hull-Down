// The armour trial and the hull-down berm in the range report.
import { BARRELS, GUNS } from '../data/parts'
import { RANGE } from '../data/range'
import { STRINGS, fill } from '../data/strings'
import type { ZoneId } from '../data/materials'
import type { RangeReport, SerialResult } from '../sim/trials'
import type { StatSheet, VehicleSpec } from '../sim/vehicle'
import { el } from './dom'
import { fixed } from './format'
import type { CardKit } from './gunneryCards'

const A = STRINGS.range.armour
const B = STRINGS.range.berm
const SVG = 'http://www.w3.org/2000/svg'

function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  return node
}

/** What one serial came to, in a few short sentences. */
export function serialWords(serial: SerialResult, wheeled = false): string[] {
  const shots = serial.shots.length
  const words: string[] = []
  if (serial.held) words.push(fill(A.held, { n: String(shots) }))
  else if (serial.through === shots) words.push(fill(A.throughAll, { n: String(shots) }))
  else words.push(fill(A.through, { n: String(serial.through), shots: String(shots) }))

  if (serial.held) {
    const spare = Math.min(...serial.shots.map((shot) => (shot.hit.armour && !shot.hit.armour.ricochet ? shot.hit.armour.spareMm : Infinity)))
    if (Number.isFinite(spare)) words.push(fill(A.closest, { mm: fixed(Math.max(0, spare), 0) }))
  } else {
    const worst: Partial<Record<SerialResult['worst'], string>> = A.worst
    const text = worst[serial.worst]
    if (text) words.push(text)
  }
  const tiles = serial.shots.filter((shot) => shot.hit.tile).length
  if (tiles > 0) {
    words.push(fill(A.tiles, { n: String(tiles) }))
    const bare = serial.shots.filter((shot) => shot.hit.through && !shot.hit.tile).length
    if (bare > 0) words.push(fill(A.bare, { n: String(bare) }))
  }
  if (serial.defeated > 0) words.push(fill(A.defeated, { n: String(serial.defeated) }))
  if (serial.shots.some((shot) => shot.hit.trackBroken)) words.push(wheeled ? A.wheel : A.track)
  return words
}

export interface ArmourKit extends CardKit {
  /** A button that leaves the range for the Armour tab, at one zone. */
  fixZone(zone: ZoneId, key: string): HTMLButtonElement
}

function armourCard(report: RangeReport, wheeled: boolean, kit: ArmourKit): HTMLElement {
  const run = report.armour
  const box = kit.card(A.title, fill(A.about, { n: String(run.serials[0]?.shots.length ?? 0) }), run.passed)
  const row = (serial: SerialResult, n: number): HTMLElement => {
    const setup = fill(A.setup, {
      round: STRINGS.threats[serial.threat].name,
      range: String(serial.rangeM),
      angle: serial.angleDeg === 0 ? A.square : fill(A.off, { n: String(serial.angleDeg) }),
    })
    const item = kit.line(STRINGS.zones[serial.zone].name, [setup, ...serialWords(serial, wheeled)], serial.held, kit.fixZone(serial.zone, `armour-${n}`))
    if (!serial.gate) {
      // A plate fired on for the record is not passed or failed: it holds or it is weak.
      const mark = item.querySelector('.rg-verdict')
      if (mark) mark.textContent = serial.held ? `✓ ${A.holds}` : `✗ ${A.weak}`
    }
    return item
  }
  const gates = el('ul', 'rg-lines')
  const record = el('ul', 'rg-lines')
  run.serials.forEach((serial, n) => (serial.gate ? gates : record).append(row(serial, n)))
  box.append(el('h4', 'rg-sub', A.gates), gates)
  if (record.children.length > 0) {
    // Folded away: these are for the curious, and the list is long on a phone.
    const weak = run.serials.filter((serial) => !serial.gate && !serial.held).length
    const fold = el('details', 'rg-fold')
    const head = el('summary', 'rg-fold-head')
    head.dataset.key = 'armour-record'
    head.append(
      el('span', 'rg-sub', A.record),
      el('span', 'rg-fold-count', fill(A.recordCount, { weak: String(weak), n: String(record.children.length) })),
    )
    fold.append(head, el('p', 'ctl-note', A.recordNote), record)
    box.append(fold)
  }
  box.append(el('p', 'ctl-note rg-note', A.note))
  return box
}

/** The tank behind the ridge, from the side, with the crest's line drawn across it. */
function bermChart(report: RangeReport, sheet: StatSheet, spec: VehicleSpec): HTMLElement {
  const run = report.berm
  const f = sheet.interior.frame
  const k = RANGE.berm
  const w = 320
  const h = 84
  // Metres shown either side of the crest. The tank sits further back the more its gun dips.
  const leftM = -25
  const rightM = 3
  const scale = w / (rightM - leftM)
  const crestY = 36
  const pitch = (run.pitchDeg * Math.PI) / 180
  /** The ridge: how far below its crest the ground is, a distance either side of it. */
  const groundBelow = (m: number): number => k.radiusM - Math.sqrt(Math.max(0, k.radiusM * k.radiusM - m * m))
  // The tank stands where the ridge is as steep as its gun can dip.
  const behindM = k.radiusM * Math.sin(pitch)
  const px = (m: number): number => (m - leftM) * scale
  const py = (m: number): number => crestY - m * scale
  /** A point of the tank, given back from the nose and up from the ground, on the picture. The nose is to the right. */
  const at = (x: number, y: number): [number, number] => {
    const ahead = f.turretX - x
    return [
      px(-behindM + ahead * Math.cos(pitch) - y * Math.sin(pitch)),
      py(-run.dropM + ahead * Math.sin(pitch) + y * Math.cos(pitch)),
    ]
  }
  const place = (x: number, y: number): string => at(x, y).map((n) => fixed(n, 1)).join(',')
  const lean = (f.top - f.roof) * Math.tan((sheet.geometry.zoneSlopeDeg.turretFrontLeft * Math.PI) / 180)
  const barrelM = (GUNS[spec.gun].calibreMm / 1000) * BARRELS[spec.barrel].calibres
  const hull = [
    place(0, f.belly + f.lowerH), place(f.upperRun, f.roof), place(f.length, f.roof), place(f.length, f.belly), place(f.lowerRun, f.belly),
  ].join(' ')
  const turret = [
    place(f.turretX - f.radius, f.roof), place(f.turretX - f.radius + lean, f.top),
    place(f.turretX + f.radius + f.bustle, f.top), place(f.turretX + f.radius + f.bustle, f.roof),
  ].join(' ')
  const tracks = [place(f.lowerRun, 0), place(f.length - 0.2, 0), place(f.length - 0.2, f.belly), place(f.lowerRun, f.belly)].join(' ')

  // The gun is laid level: its bore runs straight out over the crest.
  const root = at(f.gunRootX, f.gunY)
  const muzzleX = root[0] + barrelM * scale

  const ground: string[] = []
  for (let m = leftM; m <= rightM; m += 0.5) ground.push(`${fixed(px(m), 1)},${fixed(py(-groundBelow(m)), 1)}`)

  const chart = svg('svg', { viewBox: `0 0 ${w} ${h}`, class: 'rg-chart rg-berm', role: 'img' })
  chart.setAttribute('aria-label', fill(B.chartLabel, { m: fixed(run.showsM, 1) }))
  // What shows is everything above the crest's line; the rest is drawn faint.
  const clipId = 'berm-shows'
  const clip = svg('clipPath', { id: clipId })
  clip.append(svg('rect', { x: '0', y: '0', width: String(w), height: String(crestY) }))
  const defs = svg('defs', {})
  defs.append(clip)
  const tank = (cls: string): SVGElement => {
    const group = svg('g', { class: cls })
    group.append(
      svg('polygon', { points: tracks }), svg('polygon', { points: hull }), svg('polygon', { points: turret }),
      svg('line', { x1: fixed(root[0], 1), y1: fixed(root[1], 1), x2: fixed(muzzleX, 1), y2: fixed(root[1], 1), class: 'rg-berm-gun' }),
    )
    return group
  }
  const shown = tank('rg-berm-tank rg-berm-shown')
  shown.setAttribute('clip-path', `url(#${clipId})`)
  const crestLabel = svg('text', { x: fixed(px(0) + 4, 1), y: String(crestY + 11), class: 'rg-chart-text' })
  crestLabel.textContent = B.crest
  const showLabel = svg('text', { x: '4', y: String(crestY - 4), class: 'rg-chart-text' })
  showLabel.textContent = `${B.exposed} ${fixed(run.showsM, 1)} m`
  const hideLabel = svg('text', { x: '4', y: String(crestY + 11), class: 'rg-chart-text' })
  hideLabel.textContent = B.hidden
  chart.append(
    defs,
    svg('polyline', { points: ground.join(' '), class: 'rg-berm-ground' }),
    tank('rg-berm-tank rg-berm-hidden'),
    shown,
    svg('line', { x1: '0', y1: String(crestY), x2: String(w), y2: String(crestY), class: 'rg-mark' }),
    crestLabel, showLabel, hideLabel,
  )
  const box = el('div', 'rg-chart-box')
  box.append(chart)
  return box
}

function bermCard(report: RangeReport, sheet: StatSheet, spec: VehicleSpec, kit: ArmourKit): HTMLElement {
  const run = report.berm
  const box = kit.card(B.title, B.about, run.passed)
  const lines = el('ul', 'rg-lines')
  const enough = run.depressionDeg >= run.neededDeg
  lines.append(
    kit.line(
      B.shows,
      [
        fill(B.showsValue, { m: fixed(run.showsM, 2), height: fixed(run.heightM, 2) }),
        fill(B.showsMark, { n: fixed(report.marks.bermShowsM, 1) }),
        fill(enough ? B.dipEnough : B.dip, { have: fixed(run.depressionDeg, 1), need: fixed(run.neededDeg, 1) }),
      ],
      run.passed, kit.fixButton('turret.shape', 'berm'),
    ),
  )
  const hull = el('p', 'ctl-note rg-note', run.hullDown ? B.hullDown : fill(B.hullShows, { m: fixed(run.hullShowsM, 2) }))
  box.append(bermChart(report, sheet, spec), lines, hull)
  return box
}

/** The armour trial, then the berm. */
export function armourCards(report: RangeReport, sheet: StatSheet, spec: VehicleSpec, kit: ArmourKit): HTMLElement[] {
  return [armourCard(report, sheet.drive.wheeled, kit), bermCard(report, sheet, spec, kit)]
}
