// The proving ground on a thread of its own. The page hands it a design and
// gets the finished report back, so a long trial never freezes the screen.
// Nothing but the sim is loaded here.
import { runRangeJob, type RangeJob, type RangeReport } from '../sim/trials'

/** The little of a worker's own scope that this file uses. */
interface Scope {
  onmessage: ((message: MessageEvent<RangeJob>) => void) | null
  postMessage(report: RangeReport): void
}

const scope = self as unknown as Scope
scope.onmessage = (message) => scope.postMessage(runRangeJob(message.data))
