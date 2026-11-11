import { describe, expect, it } from 'vitest'
import { THREATS, THREAT_IDS, type Round } from '../src/data/ammo'
import { BASELINE_SPEC } from '../src/data/baseline'
import { ERA_GRIDS } from '../src/data/era'
import { HITS } from '../src/data/hits'
import { ZONES, type ZoneId } from '../src/data/materials'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1, TUNING } from '../src/data/tuning'
import { behindOf } from '../src/office/behind'
import {
  ITEM_IDS, OUTCOMES, allTiles, buildStatSheet, directionOf, paperLine, paperShot, targetOf, testShot, tilePlaceAt, traceShot,
  type HitResult, type Incoming, type Target, type Vec, type VehicleSpec,
} from '../src/sim/vehicle'

function tank(change?: (spec: VehicleSpec) => void): { spec: VehicleSpec; target: Target; sheet: ReturnType<typeof buildStatSheet> } {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  const sheet = buildStatSheet(spec, PACT_LIMITS_GEN1)
  return { spec, sheet, target: targetOf(spec, sheet.geometry, sheet.interior) }
}

const base = tank()
const f = base.target.shell.frame
const midHull = (f.belly + f.roof) / 2
const midTurret = (f.roof + f.top) / 2

/** A round that goes through anything, and one that goes through nothing. */
const LANCE: Round = { kind: 'shaped', speedMs: 900, spreadM: 0.5, penMm: 5000, lossPerKmMm: 0 }
const PEA: Round = { kind: 'kinetic', speedMs: 900, spreadM: 0.5, penMm: 1, lossPerKmMm: 0 }

function fire(target: Target, more: Partial<Incoming> & { aim: Vec }, spent?: Set<string>): HitResult {
  return traceShot(target, { round: LANCE, rangeM: 1000, bearingDeg: 0, diveDeg: 0, seed: 101, shotNo: 1, ...more }, spent)
}

const ids = (result: HitResult): string[] => result.reached.map((each) => each.id)

describe('where a shot strikes', () => {
  it('travels away from where the shooter stands', () => {
    expect(directionOf(0, 0)).toMatchObject({ x: 1, y: -0, z: -0 })
    expect(directionOf(90, 0).z).toBeCloseTo(-1, 9)
    expect(directionOf(180, 0).x).toBeCloseTo(-1, 9)
    expect(directionOf(0, 90).y).toBeCloseTo(-1, 9)
    expect(directionOf(0, -90).y).toBeCloseTo(1, 9)
  })

  it('finds the zone the line first meets, from every side', () => {
    const cases: [string, Partial<Incoming> & { aim: Vec }, ZoneId][] = [
      ['high on the hull front', { aim: { x: 0, y: f.roof - 0.1, z: 0 } }, 'upperGlacis'],
      ['low on the hull front', { aim: { x: 0, y: f.belly + 0.1, z: 0 } }, 'lowerGlacis'],
      ['the hull side, front half', { bearingDeg: 90, aim: { x: f.length * 0.25, y: f.roof - 0.1, z: 0 } }, 'hullSideFront'],
      ['the hull side, rear half', { bearingDeg: 90, aim: { x: f.length * 0.75, y: f.roof - 0.1, z: 0 } }, 'hullSideRear'],
      ['the other hull side', { bearingDeg: 270, aim: { x: f.length * 0.75, y: f.roof - 0.1, z: 0 } }, 'hullSideRear'],
      ['the hull rear', { bearingDeg: 180, aim: { x: f.length, y: midHull, z: 0 } }, 'hullRear'],
      ['the engine deck from above', { diveDeg: 90, aim: { x: f.length - 0.5, y: f.roof, z: 0 } }, 'hullRoof'],
      ['the belly from below', { diveDeg: -90, aim: { x: f.length / 2, y: f.belly, z: 0 } }, 'belly'],
      ['the turret front, the tank\'s left', { aim: { x: f.turretX, y: midTurret, z: -0.6 } }, 'turretFrontLeft'],
      ['the turret front, the tank\'s right', { aim: { x: f.turretX, y: midTurret, z: 0.6 } }, 'turretFrontRight'],
      ['the mantlet', { aim: { x: f.turretX, y: f.gunY, z: 0 } }, 'mantlet'],
      ['the turret side', { bearingDeg: 90, aim: { x: f.turretX, y: midTurret, z: 0 } }, 'turretSides'],
      ['the turret rear', { bearingDeg: 180, aim: { x: f.turretX, y: midTurret, z: 0 } }, 'turretRear'],
      ['the turret roof from above', { diveDeg: 90, aim: { x: f.turretX, y: f.top, z: 0 } }, 'turretRoof'],
    ]
    for (const [name, shot, zone] of cases) expect(fire(base.target, shot).zone, name).toBe(zone)
  })

  it('misses when the line passes over, beside or under the tank', () => {
    for (const aim of [{ x: 0, y: f.top + 0.5, z: 0 }, { x: 0, y: midTurret, z: f.radius + 1 }, { x: 0, y: f.roof + 0.1, z: f.halfWidth + 2 }]) {
      const result = fire(base.target, { aim })
      expect(result).toMatchObject({ outcome: 'missed', zone: null, entry: null, armour: null, through: false, reached: [] })
    }
  })

  it('meets the plate at the real angle', () => {
    // Square on to an upright plate.
    expect(fire(base.target, { bearingDeg: 90, aim: { x: 1.5, y: midHull, z: 0 } }).armour!.cosine).toBeCloseTo(1, 9)
    // Level, at the glacis: only its slope.
    const slope = (base.spec.hull.glacisAngleDeg * Math.PI) / 180
    expect(fire(base.target, { aim: { x: 0, y: f.roof - 0.2, z: 0 } }).armour!.cosine).toBeCloseTo(Math.cos(slope), 9)
    // From 30 degrees round, it has further to go through the same plate.
    const round = fire(base.target, { bearingDeg: 30, aim: { x: f.upperRun / 2, y: f.belly + f.lowerH + f.upperH / 2, z: 0 } })
    expect(round.zone).toBe('upperGlacis')
    expect(round.armour!.cosine).toBeCloseTo(Math.cos(slope) * Math.cos(Math.PI / 6), 9)
    // Coming down on the glacis, it meets it squarer.
    const diving = fire(base.target, { diveDeg: 30, aim: { x: f.upperRun / 2, y: f.belly + f.lowerH + f.upperH / 2, z: 0 } })
    expect(diving.armour!.cosine).toBeGreaterThan(Math.cos(slope))
  })

  it('gives the same answer every time', () => {
    const shot = { bearingDeg: 40, aim: { x: f.length / 2, y: midHull, z: 0 }, round: THREATS.accord105Sabot, luck: true }
    expect(fire(base.target, shot)).toEqual(fire(base.target, shot))
  })
})

describe('the design office test shot, followed inside', () => {
  it('strikes the zone asked for, and agrees with the test shot on every layer', () => {
    for (const zone of ZONES) {
      for (const angleDeg of TUNING.protection.shotAnglesDeg) {
        for (const id of THREAT_IDS) {
          const setup = { round: THREATS[id], rangeM: 1000, angleDeg, tile: false }
          const traced = paperShot(base.target, base.sheet.geometry, zone, setup)
          const onPaper = testShot(base.spec.armour[zone], base.sheet.geometry.zoneSlopeDeg[zone], setup)
          expect(traced.zone, `${zone} at ${angleDeg}`).toBe(zone)
          expect(traced.armour!.cosine).toBeCloseTo(onPaper.cosine, 9)
          expect(traced.armour!.worthMm).toBeCloseTo(onPaper.worthMm, 6)
          expect(traced.armour!.leftMm).toBeCloseTo(onPaper.leftMm, 6)
          expect(traced.armour!.verdict).toBe(onPaper.verdict)
          expect(traced.armour!.ricochet).toBe(onPaper.ricochet)
          expect(traced.through).toBe(!onPaper.ricochet && onPaper.leftMm > 0)
          expect(traced.track).toBe(false)
        }
      }
    }
  })

  it('aims at a point on the plate', () => {
    for (const zone of ZONES) {
      const line = paperLine(base.target.shell, zone, 0, base.sheet.geometry.zoneSlopeDeg)
      const entry = paperShot(base.target, base.sheet.geometry, zone, { round: PEA, rangeM: 0, angleDeg: 0, tile: false }).entry!
      expect(entry.x).toBeCloseTo(line.aim.x, 6)
      expect(entry.y).toBeCloseTo(line.aim.y, 6)
      expect(entry.z).toBeCloseTo(line.aim.z, 6)
    }
  })

  it('meets a tile only when told to, and sets nothing alight', () => {
    const { target, sheet, spec } = tank((s) => { s.era.upperGlacis = allTiles('upperGlacis') })
    const setup = { round: THREATS.guidedMissile, rangeM: 1000, angleDeg: 0 }
    expect(paperShot(target, sheet.geometry, 'upperGlacis', { ...setup, tile: true }).tile).toBe(true)
    expect(paperShot(target, sheet.geometry, 'upperGlacis', { ...setup, tile: false }).tile).toBe(false)
    for (const zone of ZONES) {
      const result = paperShot(target, sheet.geometry, zone, { round: LANCE, rangeM: 0, angleDeg: 0, tile: false })
      expect(result.fire).toBe('none')
      expect(result.explosion).toBe('none')
      for (const each of result.reached) expect(['fire', 'explosion', 'vented']).not.toContain(each.effect)
    }
    expect(spec.era.upperGlacis).toBe(allTiles('upperGlacis'))
  })

  it('lists the chance of a fire or an explosion at everything that could give one', () => {
    const result = paperShot(base.target, base.sheet.geometry, 'lowerGlacis', { round: LANCE, rangeM: 0, angleDeg: 0, tile: false })
    const chance = Object.fromEntries(result.reached.map((each) => [each.id, each.chance]))
    expect(chance.carousel).toBe(HITS.autoloaderCookOff)
    expect(chance.crossRack).toBe(HITS.cookOff.plainRacks)
    expect(chance.engine).toBe(HITS.engineFire)
    expect(chance.driver).toBeNull()
  })
})

describe('what a shot does inside', () => {
  it('does nothing inside when the armour holds', () => {
    const result = fire(base.target, { round: PEA, bearingDeg: 90, aim: { x: 1.5, y: midHull, z: 0 } })
    expect(result).toMatchObject({ through: false, outcome: 'stopped', reached: [], crewOut: [], spalled: [], end: null })
  })

  it('reaches what lies on its line, nearest first, and nothing off it', () => {
    // Along the middle of the hull, low, from the front: driver, carousel, then the engine bay.
    const low = fire(base.target, { aim: { x: 0, y: f.belly + 0.25, z: 0 }, onPaper: true })
    expect(ids(low)).toEqual(['driver', 'carousel', 'crossRack', 'engine', 'transmission'])
    for (let i = 1; i < low.reached.length; i++) expect(low.reached[i]!.at.x).toBeGreaterThan(low.reached[i - 1]!.at.x)
    // Across the turret at gun height: the breech, with a crewman either side of it.
    const across = fire(base.target, { bearingDeg: 90, aim: { x: f.turretX + 0.2, y: f.gunY, z: 0 }, onPaper: true })
    expect(ids(across)).toEqual(['commander', 'breech', 'gunner'])
    // Through the engine from the side: nothing forward of it.
    expect(ids(fire(base.target, { bearingDeg: 90, aim: { x: f.bayStart + 0.5, y: midHull, z: 0 }, onPaper: true }))).toEqual(['engine'])
  })

  it('stops when what it has left runs out', () => {
    const { target } = tank((s) => { s.armour.hullRear = [{ material: 'rolledSteel', mm: 10 }] })
    const weak: Round = { ...LANCE, penMm: 10 + HITS.stopMm.transmission - 50 }
    const result = fire(target, { round: weak, bearingDeg: 180, aim: { x: f.length, y: midHull, z: 0 }, onPaper: true })
    expect(ids(result)).toEqual(['transmission'])
    expect(result.end!.x).toBeGreaterThan(f.bayStart)
    const strong: Round = { ...LANCE, penMm: 10 + HITS.stopMm.transmission + 50 }
    expect(ids(fire(target, { round: strong, bearingDeg: 180, aim: { x: f.length, y: midHull, z: 0 }, onPaper: true })))
      .toEqual(['transmission', 'engine'])
  })

  it('runs on from the hull into the turret, and from the turret down into the hull', () => {
    // Up through the belly under the turret.
    const up = fire(base.target, { diveDeg: -90, aim: { x: f.turretX + 0.3, y: f.belly, z: 0.5 }, onPaper: true })
    expect(up.zone).toBe('belly')
    expect(ids(up)).toContain('carousel')
    expect(ids(up)).toContain('commander')
    // Down through the turret roof.
    const down = fire(base.target, { diveDeg: 90, aim: { x: f.turretX + 0.3, y: f.top, z: 0.5 }, onPaper: true })
    expect(down.zone).toBe('turretRoof')
    expect(ids(down)).toEqual(['commander', 'carousel'])
  })

  it('counts a crewman on the line as out of action, and a wrecked part as a kill', () => {
    const side = fire(base.target, { bearingDeg: 90, aim: { x: f.turretX + 0.2, y: f.gunY, z: 0 }, onPaper: true })
    expect(side.crewOut.sort()).toEqual(['commander', 'gunner'])
    expect(side.firepowerKill).toBe(true)
    expect(side.mobilityKill).toBe(false)
    expect(side.outcome).toBe('crew')
    const engine = fire(base.target, { bearingDeg: 90, aim: { x: f.bayStart + 0.5, y: midHull, z: 0 }, onPaper: true })
    expect(engine).toMatchObject({ mobilityKill: true, firepowerKill: false, outcome: 'mobility', crewOut: [] })
  })
})

describe('fragments off the plate', () => {
  const aim = { x: f.length * 0.2, y: midHull, z: 0 }
  it('reach a crewman near the hole who is not on the line', () => {
    // Through the hull side just behind the driver.
    const line = { bearingDeg: 90, aim: { x: 1.9, y: midHull, z: 0 }, onPaper: true }
    const bare = fire(base.target, line)
    expect(ids(bare)).not.toContain('driver')
    expect(bare.spalled).toEqual(['driver'])
    expect(bare.crewOut).toEqual(['driver'])
    const lined = fire(tank((s) => { s.protection.spallLiner = true }).target, line)
    expect(lined.spalled).toEqual([])
    expect(lined.crewOut).toEqual([])
  })

  it('never reach anyone when the armour holds', () => {
    expect(fire(base.target, { round: PEA, bearingDeg: 90, aim }).spalled).toEqual([])
  })

  it('carry less far and spread less with a liner', () => {
    expect(HITS.spall.linerReachM).toBeLessThan(HITS.spall.reachM)
    expect(HITS.spall.linerConeDeg).toBeLessThan(HITS.spall.coneDeg)
  })
})

describe('ammunition, fuel and fire', () => {
  /** How often, over many shots, something happens. */
  function share(target: Target, shot: Partial<Incoming> & { aim: Vec }, test: (result: HitResult) => boolean): number {
    let n = 0
    const shots = 400
    for (let i = 0; i < shots; i++) if (test(fire(target, { ...shot, shotNo: i }))) n++
    return n / shots
  }
  const atCarousel = { bearingDeg: 90, aim: { x: f.turretX, y: f.belly + 0.2, z: 0 }, round: THREATS.accord105Shaped }
  const atFuel = { bearingDeg: 270, aim: { x: 1.9, y: f.roof - 0.2, z: 0 }, round: THREATS.accord105Shaped }

  it('sets off rounds in a carousel about as often as the table says, and that is the end of the tank', () => {
    const rate = share(base.target, atCarousel, (r) => r.explosion === 'destroyed')
    expect(rate).toBeGreaterThan(HITS.autoloaderCookOff - 0.08)
    expect(rate).toBeLessThan(HITS.autoloaderCookOff + 0.08)
    const gone = fire(base.target, { ...atCarousel, shotNo: [...Array(50).keys()].find((n) => fire(base.target, { ...atCarousel, shotNo: n }).explosion === 'destroyed')! })
    expect(gone.outcome).toBe('destroyed')
    expect(gone.crewOut.sort()).toEqual(['commander', 'driver', 'gunner'])
    // A wrecked autoloader cannot load the gun, whether or not it blew up.
    expect(share(base.target, atCarousel, (r) => r.firepowerKill)).toBe(1)
  })

  it('is safer with wet stowage, and safest behind blow-out panels', () => {
    const rack = (change: (s: VehicleSpec) => void) => {
      const { target } = tank((s) => { s.loading = 'loader'; s.turret.shape = 'bustle'; s.ammo.rounds = 24; change(s) })
      const g = target.shell.frame
      const shot = { bearingDeg: 180, aim: { x: g.turretX + g.radius + g.bustle, y: (g.bustleFloor + g.top) / 2, z: 0 }, round: THREATS.accord105Shaped }
      expect(ids(fire(target, { ...shot, onPaper: true }))[0]).toBe('bustleRack')
      return {
        lost: share(target, shot, (r) => r.explosion === 'destroyed'),
        vented: share(target, shot, (r) => r.explosion === 'vented'),
      }
    }
    const plain = rack(() => {})
    const wet = rack((s) => { s.ammo.stowage = 'wetStowage' })
    const panels = rack((s) => { s.ammo.stowage = 'blowOutPanels' })
    expect(wet.lost).toBeLessThan(plain.lost - 0.2)
    expect(panels.lost).toBe(0)
    expect(panels.vented).toBeGreaterThan(0.6)
    expect(plain.vented).toBe(0)
  })

  it('makes a round get through an armoured bin first', () => {
    const { target } = tank((s) => { s.loading = 'loader'; s.turret.shape = 'bustle'; s.ammo.rounds = 24; s.ammo.stowage = 'armouredBins' })
    const g = target.shell.frame
    const rear = target.spec.armour.turretRear
    const worth = rear.reduce((sum, layer) => sum + layer.mm * 0.9, 0)
    const aim = { x: g.turretX + g.radius + g.bustle, y: (g.bustleFloor + g.top) / 2, z: 0 }
    const just: Round = { ...LANCE, penMm: worth + HITS.binMm - 5 }
    const held = fire(target, { round: just, bearingDeg: 180, aim })
    expect(held.through).toBe(true)
    expect(held.reached).toMatchObject([{ id: 'bustleRack', effect: 'binHeld' }])
    expect(held.explosion).toBe('none')
    const more: Round = { ...LANCE, penMm: worth + HITS.binMm + 5 }
    expect(fire(target, { round: more, bearingDeg: 180, aim, onPaper: true }).reached[0]!.effect).toBe('holed')
  })

  it('starts a fire in a holed fuel tank some of the time, and suppression puts most of them out', () => {
    expect(ids(fire(base.target, { ...atFuel, onPaper: true }))).toContain('frontTank')
    const fitted = tank((s) => { s.protection.fireSuppression = true }).target
    const bare = tank((s) => { s.protection.fireSuppression = false }).target
    const lit = share(bare, atFuel, (r) => r.fire !== 'none')
    expect(lit).toBeGreaterThan(HITS.fuelFire - 0.08)
    expect(lit).toBeLessThan(HITS.fuelFire + 0.08)
    expect(share(bare, atFuel, (r) => r.fire === 'putOut')).toBe(0)
    expect(share(bare, atFuel, (r) => r.fire === 'burned')).toBeCloseTo(lit, 9)
    // A tank that burns is lost, unless something worse happened first.
    expect(share(bare, atFuel, (r) => r.fire === 'burned' && !['burned', 'destroyed'].includes(r.outcome))).toBe(0)
    const burned = share(fitted, atFuel, (r) => r.fire === 'burned')
    expect(burned).toBeLessThan(lit * 0.35)
    expect(share(fitted, atFuel, (r) => r.fire === 'putOut')).toBeGreaterThan(lit * 0.65)
  })

  it('names the worst thing that happened', () => {
    for (let i = 0; i < 200; i++) {
      const result = fire(base.target, { bearingDeg: (i * 37) % 360, aim: { x: f.length / 2, y: midHull + ((i % 5) - 2) * 0.2, z: 0 }, shotNo: i, round: THREATS.accord105Shaped })
      expect(OUTCOMES).toContain(result.outcome)
      if (result.explosion === 'destroyed') expect(result.outcome).toBe('destroyed')
      else if (result.fire === 'burned') expect(result.outcome).toBe('burned')
      else if (result.crewOut.length > 0) expect(result.outcome).toBe('crew')
      if (!result.through && !result.trackBroken) expect(['stopped', 'skidded', 'missed', 'track']).toContain(result.outcome)
    }
  })
})

describe('tracks and wheels', () => {
  const low = { bearingDeg: 90, aim: { x: f.length * 0.3, y: f.belly + 0.15, z: 0 } }
  it('are in the way of a shot low on the hull side, and take a little out of it', () => {
    const through = fire(base.target, { ...low, round: THREATS.accord105Sabot })
    expect(through.track).toBe(true)
    expect(through.zone).toBe('hullSideFront')
    const clear = fire(base.target, { ...low, round: THREATS.accord105Sabot, aim: { ...low.aim, y: f.roof - 0.1 } })
    expect(clear.track).toBe(false)
    expect(clear.armour!.penMm - through.armour!.penMm).toBeCloseTo(HITS.trackMm.kinetic, 6)
  })

  it('can be broken by a round that never gets into the hull', () => {
    let broken = 0
    for (let i = 0; i < 200; i++) {
      const result = fire(base.target, { ...low, round: THREATS.autocannon, shotNo: i })
      expect(result.through).toBe(false)
      expect(result.mobilityKill).toBe(result.trackBroken)
      expect(result.outcome).toBe(result.trackBroken ? 'mobility' : 'stopped')
      if (result.trackBroken) broken++
    }
    expect(broken / 200).toBeGreaterThan(HITS.trackBreak - 0.1)
    expect(broken / 200).toBeLessThan(HITS.trackBreak + 0.1)
  })

  it('take a shot from the front that is wide of the hull', () => {
    const result = fire(base.target, { aim: { x: 0, y: 0.3, z: (f.bodyHalf + f.halfWidth) / 2 }, shotNo: 3 })
    expect(result.zone).toBeNull()
    expect(result.track).toBe(true)
    expect(['track', 'mobility']).toContain(result.outcome)
  })
})

describe('reactive tiles in a real hit', () => {
  const fitted = tank((s) => { for (const zone of ZONES) s.era[zone] = allTiles(zone) })
  const g = fitted.target.shell.frame

  it('finds the tile place under the point struck, counted as the grid is drawn', () => {
    const { shell } = fitted.target
    const grid = ERA_GRIDS.upperGlacis
    // Top row, the tank's right: the top left of the grid as seen from the front.
    expect(tilePlaceAt(shell, 'upperGlacis', { x: 0, y: g.roof - 0.01, z: g.bodyHalf - 0.01 })).toBe(0)
    expect(tilePlaceAt(shell, 'upperGlacis', { x: 0, y: g.roof - 0.01, z: -g.bodyHalf + 0.01 })).toBe(grid.cols - 1)
    expect(tilePlaceAt(shell, 'upperGlacis', { x: 0, y: g.belly + g.lowerH + 0.01, z: g.bodyHalf - 0.01 })).toBe((grid.rows - 1) * grid.cols)
    // The hull side: the nose end is the left of the grid.
    expect(tilePlaceAt(shell, 'hullSideFront', { x: 0.01, y: g.roof - 0.01, z: g.bodyHalf })).toBe(0)
    expect(tilePlaceAt(shell, 'hullRear', { x: g.length, y: 1, z: 0 })).toBeNull()
    for (const zone of ZONES) {
      const tiles = ERA_GRIDS[zone]
      if (!tiles) continue
      for (const point of [{ x: -5, y: -5, z: -5 }, { x: 50, y: 50, z: 50 }]) {
        const place = tilePlaceAt(shell, zone, point)!
        expect(place).toBeGreaterThanOrEqual(0)
        expect(place).toBeLessThan(tiles.cols * tiles.rows)
      }
    }
  })

  it('meets a tile where one is fitted and bare plate where a hatch is in the way', () => {
    const shot = { round: THREATS.accord105Shaped }
    // The driver's hatch is top centre of the upper glacis.
    expect(fire(fitted.target, { ...shot, aim: { x: 0, y: g.roof - 0.05, z: 0.1 } }).tile).toBe(false)
    expect(fire(fitted.target, { ...shot, aim: { x: 0, y: g.roof - 0.05, z: g.bodyHalf - 0.1 } }).tile).toBe(true)
    expect(fire(base.target, { ...shot, aim: { x: 0, y: g.roof - 0.05, z: g.bodyHalf - 0.1 } }).tile).toBe(false)
  })

  it('uses a tile up: the second round at the same place meets bare plate', () => {
    const spent = new Set<string>()
    const shot = { round: THREATS.accord105Shaped, bearingDeg: 90, aim: { x: g.length * 0.3, y: g.roof - 0.1, z: 0 } }
    const first = fire(fitted.target, shot, spent)
    const second = fire(fitted.target, shot, spent)
    expect(first.tile).toBe(true)
    expect(second.tile).toBe(false)
    expect(second.armour!.worthMm).toBeLessThan(first.armour!.worthMm)
    // The tiles on the other side of the tank are still there.
    expect(fire(fitted.target, { ...shot, bearingDeg: 270 }, spent).tile).toBe(true)
    // With nothing keeping count, a tile is met every time.
    expect(fire(fitted.target, shot).tile).toBe(true)
    expect(fire(fitted.target, shot).tile).toBe(true)
  })
})

describe('luck in what a round goes through', () => {
  it('stays inside the margin of error, so a plate that holds on paper always holds', () => {
    const { target } = tank((s) => { s.armour.hullSideFront = [{ material: 'rolledSteel', mm: 500 }] })
    const pens = new Set<number>()
    for (let i = 0; i < 100; i++) {
      const result = fire(target, { round: THREATS.accord105Sabot, bearingDeg: 90, aim: { x: f.length * 0.3, y: f.roof - 0.1, z: 0 }, shotNo: i, luck: true })
      const paper = 400 - 35
      expect(result.armour!.penMm).toBeGreaterThanOrEqual(paper * (1 - TUNING.protection.marginShare) - 1e-9)
      expect(result.armour!.penMm).toBeLessThanOrEqual(paper * (1 + TUNING.protection.marginShare) + 1e-9)
      pens.add(Math.round(result.armour!.penMm))
      // 500 mm holds on paper with room to spare, so it holds every time.
      expect(result.through).toBe(false)
    }
    expect(pens.size).toBeGreaterThan(20)
  })

  it('decides a shot that is too close to call', () => {
    const { target } = tank((s) => { s.armour.hullSideFront = [{ material: 'rolledSteel', mm: 365 }] })
    let through = 0
    for (let i = 0; i < 200; i++) {
      if (fire(target, { round: THREATS.accord105Sabot, bearingDeg: 90, aim: { x: f.length * 0.3, y: f.roof - 0.1, z: 0 }, shotNo: i, luck: true }).through) through++
    }
    expect(through).toBeGreaterThan(60)
    expect(through).toBeLessThan(140)
  })
})

describe('the test shot behind the armour, in words', () => {
  const setup = { round: LANCE, rangeM: 0, angleDeg: 0, tile: false }
  const words = (zone: ZoneId, change?: (s: VehicleSpec) => void, round: Round = LANCE) => {
    const { spec, sheet, target } = tank(change)
    return behindOf(paperShot(target, sheet.geometry, zone, { ...setup, round }), spec, sheet.crewCount)
  }

  it('says nothing when the armour holds', () => {
    expect(words('upperGlacis', undefined, PEA)).toBeNull()
  })

  it('lists what the round reaches in order, and how it ends', () => {
    const behind = words('lowerGlacis')!
    expect(behind.rows.map((row) => row.name)).toEqual([
      'Driver', 'Autoloader under the turret', 'Rounds ahead of the engine', 'Engine', 'Gearbox', 'The round',
    ])
    expect(behind.rows[0]).toMatchObject({ value: 'Out of action', grave: true })
    expect(behind.rows[1]).toMatchObject({ value: 'Wrecked · 75% they explode', grave: true })
    expect(behind.rows[3]!.value).toBe('Wrecked · 25% it burns')
    expect(behind.rows.at(-1)!.value).toBe('Out the far side')
    expect(behind.sum).toBe('If nothing burns or explodes: 1 of 3 crew out of action, the gun out of use and the tank cannot move.')
    expect(behind.notes).toContain('Rounds that explode outside blow-out panels destroy the tank.')
  })

  it('says where a weaker round stops', () => {
    const weak: Round = { ...LANCE, penMm: 60 }
    const behind = words('hullRear', (s) => { s.armour.hullRear = [{ material: 'rolledSteel', mm: 10 }] }, weak)!
    expect(behind.rows.map((row) => `${row.name}: ${row.value}`)).toEqual(['Gearbox: Wrecked', 'The round: Stops here'])
    expect(behind.sum).toBe('If nothing burns or explodes: the tank cannot move.')
  })

  it('speaks of the protection systems that have a say', () => {
    const bare = words('hullSideRear', (s) => { s.protection.fireSuppression = false; s.protection.spallLiner = false })!
    expect(bare.notes).toContain('No fire suppression is fitted: a fire that starts burns the tank out.')
    // Nobody is near the engine bay, so a liner would change nothing here.
    expect(bare.notes).not.toContain('A spall liner would keep the fragments closer to the line of the shot.')
    expect(words('mantlet')!.notes).toContain('A spall liner would keep the fragments closer to the line of the shot.')
    const fitted = words('hullSideRear', (s) => { s.protection.fireSuppression = true; s.protection.spallLiner = true })!
    expect(fitted.notes).toContain('Fire suppression puts out 85% of fires.')
    expect(fitted.notes).toContain('The spall liner keeps the fragments close to the line of the shot.')
    // The turret roof has no fuel or engine under it.
    expect(words('turretRoof')!.notes.join(' ')).not.toContain('ire suppression')
  })

  it('names the crew that fragments reach', () => {
    const { spec, sheet, target } = tank()
    const result = fire(target, { bearingDeg: 90, aim: { x: 1.9, y: midHull, z: 0 }, onPaper: true })
    expect(behindOf(result, spec, sheet.crewCount)!.notes[0]).toBe('Fragments off the inside of the plate also reach the driver.')
  })

  it('says when rounds are behind blow-out panels, and when a bin keeps the round out', () => {
    const loader = (s: VehicleSpec) => { s.loading = 'loader'; s.turret.shape = 'bustle'; s.ammo.rounds = 24 }
    const panels = words('turretRear', (s) => { loader(s); s.ammo.stowage = 'blowOutPanels' })!
    expect(panels.rows[0]).toMatchObject({ name: 'Rounds in the bustle', value: '75% they go up, vented', grave: false })
    expect(panels.notes).not.toContain('Rounds that explode outside blow-out panels destroy the tank.')
    const { spec, sheet, target } = tank((s) => { loader(s); s.ammo.stowage = 'armouredBins' })
    const worth = spec.armour.turretRear.reduce((sum, layer) => sum + layer.mm * 0.9, 0)
    const just: Round = { ...LANCE, penMm: worth + HITS.binMm - 5 }
    const held = behindOf(paperShot(target, sheet.geometry, 'turretRear', { ...setup, round: just }), spec, sheet.crewCount)!
    expect(held.rows).toEqual([{ name: 'Rounds in the bustle', value: 'The bin keeps it out', grave: false }])
    expect(held.sum).toBe('Nothing vital is on this line.')
  })

  it('has a name for everything inside', () => {
    for (const id of ITEM_IDS) expect(STRINGS.office.armour.behind.items[id].length).toBeGreaterThan(3)
  })
})
