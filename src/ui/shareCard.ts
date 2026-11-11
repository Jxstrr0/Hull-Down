// The share card: the after-action report as one picture, 1080 by 1350, for
// the phone's share sheet or a download. Always drawn in the paper look.
import { CARD } from '../data/card'
import { STRINGS, fill } from '../data/strings'
import { CUT_KINDS, drawingOf, type CutKind, type Drawing, type LineStyle } from '../office/drawing'
import type { AfterAction, RangeReport, ShotLine } from '../sim/trials'
import type { StatSheet, VehicleSpec } from '../sim/vehicle'
import { findingText, pathOf, resultText, viewOf, type PagePoint } from './afterAction'
import { el } from './dom'
import { fixed } from './format'

const S = STRINGS.range.shareCard
const T = STRINGS.range.armour

/** Everything the card says, as plain text. */
export interface CardFacts {
  name: string
  subject: string
  passed: boolean
  stamp: string
  tally: string
  /** The round the picture shows. Null when the trial fired none. */
  shown: ShotLine | null
  caption: string
  findings: string[]
}

export function cardFacts(range: RangeReport, report: AfterAction, sheet: StatSheet, spec: VehicleSpec, projectNo: number): CardFacts {
  const name = sheet.name || STRINGS.office.designs.unnamed
  const passed = range.passes === range.tests
  const shown = report.worstIndex === null ? null : report.shots[report.worstIndex] ?? null
  let caption = ''
  if (shown) {
    const { serial } = shown
    const setup = fill(T.setup, {
      round: STRINGS.threats[serial.threat].name,
      range: String(serial.rangeM),
      angle: serial.angleDeg === 0 ? T.square : fill(T.off, { n: String(serial.angleDeg) }),
    })
    caption = fill(S.caption, {
      n: String(shown.index + 1), zone: STRINGS.zones[shown.shot.hit.zone ?? serial.zone].name, setup, result: resultText(shown.shot.hit),
    })
  }
  return {
    name,
    subject: fill(S.subject, { n: String(projectNo), mass: fixed(sheet.massT, 1) }),
    passed,
    stamp: fill(passed ? S.passed : S.failed, { passes: String(range.passes), tests: String(range.tests) }),
    tally: fill(S.tally, { n: String(report.shots.length), stopped: String(report.stopped), through: String(report.through) }),
    shown,
    caption,
    findings: report.findings.map((finding) => findingText(finding, spec)),
  }
}

/**
 * Breaks text into lines no wider than `width`, on spaces. `measure` gives
 * the width of a piece of text. Past `maxLines` the last line ends in an ellipsis.
 */
export function wrapText(text: string, width: number, measure: (text: string) => number, maxLines = Infinity): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const tried = line ? `${line} ${word}` : word
    if (line && measure(tried) > width) {
      lines.push(line)
      line = word
    } else {
      line = tried
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1] ?? ''
  while (last && measure(`${last}…`) > width) last = last.slice(0, -1).trimEnd()
  kept[maxLines - 1] = `${last}…`
  return kept
}

/** A file name made from a design's name: lower case, letters and digits, hyphens between. */
export function cardFileName(name: string): string {
  const slug = name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)
  return fill(S.fileName, { name: slug || 'design' })
}

type Ctx = CanvasRenderingContext2D

/** A little tile of hatching: slanted lines for ammunition, level lines for fuel. */
function hatch(g: Ctx, kind: 'ammo' | 'fuel', colour: string): CanvasPattern | string {
  const { size, line } = CARD.hatch
  const tile = document.createElement('canvas')
  tile.width = tile.height = size
  const t = tile.getContext('2d')
  if (!t) return colour
  t.fillStyle = CARD.colour.paper
  t.fillRect(0, 0, size, size)
  t.strokeStyle = colour
  t.lineWidth = line
  t.beginPath()
  if (kind === 'ammo') {
    for (const shift of [-size, 0, size]) {
      t.moveTo(shift, size)
      t.lineTo(shift + size, 0)
    }
  } else {
    t.moveTo(0, size / 2)
    t.lineTo(size, size / 2)
  }
  t.stroke()
  return g.createPattern(tile, 'repeat') ?? colour
}

/** The cutaway and the round's path, fitted into a box of the card. */
function drawPicture(g: Ctx, drawing: Drawing, shown: ShotLine, view: 'side' | 'top', x: number, y: number, w: number, h: number): void {
  const C = CARD.colour
  const L = CARD.line
  const path = pathOf(shown, view)
  const points: PagePoint[] = [path.from, path.strike, ...(path.end ? [path.end] : []), ...(path.beyond ? [path.beyond] : [])]
  const { box } = drawing
  const x0 = Math.min(box.x, ...points.map((p) => p[0]))
  const y0 = Math.min(box.y, ...points.map((p) => p[1]))
  const x1 = Math.max(box.x + box.w, ...points.map((p) => p[0]))
  const y1 = Math.max(box.y + box.h, ...points.map((p) => p[1]))
  const scale = Math.min(w / (x1 - x0), h / (y1 - y0))
  const dx = x + (w - (x1 - x0) * scale) / 2 - x0 * scale
  const dy = y + (h - (y1 - y0) * scale) / 2 - y0 * scale
  const matrix = new DOMMatrix([scale, 0, 0, scale, dx, dy])
  /** Path data in metres, as a path in the card's pixels, so line widths and hatching stay the size they are given. */
  const shape = (d: string): Path2D => {
    const out = new Path2D()
    out.addPath(new Path2D(d), matrix)
    return out
  }
  const at = (p: PagePoint): [number, number] => [p[0] * scale + dx, p[1] * scale + dy]

  g.lineJoin = 'round'
  const stroke = (d: string, width: number, colour: string, dash: number[] = []): void => {
    g.setLineDash(dash)
    g.lineWidth = width
    g.strokeStyle = colour
    g.stroke(shape(d))
    g.setLineDash([])
  }
  const lines: Record<Exclude<LineStyle, 'face' | 'item'>, () => { width: number; colour: string; dash?: number[]; fill?: boolean }> = {
    solid: () => ({ width: L.solid, colour: C.ink, fill: true }),
    thin: () => ({ width: L.thin, colour: C.ink }),
    hidden: () => ({ width: L.thin, colour: C.inkDim, dash: [10, 6] }),
    centre: () => ({ width: L.thin, colour: C.inkDim, dash: [24, 6, 4, 6] }),
    ground: () => ({ width: L.ground, colour: C.ink }),
  }
  const fills: Record<CutKind, string | CanvasPattern> = {
    crew: C.ink, ammo: hatch(g, 'ammo', C.pencil), fuel: hatch(g, 'fuel', C.inkDim), drive: C.paper, gun: C.inkDim,
  }
  const inside = drawing.shapes.filter((each) => each.item)
  for (const each of drawing.shapes) {
    if (each.item || each.zone || each.line === 'face' || each.line === 'item') continue
    const style = lines[each.line]()
    if (style.fill) {
      g.fillStyle = C.paper
      g.fill(shape(each.d))
    }
    stroke(each.d, style.width, style.colour, style.dash)
  }
  // What is inside, only within the armour.
  g.save()
  if (drawing.body.length > 0) {
    const body = new Path2D()
    for (const d of drawing.body) body.addPath(shape(d))
    g.clip(body)
  }
  for (const each of inside) {
    const kind = each.item ?? CUT_KINDS[0]
    g.fillStyle = fills[kind]
    g.fill(shape(each.d))
    if (kind !== 'crew' && kind !== 'gun') stroke(each.d, L.item, C.ink)
  }
  g.restore()

  // The round.
  const M = CARD.mark
  const from = at(path.from)
  const strike = at(path.strike)
  const run = [strike[0] - from[0], strike[1] - from[1]] as const
  const length = Math.hypot(run[0], run[1])
  const u = length > 1e-6 ? ([run[0] / length, run[1] / length] as const) : ([1, 0] as const)
  const v = [-u[1], u[0]] as const
  const off = (p: readonly [number, number], along: number, across: number): [number, number] => [
    p[0] + u[0] * along + v[0] * across, p[1] + u[1] * along + v[1] * across,
  ]
  const seg = (a: readonly [number, number], b: readonly [number, number], width: number, dash: number[] = []): void => {
    g.setLineDash(dash)
    g.lineWidth = width
    g.lineCap = 'round'
    g.strokeStyle = C.pencil
    g.beginPath()
    g.moveTo(a[0], a[1])
    g.lineTo(b[0], b[1])
    g.stroke()
    g.setLineDash([])
  }
  const head = (tip: readonly [number, number]): void => {
    const a = off(tip, -M.head, M.head / 2)
    const b = off(tip, -M.head, -M.head / 2)
    g.fillStyle = C.pencil
    g.beginPath()
    g.moveTo(tip[0], tip[1])
    g.lineTo(a[0], a[1])
    g.lineTo(b[0], b[1])
    g.closePath()
    g.fill()
  }
  seg(from, strike, L.path)
  if (!path.end) {
    head(strike)
    seg(off(strike, 0, M.bar), off(strike, 0, -M.bar), L.mark)
    return
  }
  const end = at(path.end)
  const last = path.beyond ? at(path.beyond) : end
  seg(strike, last, L.path, [12, 10])
  for (const each of path.reached) {
    const [cx, cy] = at(each)
    g.beginPath()
    g.arc(cx, cy, M.ring, 0, Math.PI * 2)
    g.fillStyle = C.paper
    g.fill()
    g.lineWidth = L.thin * 2
    g.strokeStyle = C.pencil
    g.stroke()
  }
  if (path.beyond) head(last)
  else {
    seg(off(end, -M.cross, -M.cross), off(end, M.cross, M.cross), L.mark)
    seg(off(end, -M.cross, M.cross), off(end, M.cross, -M.cross), L.mark)
  }
}

/** Waits for the card's fonts, where the browser can say when they are ready. */
async function fontsReady(): Promise<void> {
  const F = CARD.font
  try {
    await Promise.all([
      document.fonts.load(`700 ${CARD.name.px}px ${F.head}`),
      document.fonts.load(`600 ${CARD.kind.px}px ${F.head}`),
      document.fonts.load(`400 ${CARD.caption.px}px ${F.ui}`),
      document.fonts.load(`600 ${CARD.caption.px}px ${F.ui}`),
      document.fonts.load(`500 ${CARD.subject.px}px ${F.mono}`),
      document.fonts.load(`500 ${CARD.credit.px}px ${F.studio}`),
    ])
  } catch {
    // The card is still drawn, in whatever fonts the device has.
  }
}

/** Draws the card. Null when the device will not give a canvas to draw on. */
export async function drawCard(facts: CardFacts, sheet: StatSheet, spec: VehicleSpec): Promise<HTMLCanvasElement | null> {
  await fontsReady()
  const C = CARD.colour
  const F = CARD.font
  const canvas = document.createElement('canvas')
  canvas.width = CARD.width
  canvas.height = CARD.height
  const g = canvas.getContext('2d')
  if (!g) return null
  const left = CARD.pad
  const right = CARD.width - CARD.pad
  const wide = right - left
  const measure = (text: string): number => g.measureText(text).width

  g.fillStyle = C.paper
  g.fillRect(0, 0, CARD.width, CARD.height)
  g.strokeStyle = C.ink
  g.lineWidth = 4
  g.strokeRect(20, 20, CARD.width - 40, CARD.height - 40)
  g.textBaseline = 'alphabetic'

  // The game, and what this is.
  g.fillStyle = C.ink
  g.font = `700 ${CARD.title.px}px ${F.head}`
  let x = left
  for (const letter of STRINGS.title.toUpperCase()) {
    g.fillText(letter, x, CARD.title.y)
    x += measure(letter) + CARD.title.spacing
  }
  g.textAlign = 'right'
  g.fillStyle = C.inkDim
  g.font = `600 ${CARD.kind.px}px ${F.head}`
  g.fillText(S.kind.toUpperCase(), right, CARD.kind.y)
  g.textAlign = 'left'
  g.fillStyle = C.ink
  g.fillRect(left, CARD.rule.y, wide, 3)

  // The design.
  let px: number = CARD.name.px
  do {
    g.font = `700 ${px}px ${F.head}`
    px -= 2
  } while (measure(facts.name) > wide && px >= CARD.name.minPx)
  g.fillText(wrapText(facts.name, wide, measure, 1)[0] ?? '', left, CARD.name.y)
  g.fillStyle = C.inkDim
  g.font = `500 ${CARD.subject.px}px ${F.mono}`
  g.fillText(wrapText(facts.subject, wide, measure, 1)[0] ?? '', left, CARD.subject.y)

  // The stamp. The tick or cross is part of its words, so it does not rest on colour.
  const stamp = CARD.stamp
  g.font = `700 ${stamp.px}px ${F.head}`
  const words = facts.stamp.toUpperCase()
  const stampW = measure(words) + stamp.padX * 2
  g.save()
  g.translate(left + stampW / 2, stamp.y + stamp.height / 2)
  g.rotate((stamp.tiltDeg * Math.PI) / 180)
  g.strokeStyle = g.fillStyle = facts.passed ? C.stamp : C.pencil
  g.lineWidth = 4
  g.strokeRect(-stampW / 2, -stamp.height / 2, stampW, stamp.height)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(words, 0, 2)
  g.restore()
  g.textAlign = 'right'
  g.fillStyle = C.ink
  g.font = `500 ${CARD.tally.px}px ${F.mono}`
  g.fillText(wrapText(facts.tally, wide - stampW - 24, measure, 1)[0] ?? '', right, CARD.tally.y)
  g.textAlign = 'left'

  // The picture, on squared paper.
  const P = CARD.picture
  g.save()
  g.beginPath()
  g.rect(left, P.y, wide, P.height)
  g.clip()
  g.strokeStyle = C.grid
  g.lineWidth = 1.5
  g.beginPath()
  for (let at = left; at <= right; at += P.gridPx) {
    g.moveTo(at, P.y)
    g.lineTo(at, P.y + P.height)
  }
  for (let at = P.y; at <= P.y + P.height; at += P.gridPx) {
    g.moveTo(left, at)
    g.lineTo(right, at)
  }
  g.stroke()
  if (facts.shown) {
    const view = viewOf(facts.shown.shot.hit)
    drawPicture(g, drawingOf(spec, sheet.geometry, view, sheet.interior), facts.shown, view,
      left + P.inset, P.y + P.inset, wide - 2 * P.inset, P.height - 2 * P.inset)
  }
  g.restore()
  g.strokeStyle = C.ink
  g.lineWidth = 3
  g.strokeRect(left, P.y, wide, P.height)

  const cap = CARD.caption
  g.fillStyle = C.ink
  g.font = `600 ${cap.px}px ${F.ui}`
  wrapText(facts.caption, wide, measure, cap.lines).forEach((line, n) => g.fillText(line, left, cap.y + n * cap.lineHeight))

  // What decided it. The text shrinks until all of it fits above the credit.
  const D = CARD.decided
  g.font = `700 ${D.px}px ${F.head}`
  g.fillText(S.decided.toUpperCase(), left, D.y)
  let size: number = D.textPx
  let blocks: string[][] = []
  const tall = (): number => blocks.reduce((sum, lines) => sum + lines.length * size * D.lineHeight, 0) + D.gap * Math.max(0, blocks.length - 1)
  for (;;) {
    g.font = `400 ${size}px ${F.ui}`
    blocks = facts.findings.map((text) => wrapText(text, wide - D.indent, measure))
    if (D.textY + tall() - size * D.lineHeight <= D.bottom || size <= D.minPx) break
    size -= 1
  }
  let y: number = D.textY
  blocks.forEach((lines, n) => {
    g.font = `500 ${size}px ${F.mono}`
    g.fillStyle = C.pencil
    g.fillText(`${n + 1}.`, left, y)
    g.font = `400 ${size}px ${F.ui}`
    g.fillStyle = C.ink
    for (const line of lines) {
      if (y <= D.bottom) g.fillText(line, left + D.indent, y)
      y += size * D.lineHeight
    }
    y += D.gap
  })

  // The studio's line.
  g.textAlign = 'center'
  g.fillStyle = C.inkDim
  g.font = `500 ${CARD.credit.px}px ${F.studio}`
  g.fillText(`${STRINGS.credit} · ${S.site}`, CARD.width / 2, CARD.credit.y)
  g.textAlign = 'left'
  return canvas
}

/** The button that makes the card, and the place it shows: the picture, then Share and Save. */
export function shareBlock(make: () => { facts: CardFacts; sheet: StatSheet; spec: VehicleSpec }): HTMLElement {
  const box = el('div', 'sc')
  const button = el('button', 'btn sc-make', S.make)
  button.type = 'button'
  button.dataset.key = 'share-make'
  const slot = el('div', 'sc-slot')
  const status = el('p', 'ctl-note sc-status')
  status.setAttribute('role', 'status')
  box.append(el('h4', 'rg-sub', S.title), el('p', 'ctl-note', S.about), button, slot, status)

  let url = ''
  button.addEventListener('click', () => {
    button.disabled = true
    status.textContent = ''
    const { facts, sheet, spec } = make()
    void (async () => {
      const canvas = await drawCard(facts, sheet, spec)
      const blob = canvas ? await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png')) : null
      button.disabled = false
      if (!blob) {
        status.textContent = S.failedToMake
        return
      }
      if (url) URL.revokeObjectURL(url)
      url = URL.createObjectURL(blob)
      const name = cardFileName(facts.name)
      const file = new File([blob], name, { type: 'image/png' })
      const image = el('img', 'sc-img')
      image.src = url
      image.alt = fill(S.alt, { name: facts.name, stamp: facts.stamp.replace(/^[✓✗]\s*/, ''), tally: facts.tally })
      const row = el('div', 'sc-buttons')
      // The share sheet, where the device will take a picture file.
      let canShare: boolean
      try {
        canShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
      } catch {
        canShare = false
      }
      if (canShare) {
        const share = el('button', 'btn sc-share', S.share)
        share.type = 'button'
        share.dataset.key = 'share-send'
        share.addEventListener('click', () => {
          navigator.share({ files: [file], title: fill(S.shareTitle, { name: facts.name }) }).then(
            () => { status.textContent = S.shared },
            () => { /* The player closed the sheet. */ },
          )
        })
        row.append(share)
      }
      const save = el('a', 'btn sc-save', S.save)
      save.href = url
      save.download = name
      save.dataset.key = 'share-save'
      save.addEventListener('click', () => { status.textContent = S.saved })
      row.append(save)
      slot.replaceChildren(image, row)
    })()
  })
  return box
}
