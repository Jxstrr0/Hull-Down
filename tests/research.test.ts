// The bureau's research: paying to unlock the parts of the tender's generation.
import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { RESEARCH, RESEARCH_IDS } from '../src/data/research'
import { STRINGS } from '../src/data/strings'
import { LATER_PARTS } from '../src/data/tech'
import { cleanCareer } from '../src/persist/careerCodec'
import {
  buildBlock, careerLimits, lockedParts, newCareer, research, researchBlock, researchOpen, upgradeLimits, type Career,
} from '../src/sim/career/career'
import { buildStatSheet, type VehicleSpec } from '../src/sim/vehicle'
import { generationOf, partKey, unresearched } from '../src/sim/vehicle/tech'

function tank(change: (spec: VehicleSpec) => void): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  change(spec)
  return spec
}

/** A career put on the tender of 2001 with money in hand. */
function secondTender(budgetKr = 40_000_000): Career {
  return { ...newCareer(3), tenderNo: 1, budgetKr }
}

const codes = (spec: VehicleSpec, career: Career) => buildStatSheet(spec, careerLimits(career)).issues.map((issue) => issue.code)

describe('the research table', () => {
  it('names a later part for every project, and words for it', () => {
    for (const id of RESEARCH_IDS) {
      const project = RESEARCH[id]
      expect(LATER_PARTS[project.field][project.part]).toBeGreaterThan(1)
      expect(project.costKr).toBeGreaterThan(0)
      expect(STRINGS.career.research.projects[id].name).not.toBe('')
      for (const need of project.needs) {
        expect(RESEARCH_IDS.indexOf(need)).toBeLessThan(RESEARCH_IDS.indexOf(id))
        expect(generationOf(RESEARCH[need].field, RESEARCH[need].part)).toBeLessThanOrEqual(generationOf(project.field, project.part))
      }
    }
  })
})

describe('research in a career', () => {
  it('offers nothing in the first tender, and the generation-two projects in the second', () => {
    const first = newCareer(3)
    expect(researchOpen(first)).toEqual([])
    expect(researchBlock(first, 'digitalComputer')).toBe('tooNew')
    expect(researchOpen(secondTender())).toEqual([...RESEARCH_IDS])
  })

  it('takes the money and unlocks the part', () => {
    const career = secondTender()
    const digital = tank((spec) => { spec.fireControl.computer = 'digital' })
    expect(codes(digital, career)).toContain('notResearched')
    expect(buildBlock(career, digital)).toBe('illegal')
    const after = research(career, 'digitalComputer')
    expect(after.budgetKr).toBe(career.budgetKr - RESEARCH.digitalComputer.costKr)
    expect(after.researched).toEqual(['digitalComputer'])
    expect(codes(digital, after)).not.toContain('notResearched')
    expect(buildBlock(after, digital)).not.toBe('illegal')
    expect(career.researched).toEqual([])
  })

  it('wants the projects a project stands on done first', () => {
    const career = secondTender()
    expect(researchBlock(career, 'thermalSight')).toBe('needs')
    expect(() => research(career, 'thermalSight')).toThrow()
    const after = research(career, 'digitalComputer')
    expect(researchBlock(after, 'thermalSight')).toBeNull()
    expect(researchBlock(after, 'digitalComputer')).toBe('done')
  })

  it('will not spend money the bureau has not got', () => {
    const poor = secondTender(RESEARCH.layeredArmour.costKr - 1)
    expect(researchBlock(poor, 'layeredArmour')).toBe('noMoney')
    expect(() => research(poor, 'layeredArmour')).toThrow()
  })

  it('locks an armour zone made of a material not researched, and says so once', () => {
    const career = secondTender()
    const layered = tank((spec) => { spec.armour.upperGlacis[0]!.material = 'layeredComposite' })
    expect(unresearched(layered, lockedParts(career))).toEqual(['armour.upperGlacis'])
    expect(codes(layered, research(career, 'layeredArmour'))).not.toContain('notResearched')
    // In the first tender the part is too new, and that is all that is said of it.
    const early = codes(layered, newCareer(3))
    expect(early).toContain('notYetAvailable')
    expect(early).not.toContain('notResearched')
  })

  it('carries into upgrades and through a save', () => {
    let career = secondTender()
    career = research(research(career, 'digitalComputer'), 'thermalSight')
    expect(lockedParts(career)).toContain(partKey('material', 'layeredComposite'))
    expect(lockedParts(career)).not.toContain(partKey('fireControl.night', 'thermal'))
    const served = { tender: 'improvedType1' } as Career['adopted'][number]
    expect(upgradeLimits(career, served).locked).toEqual(lockedParts(career))
    expect(cleanCareer(JSON.parse(JSON.stringify(career)))).toEqual(career)
    const odd = cleanCareer({ ...career, researched: ['thermalSight', 'warpDrive', 'thermalSight', 7] })!
    expect(odd.researched).toEqual(['thermalSight'])
    expect(cleanCareer({ seed: 1 })!.researched).toEqual([])
  })
})
