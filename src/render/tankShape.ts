// The tank for the 3D range, as plain measurements and a list of simple
// parts. It uses the blueprint's own layout, so the tank on the range is
// the tank on the drawing. Nothing here needs three.js, so it can be tested.
import { DRAWING } from '../data/drawing'
import { KIT, type KitPiece } from '../data/kit'
import type { ZoneId } from '../data/materials'
import { TURRETS } from '../data/parts'
import { RENDER } from '../data/render'
import { layout } from '../office/drawing'
import type { Geometry, VehicleSpec } from '../sim/vehicle'
import { allTiles, tileCount } from '../sim/vehicle/era'
import type { Axes, Vec } from './glb'
import type { Point } from './path'

/** Which of the tank's three colours a part is painted. */
export type Tone = 'body' | 'dark' | 'tile'
/** A part is fixed to the hull, or turns with the gun. Turret parts are placed from the middle of the ring. */
export type Mount = 'hull' | 'turret'

interface PartBase {
  mount: Mount
  tone: Tone
}

/** A box, centred at a place. `pitchDeg` tips its nose up about the axis across the tank. */
export interface BoxPart extends PartBase {
  kind: 'box'
  size: { x: number; y: number; z: number }
  at: { x: number; y: number; z: number }
  pitchDeg?: number
}

/** A wheel or a barrel: a round bar along one axis, centred at a place. */
export interface DrumPart extends PartBase {
  kind: 'drum'
  axis: 'x' | 'y' | 'z'
  radiusM: number
  lengthM: number
  sides: number
  at: { x: number; y: number; z: number }
}

/** An outline seen from the side, given width across the tank and centred at `atZ`. */
export interface SlabPart extends PartBase {
  kind: 'slab'
  outline: Point[]
  widthM: number
  atZ: number
}

/** Rings seen from above, one over the other, skinned between and closed on top. Every ring has as many corners. */
export interface LoftPart extends PartBase {
  kind: 'loft'
  rings: { y: number; corners: { x: number; z: number }[] }[]
}

/** A closed loop of plate seen from the side, open in the middle: the track. Given width across and centred at `atZ`. */
export interface BandPart extends PartBase {
  kind: 'band'
  outline: Point[]
  thickM: number
  widthM: number
  atZ: number
}

/**
 * A piece of the Blender kit (src/data/kit.ts), scaled along each axis and
 * moved into place. A negative scale mirrors it. Its own two tones are kept:
 * `tone` is for the simple shape drawn instead if the kit has not come.
 */
export interface PiecePart extends PartBase {
  kind: 'piece'
  piece: KitPiece
  scale: { x: number; y: number; z: number }
  at: { x: number; y: number; z: number }
  /** Where the piece's own axes point, if it is turned; unturned it lies as modelled. */
  axes?: Axes
  /** A wheel turns on an axle across the tank through `at`; this is how far it is from there to its rim. */
  wheelM?: number
  /** The simple shapes drawn instead, in `tone`, if the kit has not come. */
  fallback: readonly Plain[]
}

/**
 * Outlines seen from the front, one behind another along the tank, skinned
 * between and closed at both ends: the upper hull. Every outline has as many corners.
 */
export interface SweepPart extends PartBase {
  kind: 'sweep'
  stations: { x: number; corners: { y: number; z: number }[] }[]
}

export type TankPart = BoxPart | DrumPart | SlabPart | LoftPart | BandPart | SweepPart | PiecePart

type Bare<T> = T extends unknown ? Omit<T, 'mount' | 'tone'> : never
/** A simple shape: anything but a kit piece. */
export type Plain = Bare<Exclude<TankPart, PiecePart>>
/** The shape of a part alone: not what it is fixed to or how it is painted. Scenery is built from these too. */
export type Solid = Bare<TankPart>

export interface TankShape {
  lengthM: number
  /** Length of track on the ground, for working out the tilt. */
  footprintM: number
  /** The hull seen from the side: x forward from the middle, y up from the ground. */
  hullOutline: Point[]
  hullWidthM: number
  track: { widthM: number; topM: number; lengthM: number; centreZM: number }
  wheels: { xM: number[]; radiusM: number }
  turret: { xM: number; baseM: number; heightM: number; radiusM: number; bustleM: number }
  gun: { rootXM: number; lengthM: number; radiusM: number; yM: number }
  /** Everything the tank is built from. */
  parts: TankPart[]
}

/** The share of a zone's tile places that carry a tile. */
function tileShare(spec: VehicleSpec, zone: ZoneId): number {
  const all = tileCount(allTiles(zone))
  return all === 0 ? 0 : tileCount(spec.era[zone]) / all
}

export function tankShapeOf(spec: VehicleSpec, geometry: Geometry): TankShape {
  const m = layout(spec, geometry)
  const t = RENDER.tank
  const half = m.length / 2
  // The blueprint measures back from the nose. Here x runs forward from the middle.
  const fromNose = (x: number): number => half - x
  const noseY = m.belly + m.lowerH

  const count = spec.runningGear.roadWheels
  const pitch = (m.length - DRAWING.trackInsetFrontM - DRAWING.trackInsetRearM - 2 * DRAWING.trackCornerM) / count
  const radius = Math.min(DRAWING.roadWheelMaxRadiusM, (pitch * DRAWING.wheelFill) / 2)
  const firstWheel = DRAWING.trackInsetFrontM + DRAWING.trackCornerM + pitch / 2
  const wheelX: number[] = []
  for (let i = 0; i < count; i++) wheelX.push(fromNose(firstWheel + i * pitch))

  const hullOutline: Point[] = [
    { x: -half, y: m.belly },
    { x: fromNose(m.lowerRun), y: m.belly },
    { x: half, y: noseY },
    { x: fromNose(m.upperRun), y: m.roof },
    { x: -half, y: m.roof },
  ]
  const track = {
    widthM: m.trackWidth,
    topM: m.trackTop,
    lengthM: m.length - DRAWING.trackInsetFrontM - DRAWING.trackInsetRearM,
    centreZM: m.halfWidth - m.trackWidth / 2,
  }
  const turret = { xM: fromNose(m.turretX), baseM: m.roof, heightM: geometry.turretHeightM, radiusM: m.radius, bustleM: m.bustle }
  // The gun sits where the kit's turret was modelled to carry it, which is close to the drawing's place for it.
  const fit = KIT.fit[spec.turret.shape]
  const gun = {
    rootXM: turret.xM + fit.gunAhead * turret.radiusM,
    lengthM: m.gunRootX - m.muzzleX,
    radiusM: m.barrelHalf,
    yM: turret.baseM + fit.gunUp * turret.heightM,
  }

  const parts: TankPart[] = []
  const hull = (tone: Tone): PartBase => ({ mount: 'hull', tone })
  const top = (tone: Tone): PartBase => ({ mount: 'turret', tone })

  // --- The hull and what is fixed to it: a lower hull between the tracks, and over it an
  // upper hull reaching out over the tracks, bevelled underneath and leaning in to the roof.
  const sp = t.sponson
  const deck = m.trackTop + t.fenderLiftM
  const glacisX = half - m.upperRun
  // Where the upper hull's nose is: the nose itself if it stands above the deck, else where the glacis meets the deck.
  const [upperNoseX, upperNoseTop] = noseY >= deck
    ? [half, Math.max(noseY, deck + sp.frontM)]
    : [half - (m.upperRun * (deck - noseY)) / Math.max(1e-6, m.roof - noseY), deck + sp.frontM]
  const tall = m.roof - deck
  const section = (top: number): { y: number; z: number }[] => {
    const h = top - deck
    const share = h / Math.max(1e-6, tall)
    const u = m.halfWidth
    const under = sp.underInM * share
    const up = h * sp.underUpShare
    const lean = sp.leanM * share
    const chamfer = h * sp.chamferShare
    const roofIn = sp.roofInM * share
    const half8 = [
      { y: deck, z: u - under }, { y: deck + up, z: u }, { y: top - chamfer, z: u - lean }, { y: top, z: u - roofIn },
    ]
    return [...half8, ...half8.slice().reverse().map((c) => ({ y: c.y, z: -c.z }))]
  }
  parts.push({ ...hull('body'), kind: 'slab', outline: below(hullOutline, deck), widthM: m.hull.bodyWidthM, atZ: 0 })
  parts.push({
    ...hull('body'), kind: 'sweep',
    stations: [
      { x: -half, corners: section(m.roof - tall * sp.tailDropShare) },
      { x: -half + sp.tailRunM, corners: section(m.roof) },
      { x: glacisX, corners: section(m.roof) },
      { x: upperNoseX, corners: section(upperNoseTop) },
    ],
  })

  // The track loop, with its corners cut as on the drawing. It is open in the middle, so the wheels show.
  const c = DRAWING.trackCornerM
  const x0 = fromNose(DRAWING.trackInsetFrontM)
  const x1 = fromNose(m.length - DRAWING.trackInsetRearM)
  const loop: Point[] = [
    { x: x1 + c, y: 0 }, { x: x0 - c, y: 0 }, { x: x0, y: c }, { x: x0, y: m.trackTop - c * 0.4 },
    { x: x0 - c * 0.5, y: m.trackTop }, { x: x1 + c * 0.5, y: m.trackTop }, { x: x1, y: m.trackTop - c * 0.4 }, { x: x1, y: c },
  ]
  const endR = (m.trackTop - c) * 0.5
  const ref = KIT.reference
  const gear = t.runningGear
  // The drive sprocket sits at the engine's end, the idler at the other, as on the drawing.
  const frontX = x0 - endR - gear.endInM
  const backX = x1 + endR + gear.endInM
  const [sprocketX, idlerX] = spec.hull.engineAt === 'front' ? [frontX, backX] : [backX, frontX]
  const endY = m.trackTop - endR - DRAWING.trackThicknessM
  const rollerR = gear.returnRollerM
  const rollerY = m.trackTop - DRAWING.trackThicknessM - rollerR
  const span = frontX - backX
  for (const side of [-1, 1]) {
    const z = side * track.centreZM
    parts.push({ ...hull('dark'), kind: 'band', outline: loop, thickM: gear.trackThickM, widthM: track.widthM, atZ: z })
    // Each piece is modelled with its hub cap on the left; the right side's are mirrored.
    const piece = (name: KitPiece, r: number, refR: number, x: number, y: number, sides: number): TankPart => {
      const k = r / refR
      return {
        ...hull('body'), kind: 'piece', piece: name, scale: { x: k, y: k, z: -side * k }, at: { x, y, z }, wheelM: r,
        fallback: [{ kind: 'drum', axis: 'z', radiusM: r, lengthM: t.wheelThickM, sides, at: { x, y, z: side * (track.centreZM + track.widthM / 2 + t.wheelProudM) } }],
      }
    }
    for (const x of wheelX) parts.push(piece('road-wheel', radius, ref.roadWheelRadiusM, x, radius, t.wheelSides))
    parts.push(piece('sprocket', endR, ref.sprocketRadiusM, sprocketX, endY, t.endWheelSides))
    parts.push(piece('idler', endR, ref.idlerRadiusM, idlerX, endY, t.endWheelSides))
    for (let i = 0; i < gear.returnRollers; i++) {
      const x = backX + (span * (i + 1)) / (gear.returnRollers + 1)
      parts.push(piece('return-roller', rollerR, ref.returnRollerRadiusM, x, rollerY, t.endWheelSides))
    }
  }
  // The grille over the engine.
  const grille = { x: m.bayEnd - m.bayStart, z: m.hull.bodyWidthM * t.grilleWidthShare }
  const grilleX = fromNose((m.bayStart + m.bayEnd) / 2)
  parts.push({
    ...hull('dark'), kind: 'piece', piece: 'engine-deck',
    scale: { x: grille.x / ref.engineDeckM.x, y: 1, z: grille.z / ref.engineDeckM.z }, at: { x: grilleX, y: m.roof + ref.engineDeckM.y / 2, z: 0 },
    fallback: [{ kind: 'box', size: { x: grille.x, y: t.grilleThickM, z: grille.z }, at: { x: grilleX, y: m.roof + t.grilleThickM / 2, z: 0 } }],
  })

  // Side skirts, hung from the deck outside the wheels, in a row of the kit's plates.
  const sk = t.skirts
  const skirtZ = m.halfWidth + sk.outM
  if (spec.runningGear.skirts) {
    const plate = ref.skirtPanelM
    const drop = deck - m.trackTop * sk.bottomShare
    const plates = Math.max(1, Math.ceil(track.lengthM / plate.long))
    const each = track.lengthM / plates
    const sx = (each - sk.gapM) / plate.long
    const sy = drop / (plate.top - plate.bottom)
    for (const side of [-1, 1]) {
      for (let i = 0; i < plates; i++) {
        // Each plate runs forward from its back edge.
        const back = x1 + i * each + sk.gapM / 2
        parts.push({
          ...hull('body'), kind: 'piece', piece: 'skirt-panel',
          scale: { x: sx, y: sy, z: -side }, at: { x: back, y: deck - plate.top * sy, z: side * skirtZ },
          fallback: [{ kind: 'box', size: { x: each - sk.gapM, y: drop, z: plate.thick }, at: { x: back + (each - sk.gapM) / 2, y: deck - drop / 2, z: side * skirtZ } }],
        })
      }
    }
  }

  // Reactive tiles on the hull: panels laid up the glacis, and panels hung over the tracks.
  const panels = t.tilePanels
  const glacis = tileShare(spec, 'upperGlacis')
  if (glacis > 0) {
    const run = m.upperRun
    const rise = m.roof - noseY
    const long = Math.hypot(run, rise)
    parts.push(...tilePlate(hull('tile'), {
      middle: { x: half - run / 2, y: noseY + rise / 2, z: 0 },
      along: { x: -run / long, y: rise / long, z: 0 },
      out: { x: rise / long, y: run / long, z: 0 },
      longM: long * t.tile.cover, wideM: m.hull.bodyWidthM * t.tile.cover * glacis,
      ...panels.glacis, pitchDeg: (Math.atan2(rise, run) * 180) / Math.PI,
    }))
  }
  const sideHigh = (m.roof - m.trackTop * 0.45) * t.tile.cover
  const sideY = (m.roof + m.trackTop * 0.45) / 2
  const sides: [ZoneId, number][] = [['hullSideFront', 1], ['hullSideRear', -1]]
  for (const [zone, way] of sides) {
    const share = tileShare(spec, zone)
    if (share === 0) continue
    const long = half * t.tile.cover * share
    for (const side of [-1, 1]) {
      parts.push(...tilePlate(hull('tile'), {
        // Tiles go on from the nose backward, and from the middle backward.
        middle: { x: way > 0 ? half - long / 2 - half * (1 - t.tile.cover) / 2 : -long / 2, y: sideY, z: side * (spec.runningGear.skirts ? skirtZ + ref.skirtPanelM.thick / 2 : m.halfWidth) },
        along: { x: 1, y: 0, z: 0 }, out: { x: 0, y: 0, z: side },
        longM: long, wideM: sideHigh, ...panels.hullSide,
      }))
    }
  }

  // --- Everything that turns with the gun, placed from the middle of the ring.
  const R = turret.radiusM
  const h = turret.heightM
  const k = R / ref.turretRadiusM
  const rings = t.turrets[spec.turret.shape]
  const shell: Plain[] = [{
    kind: 'loft',
    rings: rings.map((ring) => {
      const a = ring.ahead * R
      const b = ring.behind * R
      const w = ring.half * R
      const cut = ring.cut * R
      return {
        y: turret.baseM + ring.up * h,
        corners: [
          { x: a, z: w - cut }, { x: a - cut, z: w }, { x: -b + cut, z: w }, { x: -b, z: w - cut },
          { x: -b, z: -(w - cut) }, { x: -b + cut, z: -w }, { x: a - cut, z: -w }, { x: a, z: -(w - cut) },
        ],
      }
    }),
  }]
  if (turret.bustleM > 0) {
    const long = turret.bustleM + R * 0.1
    const bustle: Plain = {
      kind: 'box',
      size: { x: long, y: m.top - m.bustleFloor, z: R * t.bustleWidthShare },
      at: { x: -(R * 0.9 + long / 2), y: (m.top + m.bustleFloor) / 2, z: 0 },
    }
    // The bustle turret's piece has its own overhang; any other turret keeps the plain one.
    if (spec.turret.shape === 'bustle') shell.push(bustle)
    else parts.push({ ...top('body'), ...bustle })
  }
  const rootX = gun.rootXM - turret.xM
  const mantlet: Plain = {
    kind: 'box',
    size: { x: t.mantlet.longM, y: h * t.mantlet.highShare, z: R * t.mantlet.wideShare },
    at: { x: rootX + t.mantlet.longM / 4, y: gun.yM, z: 0 },
  }
  // A turret with no mantlet in the kit (the unmanned one, its gun in a cradle) keeps the plain one in its stand-in.
  if (!fit.mantlet) shell.push(mantlet)
  parts.push({
    ...top('body'), kind: 'piece', piece: KIT.turrets[spec.turret.shape],
    scale: { x: k, y: h / ref.turretHeightM[spec.turret.shape], z: k }, at: { x: 0, y: turret.baseM, z: 0 },
    fallback: shell,
  })
  if (fit.mantlet) {
    const st = fit.mantletStretch
    parts.push({
      ...top('dark'), kind: 'piece', piece: fit.mantlet,
      scale: { x: k * st.x, y: k * st.y, z: k * st.z }, at: { x: rootX - fit.mantletBackM * k, y: gun.yM, z: 0 },
      fallback: [mantlet],
    })
  }
  const extractorX = fromNose(m.extractorX) - fromNose(m.gunRootX) + rootX
  const across = gun.radiusM / ref.gunRadiusM
  parts.push({
    ...top('dark'), kind: 'piece', piece: 'gun',
    scale: { x: gun.lengthM / ref.gunLengthM, y: across, z: across }, at: { x: rootX, y: gun.yM, z: 0 },
    fallback: [
      { kind: 'drum', axis: 'x', radiusM: gun.radiusM, lengthM: gun.lengthM, sides: t.gunSides, at: { x: rootX + gun.lengthM / 2, y: gun.yM, z: 0 } },
      { kind: 'drum', axis: 'x', radiusM: m.extractorHalf, lengthM: DRAWING.extractorLengthM, sides: t.extractorSides, at: { x: extractorX + DRAWING.extractorLengthM / 2, y: gun.yM, z: 0 } },
    ],
  })
  // The commander's cupola, and the sight head if one is fitted. A turret with nobody in it has no cupola.
  const crewed = TURRETS[spec.turret.shape].crewed
  const roof = KIT.roof
  const hatch = { x: -R * t.cupola.backShare, z: R * t.cupola.acrossShare }
  if (crewed) {
    const cupolaY = turret.baseM + h * roof.cupolaUp
    parts.push({
      ...top('body'), kind: 'piece', piece: 'cupola', scale: { x: 1, y: 1, z: 1 }, at: { x: hatch.x, y: cupolaY, z: hatch.z },
      fallback: [{ kind: 'drum', axis: 'y', radiusM: DRAWING.hatchRadiusM, lengthM: DRAWING.cupolaHeightM, sides: t.cupolaSides, at: { x: hatch.x, y: cupolaY + DRAWING.cupolaHeightM / 2, z: hatch.z } }],
    })
  }
  if (spec.fireControl.commanderSight) {
    const s = DRAWING.sightHeadM
    const sight = { x: -R * roof.sightBackShare, y: turret.baseM + h * roof.sightUp, z: -R * roof.sightAcrossShare }
    parts.push({
      ...top('dark'), kind: 'piece', piece: 'sight-head', scale: { x: 1, y: 1, z: 1 }, at: sight,
      fallback: [{ kind: 'box', size: { x: s.width, y: s.height, z: s.width }, at: { ...sight, y: sight.y + s.height / 2 } }],
    })
  }
  if (spec.protection.smokeLaunchers) {
    const l = t.launcher
    for (const side of [-1, 1]) {
      // Modelled for the left side; the right one is mirrored so its tubes face out.
      const at = { x: -R * l.backShare, y: turret.baseM + h * l.upShare, z: side * (fit.sideOut * R + l.wideM / 2) }
      parts.push({
        ...top('dark'), kind: 'piece', piece: 'smoke-launchers', scale: { x: 1, y: 1, z: -side }, at,
        fallback: [{ kind: 'box', size: { x: l.longM, y: l.highM, z: l.wideM }, at }],
      })
    }
  }
  // Reactive tiles on the turret: a panel on each cheek either side of the gun, and one along each side.
  const tileY = turret.baseM + h * 0.42
  const cheek = fit.tileFront
  const yaw = (cheek.yawDeg * Math.PI) / 180
  const fronts: [ZoneId, number][] = [['turretFrontLeft', -1], ['turretFrontRight', 1]]
  for (const [zone, side] of fronts) {
    const share = tileShare(spec, zone)
    if (share === 0) continue
    parts.push(...tilePlate(top('tile'), {
      middle: { x: cheek.x * R, y: tileY, z: side * cheek.z * R },
      along: { x: -side * Math.sin(yaw), y: 0, z: Math.cos(yaw) },
      out: { x: Math.cos(yaw), y: 0, z: side * Math.sin(yaw) },
      longM: cheek.long * R * share, wideM: h * 0.6, ...panels.turretFront,
    }))
  }
  const flank = tileShare(spec, 'turretSides')
  if (flank > 0) {
    for (const side of [-1, 1]) {
      parts.push(...tilePlate(top('tile'), {
        middle: { x: R * 0.25, y: tileY, z: side * fit.sideOut * R },
        along: { x: 1, y: 0, z: 0 }, out: { x: 0, y: 0, z: side },
        longM: R * flank, wideM: h * 0.5, ...panels.turretSide,
      }))
    }
  }

  return { lengthM: m.length, footprintM: m.length * t.footprintShare, hullOutline, hullWidthM: m.hull.bodyWidthM, track, wheels: { xM: wheelX, radiusM: radius }, turret, gun, parts }
}

/** A plate to be tiled: its middle, the way along it and the way out of it, how far it reaches each way, and how many panels go each way. */
interface Plate {
  middle: Vec
  along: Vec
  out: Vec
  longM: number
  wideM: number
  panelsLong: number
  panelsWide: number
  /** For the stand-in blocks: how far the plate tips its nose up about the axis across the tank. */
  pitchDeg?: number
}

/**
 * Panels of the kit's tiles laid over a plate, standing a little off it. If the
 * kit has not come, each panel is a block. The panel's across is its along
 * crossed with its out, so the piece is never mirrored.
 */
function tilePlate(base: PartBase, plate: Plate): TankPart[] {
  const ref = KIT.reference.eraTilesM
  const tile = RENDER.tank.tile
  const { along: u, out: n } = plate
  const w: Vec = { x: u.y * n.z - u.z * n.y, y: u.z * n.x - u.x * n.z, z: u.x * n.y - u.y * n.x }
  const cellLong = plate.longM / plate.panelsLong
  const cellWide = plate.wideM / plate.panelsWide
  const scale = { x: cellLong / ref.x, y: 1, z: cellWide / ref.z }
  const parts: TankPart[] = []
  for (let i = 0; i < plate.panelsLong; i++) {
    for (let j = 0; j < plate.panelsWide; j++) {
      const a = ((i + 0.5) / plate.panelsLong - 0.5) * plate.longM
      const b = ((j + 0.5) / plate.panelsWide - 0.5) * plate.wideM
      const off = tile.offM
      const cell = (k: 'x' | 'y' | 'z'): number => plate.middle[k] + u[k] * a + w[k] * b + n[k] * off
      // Where the piece's own origin goes, so the middle of its face lands on the cell and its back on the plate.
      const at = {
        x: cell('x') - u.x * scale.x * ref.middle.x - n.x * ref.backY - w.x * scale.z * ref.middle.z,
        y: cell('y') - u.y * scale.x * ref.middle.x - n.y * ref.backY - w.y * scale.z * ref.middle.z,
        z: cell('z') - u.z * scale.x * ref.middle.x - n.z * ref.backY - w.z * scale.z * ref.middle.z,
      }
      const reach = (k: 'x' | 'y' | 'z'): number => Math.abs(u[k]) * cellLong + Math.abs(w[k]) * cellWide + Math.abs(n[k]) * tile.thickM
      const block: Plain = plate.pitchDeg === undefined
        ? { kind: 'box', size: { x: reach('x'), y: reach('y'), z: reach('z') }, at: { x: cell('x') + n.x * tile.thickM / 2, y: cell('y') + n.y * tile.thickM / 2, z: cell('z') + n.z * tile.thickM / 2 } }
        : { kind: 'box', size: { x: cellLong, y: tile.thickM, z: cellWide }, at: { x: cell('x') + n.x * tile.thickM / 2, y: cell('y') + n.y * tile.thickM / 2, z: cell('z') + n.z * tile.thickM / 2 }, pitchDeg: -plate.pitchDeg }
      parts.push({ ...base, kind: 'piece', piece: 'era-tiles', scale, at, axes: { x: u, y: n, z: w }, fallback: [block] })
    }
  }
  return parts
}

/** The part of an outline at or below a height, as a closed outline. */
export function below(outline: readonly Point[], y: number): Point[] {
  const out: Point[] = []
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!
    const b = outline[(i + 1) % outline.length]!
    if (a.y <= y) out.push(a)
    if ((a.y <= y) !== (b.y <= y)) {
      const k = (y - a.y) / (b.y - a.y)
      out.push({ x: a.x + (b.x - a.x) * k, y })
    }
  }
  return out
}

/** Triangles one part is drawn with. */
export function partTriangles(part: Solid): number {
  switch (part.kind) {
    case 'box': return 12
    case 'drum': return part.sides * 4
    // The edge all round, and a face each side.
    case 'slab': return part.outline.length * 2 + (part.outline.length - 2) * 2
    // The edge outside and in, and a face each side.
    case 'band': return part.outline.length * 8
    // The skin between outlines, and both ends.
    case 'sweep': {
      const corners = part.stations[0]?.corners.length ?? 0
      return (part.stations.length - 1) * corners * 2 + 2 * (corners - 2)
    }
    case 'piece': return KIT.pieces[part.piece]
    case 'loft': {
      const corners = part.rings[0]?.corners.length ?? 0
      return (part.rings.length - 1) * corners * 2 + (corners - 2)
    }
  }
}

/** Triangles the whole tank is drawn with. */
export function tankTriangles(shape: TankShape): number {
  return shape.parts.reduce((sum, part) => sum + partTriangles(part), 0)
}
