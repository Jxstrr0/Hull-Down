import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { CAREER } from '../src/data/career'
import { ADVISOR } from '../src/data/advisor'
import { ADVISOR_KEY, CAREER_KEY, loadAdvisorMode, loadCareer, saveAdvisorMode, saveCareer } from '../src/persist/careerStore'
import { buildPrototype, enterTender, newCareer, prototypeTrial } from '../src/sim/career/career'
import {
  axesLine, bidLine, bidderName, blockLine, failedLine, failedTests, revisionsLine, standingChange, standingChanges, standingLine,
  standingWord, verdictLine,
} from '../src/ui/careerWords'

function memory(): { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; keys: () => string[] } {
  const map = new Map<string, string>()
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value), keys: () => [...map.keys()] }
}

describe('the career kept in the browser', () => {
  it('comes back as it was saved', () => {
    const storage = memory()
    const career = buildPrototype(newCareer(7), BASELINE_SPEC)
    expect(saveCareer(storage, career)).toBe(true)
    expect(loadCareer(storage)).toEqual(career)
  })

  it('is null when there is none, or when what is there is rubbish', () => {
    const storage = memory()
    expect(loadCareer(storage)).toBeNull()
    storage.setItem(CAREER_KEY, '{not json')
    expect(loadCareer(storage)).toBeNull()
  })

  it('says so when the browser will not keep it', () => {
    const blocked = { getItem: (): string | null => { throw new Error('blocked') }, setItem: (): void => { throw new Error('blocked') } }
    expect(saveCareer(blocked, newCareer(1))).toBe(false)
    expect(loadCareer(blocked)).toBeNull()
    expect(loadAdvisorMode(blocked)).toBe(ADVISOR.defaultMode)
    expect(saveAdvisorMode(blocked, 'off')).toBe(false)
  })

  it('keeps the chief engineer\'s setting, and only under the game\'s own keys', () => {
    const storage = memory()
    expect(loadAdvisorMode(storage)).toBe(ADVISOR.defaultMode)
    saveAdvisorMode(storage, 'ask')
    expect(loadAdvisorMode(storage)).toBe('ask')
    storage.setItem(ADVISOR_KEY, 'loudly')
    expect(loadAdvisorMode(storage)).toBe(ADVISOR.defaultMode)
    saveCareer(storage, newCareer(1))
    expect(storage.keys().every((key) => key.startsWith('hulldown.'))).toBe(true)
  })
})

describe('the career in words', () => {
  const start = newCareer(7)
  const built = buildPrototype(start, BASELINE_SPEC)
  const trial = prototypeTrial(built, 1)!
  const decided = enterTender(built, 1)

  it('gives standing a number and a word', () => {
    expect(standingLine(start, 'army')).toContain(String(CAREER.reputation.start))
    expect(standingWord(0)).not.toBe(standingWord(100))
    expect(standingWord(100)).toBe(standingWord(99))
    expect(standingChange(0)).toBe('no change')
    expect(standingChange(4)).toBe('up 4')
    expect(standingChange(-6)).toBe('down 6')
  })

  it('counts the revisions down', () => {
    expect(revisionsLine(start)).toContain('3')
    expect(revisionsLine(built)).toContain('3 revisions left')
    const spent = { ...built, prototypes: [1, 2, 3, 4].map((no) => ({ ...built.prototypes[0]!, no })) }
    expect(revisionsLine(spent)).toContain('One more')
    const done = { ...built, prototypes: [1, 2, 3, 4, 5].map((no) => ({ ...built.prototypes[0]!, no })) }
    expect(revisionsLine(done)).toBe('No revisions left.')
  })

  it('names the tests a prototype failed, as many as were marked down', () => {
    expect(failedTests(trial.bid.range)).toHaveLength(trial.score.failed)
    const line = failedLine(trial.score, trial.bid.range)
    for (const name of failedTests(trial.bid.range)) expect(line).toContain(name)
    expect(failedLine({ ...trial.score, failed: 0, penalty: 0 }, trial.bid.range)).toBe('Passed every range test.')
  })

  it('puts all five marks on one line', () => {
    const line = axesLine(trial.score.axes)
    for (const word of ['Protection', 'Firepower', 'Mobility', 'Reliability', 'Cost']) expect(line).toContain(word)
  })

  it('has a sentence for every reason the shop says no', () => {
    for (const block of ['decided', 'illegal', 'same', 'noRevisions', 'noMoney'] as const) expect(blockLine(block).length).toBeGreaterThan(10)
  })

  it('writes up the decision', () => {
    const outcome = decided.outcome!
    expect(verdictLine(outcome)).toContain(outcome.won ? 'Adopted' : `placed ${outcome.place} of 4`)
    expect(verdictLine({ ...outcome, won: true, designation: 'Model 81' })).toContain('Model 81')
    expect(outcome.bids.map((line) => bidderName(line.who))).toContain('Your bureau')
    expect(bidLine(outcome.bids[0]!)).toContain('marks')
    expect(bidLine({ ...outcome.bids[0]!, legal: false })).toContain('Thrown out')
    expect(standingChanges(outcome)).toHaveLength(3)
  }, 30_000)
})
