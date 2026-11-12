// Intelligence files: estimates of the Accord's tanks that sharpen with time.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { INTEL, INTEL_FACTS, INTEL_GRADES } from '../src/data/intel'
import { THREAT_TANK_IDS } from '../src/data/opponents'
import { STRINGS } from '../src/data/strings'
import { buildPrototype, newCareer, type Career } from '../src/sim/career/career'
import { intelFile, intelFiles, intelGrade, trueFigures } from '../src/sim/career/intel'

const width = (career: Career, threat: 'palisade' | 'palisadeB') =>
  intelFile(career, threat)!.figures.reduce((sum, figure) => sum + (figure.high - figure.low), 0)

describe('intelligence files', () => {
  const start = newCareer(8)

  it('have words for every grade and figure', () => {
    for (const grade of INTEL_GRADES) expect(STRINGS.career.intel.grades[grade]).not.toBe('')
    for (const fact of INTEL_FACTS) expect(STRINGS.career.intel.facts[fact]).not.toBe('')
    expect(INTEL.spread.confirmed).toBe(0)
  })

  it('know the tank in service for certain and the new one only by rumour', () => {
    expect(intelGrade(start, 'warden')).toBe('confirmed')
    expect(intelGrade(start, 'palisade')).toBe('rumour')
    expect(intelGrade(start, 'palisadeB')).toBeNull()
    expect(intelFile(start, 'palisadeB')).toBeNull()
    expect(intelFiles(start).map((file) => file.threat)).toEqual(['warden', 'palisade'])
    const truth = trueFigures('warden')
    for (const figure of intelFile(start, 'warden')!.figures) {
      expect(figure.low).toBe(figure.high)
      expect(Math.abs(figure.low - truth[figure.fact])).toBeLessThanOrEqual(INTEL.round[figure.fact] / 2)
    }
  })

  it('always hold the truth inside every range, whatever the career', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const tenderNo of [0, 1, 2, 3]) {
        const career = { ...newCareer(seed), tenderNo }
        for (const threat of THREAT_TANK_IDS) {
          const file = intelFile(career, threat)
          if (!file) continue
          const truth = trueFigures(threat)
          for (const figure of file.figures) {
            expect(figure.low).toBeLessThanOrEqual(truth[figure.fact] + INTEL.round[figure.fact] / 2)
            expect(figure.high).toBeGreaterThanOrEqual(truth[figure.fact] - INTEL.round[figure.fact] / 2)
          }
        }
      }
    }
  })

  it('sharpen with each prototype built, and never widen', () => {
    const one = buildPrototype(start, BASELINE_SPEC)
    expect(intelGrade(one, 'palisade')).toBe('report')
    expect(width(one, 'palisade')).toBeLessThan(width(start, 'palisade'))
    const before = intelFile(start, 'palisade')!.figures
    intelFile(one, 'palisade')!.figures.forEach((figure, at) => {
      expect(figure.low).toBeGreaterThanOrEqual(before[at]!.low)
      expect(figure.high).toBeLessThanOrEqual(before[at]!.high)
    })
  })

  it('sharpen from tender to tender', () => {
    const next = { ...start, tenderNo: 1 }
    expect(intelGrade(next, 'palisade')).toBe('assessed')
    expect(intelGrade(next, 'palisadeB')).toBeNull()
    expect(intelFiles(next).map((file) => file.threat)).toEqual(['warden', 'palisade'])
    const later = { ...start, tenderNo: 2 }
    expect(intelGrade(later, 'palisadeB')).toBe('rumour')
    expect(intelFiles(later).map((file) => file.threat)).toEqual(['palisade', 'palisadeB'])
  })

  it('are the same every time for the same career, and differ between careers', () => {
    expect(intelFile(start, 'palisade')).toEqual(intelFile(newCareer(8), 'palisade'))
    const others = [9, 10, 11].map((seed) => JSON.stringify(intelFile(newCareer(seed), 'palisade')))
    expect(others.some((each) => each !== JSON.stringify(intelFile(start, 'palisade')))).toBe(true)
  })
})
