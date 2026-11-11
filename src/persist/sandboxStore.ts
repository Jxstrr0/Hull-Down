// Whether the sandbox is on, and the weight limit picked for it, kept on this device.
import { SANDBOX, SANDBOX_LIMIT_IDS, type SandboxLimitId } from '../data/sandbox'
import type { KeyValue } from './designs'

export const SANDBOX_KEY = 'hulldown.sandbox'

export interface SandboxChoice {
  on: boolean
  limit: SandboxLimitId
}

/** What a stored value means. Anything unreadable is the sandbox off, on its starting limit. */
export function parseSandbox(stored: string | null): SandboxChoice {
  const [state, limit] = (stored ?? '').split(':')
  const known = (SANDBOX_LIMIT_IDS as readonly string[]).includes(limit ?? '')
  return { on: state === 'on', limit: known ? (limit as SandboxLimitId) : SANDBOX.startLimit }
}

/** Storage can be blocked (private mode), so never throw. */
export function loadSandbox(storage: KeyValue): SandboxChoice {
  try {
    return parseSandbox(storage.getItem(SANDBOX_KEY))
  } catch {
    return parseSandbox(null)
  }
}

export function saveSandbox(storage: KeyValue, choice: SandboxChoice): boolean {
  try {
    storage.setItem(SANDBOX_KEY, `${choice.on ? 'on' : 'off'}:${choice.limit}`)
    return true
  } catch {
    return false
  }
}
