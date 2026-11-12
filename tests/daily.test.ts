import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { DAILY, WISH_IDS } from '../src/data/daily'
import { BUREAU_IDS } from '../src/data/opponents'
import { SCORE_AXES, TENDERS, TENDER_IDS } from '../src/data/tenders'
import type { BidLine } from '../src/sim/career/career'
import { betterTry, dailyChallenge, dailyRivals, dateOfDay, dayNumber, enterDaily } from '../src/sim/career/daily'

// The challenge of the day (plan PR 17): one shared requirement and seed.

const FIRST = dayNumber({ year: 2026, month: 11, day: 11 })
const DAYS = Array.from({ length: 120 }, (_, index) => FIRST + index)

describe('day numbers', () => {
  it('counts days from 1 January 1970', () => {
    expect(dayNumber({ year: 1970, month: 1, day: 1 })).toBe(0)
    expect(dayNumber({ year: 1970, month: 1, day: 2 })).toBe(1)
    expect(dayNumber({ year: 2000, month: 3, day: 1 })).toBe(11017)
    expect(dayNumber({ year: 2026, month: 11, day: 11 })).toBe(20768)
  })

  it('steps by one over month ends, year ends and leap days', () => {
    expect(dayNumber({ year: 2027, month: 1, day: 1 }) - dayNumber({ year: 2026, month: 12, day: 31 })).toBe(1)
    expect(dayNumber({ year: 2028, month: 3, day: 1 }) - dayNumber({ year: 2028, month: 2, day: 28 })).toBe(2)
    expect(dayNumber({ year: 2027, month: 3, day: 1 }) - dayNumber({ year: 2027, month: 2, day: 28 })).toBe(1)
  })

  it('turns back into the same date', () => {
    for (const day of [0, 59, 11016, 11017, FIRST, FIRST + 51, FIRST + 475]) expect(dayNumber(dateOfDay(day))).toBe(day)
    expect(dateOfDay(FIRST)).toEqual({ year: 2026, month: 11, day: 11 })
  })
})

describe('the challenge of the day', () => {
  const challenges = DAYS.map(dailyChallenge)

  it('is the same for everyone on the same day', () => {
    expect(dailyChallenge(FIRST)).toEqual(dailyChallenge(FIRST))
    expect(dailyChallenge(FIRST).seed).not.toBe(dailyChallenge(FIRST + 1).seed)
  })

  it('stands on a career tender, tightened but never loosened', () => {
    for (const each of challenges) {
      const base = TENDERS[each.basis]
      expect(each.tender.limits.maxMassT).toBe(base.limits.maxMassT - each.massCutT)
      expect(each.massCutT).toBeGreaterThanOrEqual(0)
      expect(each.tender.limits.maxUnitCostKr).toBeLessThanOrEqual(base.limits.maxUnitCostKr)
      expect(each.tender.limits.generation).toBe(base.limits.generation)
      expect(each.tender.marks).toBe(base.marks)
      expect(each.tender.threats).toBe(base.threats)
    }
  })

  it('weighs the five counts to 100, whatever the army wants', () => {
    for (const wish of WISH_IDS) {
      expect(SCORE_AXES.reduce((sum, axis) => sum + DAILY.wishes[wish][axis], 0)).toBe(100)
    }
    for (const each of challenges) expect(each.tender.weights).toEqual(DAILY.wishes[each.wish])
  })

  it('varies: every tank tender and every wish turns up, and never the tank destroyer\'s', () => {
    const bases = new Set(challenges.map((each) => each.basis))
    expect(bases.has('destroyer1991')).toBe(false)
    expect(bases.size).toBe(TENDER_IDS.length - 1)
    expect(new Set(challenges.map((each) => each.wish)).size).toBe(WISH_IDS.length)
    expect(new Set(challenges.map((each) => each.massCutT)).size).toBe(new Set(DAILY.massCutsT).size)
  })
})

describe('entering the challenge', () => {
  const sample = DAYS.slice(0, 14).map((day) => {
    const challenge = dailyChallenge(day)
    return { challenge, rivals: dailyRivals(challenge) }
  })

  it('has every rival bureau bid, the same way each time', () => {
    const { challenge, rivals } = sample[0]!
    expect(rivals.map((each) => each.who)).toEqual([...BUREAU_IDS])
    expect(dailyRivals(challenge)).toEqual(rivals)
  })

  it('always has a rival worth beating, and not always the same one', () => {
    const winners = new Set<string>()
    for (const { rivals } of sample) {
      const legal = rivals.filter((each) => each.legal)
      expect(legal.length).toBeGreaterThanOrEqual(2)
      winners.add([...legal].sort((a, b) => b.total - a.total)[0]!.who)
    }
    expect(winners.size).toBeGreaterThanOrEqual(2)
  })

  it('places the player among the four bids', () => {
    const { challenge, rivals } = sample[0]!
    const result = enterDaily(BASELINE_SPEC, challenge, rivals)
    expect(result.day).toBe(challenge.day)
    expect(result.bids).toHaveLength(4)
    expect(result.bids[result.place - 1]).toBe(result.mine)
    expect(result.mine.who).toBe('bureau')
    expect(enterDaily(BASELINE_SPEC, challenge, rivals)).toEqual(result)
  })

  it('throws out a design that breaks the day\'s limits', () => {
    const { challenge, rivals } = sample.find((each) => each.rivals.every((rival) => rival.legal))!
    const tight = { ...challenge, tender: { ...challenge.tender, limits: { ...challenge.tender.limits, maxMassT: 20 } } }
    const result = enterDaily(BASELINE_SPEC, tight, rivals)
    expect(result.mine.legal).toBe(false)
    expect(result.place).toBe(4)
  })
})

describe('the best try of the day', () => {
  const made = (place: number, total: number, legal = true): { place: number; mine: BidLine } => ({
    place,
    mine: { who: 'bureau', legal, axes: { protection: 0, firepower: 0, mobility: 0, reliability: 0, cost: 0 }, failed: 0, total, unitCostKr: 1, revisions: 0 },
  })

  it('is the first try when there is no other', () => {
    expect(betterTry(made(4, 10), null)).toBe(true)
  })

  it('goes by place, then by marks', () => {
    expect(betterTry(made(1, 50), made(2, 60))).toBe(true)
    expect(betterTry(made(3, 70), made(2, 60))).toBe(false)
    expect(betterTry(made(2, 61), made(2, 60))).toBe(true)
    expect(betterTry(made(2, 60), made(2, 60))).toBe(false)
  })

  it('never prefers a bid that was thrown out', () => {
    expect(betterTry(made(4, 90, false), made(4, 20))).toBe(false)
    expect(betterTry(made(4, 20), made(4, 90, false))).toBe(true)
  })
})
