import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { CARD } from '../src/data/card'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { afterAction, runProvingGround } from '../src/sim/trials'
import { buildStatSheet, type VehicleSpec } from '../src/sim/vehicle'
import { pathOf, viewOf } from '../src/ui/afterAction'
import { cardFacts, cardFileName, wrapText } from '../src/ui/shareCard'

function facts(change?: (spec: VehicleSpec) => void, projectNo = 101) {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  const sheet = buildStatSheet(spec, PACT_LIMITS_GEN1)
  const range = runProvingGround(sheet, { seed: projectNo })
  const report = afterAction(range.armour, spec)
  return { spec, sheet, range, report, card: cardFacts(range, report, sheet, spec, projectNo) }
}

/** Every letter as wide as the next: enough to test where lines break. */
const measure = (text: string): number => text.length * 10

describe('what the share card says', () => {
  const base = facts()

  it('names the design, its project and its weight', () => {
    expect(base.card.name).toBe(base.sheet.name)
    expect(facts((spec) => { spec.name = '' }).card.name).toBe(STRINGS.office.designs.unnamed)
    expect(base.card.subject).toBe(`Project 101 · ${base.sheet.massT.toFixed(1)} t`)
    expect(facts((spec) => { spec.name = 'Bison' }).card.name).toBe('Bison')
  })

  it('stamps a pass with a tick and a fail with a cross', () => {
    expect(base.card.passed).toBe(true)
    expect(base.card.stamp).toBe(`✓ Passed ${base.range.tests} of ${base.range.tests} tests`)
    const thin = facts((spec) => { spec.armour.upperGlacis = [{ material: spec.armour.upperGlacis[0]!.material, mm: 30 }] })
    expect(thin.card.passed).toBe(false)
    expect(thin.card.stamp).toMatch(/^✗ Passed \d+ of \d+ tests$/)
  })

  it('counts the rounds', () => {
    const { report, card } = base
    expect(card.tally).toBe(`${report.shots.length} rounds · ${report.stopped} stopped · ${report.through} through`)
  })

  it('shows the worst round and says what it was', () => {
    const { report, card } = base
    expect(card.shown).toBe(report.shots[report.worstIndex!])
    expect(card.caption).toContain(`Round ${report.worstIndex! + 1}:`)
    expect(card.caption).toContain(STRINGS.zones[card.shown!.serial.zone].name)
    expect(card.caption).toContain(STRINGS.threats[card.shown!.serial.threat].name)
    expect(card.caption).not.toMatch(/[{}]|undefined/)
  })

  it('carries the same findings as the report, in the same order', () => {
    expect(base.card.findings.length).toBe(base.report.findings.length)
    expect(base.card.findings[0]).toContain('ammunition')
    for (const text of base.card.findings) expect(text).not.toMatch(/[{}]|undefined/)
  })
})

describe('wrapping text', () => {
  it('breaks on spaces and keeps every line within the width', () => {
    const text = 'The ammunition was reached by four rounds and exploded three times'
    const lines = wrapText(text, 200, measure)
    expect(lines.join(' ')).toBe(text)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(200)
  })

  it('leaves a word that is too long on a line of its own', () => {
    expect(wrapText('a Sturmgeschuetzabteilung b', 100, measure)).toEqual(['a', 'Sturmgeschuetzabteilung', 'b'])
  })

  it('ends the last line allowed with an ellipsis, still within the width', () => {
    const lines = wrapText('one two three four five six seven eight nine ten', 100, measure, 2)
    expect(lines.length).toBe(2)
    expect(lines[1]!.endsWith('…')).toBe(true)
    expect(measure(lines[1]!)).toBeLessThanOrEqual(100)
    expect(lines[0]).toBe('one two')
  })

  it('gives nothing for nothing', () => {
    expect(wrapText('   ', 100, measure)).toEqual([])
  })
})

describe('the picture file', () => {
  it('is named after the design, in plain letters', () => {
    expect(cardFileName('Bison Mk II')).toBe('hull-down-bison-mk-ii.png')
    expect(cardFileName('  Żubr / 2 ')).toBe('hull-down-zubr-2.png')
    expect(cardFileName('???')).toBe('hull-down-design.png')
    expect(cardFileName('x'.repeat(80)).length).toBeLessThanOrEqual('hull-down-.png'.length + 32)
  })
})

describe('the round on the picture', () => {
  const { report } = facts()

  it('starts outside, runs to the plate, and stops there when the armour holds', () => {
    const line = report.shots.find((each) => !each.shot.hit.through)!
    const path = pathOf(line, viewOf(line.shot.hit))
    expect(path.end).toBeNull()
    expect(path.beyond).toBeNull()
    expect(path.reached).toEqual([])
    expect(Math.hypot(path.strike[0] - path.from[0], path.strike[1] - path.from[1])).toBeGreaterThan(0.5)
  })

  it('carries on inside when the round gets through, past the far side when it goes out again', () => {
    const inside = report.shots.find((each) => each.shot.hit.through && !each.shot.hit.exits)!
    const stopped = pathOf(inside, viewOf(inside.shot.hit))
    expect(stopped.end).not.toBeNull()
    expect(stopped.beyond).toBeNull()
    expect(stopped.reached.length).toBe(inside.shot.hit.reached.length)
    const out = report.shots.find((each) => each.shot.hit.exits)!
    expect(pathOf(out, viewOf(out.shot.hit)).beyond).not.toBeNull()
  })

  it('puts a round from the front on the side view at its own height', () => {
    const line = report.shots.find((each) => each.serial.zone === 'lowerGlacis')!
    const path = pathOf(line, 'side')
    expect(path.strike[0]).toBeCloseTo(line.shot.hit.entry!.x, 6)
    expect(path.strike[1]).toBeCloseTo(-line.shot.hit.entry!.y, 6)
    expect(path.from[0]).toBeLessThan(path.strike[0])
  })
})

describe('the card table', () => {
  it('is a portrait picture with everything inside it', () => {
    expect(CARD.width).toBe(1080)
    expect(CARD.height).toBe(1350)
    expect(CARD.picture.y + CARD.picture.height).toBeLessThan(CARD.caption.y)
    expect(CARD.decided.bottom).toBeLessThan(CARD.credit.y)
    expect(CARD.credit.y).toBeLessThan(CARD.height - 20)
  })
})
