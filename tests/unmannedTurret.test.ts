// Generation three: the turret with nobody in it.
import { describe, expect, it } from 'vitest'
import { THREATS } from '../src/data/ammo'
import { BASELINE_SPEC } from '../src/data/baseline'
import { ACTIVE, ELECTRICS, TURRETS } from '../src/data/parts'
import { RESEARCH } from '../src/data/research'
import { STRINGS } from '../src/data/strings'
import { TENDERS } from '../src/data/tenders'
import { cleanSpec } from '../src/persist/specCodec'
import { workloadAt } from '../src/sim/crew/stations'
import { buildStatSheet, targetOf, traceShot, type Limits, type VehicleSpec } from '../src/sim/vehicle'

const T3 = TENDERS.tank2016

function tank(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return spec
}

/** The Type 1 made over as far as an unmanned turret asks: a machine to load it and a digital computer. */
const crewedTwin = tank((spec) => {
  spec.loading = 'carousel'
  spec.fireControl.computer = 'digital'
})
const unmanned = tank((spec) => {
  spec.loading = 'carousel'
  spec.fireControl.computer = 'digital'
  spec.turret.shape = 'unmanned'
})

const codes = (spec: VehicleSpec, limits: Limits = T3.limits): string[] => buildStatSheet(spec, limits).issues.map((issue) => issue.code)

describe('the unmanned turret', () => {
  it('is the only turret with nobody in it, and has its words', () => {
    for (const [id, turret] of Object.entries(TURRETS)) expect(turret.crewed, id).toBe(id !== 'unmanned')
    expect(STRINGS.parts.turrets.unmanned.name).not.toBe('')
    expect(STRINGS.career.research.projects.unmannedTurret.name).not.toBe('')
    expect(STRINGS.dataSheet.stations.sources.screens).not.toBe('')
    expect(RESEARCH.unmannedTurret.needs).toContain('digitalComputer')
  })

  it('comes with generation three and its own research', () => {
    expect(codes(unmanned, TENDERS.tank2001.limits)).toContain('notYetAvailable')
    expect(codes(unmanned)).not.toContain('notYetAvailable')
    expect(codes(unmanned, { ...T3.limits, locked: ['turret.shape:unmanned'] })).toContain('notResearched')
  })

  it('can be built on the Type 1 with an autoloader and a digital computer', () => {
    expect(buildStatSheet(unmanned, T3.limits).issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('asks for an autoloader, the engine at the back and a digital computer', () => {
    const byHand = buildStatSheet(tank((spec) => {
      spec.turret.shape = 'unmanned'
      spec.fireControl.computer = 'digital'
      spec.loading = 'loader'
    }), T3.limits)
    expect(byHand.issues.find((issue) => issue.code === 'turretNeedsAutoloader')?.part).toBe('loading')
    const frontEngine = structuredClone(unmanned)
    frontEngine.hull.engineAt = 'front'
    expect(buildStatSheet(frontEngine, T3.limits).issues.find((issue) => issue.code === 'turretNeedsRearEngine')?.part).toBe('hull.engineAt')
    const plain = structuredClone(unmanned)
    plain.fireControl.computer = 'electronic'
    expect(buildStatSheet(plain, T3.limits).issues.find((issue) => issue.code === 'turretNeedsComputer')?.part).toBe('fireControl.computer')
    for (const code of ['turretNeedsAutoloader', 'turretNeedsRearEngine', 'turretNeedsComputer'] as const) {
      expect(STRINGS.issues[code]).not.toBe('')
      expect(codes(crewedTwin)).not.toContain(code)
    }
  })

  it('is lighter and lower than the same tank with a crewed turret', () => {
    const before = buildStatSheet(crewedTwin, T3.limits)
    const after = buildStatSheet(unmanned, T3.limits)
    expect(after.massT).toBeLessThan(before.massT - 0.5)
    expect(after.geometry.heightM).toBeLessThan(before.geometry.heightM)
    expect(after.rollup.capacityM3).toBeLessThan(before.rollup.capacityM3)
  })

  it('gives the commander more to do', () => {
    const before = buildStatSheet(crewedTwin, T3.limits)
    const after = buildStatSheet(unmanned, T3.limits)
    expect(workloadAt(after.crew, 'commander')).toBe(workloadAt(before.crew, 'commander') + TURRETS.unmanned.workload)
    expect(workloadAt(after.crew, 'gunner')).toBe(workloadAt(before.crew, 'gunner'))
    expect(after.crew.find((station) => station.id === 'commander')?.shares.some((share) => share.source === 'screens')).toBe(true)
  })

  it('draws power: with hard kill as well it takes everything the tank makes', () => {
    expect(buildStatSheet(unmanned, T3.limits).electrics.drawKw).toBe(TURRETS.unmanned.drawKw)
    const both = structuredClone(unmanned)
    both.protection.active = 'hardKill'
    expect(buildStatSheet(both, T3.limits).issues.find((issue) => issue.code === 'overPowerBudget')?.part).toBe('powerpack.apu')
    both.powerpack.apu = true
    const sheet = buildStatSheet(both, T3.limits)
    expect(sheet.electrics.drawKw).toBe(TURRETS.unmanned.drawKw + ACTIVE.hardKill.drawKw)
    expect(sheet.electrics.drawKw).toBeLessThanOrEqual(ELECTRICS.generatorKw + ELECTRICS.apuKw)
    expect(sheet.issues.map((issue) => issue.code)).not.toContain('overPowerBudget')
  })
})

describe('the crew of an unmanned turret', () => {
  const sheet = buildStatSheet(unmanned, T3.limits)
  const crew = sheet.interior.items.filter((item) => item.kind === 'crew')

  it('all sit in the hull, three abreast in the nose', () => {
    expect(crew.map((item) => item.id).sort()).toEqual(['commander', 'driver', 'gunner'])
    for (const seat of crew) {
      expect(seat.part, seat.id).toBe('hull')
      expect(seat.box.y1, seat.id).toBeLessThanOrEqual(sheet.interior.frame.roof)
    }
    const z = (id: string): number => {
      const seat = crew.find((item) => item.id === id)!
      return (seat.box.z0 + seat.box.z1) / 2
    }
    expect(z('gunner')).toBeLessThan(z('driver'))
    expect(z('commander')).toBeGreaterThan(z('driver'))
  })

  it('leave the racks and tanks beside the driver no room: they go across the hull', () => {
    const ids = sheet.interior.items.map((item) => item.id)
    expect(ids).not.toContain('frontRack')
    expect(ids).not.toContain('frontTank')
    expect(ids).toContain('crossTank')
    const stowed = sheet.interior.items.reduce((sum, item) => sum + item.rounds, 0)
    expect(stowed).toBe(unmanned.ammo.rounds)
    expect(sheet.interior.items.reduce((sum, item) => sum + item.litres, 0)).toBe(unmanned.powerpack.fuelL)
  })

  it('are out of the way of a round that goes through the turret', () => {
    const through = { kind: 'shaped', speedMs: 900, spreadM: 0.5, penMm: 5000, lossPerKmMm: 0 } as const
    const crewHit = (spec: VehicleSpec): number => {
      const s = buildStatSheet(spec, T3.limits)
      const target = targetOf(spec, s.geometry, s.interior)
      const f = target.shell.frame
      let out = 0
      for (let shotNo = 0; shotNo < 40; shotNo++) {
        // Across the turret from the tank's right, a little behind its centre, where a crewed turret keeps its men.
        const aim = { x: f.turretX + f.radius * 0.3, y: (f.roof + f.top) / 2, z: 0 }
        out += traceShot(target, { round: through, rangeM: 300, bearingDeg: 90, diveDeg: 0, aim, seed: 5, shotNo }).crewOut.length
      }
      return out
    }
    expect(crewHit(crewedTwin)).toBeGreaterThan(0)
    expect(crewHit(unmanned)).toBe(0)
    expect(THREATS.topAttackMissile.flight).toBe('missile')
  })
})

describe('a saved design', () => {
  it('keeps its unmanned turret', () => {
    expect(cleanSpec(JSON.parse(JSON.stringify(unmanned))).turret.shape).toBe('unmanned')
  })
})
