// The self-propelled gun tender of 2008: judged on a fire mission, not on tank shoots and duels.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BUREAU_IDS } from '../src/data/opponents'
import { SERVICE } from '../src/data/service'
import { STRINGS } from '../src/data/strings'
import { TENDER_IDS, TENDERS } from '../src/data/tenders'
import { compareTrials } from '../src/office/compareTrials'
import { cleanCareer } from '../src/persist/careerCodec'
import { CAREER_FORMAT, newCareer, tenderIdOf, trialSeed } from '../src/sim/career/career'
import { recordYear } from '../src/sim/career/record'
import { rivalBid } from '../src/sim/career/rival'
import { scoreBid, trialBid } from '../src/sim/career/score'
import { fieldReport } from '../src/sim/career/service'
import { gunRingMm, type VehicleSpec } from '../src/sim/vehicle'
import { exerciseLine, lessonLines } from '../src/ui/serviceWords'
import { failedTests } from '../src/ui/careerWords'

const SLOW = 60_000
const T = TENDERS.spg2008

function spg(change?: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.gun = 'howitzer155'
  spec.turret.shape = 'casemate'
  spec.loading = 'loader'
  spec.ammo.rounds = 30
  change?.(spec)
  spec.turret.ringMm = gunRingMm(spec)
  return spec
}

describe('the self-propelled gun tender of 2008', () => {
  it('comes between the tank tenders of 2001 and 2016, with generation two parts and only the howitzer', () => {
    const at = TENDER_IDS.indexOf('spg2008')
    expect(TENDER_IDS[at - 1]).toBe('tank2001')
    expect(TENDER_IDS[at + 1]).toBe('tank2016')
    expect(T.year).toBeGreaterThan(TENDERS.tank2001.year)
    expect(T.year).toBeLessThan(TENDERS.tank2016.year)
    expect(T.limits.generation).toBe(2)
    expect(T.limits.allowedCalibresMm).toEqual([155])
    expect(T.threats).toEqual([])
    expect(T.marks.fireMission).toBeDefined()
    expect(Math.max(...Object.values(T.weights))).toBe(T.weights.firepower)
    expect(STRINGS.tenders.spg2008.name).not.toBe('')
    expect(STRINGS.tenders.spg2008.brief).not.toBe('')
  })

  it('counts the drive, the endurance run, the armour and the fire mission, and nothing else', () => {
    const bid = trialBid(spg(), T, 7)
    expect(bid.sheet.issues.filter((issue) => issue.severity === 'error')).toEqual([])
    expect(bid.range.selfPropelled).toBe(true)
    expect(bid.range.tests).toBe(5)
    expect(bid.range.fireMission).not.toBeNull()
    expect(bid.duels).toEqual([])
    // The tank shoots are still run, but a miss there is not a test failed.
    for (const name of failedTests(bid.range)) {
      expect([STRINGS.range.drill.title, STRINGS.range.berm.title, ...Object.values(STRINGS.range.gunnery.titles)]).not.toContain(name)
    }
  })

  it('scores firepower from the fire mission, so a gun quicker to lay and closer on the grid scores more', () => {
    const slow = scoreBid(trialBid(spg(), T, 7), T)
    const quick = scoreBid(trialBid(spg((s) => { s.fireControl.computer = 'digital' }), T, 7), T)
    expect(slow.legal && quick.legal).toBe(true)
    expect(quick.axes.firepower).toBeGreaterThan(slow.axes.firepower)
    for (const axis of Object.values(quick.axes)) {
      expect(axis).toBeGreaterThanOrEqual(0)
      expect(axis).toBeLessThanOrEqual(100)
    }
  })

  it('leaves the tank-only rows out when two of its builds are compared', () => {
    const a = trialBid(spg(), T, 7).range
    const b = trialBid(spg((s) => { s.fireControl.computer = 'digital' }), T, 7).range
    const keys = compareTrials(a, b).map((move) => move.key)
    expect(keys).toContain('missionRate')
    for (const key of ['drill', 'berm', 'firstShot', 'hits:halted']) expect(keys).not.toContain(key)
  })

  it('lets every rival bureau put in a legal bid with the howitzer', () => {
    for (const bureau of BUREAU_IDS) {
      const rival = rivalBid(bureau, T, 5)
      expect(rival.score.legal, bureau).toBe(true)
      expect(rival.bid.spec.gun, bureau).toBe('howitzer155')
    }
  }, SLOW)

  it('goes into service with no exercise against tanks', () => {
    const report = fieldReport(spg(), T, SERVICE.defaultProduction, 1, 9)
    expect(report.exercise).toBeNull()
    expect(exerciseLine(report)).toBe(STRINGS.service.report.noExercise)
    expect(lessonLines(report)).toEqual([])
    const year = recordYear(report)
    expect(year.won + year.lost + year.drawn).toBe(0)
  })
})

describe('a career saved before the self-propelled gun tender came in', () => {
  const old = (tenderNo: number) => cleanCareer({ ...JSON.parse(JSON.stringify(newCareer(11))), format: 2, tenderNo })!

  it('stays where it was up to 2001, and moves on one place from 2016', () => {
    expect(tenderIdOf(old(0))).toBe('improvedType1')
    expect(tenderIdOf(old(1))).toBe('destroyer1991')
    expect(tenderIdOf(old(2))).toBe('tank2001')
    expect(tenderIdOf(old(3))).toBe('tank2016')
    expect(old(3).format).toBe(CAREER_FORMAT)
  })

  it('keeps the trial luck of the tender of 2016', () => {
    expect(trialSeed(old(3))).toBe(trialSeed({ ...newCareer(11), tenderNo: TENDER_IDS.indexOf('tank2016') }))
  })
})
