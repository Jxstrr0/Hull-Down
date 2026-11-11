// Sends a design to the proving ground. The tests run on another thread (a
// Web Worker) and the report comes back when they are done. Where that
// thread cannot be had, the same sim runs here and gives the same report.
import { runRangeJob, type RangeJob, type RangeReport } from '../sim/trials'

/** How long to wait for the other thread before running the tests here instead. */
export const RANGE_WAIT_MS = 4000

export function runRange(job: RangeJob): Promise<RangeReport> {
  return new Promise((resolve) => {
    let worker: Worker | undefined
    let settled = false
    const finish = (report: () => RangeReport): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      worker?.terminate()
      resolve(report())
    }
    const here = (): void => finish(() => runRangeJob(job))
    const timer = setTimeout(here, RANGE_WAIT_MS)
    try {
      worker = new Worker(new URL('./rangeWorker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (message: MessageEvent<RangeReport>) => finish(() => message.data)
      worker.onerror = here
      worker.onmessageerror = here
      worker.postMessage(job)
    } catch {
      // No workers on this device, or this one would not start.
      here()
    }
  })
}
