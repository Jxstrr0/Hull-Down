// What the crash screen says: whether a complaint from the browser is a real
// crash, and the short report a player can send. No DOM here, so it is tested.
import { CRASH } from '../data/crash'
import { STRINGS, fill } from '../data/strings'

const S = STRINGS.crash

/** The name and message of whatever was thrown. */
export function crashMessage(reason: unknown): string {
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`
  if (typeof reason === 'string') return reason
  try {
    return JSON.stringify(reason) ?? String(reason)
  } catch {
    return String(reason)
  }
}

/** False for the complaints the game carries on from. */
export function isCrash(reason: unknown): boolean {
  if (reason === null || reason === undefined) return false
  const message = crashMessage(reason)
  return !CRASH.harmless.some((word) => message.includes(word))
}

export interface CrashFacts {
  reason: unknown
  version: string
  commit: string
  built: string
  /** The browser, as it describes itself. */
  browser: string
}

/** A few lines for a bug report. It names the game's version and the browser, and nothing about the player. */
export function crashReport(facts: CrashFacts): string {
  const trace = facts.reason instanceof Error && facts.reason.stack ? facts.reason.stack.split('\n').slice(0, CRASH.traceLines) : []
  // Some browsers start the trace with the message, some do not.
  const message = crashMessage(facts.reason)
  const rest = trace.filter((line) => line.trim() !== message)
  return [
    fill(S.report.version, { version: facts.version, commit: facts.commit, built: facts.built }),
    fill(S.report.error, { message }),
    ...rest.map((line) => line.trim()),
    fill(S.report.browser, { browser: facts.browser }),
  ].join('\n')
}
