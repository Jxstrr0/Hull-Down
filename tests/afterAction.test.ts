import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { MARKS_GEN1, RANGE, type ArmourSerial } from '../src/data/range'
import { REPORT } from '../src/data/report'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { STRINGS } from '../src/data/strings'
import { afterAction, runArmourTrial, timelineOf, weigh, type Finding, type ShotLine } from '../src/sim/trials'
import { OUTCOMES, allTiles, buildStatSheet, setTile, type VehicleSpec } from '../src/sim/vehicle'
import { findingText, resultText, shotRows, viewOf } from '../src/ui/afterAction'

function build(change?: (spec: VehicleSpec) => void) {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return { spec, sheet: buildStatSheet(spec, PACT_LIMITS_GEN1) }
}

function trial(change?: (spec: VehicleSpec) => void, serials: readonly ArmourSerial[] = MARKS_GEN1.armour, seed = 101) {
  const { spec, sheet } = build(change)
  const run = runArmourTrial(sheet.target, sheet.geometry.zoneSlopeDeg, serials, seed)
  return { spec, run, report: afterAction(run, spec), all: weigh(run, spec) }
}

const SEEDS = [101, 1, 7, 23, 512]

describe('the timeline', () => {
  it('lists every round in the order it was fired', () => {
    const { run, report } = trial()
    expect(report.shots.length).toBe(MARKS_GEN1.armour.length * RANGE.armour.shots)
    report.shots.forEach((line, n) => {
      expect(line.index).toBe(n)
      expect(line.serialNo).toBe(Math.floor(n / RANGE.armour.shots))
      expect(line.roundNo).toBe(n % RANGE.armour.shots)
      expect(line.serial).toBe(run.serials[line.serialNo])
      expect(line.shot).toBe(run.serials[line.serialNo]!.shots[line.roundNo])
    })
    expect(timelineOf(run)).toEqual(report.shots)
  })

  it('gives the same report for the same trial', () => {
    expect(trial().report).toEqual(trial().report)
  })

  it('has nothing to say about a trial that fired nothing', () => {
    const { report } = trial(undefined, [])
    expect(report.shots).toEqual([])
    expect(report.worstIndex).toBeNull()
    expect(report.findings).toEqual([])
  })
})

describe('the tallies', () => {
  it('add up to the rounds fired', () => {
    for (const seed of SEEDS) {
      const { report } = trial(undefined, MARKS_GEN1.armour, seed)
      const hits = report.shots.map((line) => line.shot.hit)
      expect(report.stopped + report.through).toBe(hits.length)
      expect(report.through).toBe(hits.filter((hit) => hit.through).length)
      expect(report.tracks).toBe(hits.filter((hit) => hit.trackBroken).length)
      expect(Object.values(report.outcomes).reduce((a, b) => a + b, 0)).toBe(hits.length)
      for (const outcome of OUTCOMES) expect(report.outcomes[outcome]).toBe(hits.filter((hit) => hit.outcome === outcome).length)
    }
  })

  it('count the rounds that put each station out of action', () => {
    const { report } = trial()
    for (const station of ['commander', 'gunner', 'driver', 'loader'] as const) {
      expect(report.crewOut[station]).toBe(report.shots.filter((line) => line.shot.hit.crewOut.includes(station)).length)
    }
    // The baseline has an autoloader and no loader.
    expect(report.crewOut.loader).toBe(0)
    expect(report.crewOut.gunner).toBeGreaterThan(0)
  })

  it('count the rounds that reached each part, crew left out', () => {
    const { report } = trial()
    expect(report.parts.length).toBeGreaterThan(0)
    for (const part of report.parts) {
      expect(['driver', 'gunner', 'commander', 'loader']).not.toContain(part.id)
      expect(part.rounds).toBe(report.shots.filter((line) => line.shot.hit.reached.some((each) => each.id === part.id)).length)
    }
  })

  it('point at the first round with the worst result', () => {
    for (const seed of SEEDS) {
      const { report } = trial(undefined, MARKS_GEN1.armour, seed)
      const rank = report.shots.map((line) => OUTCOMES.indexOf(line.shot.hit.outcome))
      expect(report.worstIndex).toBe(rank.indexOf(Math.max(...rank)))
    }
  })
})

describe('what decided it', () => {
  it('names no more than three things, heaviest first', () => {
    for (const seed of SEEDS) {
      const { report, all } = trial(undefined, MARKS_GEN1.armour, seed)
      expect(report.findings.length).toBeLessThanOrEqual(REPORT.findings)
      expect(report.findings).toEqual(all.slice(0, REPORT.findings))
      for (let n = 1; n < all.length; n++) expect(all[n - 1]!.weight).toBeGreaterThanOrEqual(all[n]!.weight)
      for (const finding of all) expect(report.shots[finding.shotIndex]).toBeDefined()
    }
  })

  it('finds the baseline loses its ammunition, its crew to fragments, and has a weak lower glacis', () => {
    const { report } = trial()
    expect(report.findings.map((finding) => finding.kind)).toEqual(['magazine', 'fragments', 'weakPlate'])
    const [magazine, fragments, weak] = report.findings
    expect(magazine!.fix).toEqual({ control: 'ammo.stowage' })
    expect(report.shots[magazine!.shotIndex]!.shot.hit.explosion).toBe('destroyed')
    expect(fragments!.fix).toEqual({ control: 'protection.spallLiner' })
    expect(report.shots[fragments!.shotIndex]!.shot.hit.spalled.length).toBeGreaterThan(0)
    expect(weak).toMatchObject({ zone: 'lowerGlacis', worst: 'destroyed', fix: { zone: 'lowerGlacis' } })
  })

  it('puts a plate that had to hold, and did not, first', () => {
    const { run, report } = trial((spec) => { spec.armour.upperGlacis = [{ material: spec.armour.upperGlacis[0]!.material, mm: 30 }] })
    expect(run.failed).toContain('upperGlacis')
    const first = report.findings[0]!
    expect(first).toMatchObject({ kind: 'gateFailed', zone: 'upperGlacis', fix: { zone: 'upperGlacis' } })
    expect(first.count).toBe(first.of)
    const line = report.shots[first.shotIndex]!
    expect(line.serial.zone).toBe('upperGlacis')
    expect(line.serial.gate).toBe(true)
    expect(line.shot.hit.outcome).toBe(first.worst)
  })

  it('never ranks a weak plate fired on for the record above one that had to hold', () => {
    const { all } = trial((spec) => { spec.armour.upperGlacis = [{ material: spec.armour.upperGlacis[0]!.material, mm: 30 }] })
    const lastGate = all.map((finding) => finding.kind).lastIndexOf('gateFailed')
    const firstWeak = all.findIndex((finding) => finding.kind === 'weakPlate')
    expect(lastGate).toBeGreaterThanOrEqual(0)
    expect(firstWeak).toBeGreaterThan(lastGate)
  })

  it('does not blame fragments once a liner is fitted', () => {
    const { all } = trial((spec) => { spec.protection.spallLiner = true })
    expect(all.some((finding) => finding.kind === 'fragments')).toBe(false)
  })

  it('points a fire nobody put out at the suppression system, when there is none', () => {
    let burned = 0
    for (const seed of SEEDS) {
      const { report, all } = trial((spec) => { spec.protection.fireSuppression = false }, MARKS_GEN1.armour, seed)
      const fires = report.shots.filter((line) => line.shot.hit.fire === 'burned').length
      const finding = all.find((each) => each.kind === 'burned')
      expect(all.some((each) => each.kind === 'savedBySuppression')).toBe(false)
      if (fires === 0) {
        expect(finding).toBeUndefined()
        continue
      }
      burned++
      expect(finding).toMatchObject({ count: fires, fix: { control: 'protection.fireSuppression' } })
    }
    expect(burned).toBeGreaterThan(0)
  })

  it('credits the suppression system only where the tank was not lost anyway', () => {
    for (const seed of SEEDS) {
      const { report, all } = trial(undefined, MARKS_GEN1.armour, seed)
      const saved = report.shots.filter((line) => line.shot.hit.fire === 'putOut' && line.shot.hit.explosion !== 'destroyed').length
      const finding = all.find((each) => each.kind === 'savedBySuppression')
      if (saved === 0) expect(finding).toBeUndefined()
      else expect(finding).toMatchObject({ count: saved, fix: null })
    }
  })

  it('credits blow-out panels when the ammunition goes up and the tank lives', () => {
    let vented = 0
    for (const seed of SEEDS) {
      const { report, all } = trial((spec) => {
        spec.turret.shape = 'bustle'
        spec.ammo.stowage = 'blowOutPanels'
      }, MARKS_GEN1.armour, seed)
      const count = report.shots.filter((line) => line.shot.hit.explosion === 'vented').length
      const finding = all.find((each) => each.kind === 'savedByPanels')
      if (count === 0) expect(finding).toBeUndefined()
      else expect(finding).toMatchObject({ count, fix: null })
      vented += count
    }
    expect(vented).toBeGreaterThan(0)
  })

  it('notices rounds that found bare plate where tiles are fitted', () => {
    // Tiles on the hull side, with a few places left bare.
    const serials: ArmourSerial[] = [{ zone: 'hullSideFront', threat: 'infantryRocket', rangeM: 200, angleDeg: 0, gate: false }]
    let gaps = 0
    for (const seed of SEEDS) {
      const { run, all } = trial((spec) => {
        spec.era.hullSideFront = allTiles('hullSideFront')
        for (const place of [0, 1, 2, 3]) spec.era.hullSideFront = setTile('hullSideFront', spec.era.hullSideFront, place, false)
      }, serials, seed)
      const bare = run.serials[0]!.shots.filter((shot) => shot.hit.through && !shot.hit.tile).length
      const finding = all.find((each) => each.kind === 'tileGap')
      if (bare === 0) expect(finding).toBeUndefined()
      else expect(finding).toMatchObject({ zone: 'hullSideFront', count: bare, fix: { zone: 'hullSideFront' } })
      gaps += bare
    }
    expect(gaps).toBeGreaterThan(0)
  })

  it('says nothing about tile gaps on a plate with no tiles', () => {
    expect(trial().all.some((finding) => finding.kind === 'tileGap')).toBe(false)
  })

  it('calls a plate that only just held a close call', () => {
    let close = 0
    for (let rangeM = 600; rangeM <= 2400; rangeM += 100) {
      const serials: ArmourSerial[] = [{ zone: 'upperGlacis', threat: 'accord105Sabot', rangeM, angleDeg: 0, gate: true }]
      const { run, all } = trial(undefined, serials)
      const serial = run.serials[0]!
      const finding = all.find((each) => each.kind === 'closeCall')
      if (!serial.held) {
        expect(finding).toBeUndefined()
        continue
      }
      const spares = serial.shots.map((shot) => shot.hit.armour!).filter((armour) => !armour.ricochet)
      const least = spares.reduce((a, b) => (b.spareMm < a.spareMm ? b : a))
      if (least.spareMm < least.penMm * REPORT.closeCallShare) {
        close++
        expect(finding).toMatchObject({ zone: 'upperGlacis', spareMm: least.spareMm, fix: { zone: 'upperGlacis' } })
        expect(all.some((each) => each.kind === 'allHeld')).toBe(true)
      } else {
        expect(finding).toBeUndefined()
      }
    }
    expect(close).toBeGreaterThan(0)
  })

  it('says so when nothing got through anywhere', () => {
    const serials: ArmourSerial[] = [{ zone: 'upperGlacis', threat: 'autocannon', rangeM: 1000, angleDeg: 0, gate: true }]
    const { report } = trial(undefined, serials)
    expect(report.through).toBe(0)
    expect(report.findings.map((finding) => finding.kind)).toEqual(['allHeld'])
  })
})

describe('the words of the report', () => {
  const { spec, report, all } = trial()
  const lineWith = (test: (line: ShotLine) => boolean): ShotLine => report.shots.find(test)!

  it('has a sentence for every kind of finding, with nothing left unfilled', () => {
    const seen = new Set<string>()
    const check = (findings: Finding[], of: VehicleSpec): void => {
      for (const finding of findings) {
        seen.add(finding.kind)
        const text = findingText(finding, of)
        expect(text.length).toBeGreaterThan(10)
        expect(text).not.toMatch(/[{}]|undefined/)
      }
    }
    check(all, spec)
    for (const seed of SEEDS) {
      const bare = trial((each) => { each.protection.fireSuppression = false }, MARKS_GEN1.armour, seed)
      check(bare.all, bare.spec)
      const panels = trial((each) => {
        each.turret.shape = 'bustle'
        each.ammo.stowage = 'blowOutPanels'
      }, MARKS_GEN1.armour, seed)
      check(panels.all, panels.spec)
    }
    const thin = trial((each) => { each.armour.upperGlacis = [{ material: each.armour.upperGlacis[0]!.material, mm: 30 }] })
    check(thin.all, thin.spec)
    const held = trial(undefined, [{ zone: 'upperGlacis', threat: 'autocannon', rangeM: 1000, angleDeg: 0, gate: true }])
    check(held.all, held.spec)
    for (const kind of ['gateFailed', 'weakPlate', 'magazine', 'burned', 'fragments', 'savedByPanels', 'savedBySuppression', 'allHeld']) {
      expect(seen, kind).toContain(kind)
    }
  })

  it('never says "1 times" or "1 rounds"', () => {
    for (const seed of SEEDS) {
      const each = trial(undefined, MARKS_GEN1.armour, seed)
      for (const finding of each.all) expect(findingText(finding, each.spec)).not.toMatch(/\b1 (times|rounds|fires)\b/)
    }
  })

  it('names the plate and the worst of it for a weak plate', () => {
    const weak = report.findings.find((finding) => finding.kind === 'weakPlate')!
    const text = findingText(weak, spec)
    expect(text).toContain(STRINGS.zones.lowerGlacis.name)
    expect(text).toContain(STRINGS.range.armour.worst.destroyed)
  })

  it('has a sentence for what every round came to', () => {
    for (const line of report.shots) {
      const text = resultText(line.shot.hit)
      expect(text).not.toMatch(/[{}]|undefined/)
      if (line.shot.hit.outcome === 'crew') expect(text).toMatch(/gunner|driver|commander/)
    }
  })

  it('stops the rows at the plate for a round the armour stopped', () => {
    const line = lineWith((each) => !each.shot.hit.through && !each.shot.hit.track)
    const rows = shotRows(line, spec)
    expect(rows.at(-1)).toMatchObject({ value: STRINGS.office.armour.stepStops, grave: true })
    expect(rows.some((row) => row.name === STRINGS.range.afterAction.round)).toBe(false)
  })

  it('carries the rows on inside for a round that got through', () => {
    const line = lineWith((each) => each.shot.hit.explosion === 'destroyed')
    const rows = shotRows(line, spec)
    const names = rows.map((row) => row.name)
    for (const each of line.shot.hit.reached) expect(names).toContain(STRINGS.office.armour.behind.items[each.id])
    expect(rows.find((row) => row.value === STRINGS.range.afterAction.effects.explosion)?.grave).toBe(true)
    expect(names).toContain(STRINGS.range.afterAction.round)
  })

  it('says when a track was in the way', () => {
    const line = lineWith((each) => each.shot.hit.trackBroken)
    expect(shotRows(line, spec)[0]).toMatchObject({ name: STRINGS.range.afterAction.track, value: STRINGS.range.afterAction.trackBroken })
  })

  it('looks at a round from the side when it comes from ahead or behind, and from above when it comes from the flank', () => {
    for (const line of report.shots) {
      const flank = ['hullSideFront', 'hullSideRear', 'turretSides'].includes(line.serial.zone)
      expect(viewOf(line.shot.hit), line.serial.zone).toBe(flank ? 'top' : 'side')
    }
  })
})
