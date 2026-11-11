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
export type LineStyle = 'solid' | 'thin' | 'hidden' | 'centre' | 'ground' | 'face' | 'item'

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

export interface Drawing {
  box: { x: number; y: number; w: number; h: number }
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

  /** A tap zone that picks an armour zone, given in drawing space (y up). */
  armourTap(x0: number, y0: number, x1: number, y1: number, zone: ZoneId): void {
    this.armourTaps.push({ x: round(x0), y: round(-y1), w: round(x1 - x0), h: round(y1 - y0), zone })
  }
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
  pen.rect(m.muzzleX, axis - m.barrelHalf, m.gunRootX, axis + m.barrelHalf, 'solid')
  pen.rect(m.extractorX - DRAWING.extractorLengthM, axis - m.extractorHalf, m.extractorX, axis + m.extractorHalf, 'solid')
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
  for (let i = 0; i < wheels; i++) {
    const cx = start + pitch * (i + 0.5)
    pen.circle(cx, wheelR + DRAWING.trackThicknessM, wheelR, 'solid')
    pen.circle(cx, wheelR + DRAWING.trackThicknessM, wheelR * DRAWING.hubShare, 'thin')
  }
  const endR = (m.trackTop - c) * 0.5
  pen.circle(x0 + endR + 0.08, m.trackTop - endR - DRAWING.trackThicknessM, endR, 'thin')
  pen.circle(x1 - endR - 0.08, m.trackTop - endR - DRAWING.trackThicknessM, endR, 'thin')

  pen.line(xc, -0.1, xc, top + DRAWING.cupolaHeightM + 0.35, 'centre')

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

  // Engine deck louvres, and the driver's hatch beside or ahead of them.
  const bayHalf = bodyHalf * 0.8
  const frontEngine = spec.hull.engineAt === 'front'
  const bayLow = frontEngine ? 0.1 : -bayHalf
  pen.rect(m.bayStart, bayLow, m.bayEnd - DRAWING.rearUndercutM, bayHalf, 'thin')
  const louvres = 5
  for (let i = 1; i < louvres; i++) {
    const x = m.bayStart + ((m.bayEnd - DRAWING.rearUndercutM - m.bayStart) * i) / louvres
    pen.line(x, bayLow, x, bayHalf, 'thin')
  }
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
  }
  const turret = pen.shapes[before]
  if (turret) pen.face(turret.d, 'turretRoof')
  pen.circle(xc, 0, spec.turret.ringMm / 2000, 'hidden')
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
  pen.line(0, -0.1, 0, top + DRAWING.cupolaHeightM + 0.35, 'centre')

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
