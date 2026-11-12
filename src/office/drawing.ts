// The blueprint as plain data: for each view, the lines to draw and the tap
// zones that lead to a control. No DOM in here, so it can be tested.
// Coordinates are metres, already flipped for SVG (up is negative y).
import { DRAWING } from '../data/drawing'
import type { ZoneId } from '../data/materials'
import { BARRELS, GUNS, HULLS, TURRETS } from '../data/parts'
import { TUNING } from '../data/tuning'
import { frameOf, type Geometry, type Interior, type ItemKind, type VehicleSpec } from '../sim/vehicle'
import type { ControlId } from './controls'

export const VIEWS = ['side', 'top', 'front'] as const
export type View = (typeof VIEWS)[number]

/** Line styles, in the manner of a technical drawing. */
export type LineStyle = 'solid' | 'thin' | 'fine' | 'hidden' | 'centre' | 'ground' | 'face' | 'item'

/** How the things inside are told apart on the cutaway. Each has its own mark, so none relies on colour. */
export const CUT_KINDS = ['crew', 'ammo', 'fuel', 'drive', 'gun'] as const
export type CutKind = (typeof CUT_KINDS)[number]

const CUT_KIND: Record<ItemKind, CutKind> = {
  crew: 'crew', ammo: 'ammo', autoloader: 'ammo', fuel: 'fuel', engine: 'drive', transmission: 'drive', gun: 'gun', sight: 'gun',
}

export interface Shape {
  /** SVG path data. */
  d: string
  line: LineStyle
  /**
   * Set on a face: the armour zone this patch of the drawing shows square on.
   * Faces sit in drawing order, so whatever is drawn in front still covers them.
   */
  zone?: ZoneId
  /** Set on something inside the tank, drawn only on the cutaway. */
  item?: CutKind
}

export interface Zone {
  x: number
  y: number
  w: number
  h: number
  /** The control a tap on this zone opens. */
  go: ControlId
}

/** A tap zone used while the armour is being worked on: it picks an armour zone. */
export interface ArmourTap {
  x: number
  y: number
  w: number
  h: number
  zone: ZoneId
}

/** The view that shows each armour zone square on. The rear and the belly are on none of them. */
export const ZONE_VIEW: Partial<Record<ZoneId, View>> = {
  upperGlacis: 'front',
  lowerGlacis: 'front',
  turretFrontLeft: 'front',
  turretFrontRight: 'front',
  mantlet: 'front',
  hullSideFront: 'side',
  hullSideRear: 'side',
  turretSides: 'side',
  hullRoof: 'top',
  turretRoof: 'top',
}

/** A dimension's figure: where it sits (SVG space), the length it gives in metres, and which way it reads. */
export interface Dimension {
  x: number
  y: number
  m: number
  vertical: boolean
}

export interface Drawing {
  box: { x: number; y: number; w: number; h: number }
  /** The figures on the dimension lines; the lines themselves are among the shapes. */
  dimensions: Dimension[]
  shapes: Shape[]
  zones: Zone[]
  armourTaps: ArmourTap[]
  /** The outline of the armour, as path data. What is inside is only drawn within it. Empty when nothing is. */
  body: string[]
  /** Hull length, length with the gun forward, width and height, for the caption. */
  hullLengthM: number
  overallLengthM: number
  widthM: number
  heightM: number
}

type Point = readonly [number, number]

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Collects shapes and keeps track of how much room they take. */
class Pen {
  readonly shapes: Shape[] = []
  readonly zones: Zone[] = []
  readonly armourTaps: ArmourTap[] = []
  readonly body: string[] = []
  readonly dimensions: Dimension[] = []
  minX = Infinity
  maxX = -Infinity
  minY = Infinity
  maxY = -Infinity

  /** A point in drawing space (y up) as SVG text (y down). */
  p = (x: number, y: number): string => {
    this.minX = Math.min(this.minX, x)
    this.maxX = Math.max(this.maxX, x)
    this.minY = Math.min(this.minY, -y)
    this.maxY = Math.max(this.maxY, -y)
    return `${round(x)} ${round(-y)}`
  }

  path(d: string, line: LineStyle): void {
    this.shapes.push({ d, line })
  }

  poly(points: readonly Point[], line: LineStyle, closed = true): void {
    const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${this.p(x, y)}`).join(' ')
    this.path(closed ? `${d} Z` : d, line)
  }

  rect(x0: number, y0: number, x1: number, y1: number, line: LineStyle): void {
    this.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], line)
  }

  line(x0: number, y0: number, x1: number, y1: number, line: LineStyle): void {
    this.poly([[x0, y0], [x1, y1]], line, false)
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, line: LineStyle): void {
    this.p(cx, cy + ry)
    this.p(cx, cy - ry)
    const left = this.p(cx - rx, cy)
    const right = this.p(cx + rx, cy)
    const r = `${round(rx)} ${round(ry)}`
    this.path(`M${left} A${r} 0 1 0 ${right} A${r} 0 1 0 ${left} Z`, line)
  }

  circle(cx: number, cy: number, radius: number, line: LineStyle): void {
    this.ellipse(cx, cy, radius, radius, line)
  }

  /** A tap zone, given in drawing space (y up). */
  zone(x0: number, y0: number, x1: number, y1: number, go: ControlId): void {
    this.zones.push({ x: round(x0), y: round(-y1), w: round(x1 - x0), h: round(y1 - y0), go })
  }

  /** A patch of armour seen square on, as path data. */
  face(d: string, zone: ZoneId): void {
    this.shapes.push({ d, line: 'face', zone })
  }

  facePoly(points: readonly Point[], zone: ZoneId): void {
    this.face(`${points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${this.p(x, y)}`).join(' ')} Z`, zone)
  }

  /** Something inside the tank, as path data. */
  item(d: string, kind: CutKind): void {
    this.shapes.push({ d, line: 'item', item: kind })
  }

  /** The same as a box, with its marks: a cross for the engine, one stroke for the gearbox. */
  itemRect(x0: number, y0: number, x1: number, y1: number, kind: CutKind, strokes: 0 | 1 | 2 = 0): void {
    const box = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as const
    let d = `${box.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${this.p(x, y)}`).join(' ')} Z`
    if (strokes > 0) d += ` M${this.p(x0, y0)} L${this.p(x1, y1)}`
    if (strokes > 1) d += ` M${this.p(x0, y1)} L${this.p(x1, y0)}`
    this.item(d, kind)
  }

  /** A filled round mark. */
  itemDot(cx: number, cy: number, radius: number, kind: CutKind): void {
    const left = this.p(cx - radius, cy)
    const right = this.p(cx + radius, cy)
    const r = `${round(radius)} ${round(radius)}`
    this.item(`M${left} A${r} 0 1 0 ${right} A${r} 0 1 0 ${left} Z`, kind)
  }

  /**
   * A dimension in the drawing-office way: a line with an arrowhead at each end,
   * short extension lines out to it, and the figure on it. Drawing space (y up).
   * `along` is the line's position across: its height for a level line, its x for an upright one.
   */
  dimension(from: number, to: number, along: number, vertical: boolean, m: number): void {
    const a = DRAWING.dims.arrowM
    const e = DRAWING.dims.extensionM
    const at = (u: number, v: number): string => (vertical ? this.p(v, u) : this.p(u, v))
    let line = `M${at(from, along)} L${at(to, along)}`
    for (const [end, dir] of [[from, 1], [to, -1]] as const) {
      line += ` M${at(end + dir * a, along - a * 0.45)} L${at(end, along)} L${at(end + dir * a, along + a * 0.45)}`
    }
    this.path(line, 'thin')
    const ext = (u: number): string => `M${at(u, along - e)} L${at(u, along + e)}`
    this.path(ext(from) + ' ' + ext(to), 'fine')
    const mid = (from + to) / 2
    const [x, y] = vertical ? [along, mid] : [mid, along]
    this.dimensions.push({ x: round(x), y: round(-y), m, vertical })
  }

  /** A tap zone that picks an armour zone, given in drawing space (y up). */
  armourTap(x0: number, y0: number, x1: number, y1: number, zone: ZoneId): void {
    this.armourTaps.push({ x: round(x0), y: round(-y1), w: round(x1 - x0), h: round(y1 - y0), zone })
  }
}

/** A circle as path data, for joining several into one shape. */
function ring(pen: Pen, cx: number, cy: number, r: number): string {
  pen.p(cx, cy + r)
  pen.p(cx, cy - r)
  const left = pen.p(cx - r, cy)
  const right = pen.p(cx + r, cy)
  const rr = `${round(r)} ${round(r)}`
  return `M${left} A${rr} 0 1 0 ${right} A${rr} 0 1 0 ${left} Z`
}

/** A straight stroke as path data, for joining several into one shape. */
function stroke(pen: Pen, x0: number, y0: number, x1: number, y1: number): string {
  return `M${pen.p(x0, y0)} L${pen.p(x1, y1)}`
}

/** A road wheel: the rim, then the tyre line, hub and bolt circle as one finer shape. */
function roadWheel(pen: Pen, cx: number, cy: number, r: number): void {
  pen.circle(cx, cy, r, 'solid')
  const d = DRAWING.detail
  let inner = ring(pen, cx, cy, r * d.tyreShare) + ring(pen, cx, cy, r * DRAWING.hubShare)
  for (let i = 0; i < d.wheelBolts; i++) {
    const a = (i / d.wheelBolts) * Math.PI * 2
    inner += ring(pen, cx + Math.cos(a) * r * d.boltRingShare, cy + Math.sin(a) * r * d.boltRingShare, r * d.boltShare)
  }
  pen.path(inner, 'thin')
}

/** The drive sprocket: a toothed rim and its hub. */
function sprocket(pen: Pen, cx: number, cy: number, r: number): void {
  const d = DRAWING.detail
  const points: Point[] = []
  for (let i = 0; i < d.sprocketTeeth * 2; i++) {
    const a = (i / (d.sprocketTeeth * 2)) * Math.PI * 2
    const rr = i % 2 === 0 ? r : r * d.toothRootShare
    points.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
  }
  pen.poly(points, 'thin')
  pen.path(ring(pen, cx, cy, r * 0.42) + ring(pen, cx, cy, r * 0.16), 'fine')
}

/** The idler: a plain wheel with spokes. */
function idler(pen: Pen, cx: number, cy: number, r: number): void {
  const d = DRAWING.detail
  let spokes = ''
  for (let i = 0; i < d.idlerSpokes; i++) {
    const a = (i / d.idlerSpokes) * Math.PI * 2 + 0.3
    spokes += stroke(pen, cx + Math.cos(a) * r * 0.22, cy + Math.sin(a) * r * 0.22, cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78)
  }
  pen.path(ring(pen, cx, cy, r) + ring(pen, cx, cy, r * 0.8) + ring(pen, cx, cy, r * 0.22), 'thin')
  pen.path(spokes, 'fine')
}

/** A closed outline through the points, as path data. */
function outline(pen: Pen, points: readonly Point[]): string {
  return `${points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${pen.p(x, y)}`).join(' ')} Z`
}

/** The measurements every view shares, with what only a drawing needs. The 3D range builds its tank from the same ones. */
export function layout(spec: VehicleSpec, geo: Geometry) {
  const frame = frameOf(spec, geo)
  const calibre = GUNS[spec.gun].calibreMm / 1000
  const barrel = calibre * BARRELS[spec.barrel].calibres
  return {
    ...frame,
    hull: HULLS[spec.hull.size],
    calibre,
    muzzleX: frame.gunRootX - barrel,
    barrelHalf: (calibre * DRAWING.barrelThicknessCalibres) / 2,
    extractorX: frame.gunRootX - barrel * DRAWING.extractorAt,
    extractorHalf: (calibre * DRAWING.extractorThicknessCalibres) / 2,
  }
}

export type Layout = ReturnType<typeof layout>

/** The barrel runs along x. `axis` is its height (side view) or its offset from the centre line (top view). */
function barrel(pen: Pen, m: Layout, axis: number): void {
  const d = DRAWING.detail
  pen.rect(m.muzzleX, axis - m.barrelHalf, m.gunRootX, axis + m.barrelHalf, 'solid')
  pen.rect(m.extractorX - DRAWING.extractorLengthM, axis - m.extractorHalf, m.extractorX, axis + m.extractorHalf, 'solid')
  // The muzzle reference ring and the bands of the thermal sleeve.
  const ring = m.barrelHalf * d.muzzleRingShare
  pen.rect(m.muzzleX, axis - ring, m.muzzleX + d.muzzleRingM, axis + ring, 'thin')
  let bands = ''
  const from = m.muzzleX + d.muzzleRingM + d.sleeveBandM
  for (let x = from; x < m.gunRootX - d.sleeveBandM; x += d.sleeveBandM) {
    if (x > m.extractorX - DRAWING.extractorLengthM - 0.02 && x < m.extractorX + 0.02) continue
    bands += stroke(pen, x, axis - m.barrelHalf, x, axis + m.barrelHalf)
  }
  if (bands) pen.path(bands, 'fine')
  pen.line(m.muzzleX - 0.15, axis, m.gunRootX, axis, 'centre')
}

/** Is the engine, and so the drive sprocket, at the front? */
function engineFirstSide(spec: VehicleSpec): boolean {
  return spec.hull.engineAt === 'front'
}

function sideView(pen: Pen, spec: VehicleSpec, geo: Geometry, m: Layout): void {
  const { length: L, roof, belly, top, turretX: xc, radius: R } = m
  const h = geo.turretHeightM
  pen.line(m.muzzleX - DRAWING.marginM, 0, L + DRAWING.marginM, 0, 'ground')

  // Hull: nose, upper glacis up to the roof, rear plate, belly, lower glacis.
  const hullLine: readonly Point[] = [
    [0, belly + m.lowerH], [m.upperRun, roof], [L, roof], [L - DRAWING.rearUndercutM, belly], [m.lowerRun, belly],
  ]
  pen.poly(hullLine, 'solid')
  pen.body.push(outline(pen, hullLine))
  // The hull side is two armour zones, split half way along.
  const mid = L / 2
  pen.facePoly([[0, belly + m.lowerH], [m.upperRun, roof], [mid, roof], [mid, belly], [m.lowerRun, belly]], 'hullSideFront')
  pen.facePoly([[mid, roof], [L, roof], [L - DRAWING.rearUndercutM, belly], [mid, belly]], 'hullSideRear')
  pen.rect(m.bayStart, belly + 0.08, m.bayEnd - DRAWING.rearUndercutM, roof - 0.08, 'hidden')

  // Gun first, so the turret covers its root.
  barrel(pen, m, m.gunY)

  // Turret, by shape. Its side is one armour zone.
  const p = pen.p
  let turret: string
  switch (spec.turret.shape) {
    case 'castDome':
    case 'lowProfile':
      turret =
        `M${p(xc - R, roof)} Q${p(xc - R * 0.92, top)} ${p(xc - R * 0.25, top)} L${p(xc + R * 0.35, top)} ` +
        `Q${p(xc + R * 0.97, top)} ${p(xc + R, roof)} Z`
      break
    case 'weldedWedge':
      turret = outline(pen, [
        [xc - R, roof], [xc - R * 0.8, roof + h * 0.55], [xc - R * 0.25, top], [xc + R * 0.7, top],
        [xc + R, roof + h * 0.5], [xc + R, roof],
      ])
      break
    case 'bustle':
      turret = outline(pen, [
        [xc - R, roof], [xc - R * 0.82, roof + h * 0.6], [xc - R * 0.3, top], [xc + R + m.bustle, top],
        [xc + R + m.bustle, m.bustleFloor], [xc + R * 0.92, m.bustleFloor], [xc + R * 0.92, roof],
      ])
      break
    case 'unmanned':
      // A low box on the ring, cut back at the front.
      turret = outline(pen, [
        [xc - R, roof], [xc - R * 0.85, roof + h * 0.7], [xc - R * 0.5, top], [xc + R * 0.8, top], [xc + R, roof + h * 0.6], [xc + R, roof],
      ])
      break
    case 'casemate':
      // No turret: a low box built onto the hull, its front plate laid well back.
      turret = outline(pen, [[xc - R, roof], [xc - R * 0.35, top], [xc + R, top], [xc + R, roof]])
      break
  }
  pen.path(turret, 'solid')
  pen.body.push(turret)
  pen.face(turret, 'turretSides')
  // Mantlet, commander's hatch, and the sight head if one is fitted.
  pen.rect(m.gunRootX - 0.05, m.gunY - h * 0.25, m.gunRootX + 0.22, m.gunY + h * 0.25, 'thin')
  const hatchX = xc + R * 0.3
  // A turret with nobody in it has no hatch: the sight head sits straight on its roof.
  const cupola = TURRETS[spec.turret.shape].crewed ? DRAWING.cupolaHeightM : 0
  if (cupola > 0) pen.rect(hatchX - DRAWING.hatchRadiusM, top, hatchX + DRAWING.hatchRadiusM, top + cupola, 'solid')
  if (spec.fireControl.commanderSight) {
    const s = DRAWING.sightHeadM
    pen.rect(hatchX - s.width / 2, top + cupola, hatchX + s.width / 2, top + cupola + s.height, 'solid')
  }
  if (spec.protection.smokeLaunchers) {
    for (let i = 0; i < 3; i++) {
      const x = xc - R * 0.55 + i * 0.16
      pen.poly([[x, roof + h * 0.35], [x - 0.1, roof + h * 0.62], [x - 0.02, roof + h * 0.66], [x + 0.08, roof + h * 0.39]], 'thin')
    }
  }

  // Running gear in front of the hull.
  const x0 = DRAWING.trackInsetFrontM
  const x1 = L - DRAWING.trackInsetRearM
  const c = DRAWING.trackCornerM
  const contact = geo.trackContactM
  const start = (L - contact) / 2
  pen.poly([
    [start, 0], [start + contact, 0], [x1, c], [x1, m.trackTop - c * 0.4], [x1 - c * 0.5, m.trackTop],
    [x0 + c * 0.5, m.trackTop], [x0, m.trackTop - c * 0.4], [x0, c],
  ], 'solid')
  const wheels = spec.runningGear.roadWheels
  const pitch = contact / wheels
  const wheelR = Math.min(DRAWING.roadWheelMaxRadiusM, (pitch / 2) * DRAWING.wheelFill)
  const t = DRAWING.trackThicknessM
  const d = DRAWING.detail
  // Behind side skirts the wheels are hidden: each is a plain dashed ring, and the top run's links are left out.
  const skirted = spec.runningGear.skirts
  // Track links: the inner face of the track and a tick at every link, on both runs.
  let links = stroke(pen, start, t, start + contact, t)
  for (let x = start + d.linkM / 2; x < start + contact; x += d.linkM) links += stroke(pen, x, 0, x, t)
  if (!skirted) {
    links += stroke(pen, x0 + c * 0.5, m.trackTop - t, x1 - c * 0.5, m.trackTop - t)
    for (let x = x0 + c * 0.5 + d.linkM / 2; x < x1 - c * 0.5; x += d.linkM) links += stroke(pen, x, m.trackTop - t, x, m.trackTop)
  }
  pen.path(links, 'fine')
  const endR = (m.trackTop - c) * 0.5
  const endY = m.trackTop - endR - t
  const front = x0 + endR + 0.08
  const back = x1 - endR - 0.08
  const rollerX = (i: number): number => start + pitch * 0.5 + ((contact - pitch) * (i + 0.5)) / d.returnRollers
  if (skirted) {
    let hidden = ''
    for (let i = 0; i < wheels; i++) hidden += ring(pen, start + pitch * (i + 0.5), wheelR + t, wheelR)
    for (let i = 0; i < d.returnRollers; i++) hidden += ring(pen, rollerX(i), m.trackTop - t - d.rollerR, d.rollerR)
    hidden += ring(pen, front, endY, endR) + ring(pen, back, endY, endR)
    pen.path(hidden, 'hidden')
  } else {
    for (let i = 0; i < wheels; i++) roadWheel(pen, start + pitch * (i + 0.5), wheelR + t, wheelR)
    // Return rollers under the top run, between the first and last wheels.
    let rollers = ''
    for (let i = 0; i < d.returnRollers; i++) rollers += ring(pen, rollerX(i), m.trackTop - t - d.rollerR, d.rollerR)
    pen.path(rollers, 'thin')
    // The drive sprocket sits at the engine's end, the idler at the other.
    if (engineFirstSide(spec)) {
      sprocket(pen, front, endY, endR)
      idler(pen, back, endY, endR)
    } else {
      idler(pen, front, endY, endR)
      sprocket(pen, back, endY, endR)
    }
  }

  // Hull fittings: the track guard, the engine grille, tow hooks and a weld seam.
  const fender = m.trackTop + d.fenderGapM
  if (skirted) {
    // The skirt plates, hung from the track guard the length of the track, each with its bolts.
    const s = d.skirts
    const plates = Math.max(1, Math.ceil((x1 - x0) / s.plateM))
    const each = (x1 - x0) / plates
    const bottom = m.trackTop * s.bottomShare
    let bolts = ''
    for (let i = 0; i < plates; i++) {
      const a = x0 + i * each + s.gapM / 2
      const b = a + each - s.gapM
      pen.rect(a, bottom, b, fender, 'solid')
      for (let k = 0; k < s.bolts; k++) bolts += ring(pen, a + ((b - a) * (k + 0.5)) / s.bolts, fender - s.boltDownM, s.boltR)
    }
    pen.path(bolts, 'fine')
  }
  const noseY = belly + m.lowerH
  const glacisAt = (y: number): number => ((y - noseY) / (roof - noseY)) * m.upperRun
  pen.line(Math.max(glacisAt(fender), 0), fender, L - 0.02, fender, 'thin')
  let seams = stroke(pen, glacisAt(roof - d.seamM), roof - d.seamM, L - 0.03, roof - d.seamM)
  const grilleTop = roof - 0.1
  const grilleBottom = fender + 0.06
  for (let x = m.bayStart + 0.15; x < m.bayEnd - DRAWING.rearUndercutM - 0.2; x += d.louvreM) {
    seams += stroke(pen, x, grilleBottom, x + 0.06, grilleTop)
  }
  pen.path(seams, 'fine')
  pen.poly([[0.02, noseY - 0.03], [-0.07, noseY - 0.06], [-0.07, noseY - 0.13], [0.04, noseY - 0.13]], 'thin')
  pen.poly([[L - DRAWING.rearUndercutM * 0.5, belly + 0.12], [L + 0.04, belly + 0.1], [L + 0.04, belly + 0.03], [L - DRAWING.rearUndercutM * 0.7, belly + 0.03]], 'thin')

  // Turret fittings: periscopes on the roof, a stowage basket at the back, the casting line.
  let fittings = stroke(pen, xc - R * 0.9, roof + h * d.castLineShare, xc + R * 0.9, roof + h * d.castLineShare)
  for (const at of [-0.05, 0.12]) {
    const px = xc + R * at
    fittings += `M${pen.p(px - 0.05, top)} L${pen.p(px - 0.035, top + 0.07)} L${pen.p(px + 0.035, top + 0.07)} L${pen.p(px + 0.05, top)}`
  }
  pen.path(fittings, 'fine')
  if (spec.turret.shape !== 'bustle' && spec.turret.shape !== 'unmanned' && spec.turret.shape !== 'casemate') {
    const b0 = xc + R * 0.98
    const b1 = b0 + d.basketM
    const y0 = roof + h * 0.18
    const y1 = roof + h * 0.55
    pen.rect(b0, y0, b1, y1, 'thin')
    let mesh = ''
    for (let x = b0 + 0.07; x < b1 - 0.02; x += 0.07) mesh += stroke(pen, x, y0, x, y1)
    pen.path(mesh, 'fine')
  }

  pen.line(xc, -0.1, xc, top + DRAWING.cupolaHeightM + 0.35, 'centre')

  // Dimensions: the hull, the length with the gun, and the height.
  const D = DRAWING.dims
  pen.dimension(0, L, -D.firstM, false, L)
  if (m.muzzleX < 0) pen.dimension(m.muzzleX, L, -D.secondM, false, L - m.muzzleX)
  pen.dimension(0, geo.heightM, L + D.besideM, true, geo.heightM)

  // Tap zones. Upper band: gun, then turret. Lower band: front, middle, rear.
  const sky = top + DRAWING.tapSkyM
  const ground = -DRAWING.tapGroundM
  const rear = L + DRAWING.marginM
  pen.zone(m.muzzleX - DRAWING.marginM, roof, xc - R, sky, 'gun')
  pen.zone(xc - R, roof, rear, sky, 'turret.shape')
  const third = L / 3
  const engineFirst = spec.hull.engineAt === 'front'
  pen.zone(m.muzzleX - DRAWING.marginM, ground, third, roof, 'hull.glacisAngleDeg')
  pen.zone(third, ground, 2 * third, roof, 'runningGear.roadWheels')
  pen.zone(2 * third, ground, rear, roof, engineFirst ? 'hull.engineAt' : 'powerpack.engine')

  pen.armourTap(m.muzzleX - DRAWING.marginM, roof, rear, sky, 'turretSides')
  pen.armourTap(m.muzzleX - DRAWING.marginM, ground, mid, roof, 'hullSideFront')
  pen.armourTap(mid, ground, rear, roof, 'hullSideRear')
}

function topView(pen: Pen, spec: VehicleSpec, m: Layout): void {
  const { length: L, turretX: xc, radius: R, halfWidth: W } = m
  const bodyHalf = m.hull.bodyWidthM / 2

  // Deck outline, with the tracks under the fenders shown as hidden lines.
  pen.rect(0, -W, L, W, 'solid')
  pen.facePoly([[m.upperRun, -bodyHalf], [L, -bodyHalf], [L, bodyHalf], [m.upperRun, bodyHalf]], 'hullRoof')
  pen.line(DRAWING.trackInsetFrontM, W - m.trackWidth, L - DRAWING.trackInsetRearM, W - m.trackWidth, 'hidden')
  pen.line(DRAWING.trackInsetFrontM, -(W - m.trackWidth), L - DRAWING.trackInsetRearM, -(W - m.trackWidth), 'hidden')
  pen.line(m.upperRun, -bodyHalf, m.upperRun, bodyHalf, 'thin')
  if (spec.runningGear.skirts) {
    // Side skirts, seen from above: a thin plate along each side, outside the deck.
    const s = DRAWING.detail.skirts
    for (const side of [-1, 1]) {
      pen.rect(DRAWING.trackInsetFrontM, side * (W + s.outM), L - DRAWING.trackInsetRearM, side * (W + s.outM + s.thickM), 'thin')
    }
  }

  // Engine deck louvres, and the driver's hatch beside or ahead of them.
  const bayHalf = bodyHalf * 0.8
  const frontEngine = spec.hull.engineAt === 'front'
  const bayLow = frontEngine ? 0.1 : -bayHalf
  const bayEnd = m.bayEnd - DRAWING.rearUndercutM
  pen.rect(m.bayStart, bayLow, bayEnd, bayHalf, 'thin')
  const louvres = 5
  for (let i = 1; i < louvres; i++) {
    const x = m.bayStart + ((bayEnd - m.bayStart) * i) / louvres
    pen.line(x, bayLow, x, bayHalf, 'thin')
  }
  topDetail(pen, spec, m, bayLow, bayHalf, bayEnd)
  const driverX = Math.min(m.upperRun + 0.45, xc - R - 0.35)
  pen.circle(driverX, frontEngine ? -bodyHalf * 0.5 : 0, DRAWING.hatchRadiusM, 'thin')

  barrel(pen, m, 0)

  // Turret outline, by shape, then the ring under it and the hatches on it.
  // Its roof is one armour zone.
  const before = pen.shapes.length
  switch (spec.turret.shape) {
    case 'castDome':
      pen.circle(xc, 0, R, 'solid')
      break
    case 'lowProfile':
      pen.ellipse(xc, 0, R, R * 0.9, 'solid')
      break
    case 'weldedWedge':
      pen.poly([
        [xc - R, -R * 0.45], [xc - R * 0.3, -R], [xc + R * 0.7, -R], [xc + R, -R * 0.6],
        [xc + R, R * 0.6], [xc + R * 0.7, R], [xc - R * 0.3, R], [xc - R, R * 0.45],
      ], 'solid')
      break
    case 'bustle':
      pen.poly([
        [xc - R, -R * 0.45], [xc - R * 0.3, -R], [xc + R * 0.6, -R], [xc + R * 0.9, -R * 0.72],
        [xc + R + m.bustle, -R * 0.72], [xc + R + m.bustle, R * 0.72], [xc + R * 0.9, R * 0.72],
        [xc + R * 0.6, R], [xc - R * 0.3, R], [xc - R, R * 0.45],
      ], 'solid')
      break
    case 'unmanned':
      // Narrow: only as wide as the gun and its loader need.
      pen.poly([
        [xc - R, -R * 0.4], [xc - R * 0.5, -R * 0.65], [xc + R * 0.8, -R * 0.65], [xc + R, -R * 0.45],
        [xc + R, R * 0.45], [xc + R * 0.8, R * 0.65], [xc - R * 0.5, R * 0.65], [xc - R, R * 0.4],
      ], 'solid')
      break
    case 'casemate':
      // Square on the hull, the front corners cut.
      pen.poly([
        [xc - R, -R * 0.75], [xc - R * 0.8, -R * 0.95], [xc + R, -R * 0.95],
        [xc + R, R * 0.95], [xc - R * 0.8, R * 0.95], [xc - R, R * 0.75],
      ], 'solid')
      break
  }
  const turret = pen.shapes[before]
  if (turret) pen.face(turret.d, 'turretRoof')
  // A casemate has no ring: the gun's mount is in its front plate.
  if (TURRETS[spec.turret.shape].swingDeg === null) pen.circle(xc, 0, spec.turret.ringMm / 2000, 'hidden')
  // The tank faces left, so its right-hand side is up the page. The commander sits on the right.
  const commanderY = R * 0.42
  if (TURRETS[spec.turret.shape].crewed) {
    pen.circle(xc + R * 0.3, commanderY, DRAWING.hatchRadiusM, 'thin')
    if (m.hasLoader) pen.circle(xc + R * 0.3, -commanderY, DRAWING.hatchRadiusM, 'thin')
  } else {
    // Nobody in the turret: the gunner's and commander's hatches are in the hull roof, either side of the driver's.
    for (const side of [-1, 1]) pen.circle(driverX + 0.1, side * bodyHalf * 0.62, DRAWING.hatchRadiusM, 'thin')
  }
  if (spec.fireControl.commanderSight) {
    const s = DRAWING.sightHeadM.width / 2
    pen.rect(xc + R * 0.3 - s, commanderY - s, xc + R * 0.3 + s, commanderY + s, 'thin')
  }

  pen.line(m.muzzleX - 0.15, 0, L + 0.15, 0, 'centre')

  // Dimensions: the hull's length below, its width at the back.
  pen.dimension(0, L, -(W + DRAWING.dims.besideM), false, L)
  pen.dimension(-W, W, L + DRAWING.dims.besideM, true, 2 * W)

  // Tap zones: four columns, full height.
  const edge = W + DRAWING.marginM
  pen.zone(m.muzzleX - DRAWING.marginM, -edge, 0, edge, 'gun')
  pen.zone(0, -edge, xc - R, edge, 'hull.size')
  pen.zone(xc - R, -edge, xc + R, edge, 'turret.ringMm')
  pen.zone(xc + R, -edge, L + DRAWING.marginM, edge, frontEngine ? 'hull.engineAt' : 'powerpack.engine')

  pen.armourTap(m.muzzleX - DRAWING.marginM, -edge, xc - R, edge, 'hullRoof')
  pen.armourTap(xc - R, -edge, xc + R, edge, 'turretRoof')
  pen.armourTap(xc + R, -edge, L + DRAWING.marginM, edge, 'hullRoof')
}

/** The finer parts of the top view: grille slats, fans, track guards and their bins, lights and the turret's fittings. */
function topDetail(pen: Pen, spec: VehicleSpec, m: Layout, bayLow: number, bayHigh: number, bayEnd: number): void {
  const { length: L, turretX: xc, radius: R, halfWidth: W } = m
  const d = DRAWING.detail
  const tp = DRAWING.top
  const t = m.trackWidth
  // Grille slats across the engine deck, between the louvre frames.
  let deck = ''
  for (let y = bayLow + d.louvreM; y < bayHigh - 0.02; y += d.louvreM) deck += stroke(pen, m.bayStart, y, bayEnd, y)
  // Track guards: the plate seams along each guard.
  for (const side of [-1, 1]) {
    for (let x = tp.guardSeamM; x < L - 0.1; x += tp.guardSeamM) deck += stroke(pen, x, side * W, x, side * (W - t))
  }
  pen.path(deck, 'fine')
  // Cooling fans in the engine deck.
  const fanX = (m.bayStart + bayEnd) / 2
  const fanY = (bayLow + bayHigh) / 2
  const fanR = Math.min((bayHigh - bayLow) * 0.22, (bayEnd - m.bayStart) * 0.18)
  pen.path(ring(pen, fanX - fanR * 1.25, fanY, fanR) + ring(pen, fanX + fanR * 1.25, fanY, fanR), 'thin')
  // Stowage bins on the guards, ahead of and behind the turret.
  for (const side of [-1, 1]) {
    const y0 = side * (W - t * 0.12)
    const y1 = side * (W - t * 0.88)
    pen.rect(xc + R + 0.15, Math.min(y0, y1), xc + R + 0.15 + tp.binM, Math.max(y0, y1), 'thin')
    pen.rect(m.upperRun + 0.1, Math.min(y0, y1), m.upperRun + 0.1 + tp.binM * 0.7, Math.max(y0, y1), 'thin')
  }
  // Headlights and tow hooks at the nose.
  for (const side of [-1, 1]) {
    const y = side * (W - t * 0.5)
    pen.rect(0.04, y - 0.07, 0.16, y + 0.07, 'thin')
    pen.poly([[0, side * W * 0.45 - 0.06], [-0.09, side * W * 0.45 - 0.04], [-0.09, side * W * 0.45 + 0.04], [0, side * W * 0.45 + 0.06]], 'thin')
  }
  // Turret roof: periscopes ahead of the hatches, a vent, and the basket at the back.
  let roof = ''
  for (const y of [-0.18, 0.18]) {
    const x = xc - R * 0.35
    roof += `M${pen.p(x - 0.05, y - 0.08)} L${pen.p(x + 0.05, y - 0.08)} L${pen.p(x + 0.05, y + 0.08)} L${pen.p(x - 0.05, y + 0.08)} Z`
  }
  pen.path(roof, 'thin')
  pen.circle(xc + R * 0.05, -R * 0.55, tp.ventR, 'thin')
  if (spec.turret.shape !== 'bustle' && spec.turret.shape !== 'unmanned' && spec.turret.shape !== 'casemate') {
    const b0 = xc + R * 0.9
    const b1 = b0 + d.basketM
    const half = R * 0.62
    pen.rect(b0, -half, b1, half, 'thin')
    let mesh = ''
    for (let x = b0 + 0.08; x < b1 - 0.02; x += 0.08) mesh += stroke(pen, x, -half, x, half)
    pen.path(mesh, 'fine')
  }
}

function frontView(pen: Pen, spec: VehicleSpec, geo: Geometry, m: Layout): void {
  const { roof, belly, top, radius: R, halfWidth: W } = m
  const bodyHalf = m.hull.bodyWidthM / 2
  const fender = m.trackTop + 0.04
  pen.line(-W - DRAWING.marginM, 0, W + DRAWING.marginM, 0, 'ground')

  // Lower hull between the tracks, upper hull over them, and the glacis break.
  pen.rect(-bodyHalf, belly, bodyHalf, fender, 'solid')
  pen.rect(-W + 0.03, fender, W - 0.03, roof, 'solid')
  pen.facePoly([[-bodyHalf, belly], [bodyHalf, belly], [bodyHalf, belly + m.lowerH], [-bodyHalf, belly + m.lowerH]], 'lowerGlacis')
  pen.facePoly([[-bodyHalf, belly + m.lowerH], [bodyHalf, belly + m.lowerH], [bodyHalf, roof], [-bodyHalf, roof]], 'upperGlacis')
  pen.line(-bodyHalf, belly + m.lowerH, bodyHalf, belly + m.lowerH, 'thin')
  pen.rect(-W, 0, -W + m.trackWidth, m.trackTop, 'solid')
  pen.rect(W - m.trackWidth, 0, W, m.trackTop, 'solid')
  if (spec.runningGear.skirts) {
    // Side skirts, end on: a thin plate outside each track.
    const s = DRAWING.detail.skirts
    for (const side of [-1, 1]) pen.rect(side * (W + s.outM), m.trackTop * s.bottomShare, side * (W + s.outM + s.thickM), fender, 'solid')
  }

  // The turret front is two armour zones, one each side of the gun. Seen
  // from the front, the tank's left is on the right of the page.
  const p = pen.p
  /** One half of the turret outline; `side` is -1 for the page's left, 1 for its right. */
  const half = (side: number): string => {
    switch (spec.turret.shape) {
      case 'castDome':
      case 'lowProfile':
        return `M${p(side * R, roof)} Q${p(side * R * 0.9, top)} ${p(side * R * 0.4, top)} L${p(0, top)} L${p(0, roof)} Z`
      case 'weldedWedge':
        return outline(pen, [[side * R, roof], [side * R * 0.72, top], [0, top], [0, roof]])
      case 'bustle':
        return outline(pen, [[side * R, roof], [side * R * 0.86, top], [0, top], [0, roof]])
      case 'unmanned':
        return outline(pen, [[side * R * 0.65, roof], [side * R * 0.55, top], [0, top], [0, roof]])
      case 'casemate':
        return outline(pen, [[side * R * 0.95, roof], [side * R * 0.85, top], [0, top], [0, roof]])
    }
  }
  switch (spec.turret.shape) {
    case 'castDome':
    case 'lowProfile':
      pen.path(
        `M${p(-R, roof)} Q${p(-R * 0.9, top)} ${p(-R * 0.4, top)} L${p(R * 0.4, top)} Q${p(R * 0.9, top)} ${p(R, roof)} Z`,
        'solid')
      break
    case 'weldedWedge':
      pen.poly([[-R, roof], [-R * 0.72, top], [R * 0.72, top], [R, roof]], 'solid')
      break
    case 'bustle':
      pen.poly([[-R, roof], [-R * 0.86, top], [R * 0.86, top], [R, roof]], 'solid')
      break
    case 'unmanned':
      pen.poly([[-R * 0.65, roof], [-R * 0.55, top], [R * 0.55, top], [R * 0.65, roof]], 'solid')
      break
    case 'casemate':
      pen.poly([[-R * 0.95, roof], [-R * 0.85, top], [R * 0.85, top], [R * 0.95, roof]], 'solid')
      break
  }
  pen.face(half(-1), 'turretFrontRight')
  pen.face(half(1), 'turretFrontLeft')
  const mantletHalf = TUNING.geometry.mantletWidthM / 2
  const h = geo.turretHeightM
  pen.facePoly([
    [-mantletHalf, m.gunY - h * 0.25], [mantletHalf, m.gunY - h * 0.25],
    [mantletHalf, m.gunY + h * 0.25], [-mantletHalf, m.gunY + h * 0.25],
  ], 'mantlet')
  pen.rect(-mantletHalf, m.gunY - h * 0.25, mantletHalf, m.gunY + h * 0.25, 'thin')
  pen.circle(0, m.gunY, m.barrelHalf, 'solid')
  pen.circle(0, m.gunY, m.calibre / 2, 'thin')

  const hatchX = -R * 0.42
  const cupola = TURRETS[spec.turret.shape].crewed ? DRAWING.cupolaHeightM : 0
  if (cupola > 0) pen.rect(hatchX - DRAWING.hatchRadiusM, top, hatchX + DRAWING.hatchRadiusM, top + cupola, 'solid')
  if (spec.fireControl.commanderSight) {
    const s = DRAWING.sightHeadM
    pen.rect(hatchX - s.width / 2, top + cupola, hatchX + s.width / 2, top + cupola + s.height, 'solid')
  }
  frontDetail(pen, spec, m, h, mantletHalf, fender, bodyHalf, hatchX, cupola)
  pen.line(0, -0.1, 0, top + DRAWING.cupolaHeightM + 0.35, 'centre')

  // Dimensions: the width under the tracks, the height beside them.
  pen.dimension(-W, W, -DRAWING.dims.firstM, false, 2 * W)
  pen.dimension(0, geo.heightM, W + DRAWING.dims.besideM, true, geo.heightM)

  // Tap zones: turret above; a track column each side and the hull between.
  const sky = top + DRAWING.tapSkyM
  const ground = -DRAWING.tapGroundM
  const edge = W + DRAWING.marginM
  const inner = bodyHalf * 0.6
  pen.zone(-edge, roof, edge, sky, 'turret.shape')
  pen.zone(-edge, ground, -inner, roof, 'runningGear.trackWidthMm')
  pen.zone(-inner, ground, inner, roof, 'hull.size')
  pen.zone(inner, ground, edge, roof, 'runningGear.trackWidthMm')

  pen.armourTap(-edge, roof, 0, sky, 'turretFrontRight')
  pen.armourTap(0, roof, edge, sky, 'turretFrontLeft')
  pen.armourTap(-edge, ground, edge, roof, 'upperGlacis')
}

/** The finer parts of the front view: plates, lights, tracks seen end on, and the turret's fittings. */
function frontDetail(
  pen: Pen, spec: VehicleSpec, m: Layout, h: number, mantletHalf: number, fender: number, bodyHalf: number,
  hatchX: number, cupola: number,
): void {
  const { roof, belly, top, radius: R, halfWidth: W } = m
  const d = DRAWING.detail
  const f = DRAWING.front
  const t = m.trackWidth

  // Track guards: a plate over each track, with its edge.
  pen.rect(-W, fender - 0.02, -W + t, fender + f.guardM, 'thin')
  pen.rect(W - t, fender - 0.02, W, fender + f.guardM, 'thin')
  // Tracks end on: the link plates as bands, and the guide horns down the middle.
  let tracks = ''
  for (const side of [-1, 1]) {
    const outer = side * W
    const innerEdge = side * (W - t)
    for (let y = d.linkM * 0.5; y < m.trackTop - 0.02; y += d.linkM * 0.5) tracks += stroke(pen, innerEdge, y, outer, y)
    const mid = side * (W - t / 2)
    tracks += stroke(pen, mid - f.hornM, 0, mid - f.hornM, m.trackTop) + stroke(pen, mid + f.hornM, 0, mid + f.hornM, m.trackTop)
  }
  pen.path(tracks, 'fine')

  // Hull plates: the glacis break under the roof, the splash board, and the belly's chamfer.
  const glacisTop = roof - f.roofLipM
  let plates = stroke(pen, -W + 0.03, glacisTop, W - 0.03, glacisTop)
  plates += stroke(pen, -bodyHalf * 0.55, fender + (roof - fender) * 0.55, 0, fender + (roof - fender) * 0.7)
  plates += stroke(pen, 0, fender + (roof - fender) * 0.7, bodyHalf * 0.55, fender + (roof - fender) * 0.55)
  plates += stroke(pen, -bodyHalf + 0.05, belly + 0.05, bodyHalf - 0.05, belly + 0.05)
  pen.path(plates, 'fine')
  // Headlights at the glacis corners, the driver's vision block, and tow hooks on the lower plate.
  let lights = ''
  for (const side of [-1, 1]) lights += ring(pen, side * (W - t * 0.55), fender + f.lightR + 0.05, f.lightR)
  pen.path(lights, 'thin')
  const driverX = spec.hull.engineAt === 'front' ? 0 : -bodyHalf * 0.45
  pen.rect(driverX - f.visionM / 2, glacisTop - 0.09, driverX + f.visionM / 2, glacisTop - 0.03, 'thin')
  for (const side of [-1, 1]) {
    const x = side * bodyHalf * 0.7
    pen.poly([[x - 0.07, belly + 0.2], [x + 0.07, belly + 0.2], [x + 0.05, belly + 0.08], [x - 0.05, belly + 0.08]], 'thin')
  }

  // Turret: casting line, periscopes, a sight window, the coaxial gun, mantlet bolts and the muzzle ring.
  let turret = stroke(pen, -R * 0.92, roof + h * d.castLineShare, R * 0.92, roof + h * d.castLineShare)
  const sightX = R * 0.48
  turret += `M${pen.p(sightX - 0.1, m.gunY + h * 0.12)} L${pen.p(sightX + 0.1, m.gunY + h * 0.12)} L${pen.p(sightX + 0.1, m.gunY + h * 0.3)} L${pen.p(sightX - 0.1, m.gunY + h * 0.3)} Z`
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    turret += ring(pen, x * (mantletHalf - 0.04), m.gunY + y * (h * 0.25 - 0.04), 0.012)
  }
  pen.path(turret, 'fine')
  pen.circle(-mantletHalf * 0.62, m.gunY - h * 0.08, f.coaxR, 'thin')
  pen.circle(0, m.gunY, m.barrelHalf * d.muzzleRingShare, 'thin')
  let scopes = ''
  for (const at of [-0.12, 0.15]) {
    const x = R * at
    scopes += `M${pen.p(x - 0.06, top)} L${pen.p(x - 0.05, top + 0.07)} L${pen.p(x + 0.05, top + 0.07)} L${pen.p(x + 0.06, top)}`
  }
  if (cupola > 0) {
    for (let i = 1; i < 4; i++) {
      const x = hatchX - DRAWING.hatchRadiusM + (i * DRAWING.hatchRadiusM) / 2
      scopes += stroke(pen, x, top + cupola * 0.35, x, top + cupola * 0.8)
    }
  }
  pen.path(scopes, 'fine')
  // Smoke dischargers seen end on, three to a cheek.
  if (spec.protection.smokeLaunchers) {
    let tubes = ''
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) tubes += ring(pen, side * (R * 0.78 - i * 0.1), roof + h * 0.42, 0.035)
    }
    pen.path(tubes, 'thin')
  }
}

/**
 * What is inside, drawn over a view. The side view looks through the hull
 * side; the top view looks down through the roofs. `across` picks which way
 * the page's second direction runs: up (side view) or out to the tank's right (top view).
 */
function cutaway(pen: Pen, interior: Interior, across: 'y' | 'z'): void {
  const head = DRAWING.crewHeadM
  // Racks, tanks and machinery first, then the gun, then the crew, so the people are never covered.
  const order = (kind: CutKind): number => (kind === 'crew' ? 2 : kind === 'gun' ? 1 : 0)
  const items = [...interior.items].sort((a, b) => order(CUT_KIND[a.kind]) - order(CUT_KIND[b.kind]))
  for (const item of items) {
    const { box } = item
    const kind = CUT_KIND[item.kind]
    const a0 = across === 'y' ? box.y0 : box.z0
    const a1 = across === 'y' ? box.y1 : box.z1
    if (item.kind === 'crew') {
      const cx = (box.x0 + box.x1) / 2
      if (across === 'y') {
        // Seen from the side: a head over a body.
        pen.itemDot(cx, a1 - head, head, kind)
        pen.itemRect(cx - head * 1.1, Math.max(a0, a1 - head * 6), cx + head * 1.1, a1 - head * 2.3, kind)
      } else {
        pen.itemDot(cx, (a0 + a1) / 2, head * 1.5, kind)
      }
      continue
    }
    pen.itemRect(box.x0, a0, box.x1, a1, kind, item.kind === 'engine' ? 2 : item.kind === 'transmission' ? 1 : 0)
  }
}

/** `interior` adds the cutaway: what is inside the armour, on the side and top views. */
export function drawingOf(spec: VehicleSpec, geo: Geometry, view: View, interior?: Interior): Drawing {
  const m = layout(spec, geo)
  const pen = new Pen()
  if (view === 'side') sideView(pen, spec, geo, m)
  else if (view === 'top') topView(pen, spec, m)
  else frontView(pen, spec, geo, m)
  if (interior && view === 'side') cutaway(pen, interior, 'y')
  if (interior && view === 'top') cutaway(pen, interior, 'z')

  // Make room for the lines and for the tap zones around them.
  let minX = pen.minX
  let maxX = pen.maxX
  let minY = pen.minY
  let maxY = pen.maxY
  for (const zone of pen.zones) {
    minX = Math.min(minX, zone.x)
    maxX = Math.max(maxX, zone.x + zone.w)
    minY = Math.min(minY, zone.y)
    maxY = Math.max(maxY, zone.y + zone.h)
  }
  const pad = view === 'side' ? 0 : DRAWING.marginM * 0.5
  return {
    box: { x: round(minX - pad), y: round(minY - pad), w: round(maxX - minX + 2 * pad), h: round(maxY - minY + 2 * pad) },
    dimensions: pen.dimensions,
    shapes: pen.shapes,
    zones: pen.zones,
    armourTaps: pen.armourTaps,
    body: interior && view === 'side' ? pen.body : [],
    hullLengthM: m.length,
    overallLengthM: m.length - Math.min(0, m.muzzleX),
    widthM: geo.widthM,
    heightM: geo.heightM,
  }
}
