import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { DUEL, DUEL_GROUND_IDS } from '../src/data/duel'
import { ACCORD_LIMITS, THREAT_TANKS } from '../src/data/opponents'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { designRival } from '../src/sim/ai/designer'
import { combatantOf, type Combatant } from '../src/sim/duel/duel'
import { DUEL_FINDING_KINDS, runCard, runSeries, type DuelSeries } from '../src/sim/duel/series'
import type { VehicleSpec } from '../src/sim/vehicle'

const LIMITS = PACT_LIMITS_GEN1
const baseline = combatantOf(BASELINE_SPEC, LIMITS)
const palisade = combatantOf(THREAT_TANKS.palisade.spec, ACCORD_LIMITS, THREAT_TANKS.palisade.rounds)
const warden = combatantOf(THREAT_TANKS.warden.spec, ACCORD_LIMITS, THREAT_TANKS.warden.rounds)
const light = combatantOf(designRival('light', LIMITS, 101), LIMITS)
const firepower = combatantOf(designRival('firepower', LIMITS, 101), LIMITS)
const SEED = 101

function withSpec(change: (spec: VehicleSpec) => void): Combatant {
  const spec = JSON.parse(JSON.stringify(BASELINE_SPEC)) as VehicleSpec
  change(spec)
  return combatantOf(spec, LIMITS)
}

const kinds = (series: DuelSeries): string[] => series.findings.map((finding) => finding.kind)

describe('a duel series', () => {
  it('comes out the same for the same tanks, ground, seed and count', () => {
    expect(runSeries(baseline, warden, 'meeting', SEED)).toEqual(runSeries(baseline, warden, 'meeting', SEED))
  })

  it('differs with the seed, and from ground to ground on one seed', () => {
    const a = runSeries(baseline, warden, 'meeting', 1)
    const b = runSeries(baseline, warden, 'meeting', 2)
    expect(a.duels.map((duel) => duel.seed)).not.toEqual(b.duels.map((duel) => duel.seed))
    const card = runCard(baseline, warden, 1)
    expect(new Set(card.flatMap((series) => series.duels.map((duel) => duel.seed))).size).toBe(card.length * DUEL.runs)
  })

  it('fights every ground, in order, the set number of times', () => {
    const card = runCard(baseline, warden, SEED)
    expect(card.map((series) => series.ground)).toEqual([...DUEL_GROUND_IDS])
    for (const series of card) expect(series.duels).toHaveLength(DUEL.runs)
    expect(runSeries(baseline, warden, 'meeting', SEED, 7).duels).toHaveLength(7)
  })

  it('adds up', () => {
    for (const foe of [warden, palisade, light, firepower]) {
      for (const series of runCard(baseline, foe, SEED)) {
        const n = series.duels.length
        expect(series.won + series.lost + series.drawn).toBe(n)
        expect(series.won).toBe(series.duels.filter((duel) => duel.winner === 0).length)
        expect(series.lost).toBe(series.duels.filter((duel) => duel.winner === 1).length)
        expect(series.shotFirst[0] + series.shotFirst[1]).toBeLessThanOrEqual(n)
        expect(Object.values(series.wonBy).reduce((sum, each) => sum + each, 0)).toBe(series.won)
        expect(Object.values(series.lostBy).reduce((sum, each) => sum + each, 0)).toBe(series.lost)
        for (const no of [0, 1] as const) {
          const tally = series.tally[no]
          expect(tally.fired).toBe(series.duels.reduce((sum, duel) => sum + duel.sides[no].fired, 0))
          expect(tally.hits).toBe(series.duels.reduce((sum, duel) => sum + duel.sides[no].hits, 0))
          expect(tally.through).toBeLessThanOrEqual(tally.hits)
          expect(tally.hits + tally.berm).toBeLessThanOrEqual(tally.fired)
        }
        // Every round that got through the tank under test is put down to a plate.
        expect(series.holes.reduce((sum, hole) => sum + hole.count, 0)).toBe(series.tally[1].through)
        for (let i = 1; i < series.holes.length; i++) {
          expect(series.holes[i]!.count).toBeLessThanOrEqual(series.holes[i - 1]!.count)
        }
      }
    }
  })

  it('names at most three things, heaviest first, each with a duel that shows it', () => {
    for (const foe of [warden, palisade, light, firepower]) {
      for (const series of runCard(baseline, foe, SEED)) {
        expect(series.findings.length).toBeLessThanOrEqual(DUEL.report.findings)
        for (let i = 1; i < series.findings.length; i++) {
          expect(series.findings[i]!.weight).toBeLessThanOrEqual(series.findings[i - 1]!.weight)
        }
        expect(new Set(kinds(series)).size).toBe(series.findings.length)
        for (const finding of series.findings) {
          expect(DUEL_FINDING_KINDS).toContain(finding.kind)
          expect(finding.count).toBeGreaterThan(0)
          expect(finding.count).toBeLessThanOrEqual(finding.of)
          const duel = series.duels[finding.duelIndex]
          expect(duel, finding.kind).toBeDefined()
          if (finding.kind === 'magazine') expect(duel).toMatchObject({ winner: 1, end: 'destroyed' })
          if (finding.kind === 'burned') expect(duel).toMatchObject({ winner: 1, end: 'burned' })
          if (finding.kind === 'outdrawn') expect(duel?.firstShotBy).toBe(1)
          if (finding.kind === 'shotFirst') expect(duel?.firstShotBy).toBe(0)
          if (finding.kind === 'neverFired') expect(duel?.sides[0].fired).toBe(0)
          if (finding.kind === 'holed') {
            expect(finding.zone).toBe(series.holes[0]?.zone)
            expect(finding.fix).toEqual({ zone: finding.zone })
            expect(duel?.shots.some((shot) => shot.by === 1 && shot.hit?.through && shot.hit.zone === finding.zone)).toBe(true)
          }
          // Good news needs no fixing; bad news always says where to look.
          if (finding.good) expect(finding.fix).toBeNull()
          else expect(finding.fix).not.toBeNull()
        }
      }
    }
  })

  it('points every fix at a control the design office has', () => {
    const controls = Object.keys(STRINGS.controls)
    for (const foe of [warden, palisade, light, firepower]) {
      for (const series of runCard(baseline, foe, SEED)) {
        for (const finding of series.findings) {
          if (finding.fix && 'part' in finding.fix) expect(controls).toContain(finding.fix.part)
        }
      }
    }
  })

  it('says the Palisade shoots first and shrugs off the hits, and where to look', () => {
    const series = runSeries(baseline, palisade, 'meeting', SEED)
    expect(series.lost).toBeGreaterThan(series.won)
    const outdrawn = series.findings.find((finding) => finding.kind === 'outdrawn')
    expect(outdrawn?.fix).toEqual({ part: 'fireControl.rangefinder' })
    expect(kinds(series)).toContain('bouncing')
  })

  it('is outdrawn less often once the sights are put right', () => {
    const quick = withSpec((spec) => {
      spec.fireControl = { ...spec.fireControl, rangefinder: 'laser', computer: 'electronic', sight: 'improvedDaySight', commanderSight: true }
    })
    const before = runSeries(baseline, palisade, 'meeting', SEED, 60)
    const after = runSeries(quick, palisade, 'meeting', SEED, 60)
    expect(after.shotFirst[0]).toBeGreaterThan(before.shotFirst[0] + 10)
    expect(after.shotFirst[1]).toBeLessThan(before.shotFirst[1])
    expect(after.won).toBeGreaterThan(before.won)
  })

  it('points at the night sight in the dark', () => {
    const series = runSeries(baseline, firepower, 'night', SEED)
    const fixes = series.findings.map((finding) => finding.fix)
    expect(fixes).toContainEqual({ part: 'fireControl.night' })
  })

  it('has only good news against a tank it beats soundly', () => {
    const series = runSeries(baseline, light, 'defend', SEED)
    expect(series.won).toBeGreaterThan(series.lost * 2)
    expect(series.findings.length).toBeGreaterThan(0)
    expect(series.findings[0]?.good).toBe(true)
  })

  it('says nothing about hits when there were too few to judge', () => {
    const series = runSeries(baseline, palisade, 'meeting', SEED, 1)
    for (const finding of series.findings) {
      if (finding.kind === 'bouncing' || finding.kind === 'gotThrough') expect(series.tally[0].hits).toBeGreaterThanOrEqual(DUEL.report.fewest)
    }
  })
})
