// The self-propelled gun tender of 2008: what the rival bureaux draw up, and what they learn from a fire mission.
import { describe, expect, it } from 'vitest'
import { BUREAU_IDS, BUREAUS } from '../src/data/opponents'
import { TENDER_IDS, TENDERS } from '../src/data/tenders'
import { COMPUTERS } from '../src/data/parts'
import { draftRival, reviseRival, wantsHowitzer } from '../src/sim/ai/designer'
import { lessonsOf } from '../src/sim/career/rival'
import { trialBid } from '../src/sim/career/score'
import { BASELINE_SPEC } from '../src/data/baseline'
import { review } from '../src/sim/career/advisor'
import { buildStatSheet, gunRingMm } from '../src/sim/vehicle'
import { remarkText } from '../src/ui/advisorWords'

const T = TENDERS.spg2008
const SEEDS = [101, 102, 103, 104]

describe('the rival bureaux asked for a self-propelled gun', () => {
  it('know a tender for one by its taking only howitzers', () => {
    for (const id of TENDER_IDS) expect(wantsHowitzer(TENDERS[id].limits), id).toBe(id === 'spg2008')
  })

  it('draw up a howitzer that can be built, carrying the rounds they choose for it', () => {
    for (const bureau of BUREAU_IDS) {
      for (const seed of SEEDS) {
        const { spec } = draftRival(bureau, T.limits, seed)
        expect(spec.gun, bureau).toBe('howitzer155')
        expect(spec.ammo.rounds).toBeLessThanOrEqual(BUREAUS[bureau].spg.rounds)
        expect(buildStatSheet(spec, T.limits).issues.filter((issue) => issue.severity === 'error'), `${bureau} ${seed}`).toEqual([])
      }
    }
  })

  it('build lighter than for a tank, since a gun that stays back needs less armour', () => {
    for (const bureau of BUREAU_IDS) {
      const gun = buildStatSheet(draftRival(bureau, T.limits, 101).spec, T.limits)
      const tank = buildStatSheet(draftRival(bureau, TENDERS.tank2001.limits, 101).spec, TENDERS.tank2001.limits)
      expect(gun.massT, bureau).toBeLessThan(tank.massT)
    }
  })

  it('put the light and the gunnery bureau in casemates', () => {
    for (const seed of SEEDS) {
      expect(draftRival('light', T.limits, seed).spec.turret.shape).toBe('casemate')
      expect(draftRival('firepower', T.limits, seed).spec.turret.shape).toBe('casemate')
    }
  })

  it('learn only from the tests that count: a late or wide fire mission, never the tank shoots', () => {
    const { spec } = draftRival('light', T.limits, 101)
    const range = trialBid(spec, T, 101).range
    const lessons = lessonsOf(range)
    for (const tankOnly of ['night', 'onTheMove', 'halted', 'berm']) expect(lessons).not.toContain(tankOnly)
    const mission = range.fireMission!
    expect(lessons.includes('fireData')).toBe(!mission.timePassed || !mission.closePassed)
    expect(lessons.includes('drill')).toBe(!mission.ratePassed)
  })

  it('fit a better computer when the fire data was slow', () => {
    const draft = draftRival('light', T.limits, 101)
    const next = reviseRival(draft, 'light', T.limits, ['fireData'])
    expect(next).not.toBeNull()
    const ids = Object.keys(COMPUTERS)
    expect(ids.indexOf(next!.spec.fireControl.computer)).toBeGreaterThan(ids.indexOf(draft.spec.fireControl.computer))
  })
})

describe('the chief engineer, on a self-propelled gun', () => {
  it('speaks of the fire mission, and never of the tank shoots, the drill or the berm', () => {
    const spec = structuredClone(BASELINE_SPEC)
    spec.gun = 'howitzer155'
    spec.turret.shape = 'casemate'
    spec.loading = 'loader'
    spec.ammo.rounds = 30
    spec.turret.ringMm = gunRingMm(spec)
    const kinds = review(spec, T).map((remark) => remark.kind)
    expect(kinds).toContain('missionFirst')
    expect(kinds).toContain('missionRate')
    for (const tankOnly of ['shoot', 'slowShot', 'drill', 'berm']) expect(kinds).not.toContain(tankOnly)
    for (const remark of review(spec, T)) expect(remarkText(remark)).not.toBe('')
  })
})
