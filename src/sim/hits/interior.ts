// What is inside the armour and where: crew stations, ammunition, fuel,
// engine, gearbox, the gun's breech, the autoloader and the gunner's sight,
// each as a plain box placed by the design. A shot that gets through the
// armour is followed through these (PR 6b).
// Game-level abstractions, not engineering data.
import type { StationId } from '../../data/crew'
import { INTERIOR } from '../../data/layout'
import { GUNS, LOADING, STOWAGE, TURRETS, type StowageId } from '../../data/parts'
import { TUNING } from '../../data/tuning'
import { frameOf, type Frame } from '../vehicle/frame'
import type { Geometry } from '../vehicle/geometry'
import type { VehicleSpec } from '../vehicle/spec'

export const ITEM_KINDS = ['crew', 'ammo', 'fuel', 'engine', 'transmission', 'gun', 'autoloader', 'sight'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]

export const ITEM_IDS = [
  'driver', 'gunner', 'commander', 'loader', 'breech', 'sight', 'carousel', 'bustleLoader', 'bustleRack', 'readyRack',
  'frontRack', 'crossRack', 'tailRack', 'frontTank', 'crossTank', 'tailTank', 'engine', 'transmission',
] as const
export type ItemId = (typeof ITEM_IDS)[number]

/** A box with its sides square to the tank: x back from the nose, y up from the ground, z out to the tank's right. */
export interface Box {
  x0: number
  x1: number
  y0: number
  y1: number
  z0: number
  z1: number
}

export interface InteriorItem {
  id: ItemId
  kind: ItemKind
  box: Box
  /** Whether it sits in the hull or turns with the turret. */
  part: 'hull' | 'turret'
  /** The crewman who sits here. */
  station?: StationId
  /** Rounds kept here. */
  rounds: number
  /** How those rounds are stowed. Null for rounds held in an autoloader, and where there are none. */
  stowage: StowageId | null
  /** True when the rounds here are behind blow-out panels. */
  vented: boolean
  /** Litres of fuel kept here. */
  litres: number
}

export interface Interior {
  frame: Frame
  items: InteriorItem[]
}

function volumeOf(box: Box): number {
  return (box.x1 - box.x0) * (box.y1 - box.y0) * (box.z1 - box.z0)
}

/**
 * A rack or tank that grows along the hull from one end of its place as it
 * is given more to hold. `fromFront` grows it back from the front end.
 * It never outgrows its place: past that, what it holds is packed tighter.
 */
function grown(place: Box, volumeM3: number, fromFront: boolean): Box {
  const room = volumeOf(place)
  if (room <= 0 || volumeM3 >= room) return place
  const length = ((place.x1 - place.x0) * Math.max(volumeM3, 0)) / room
  return fromFront ? { ...place, x1: place.x0 + length } : { ...place, x0: place.x1 - length }
}

export function interiorOf(spec: VehicleSpec, geo: Geometry): Interior {
  const f = frameOf(spec, geo)
  const I = INTERIOR
  const w = I.wallM
  const loading = LOADING[spec.loading]
  const hasBustle = TURRETS[spec.turret.shape].hasBustle
  const rearEngine = spec.hull.engineAt === 'rear'
  const inner = f.bodyHalf - w
  const floor = f.belly + w
  const ceiling = f.roof - w
  const xc = f.turretX
  const R = f.radius
  const items: InteriorItem[] = []
  const add = (id: ItemId, kind: ItemKind, part: 'hull' | 'turret', box: Box, more: Partial<InteriorItem> = {}): void => {
    items.push({ id, kind, part, box, rounds: 0, stowage: null, vented: false, litres: 0, ...more })
  }

  // --- Crew ---------------------------------------------------------------
  const seat = I.seatM / 2
  const driverX = Math.min(f.upperRun + I.driverBackM, xc - R - I.driverClearOfTurretM)
  const driverZ = rearEngine ? 0 : f.bodyHalf * I.driverOffsetShare
  add('driver', 'crew', 'hull', {
    x0: driverX - seat, x1: driverX + seat, y0: floor, y1: ceiling, z0: driverZ - seat, z1: driverZ + seat,
  }, { station: 'driver' })

  const carousel = spec.loading === 'carousel'
  const feet = Math.max(f.roof - I.basketDepthM, carousel ? floor + I.carouselDepthM + w : floor)
  const head = f.top - I.headRoomM
  const turretSeat = (id: 'gunner' | 'commander' | 'loader', at: readonly [number, number]): void => {
    const x = xc + R * at[0]
    const z = R * at[1]
    add(id, 'crew', 'turret', { x0: x - seat, x1: x + seat, y0: feet, y1: head, z0: z - seat, z1: z + seat }, { station: id })
  }
  const gunnerAt = f.hasLoader ? I.gunnerWithLoader : I.gunnerAlone
  // Nobody in the turret: the gunner and commander sit against the hull walls, either side of the driver.
  // That needs the engine at the back; a design that breaks the rule is drawn with its crew in the turret.
  const crewed = TURRETS[spec.turret.shape].crewed || !rearEngine
  if (f.hasLoader) turretSeat('loader', I.loader)
  if (crewed) {
    turretSeat('gunner', gunnerAt)
    turretSeat('commander', I.commander)
  } else {
    const x = driverX + I.hullCrewBackM
    const out = Math.max(inner - seat, 2 * seat + w)
    const hullSeat = (id: 'gunner' | 'commander', z: number): void => {
      add(id, 'crew', 'hull', { x0: x - seat, x1: x + seat, y0: floor, y1: ceiling, z0: z - seat, z1: z + seat }, { station: id })
    }
    hullSeat('gunner', -out)
    hullSeat('commander', out)
  }

  // --- Gun and sight ------------------------------------------------------
  add('breech', 'gun', 'turret', {
    x0: f.gunRootX + I.breechStartM, x1: xc + R * I.breechEndShare,
    y0: f.gunY - I.breechHalfM, y1: f.gunY + I.breechHalfM, z0: -I.breechHalfM, z1: I.breechHalfM,
  })
  const sightZ = R * gunnerAt[1]
  // The sight is in the turret front, ahead of the gunner's seat.
  const sightTo = Math.min(xc - R * I.sightToShare, xc + R * gunnerAt[0] - seat - w)
  add('sight', 'sight', 'turret', {
    x0: xc - R * I.sightFromShare, x1: sightTo,
    y0: f.gunY - I.sightHalfM, y1: f.gunY + I.sightHalfM, z0: sightZ - I.sightHalfM, z1: sightZ + I.sightHalfM,
  })

  // --- Ammunition ---------------------------------------------------------
  const stowage = spec.ammo.stowage
  const vented = stowage === 'blowOutPanels' && hasBustle
  let left = spec.ammo.rounds
  const take = (most: number): number => {
    const n = Math.min(left, most)
    left -= n
    return n
  }
  const bustleBox: Box = {
    x0: xc + R * I.bustleFromShare, x1: xc + R + f.bustle - w, y0: f.bustleFloor + w, y1: f.top - w,
    z0: -R * I.bustleHalfShare, z1: R * I.bustleHalfShare,
  }
  if (carousel) {
    const r = f.ringRadius * I.carouselShare
    add('carousel', 'autoloader', 'hull', { x0: xc - r, x1: xc + r, y0: floor, y1: floor + I.carouselDepthM, z0: -r, z1: r }, {
      rounds: take(loading.readyRounds),
    })
  }
  const loaderInBustle = spec.loading === 'bustleLoader' && hasBustle
  // The machine takes the middle of the bustle and leaves a narrow rack beside it.
  const split = R * I.bustleHalfShare * I.bustleLoaderShare
  if (loaderInBustle) {
    add('bustleLoader', 'autoloader', 'turret', { ...bustleBox, z1: split }, { rounds: take(loading.readyRounds), vented })
  }
  if (hasBustle) {
    const n = take(loaderInBustle ? I.bustleSpareRounds : I.bustleRackRounds)
    if (n > 0) add('bustleRack', 'ammo', 'turret', loaderInBustle ? { ...bustleBox, z0: split + w } : bustleBox, { rounds: n, stowage, vented })
  } else if (f.hasLoader) {
    const n = take(I.readyRackRounds)
    if (n > 0) {
      add('readyRack', 'ammo', 'turret', {
        x0: xc + R * I.readyRackFromShare, x1: xc + R * I.readyRackToShare, y0: f.roof + w, y1: head - w,
        z0: -R * I.readyRackHalfShare, z1: R * I.readyRackHalfShare,
      }, { rounds: n, stowage })
    }
  }

  // Where racks and tanks go in the hull. With the engine at the back they
  // sit either side of the driver, with more across the hull ahead of the
  // engine. With the engine in front they share the room behind the turret.
  const frontFrom = f.upperRun + I.besideDriverBackM
  const frontTo = Math.max(frontFrom, xc - R * I.besideDriverStopShare)
  const behindTurret = xc + R * I.besideDriverStopShare
  // With the turret crew in the nose there is no room left beside the driver.
  const besideTo = crewed ? frontTo : frontFrom
  const rackPlace: Box = rearEngine
    ? { x0: frontFrom, x1: besideTo, y0: floor, y1: ceiling, z0: I.besideDriverInnerM, z1: inner }
    : { x0: behindTurret, x1: f.length - I.rearClearM, y0: floor, y1: ceiling, z0: w / 2, z1: inner }
  const tankPlace: Box = rearEngine
    ? { x0: frontFrom, x1: besideTo, y0: floor, y1: ceiling, z0: -inner, z1: -I.besideDriverInnerM }
    : { x0: behindTurret, x1: f.length - I.rearClearM, y0: floor, y1: ceiling, z0: -inner, z1: -w / 2 }
  // Only with the engine at the back: the room between the turret crew and the engine.
  const acrossFrom = Math.min(behindTurret, f.bayStart - w)
  const acrossTank: Box = { x0: acrossFrom, x1: f.bayStart - w, y0: ceiling - I.crossTankDepthM, y1: ceiling, z0: -inner, z1: inner }
  const acrossRack: Box = { ...acrossTank, y0: floor, y1: ceiling - I.crossTankDepthM - w }

  // Blow-out panels are part of the bustle. Rounds kept in the hull have none.
  const hullStowage: StowageId = stowage === 'blowOutPanels' ? 'plainRacks' : stowage
  const roundM3 = GUNS[spec.gun].roundVolumeM3 * STOWAGE[hullStowage].volumeFactor
  if (left > 0) {
    const fits = rearEngine ? Math.floor(volumeOf(rackPlace) / roundM3) : left
    const n = take(Math.max(fits, 0))
    if (n > 0) {
      add(rearEngine ? 'frontRack' : 'tailRack', 'ammo', 'hull', grown(rackPlace, n * roundM3, rearEngine), { rounds: n, stowage: hullStowage })
    }
  }
  if (left > 0) {
    const n = take(left)
    add('crossRack', 'ammo', 'hull', grown(acrossRack, n * roundM3, false), { rounds: n, stowage: hullStowage })
  }

  // --- Fuel ---------------------------------------------------------------
  const perL = TUNING.volume.fuelM3PerL
  const fuel = spec.powerpack.fuelL
  const firstL = rearEngine ? Math.min(fuel, Math.floor(volumeOf(tankPlace) / perL)) : fuel
  if (firstL > 0) add(rearEngine ? 'frontTank' : 'tailTank', 'fuel', 'hull', grown(tankPlace, firstL * perL, rearEngine), { litres: firstL })
  if (fuel > firstL) add('crossTank', 'fuel', 'hull', grown(acrossTank, (fuel - firstL) * perL, false), { litres: fuel - firstL })

  // --- Engine and gearbox -------------------------------------------------
  const bayHalf = f.bodyHalf * I.bayHalfShare
  const z0 = rearEngine ? -bayHalf : I.bayBesideDriverM
  const y0 = f.belly + I.bayClearM
  const y1 = f.roof - I.bayClearM
  const from = f.bayStart + w
  const to = f.bayEnd - w
  const engineLength = (to - from) * I.engineShare
  // The gearbox is at the end of the hull, by the sprockets it drives.
  const cut = rearEngine ? from + engineLength : to - engineLength
  add('engine', 'engine', 'hull', rearEngine ? { x0: from, x1: cut, y0, y1, z0, z1: bayHalf } : { x0: cut, x1: to, y0, y1, z0, z1: bayHalf })
  add('transmission', 'transmission', 'hull',
    rearEngine ? { x0: cut + w, x1: to, y0, y1, z0, z1: bayHalf } : { x0: from, x1: cut - w, y0, y1, z0, z1: bayHalf })

  return { frame: f, items }
}
