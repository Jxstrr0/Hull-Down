import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { BUREAU_IDS, THREAT_TANK_IDS } from '../src/data/opponents'
import { SCORE_AXES, SCORING, TENDER_IDS, TENDERS } from '../src/data/tenders'
import { PACT_LIMITS_GEN1, PACT_LIMITS_GEN3 } from '../src/data/tuning'
import { designRival } from '../src/sim/ai/designer'
import { decide, scoreBid, trialBid, type BidScore } from '../src/sim/career/score'

const T = TENDERS.improvedType1
const base = scoreBid(trialBid(BASELINE_SPEC, T, 101), T)

function scoreOf(total: number, legal = true): BidScore {
  return { legal, axes: { protection: 0, firepower: 0, mobility: 0, reliability: 0, cost: 0 }, weighted: total, failed: 0, penalty: 0, total }
}

describe('the tenders', () => {
  it('weigh the five counts to 100 and stay inside the Pact limits', () => {
    for (const id of TENDER_IDS) {
      const tender = TENDERS[id]
      expect(SCORE_AXES.reduce((sum, axis) => sum + tender.weights[axis], 0)).toBe(100)
      // The Pact rebuilt its bridges for generation three; the rail width never changed.
      const pact = (tender.limits.generation ?? 1) >= 3 ? PACT_LIMITS_GEN3 : PACT_LIMITS_GEN1
      expect(tender.limits.maxMassT).toBeLessThanOrEqual(pact.maxMassT)
      expect(tender.limits.maxWidthM).toBeLessThanOrEqual(PACT_LIMITS_GEN1.maxWidthM)
      expect(tender.limits.maxUnitCostKr).toBeGreaterThan(SCORING.cost.bestKr)
      // A self-propelled gun fights from beyond the hill, an infantry fighting vehicle is judged on its squad, a scout car is meant not to
      // be seen and an anti-aircraft gun vehicle is judged on the aircraft it brings down, so none meets a tank.
      if (tender.marks.fireMission || tender.marks.squad || tender.marks.scout || tender.marks.air) expect(tender.threats).toEqual([])
      else expect(tender.threats.length).toBeGreaterThan(0)
      for (const threat of tender.threats) expect(THREAT_TANK_IDS).toContain(threat)
    }
  })

  it('the first one asks more of the night shoot than the Type 1 gives', () => {
    const bid = trialBid(BASELINE_SPEC, T, 101)
    expect(bid.sheet.issues).toEqual([])
    expect(bid.range.gunnery.night.passed).toBe(false)
    expect(bid.range.tests - bid.range.passes).toBe(1)
  })
})

describe('marking a bid', () => {
  it('gives the same marks for the same tank and seed', () => {
    expect(scoreBid(trialBid(BASELINE_SPEC, T, 101), T)).toEqual(base)
  })

  it('keeps every count between 0 and 100 and adds up as the tender says', () => {
    for (const seed of [101, 102, 103]) {
      for (const spec of [BASELINE_SPEC, ...BUREAU_IDS.map((bureau) => designRival(bureau, T.limits, seed))]) {
        const score = scoreBid(trialBid(spec, T, seed), T)
        let weighted = 0
        for (const axis of SCORE_AXES) {
          expect(score.axes[axis]).toBeGreaterThanOrEqual(0)
          expect(score.axes[axis]).toBeLessThanOrEqual(100)
          weighted += (score.axes[axis] * T.weights[axis]) / 100
        }
        expect(score.weighted).toBeCloseTo(weighted, 9)
        expect(score.penalty).toBe(score.failed * SCORING.failedTest)
        expect(score.total).toBeCloseTo(Math.max(0, score.weighted - score.penalty), 9)
      }
    }
  })

  it('takes marks off the Type 1 for the test it fails', () => {
    expect(base.legal).toBe(true)
    expect(base.failed).toBe(1)
    expect(base.total).toBeCloseTo(base.weighted - SCORING.failedTest, 9)
  })

  it('rewards a better night sight with firepower, charges for it in cost, and comes out ahead', () => {
    const better = structuredClone(BASELINE_SPEC)
    better.fireControl.night = 'imageIntensifier'
    const score = scoreBid(trialBid(better, T, 101), T)
    expect(score.failed).toBe(0)
    expect(score.axes.firepower).toBeGreaterThan(base.axes.firepower)
    expect(score.axes.cost).toBeLessThan(base.axes.cost)
    expect(score.total).toBeGreaterThan(base.total)
  })

  it('marks more armour up on protection and down on mobility', () => {
    const thick = structuredClone(BASELINE_SPEC)
    for (const zone of ['upperGlacis', 'turretFrontLeft', 'turretFrontRight'] as const) {
      thick.armour[zone] = thick.armour[zone].map((layer) => ({ ...layer, mm: Math.round(layer.mm * 1.12) }))
    }
    const bid = trialBid(thick, T, 101)
    const score = scoreBid(bid, T)
    expect(bid.sheet.massT).toBeGreaterThan(42)
    expect(score.axes.protection).toBeGreaterThan(base.axes.protection)
    expect(score.axes.mobility).toBeLessThan(base.axes.mobility)
  })

  it('throws out a bid over the cost ceiling', () => {
    const tight = { ...T, limits: { ...T.limits, maxUnitCostKr: 2_000_000 } }
    const score = scoreBid(trialBid(BASELINE_SPEC, tight, 101), tight)
    expect(score.legal).toBe(false)
    expect(score.axes.cost).toBe(0)
  })

  it('has every rival bureau put in a legal bid', () => {
    for (let seed = 101; seed < 113; seed++) {
      for (const bureau of BUREAU_IDS) {
        const bid = trialBid(designRival(bureau, T.limits, seed), T, seed)
        expect(bid.sheet.issues.filter((issue) => issue.severity === 'error')).toEqual([])
        expect(bid.duels.map((each) => each.threat)).toEqual([...T.threats])
      }
    }
  }, 30_000)
})

describe('the decision', () => {
  it('ranks the bids best first', () => {
    expect(decide([{ score: scoreOf(50), unitCostKr: 2 }, { score: scoreOf(70), unitCostKr: 2 }, { score: scoreOf(60), unitCostKr: 2 }])).toEqual([1, 2, 0])
  })

  it('puts a bid that breaks a limit last, whatever its marks', () => {
    expect(decide([{ score: scoreOf(90, false), unitCostKr: 1 }, { score: scoreOf(40), unitCostKr: 2 }])).toEqual([1, 0])
  })

  it('gives level bids to the cheaper tank, then to the first to bid', () => {
    expect(decide([{ score: scoreOf(60), unitCostKr: 3 }, { score: scoreOf(60), unitCostKr: 2 }])).toEqual([1, 0])
    expect(decide([{ score: scoreOf(60), unitCostKr: 2 }, { score: scoreOf(60), unitCostKr: 2 }])).toEqual([0, 1])
  })
})
