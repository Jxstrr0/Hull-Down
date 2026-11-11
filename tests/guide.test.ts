import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { GUIDE, GUIDE_STEPS } from '../src/data/guide'
import { BUREAU_IDS } from '../src/data/opponents'
import { STRINGS } from '../src/data/strings'
import { TENDERS } from '../src/data/tenders'
import { buildPrototype, enterTender, newCareer, nextTender, prototypeTrial, type Career } from '../src/sim/career/career'
import { guideState } from '../src/sim/career/guide'
import { rivalBid } from '../src/sim/career/rival'
import type { VehicleSpec } from '../src/sim/vehicle/spec'
import { guideAction, guideActionLabel, guideText, guideTitle } from '../src/ui/guide'

/** What the guide tells a newcomer to do: the Type 1 with a better night sight, and nothing else. */
function guided(): VehicleSpec {
  const spec = structuredClone(BASELINE_SPEC)
  spec.fireControl.night = 'imageIntensifier'
  return spec
}

function entered(seed: number): Career {
  const built = buildPrototype(newCareer(seed), guided())
  return enterTender(built, 1)
}

describe('the guided first contract', () => {
  it('starts by sending the player to the night sight', () => {
    const career = newCareer(7)
    expect(guideState(career, BASELINE_SPEC, 0, null)).toEqual({ step: 'night', prototype: 0, failed: 0 })
    const worse = structuredClone(BASELINE_SPEC)
    worse.fireControl.night = 'none'
    expect(guideState(career, worse, 0, null)?.step).toBe('night')
    expect(GUIDE.part).toBe('fireControl.night')
    expect(STRINGS.controls[GUIDE.part].label).toBeTruthy()
  })

  it('then asks for faults to be cleared, and for the prototype', () => {
    const career = newCareer(7)
    expect(guideState(career, guided(), 2, null)?.step).toBe('faults')
    expect(guideState(career, guided(), 0, null)?.step).toBe('build')
  })

  it('follows the prototype through the range to the decision', () => {
    const built = buildPrototype(newCareer(7), guided())
    expect(guideState(built, guided(), 0, null)).toEqual({ step: 'trial', prototype: 1, failed: 0 })
    const trial = prototypeTrial(built, 1)!
    const after = guideState(built, guided(), 0, trial.score)!
    expect(after.step).toBe(trial.score.failed > 0 ? 'revise' : 'enter')
    expect(guideState(built, guided(), 0, { ...trial.score, failed: 2 })).toEqual({ step: 'revise', prototype: 1, failed: 2 })
    const done = enterTender(built, 1)
    expect(guideState(done, guided(), 0, trial.score)?.step).toBe(done.outcome!.won ? 'won' : 'lost')
  })

  it('has nothing to say after the first tender', () => {
    const done = entered(7)
    expect(guideState(nextTender(done), guided(), 0, null)).toBeNull()
  })

  it('has words and a place to go for every step', () => {
    for (const step of GUIDE_STEPS) {
      const state = { step, prototype: 2, failed: 3 }
      expect(guideTitle(state)).toContain(STRINGS.guide.steps[step].title)
      expect(guideText(state)).not.toMatch(/[{}]/)
      expect(guideActionLabel(step).length).toBeGreaterThan(0)
      expect(['part', 'faults', 'bureau']).toContain(guideAction(step))
    }
    expect(guideText({ step: 'revise', prototype: 2, failed: 3 })).toContain('Prototype 2 failed 3')
  })
})

describe('the first tender is one a newcomer can win', () => {
  it('has the rival bureaus enter their first drawings', () => {
    expect(TENDERS.improvedType1.rivalRevisions).toBe(0)
    for (const bureau of BUREAU_IDS) expect(rivalBid(bureau, TENDERS.improvedType1, 101).revisions).toBe(0)
    expect(TENDERS.tank2001.rivalRevisions).toBeGreaterThan(0)
    expect(TENDERS.tank2016.rivalRevisions).toBeGreaterThan(0)
  })

  it('goes to the player who only fixes the night sight, nine times in ten', () => {
    let won = 0
    const careers = 20
    for (let i = 0; i < careers; i++) if (entered(1000 + i * 7919).outcome!.won) won++
    expect(won).toBeGreaterThanOrEqual(careers * 0.9)
  })
})
