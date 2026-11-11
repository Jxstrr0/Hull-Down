import { afterEach, describe, expect, it, vi } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { runProvingGround, runRangeJob, type RangeJob, type RangeReport } from '../src/sim/trials'
import { buildStatSheet } from '../src/sim/vehicle'
import { RANGE_WAIT_MS, runRange } from '../src/ui/rangeRunner'
import { readRepoFile } from './helpers'

const job = (seed = 7): RangeJob => ({ spec: structuredClone(BASELINE_SPEC), limits: PACT_LIMITS_GEN1, setup: { seed } })

describe('a visit to the range as one job', () => {
  it('gives the report the range gives the built tank', () => {
    const j = job()
    expect(runRangeJob(j)).toEqual(runProvingGround(buildStatSheet(j.spec, j.limits), j.setup))
  })

  it('gives the same report every time', () => {
    expect(runRangeJob(job())).toEqual(runRangeJob(job()))
  })

  it('crosses to another thread and back unchanged', () => {
    // Handing a job to a worker copies it, and the report is copied on the way back.
    const j = job()
    const copy = structuredClone(j)
    expect(copy).toEqual(j)
    const report = runRangeJob(copy)
    expect(structuredClone(report)).toEqual(report)
    expect(report).toEqual(runRangeJob(j))
  })
})

describe('sending a design to the range', () => {
  /** A stand-in for the browser's Worker, so the hand-over can be tested here. */
  class FakeWorker {
    static made: FakeWorker[] = []
    static answer: 'report' | 'error' | 'silence' = 'report'
    onmessage: ((message: { data: RangeReport }) => void) | null = null
    onerror: (() => void) | null = null
    onmessageerror: (() => void) | null = null
    posted: unknown[] = []
    ended = false
    constructor(readonly url: URL, readonly options: { type: string }) {
      FakeWorker.made.push(this)
    }
    postMessage(message: RangeJob): void {
      this.posted.push(message)
      if (FakeWorker.answer === 'silence') return
      queueMicrotask(() => {
        if (FakeWorker.answer === 'error') this.onerror?.()
        else this.onmessage?.({ data: { ...runRangeJob(message), tests: 99 } })
      })
    }
    terminate(): void {
      this.ended = true
    }
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    FakeWorker.made = []
    FakeWorker.answer = 'report'
  })

  it('runs the tests here when there is no other thread to be had', async () => {
    expect(typeof Worker).toBe('undefined')
    expect(await runRange(job())).toEqual(runRangeJob(job()))
  })

  it('hands the job to a worker and takes the report it sends back', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const report = await runRange(job())
    // The stand-in marks its report, to show it came from the worker.
    expect(report.tests).toBe(99)
    expect(FakeWorker.made).toHaveLength(1)
    const worker = FakeWorker.made[0]!
    expect(worker.posted).toEqual([job()])
    expect(worker.options).toEqual({ type: 'module' })
    expect(String(worker.url)).toMatch(/rangeWorker/)
    expect(worker.ended).toBe(true)
  })

  it('runs the tests here when the worker fails, with the same report', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    FakeWorker.answer = 'error'
    expect(await runRange(job())).toEqual(runRangeJob(job()))
    expect(FakeWorker.made[0]!.ended).toBe(true)
  })

  it('stops waiting for a worker that never answers', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('Worker', FakeWorker)
    FakeWorker.answer = 'silence'
    let report: RangeReport | undefined
    void runRange(job()).then((got) => (report = got))
    await vi.advanceTimersByTimeAsync(RANGE_WAIT_MS - 1)
    expect(report).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(report).toEqual(runRangeJob(job()))
    expect(FakeWorker.made[0]!.ended).toBe(true)
  })

  it('answers once, even if the worker speaks up late', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('Worker', FakeWorker)
    FakeWorker.answer = 'silence'
    const answers: RangeReport[] = []
    void runRange(job()).then((got) => answers.push(got))
    await vi.advanceTimersByTimeAsync(RANGE_WAIT_MS)
    FakeWorker.made[0]!.onmessage?.({ data: { ...runRangeJob(job()), tests: 99 } })
    await vi.advanceTimersByTimeAsync(10)
    expect(answers).toHaveLength(1)
    expect(answers[0]!.tests).not.toBe(99)
  })
})

describe('the worker file', () => {
  const text = readRepoFile('src/ui/rangeWorker.ts')

  it('loads nothing but the sim', () => {
    const from = [...text.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1])
    expect(from).toEqual(['../sim/trials'])
  })

  it('is what the runner starts', () => {
    expect(readRepoFile('src/ui/rangeRunner.ts')).toContain("new URL('./rangeWorker.ts', import.meta.url)")
  })

  it('is used by the range screen, which no longer runs the tests itself', () => {
    const screen = readRepoFile('src/ui/rangeScreen.ts')
    expect(screen).toContain('runRange(')
    expect(screen).not.toContain('runProvingGround(')
  })
})
