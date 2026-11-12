import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { GUNNERY } from '../src/data/gunnery'
import { GUNNERY_TEST_IDS, MARKS_GEN1, RANGE } from '../src/data/range'
import { LOADING } from '../src/data/parts'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { RANGE_DAY, TURRET_PARTS, firstShotS, hitChance, turretFallbacks } from '../src/sim/gunnery/fire'
import { runGunnery, runLoadingDrill, runProvingGround } from '../src/sim/trials'
import { buildStatSheet, type StatSheet, type VehicleSpec } from '../src/sim/vehicle'
import { faultFix } from '../src/ui/gunneryAdvice'

function spec(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const out = structuredClone(BASELINE_SPEC)
  change?.(out)
  return out
}

function build(change?: (spec: VehicleSpec) => void): StatSheet {
  return buildStatSheet(spec(change), PACT_LIMITS_GEN1)
}

const SEEDS = Array.from({ length: 300 }, (_, index) => 1 + index)

describe('the loading drill', () => {
  it('comes out the same for the same tank and seed', () => {
    const sheet = build()
    expect(runLoadingDrill(sheet.fire, 9)).toEqual(runLoadingDrill(sheet.fire, 9))
  })

  it('fires the long shoot, or every round carried if that is fewer', () => {
    expect(runLoadingDrill(build().fire, 1).rounds).toHaveLength(GUNNERY.loading.drillRounds)
    const few = build((s) => { s.ammo.rounds = 12 })
    expect(runLoadingDrill(few.fire, 1).rounds).toHaveLength(Math.min(GUNNERY.loading.drillRounds, few.fire.carried))
  })

  it('adds up: the rate is the rounds over the time', () => {
    const run = runLoadingDrill(build().fire, 3)
    const total = run.rounds.reduce((sum, round) => sum + round.seconds, 0)
    expect(run.totalS).toBeCloseTo(total, 9)
    expect(run.rpm).toBeCloseTo((run.rounds.length * 60) / total, 9)
  })

  it('keeps a machine at one pace when nothing goes wrong', () => {
    const sheet = build()
    const clean = SEEDS.map((seed) => runLoadingDrill(sheet.fire, seed)).find((run) => run.jams === 0)!
    expect(clean.auto).toBe(true)
    expect(clean.emptyAfter).toBeNull()
    const first = clean.rounds[0]!.seconds
    for (const round of clean.rounds) expect(round.seconds).toBeCloseTo(first, 9)
  })

  it('slows a human loader with every round', () => {
    const run = runLoadingDrill(build((s) => { s.loading = 'loader' }).fire, 1)
    expect(run.auto).toBe(false)
    expect(run.jams).toBe(0)
    expect(run.emptyAfter).toBeNull()
    for (let i = 1; i < run.rounds.length; i++) {
      expect(run.rounds[i]!.seconds).toBeGreaterThan(run.rounds[i - 1]!.seconds)
    }
  })

  it('gives a loader and an autoloader clearly different results', () => {
    const marks = MARKS_GEN1.drillRpm
    const machine = build()
    const byHand = build((s) => { s.loading = 'loader' })
    const machineRuns = SEEDS.map((seed) => runLoadingDrill(machine.fire, seed))
    // The carousel reaches the mark even on its worst day; a loader throwing 125 mm rounds in a cramped turret never does.
    expect(Math.min(...machineRuns.map((run) => run.rpm))).toBeGreaterThan(marks)
    expect(runLoadingDrill(byHand.fire, 1).rpm).toBeLessThan(marks)
    expect(runLoadingDrill(machine.fire, 1).rpm).toBeGreaterThan(runLoadingDrill(byHand.fire, 1).rpm * 1.5)
  })

  it('lets a loader reach the mark with lighter rounds or more room', () => {
    const marks = MARKS_GEN1.drillRpm
    expect(runLoadingDrill(build((s) => { s.loading = 'loader'; s.gun = 'rifled100' }).fire, 1).rpm).toBeGreaterThan(marks)
    expect(runLoadingDrill(build((s) => { s.loading = 'loader'; s.gun = 'rifled120' }).fire, 1).rpm).toBeGreaterThan(marks)
    expect(runLoadingDrill(build((s) => { s.loading = 'loader'; s.crew.comfort = 'improved' }).fire, 1).rpm).toBeGreaterThan(marks)
  })

  it('feeds by hand once the machine is empty', () => {
    const run = runLoadingDrill(build((s) => { s.loading = 'bustleLoader' }).fire, 1)
    const ready = LOADING.bustleLoader.readyRounds
    expect(run.emptyAfter).toBe(ready)
    expect(run.rounds.slice(0, ready).every((round) => !round.byHand)).toBe(true)
    expect(run.rounds.slice(ready).every((round) => round.byHand && !round.jammed)).toBe(true)
    expect(run.rounds[ready]!.seconds).toBeGreaterThan(run.rounds[0]!.seconds * 2)
  })

  it('jams now and then, and counts the time it costs', () => {
    const sheet = build()
    const runs = SEEDS.map((seed) => runLoadingDrill(sheet.fire, seed))
    const jammed = runs.filter((run) => run.jams > 0)
    expect(jammed.length).toBeGreaterThan(SEEDS.length * 0.05)
    expect(jammed.length).toBeLessThan(SEEDS.length * 0.4)
    const one = jammed[0]!
    const clean = runs.find((run) => run.jams === 0)!
    expect(one.rounds.filter((round) => round.jammed)).toHaveLength(one.jams)
    expect(one.totalS).toBeCloseTo(clean.totalS + one.clearingS, 6)
    expect(clean.clearingS).toBe(0)
  })
})

describe('turret parts that fail', () => {
  it('lists only the parts with something plainer to fall back on', () => {
    expect(build().turret.map((part) => part.id)).toEqual(['rangefinder', 'stabiliser', 'computer', 'night'])
    const plain = build((s) => {
      s.fireControl = { sight: 'daySight', rangefinder: 'stadiametric', stabiliser: 'none', computer: 'none', night: 'none', commanderSight: false, searchRadar: false }
    })
    expect(plain.turret).toEqual([])
    const full = build((s) => { s.fireControl.sight = 'improvedDaySight'; s.fireControl.commanderSight = true })
    expect(full.turret.map((part) => part.id)).toEqual([...TURRET_PARTS])
  })

  it('leaves the rest of the design alone', () => {
    const base = spec()
    for (const part of turretFallbacks(base)) {
      expect({ ...part.spec, fireControl: null }).toEqual({ ...base, fireControl: null })
      const changed = Object.keys(base.fireControl).filter(
        (key) => part.spec.fireControl[key as keyof typeof base.fireControl] !== base.fireControl[key as keyof typeof base.fireControl],
      )
      expect(changed).toEqual([part.id])
    }
  })

  it('shoots worse without each part', () => {
    const sheet = build((s) => { s.fireControl.sight = 'improvedDaySight'; s.fireControl.commanderSight = true })
    const round = sheet.fire.rounds[0]!
    const without = (id: string) => sheet.turret.find((part) => part.id === id)!.without
    const moving = { ...RANGE_DAY, moving: true }
    const night = { ...RANGE_DAY, night: true }
    expect(hitChance(without('sight'), round, 1500, RANGE_DAY)).toBeLessThan(hitChance(sheet.fire, round, 1500, RANGE_DAY))
    expect(hitChance(without('rangefinder'), round, 2000, RANGE_DAY)).toBeLessThan(hitChance(sheet.fire, round, 2000, RANGE_DAY))
    expect(hitChance(without('computer'), round, 2000, RANGE_DAY)).toBeLessThan(hitChance(sheet.fire, round, 2000, RANGE_DAY))
    expect(without('stabiliser').moving.halts).toBe(true)
    expect(firstShotS(without('stabiliser'), moving)).toBeGreaterThan(firstShotS(sheet.fire, moving))
    expect(hitChance(without('night'), round, 800, night)).toBeLessThan(hitChance(sheet.fire, round, 800, night))
    expect(firstShotS(without('commanderSight'), RANGE_DAY)).toBeGreaterThan(firstShotS(sheet.fire, RANGE_DAY))
  })

  it('fails a part in a shoot now and then, and shoots that test without it', () => {
    const sheet = build()
    let shoots = 0
    let faults = 0
    for (const seed of SEEDS) {
      const report = runProvingGround(sheet, { seed })
      for (const id of GUNNERY_TEST_IDS) {
        shoots++
        const run = report.gunnery[id]
        const { fault, hitsPassed: _h, timePassed: _t, passed: _p, ...shot } = run
        if (fault === null) {
          expect(shot).toEqual(runGunnery(sheet.fire, id, seed))
        } else {
          faults++
          expect(shot).toEqual(runGunnery(sheet.turret.find((part) => part.id === fault)!.without, id, seed))
        }
      }
    }
    // About one shoot in thirty for the baseline: rare enough to be news, common enough to meet.
    expect(faults / shoots).toBeGreaterThan(0.01)
    expect(faults / shoots).toBeLessThan(0.07)
  })

  it('never fails a part the tank does not have', () => {
    const plain = build((s) => {
      s.fireControl = { sight: 'daySight', rangefinder: 'stadiametric', stabiliser: 'none', computer: 'none', night: 'none', commanderSight: false, searchRadar: false }
    })
    for (const seed of SEEDS.slice(0, 60)) {
      const report = runProvingGround(plain, { seed })
      for (const id of GUNNERY_TEST_IDS) expect(report.gunnery[id].fault).toBeNull()
    }
  })

  it('keeps each part\'s luck when another part is changed', () => {
    const base = build()
    const better = build((s) => { s.fireControl.sight = 'improvedDaySight' })
    const seed = SEEDS.find((each) => runProvingGround(base, { seed: each }).gunnery.onTheMove.fault === 'stabiliser')!
    expect(seed).toBeDefined()
    // The better sight is a new part that might fail first, but if it holds, the stabiliser still goes.
    const fault = runProvingGround(better, { seed }).gunnery.onTheMove.fault
    expect(['sight', 'stabiliser']).toContain(fault)
  })

  it('fails more often with less reliable parts', () => {
    const count = (sheet: StatSheet): number => SEEDS.reduce((sum, seed) => {
      const report = runProvingGround(sheet, { seed })
      return sum + GUNNERY_TEST_IDS.filter((id) => report.gunnery[id].fault !== null).length
    }, 0)
    const fancy = build((s) => {
      s.fireControl = { sight: 'improvedDaySight', rangefinder: 'laser', stabiliser: 'twoPlane', computer: 'electronic', night: 'imageIntensifier', commanderSight: true, searchRadar: false }
    })
    expect(count(fancy)).toBeGreaterThan(count(build()))
    expect(RANGE.gunnery.faultShare).toBeGreaterThan(0)
  })

  it('points the fix at the part that failed', () => {
    expect(faultFix('stabiliser')).toBe('fireControl.stabiliser')
    expect(faultFix('commanderSight')).toBe('fireControl.commanderSight')
  })
})
