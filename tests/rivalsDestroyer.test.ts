// The tank destroyer tender of 1991: which rival bureaux bid a casemate.
import { describe, expect, it } from 'vitest'
import { BUREAU_IDS, BUREAUS } from '../src/data/opponents'
import { LOADING, TURRETS } from '../src/data/parts'
import { TENDER_IDS, TENDERS } from '../src/data/tenders'
import { designRival, draftRival, reviseRival } from '../src/sim/ai/designer'
import { rivalBid } from '../src/sim/career/rival'
import { buildStatSheet } from '../src/sim/vehicle'

const T = TENDERS.destroyer1991
const SEEDS = [101, 102, 103, 104, 105, 106, 107, 108]
const casemate = (shape: keyof typeof TURRETS): boolean => TURRETS[shape].swingDeg !== null

describe('the rival bureaux asked for a tank destroyer', () => {
  it('put the light and the gunnery bureau in casemates, and leave the heavy bureau its turret', () => {
    expect(BUREAUS.heavy).not.toHaveProperty('destroyer')
    for (const seed of SEEDS) {
      expect(designRival('light', T.limits, seed).turret.shape).toBe('casemate')
      expect(designRival('firepower', T.limits, seed).turret.shape).toBe('casemate')
      expect(casemate(designRival('heavy', T.limits, seed).turret.shape)).toBe(false)
    }
  })

  it('bid no casemate on any other tender', () => {
    for (const id of TENDER_IDS.filter((each) => each !== 'destroyer1991')) {
      for (const seed of SEEDS) {
        for (const bureau of BUREAU_IDS) expect(casemate(designRival(bureau, TENDERS[id].limits, seed).turret.shape), `${id} ${bureau}`).toBe(false)
      }
    }
  })

  it('put in casemates that can be built', () => {
    for (const seed of SEEDS) {
      for (const bureau of BUREAU_IDS) {
        const sheet = buildStatSheet(designRival(bureau, T.limits, seed), T.limits)
        expect(sheet.issues.filter((issue) => issue.severity === 'error'), `${bureau} ${seed}`).toEqual([])
      }
    }
  })

  it('keep the casemate whatever a trial teaches them, and fit no loader that needs a bustle', () => {
    for (const seed of SEEDS) {
      for (const bureau of ['light', 'firepower'] as const) {
        let draft = draftRival(bureau, T.limits, seed)
        for (let turn = 0; turn < 3; turn++) draft = reviseRival(draft, bureau, T.limits, ['berm', 'drill', 'halted']) ?? draft
        expect(draft.spec.turret.shape).toBe('casemate')
        expect(LOADING[draft.spec.loading].needsBustle).toBe(false)
        expect(buildStatSheet(draft.spec, T.limits).issues.filter((issue) => issue.severity === 'error')).toEqual([])
      }
    }
  })

  it('still enter a legal bid once the trials are done', () => {
    for (const seed of SEEDS.slice(0, 4)) {
      for (const bureau of BUREAU_IDS) {
        const entry = rivalBid(bureau, T, seed)
        expect(entry.score.legal, `${bureau} ${seed}`).toBe(true)
        if (bureau !== 'heavy') expect(entry.bid.spec.turret.shape).toBe('casemate')
      }
    }
  }, 30_000)
})
