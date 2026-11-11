// Generation three: active protection, and the electrical power it draws.
import { describe, expect, it } from 'vitest'
import { THREATS, type Round } from '../src/data/ammo'
import { BASELINE_SPEC } from '../src/data/baseline'
import { ACTIVE, ELECTRICS } from '../src/data/parts'
import { MARKS_GEN2, MARKS_GEN3 } from '../src/data/range'
import { RESEARCH } from '../src/data/research'
import { STRINGS } from '../src/data/strings'
import { TENDERS } from '../src/data/tenders'
import { cleanSpec } from '../src/persist/specCodec'
import { runProvingGround } from '../src/sim/trials'
import { buildStatSheet, targetOf, traceShot, type Limits, type Target, type VehicleSpec } from '../src/sim/vehicle'
import { serialWords } from '../src/ui/armourCards'

const T3 = TENDERS.tank2016
const T2 = TENDERS.tank2001

function tank(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return spec
}

const codes = (spec: VehicleSpec, limits: Limits): string[] => buildStatSheet(spec, limits).issues.map((issue) => issue.code)

function targetFor(spec: VehicleSpec): Target {
  const sheet = buildStatSheet(spec, T3.limits)
  return targetOf(spec, sheet.geometry, sheet.interior)
}

/** The share of 200 rounds at the turret front that active protection deals with. */
function defeatedShare(spec: VehicleSpec, round: Round, onPaper = false): number {
  const target = targetFor(spec)
  const f = target.shell.frame
  const aim = { x: 0, y: (f.roof + f.top) / 2, z: 0 }
  let defeated = 0
  for (let shotNo = 0; shotNo < 200; shotNo++) {
    const hit = traceShot(target, { round, rangeM: 500, bearingDeg: 0, diveDeg: 0, aim, seed: 11, shotNo, onPaper })
    if (hit.defeated) {
      defeated++
      expect(hit.through).toBe(false)
      expect(hit.outcome).toBe('stopped')
      expect(hit.defeated).toBe(spec.protection.active)
    }
  }
  return defeated / 200
}

const soft = tank((spec) => { spec.protection.active = 'softKill' })
const hard = tank((spec) => {
  spec.protection.active = 'hardKill'
  spec.powerpack.apu = true
})

describe('the active protection systems', () => {
  it('cost weight, money and power, hard kill most of all', () => {
    const none = buildStatSheet(BASELINE_SPEC, T3.limits)
    const softSheet = buildStatSheet(soft, T3.limits)
    const hardSheet = buildStatSheet(tank((spec) => { spec.protection.active = 'hardKill' }), T3.limits)
    expect(none.electrics.drawKw).toBe(0)
    expect(softSheet.massT).toBeGreaterThan(none.massT)
    expect(hardSheet.massT).toBeGreaterThan(softSheet.massT)
    expect(hardSheet.unitCostKr).toBeGreaterThan(softSheet.unitCostKr)
    expect(softSheet.unitCostKr).toBeGreaterThan(none.unitCostKr)
    expect(hardSheet.electrics.drawKw).toBeGreaterThan(softSheet.electrics.drawKw)
    expect(hardSheet.reliabilityIndex).toBeLessThan(none.reliabilityIndex)
  })

  it('have a name and a note each, and so do their research projects', () => {
    for (const id of ['none', 'softKill', 'hardKill'] as const) {
      expect(STRINGS.parts.active[id].name).not.toBe('')
      expect(STRINGS.parts.active[id].note).not.toBe('')
    }
    expect(RESEARCH.hardKill.needs).toContain('softKill')
    expect(STRINGS.career.research.projects.softKill.name).not.toBe('')
    expect(STRINGS.career.research.projects.hardKill.name).not.toBe('')
  })

  it('come with their generation: soft kill in 2001, hard kill in 2016', () => {
    expect(codes(soft, TENDERS.improvedType1.limits)).toContain('notYetAvailable')
    expect(codes(soft, T2.limits)).not.toContain('notYetAvailable')
    expect(codes(hard, T2.limits)).toContain('notYetAvailable')
    expect(codes(hard, T3.limits)).not.toContain('notYetAvailable')
    expect(codes(hard, { ...T3.limits, locked: ['protection.active:hardKill'] })).toContain('notResearched')
  })
})

describe('electrical power', () => {
  it('runs soft kill off the generator, and hard kill only with the auxiliary power unit', () => {
    expect(ACTIVE.softKill.drawKw).toBeLessThanOrEqual(ELECTRICS.generatorKw)
    expect(ACTIVE.hardKill.drawKw).toBeGreaterThan(ELECTRICS.generatorKw)
    expect(ACTIVE.hardKill.drawKw).toBeLessThanOrEqual(ELECTRICS.generatorKw + ELECTRICS.apuKw)
    expect(codes(soft, T3.limits)).not.toContain('overPowerBudget')
    expect(codes(hard, T3.limits)).not.toContain('overPowerBudget')
    const short = buildStatSheet(tank((spec) => { spec.protection.active = 'hardKill' }), T3.limits)
    const fault = short.issues.find((issue) => issue.code === 'overPowerBudget')
    expect(fault?.severity).toBe('error')
    expect(fault?.part).toBe('powerpack.apu')
    expect(fault?.value).toBe(ACTIVE.hardKill.drawKw)
    expect(fault?.limit).toBe(ELECTRICS.generatorKw)
    expect(STRINGS.issues.overPowerBudget).toContain('{value}')
  })
})

describe('a round on its way in', () => {
  it('is left alone when it comes from a gun or drops from a drone', () => {
    for (const id of ['accord120Sabot', 'accord105Shaped', 'autocannon', 'droneBomblet'] as const) {
      expect(defeatedShare(hard, THREATS[id]), id).toBe(0)
    }
  })

  it('is thrown off by soft kill about half the time if it is a missile, never if it is a rocket', () => {
    expect(defeatedShare(soft, THREATS.tandemRocket)).toBe(0)
    const share = defeatedShare(soft, THREATS.tandemMissile)
    expect(share).toBeGreaterThan(ACTIVE.softKill.defeats.missile - 0.12)
    expect(share).toBeLessThan(ACTIVE.softKill.defeats.missile + 0.12)
  })

  it('is shot down by hard kill four times in five, rocket or missile', () => {
    for (const id of ['tandemRocket', 'tandemMissile', 'topAttackMissile'] as const) {
      const share = defeatedShare(hard, THREATS[id])
      expect(share, id).toBeGreaterThan(ACTIVE.hardKill.defeats.missile - 0.1)
      expect(share, id).toBeLessThan(ACTIVE.hardKill.defeats.missile + 0.1)
    }
  })

  it('always arrives with nothing fitted, and on paper', () => {
    expect(defeatedShare(BASELINE_SPEC, THREATS.tandemMissile)).toBe(0)
    expect(defeatedShare(hard, THREATS.tandemMissile, true)).toBe(0)
  })
})

describe('at the armour trial', () => {
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]
  const missile = (spec: VehicleSpec, seed: number) => {
    const report = runProvingGround(buildStatSheet(spec, T3.limits), { seed, marks: MARKS_GEN3 })
    return report.armour.serials[MARKS_GEN3.armour.length - 1]!
  }

  it('hard kill keeps most top-attack missiles off a roof that armour cannot save', () => {
    let bare = 0
    let guarded = 0
    let dealtWith = 0
    for (const seed of SEEDS) {
      expect(missile(BASELINE_SPEC, seed).defeated).toBe(0)
      bare += missile(BASELINE_SPEC, seed).through
      const serial = missile(hard, seed)
      expect(serial.threat).toBe('topAttackMissile')
      guarded += serial.through
      dealtWith += serial.defeated
      expect(serial.through + serial.defeated).toBe(serial.shots.length)
      if (serial.defeated > 0) expect(serialWords(serial).join(' ')).toContain('Active protection')
    }
    expect(bare).toBe(SEEDS.length * 3)
    expect(guarded).toBeLessThan(bare / 2)
    expect(dealtWith).toBeGreaterThan(bare / 2)
  })

  it('does nothing for the roof under the bomblets, or for the 2001 range against gun rounds', () => {
    for (const seed of SEEDS.slice(0, 3)) {
      const report = runProvingGround(buildStatSheet(hard, T3.limits), { seed, marks: MARKS_GEN3 })
      expect(report.armour.failed).toContain('turretRoof')
      expect(report.armour.failed).toContain('hullRoof')
      for (const serial of report.armour.serials.slice(0, MARKS_GEN2.armour.length)) {
        if (THREATS[serial.threat].kind === 'kinetic') expect(serial.defeated).toBe(0)
      }
    }
  })
})

describe('a saved design', () => {
  it('keeps its active protection, and one from before it has none', () => {
    expect(cleanSpec(JSON.parse(JSON.stringify(hard))).protection.active).toBe('hardKill')
    const old = JSON.parse(JSON.stringify(BASELINE_SPEC)) as { protection: { active?: string } }
    delete old.protection.active
    expect(cleanSpec(old).protection.active).toBe('none')
    const odd = JSON.parse(JSON.stringify(BASELINE_SPEC)) as { protection: { active?: string } }
    odd.protection.active = 'forceField'
    expect(cleanSpec(odd).protection.active).toBe('none')
  })
})
