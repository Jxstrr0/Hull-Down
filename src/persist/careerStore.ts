// The career in hand, kept in the browser so it is still there next time.
// The save slots and the save code are separate: this is the working copy.
import { ADVISOR, ADVISOR_MODES, type AdvisorMode } from '../data/advisor'
import type { Career } from '../sim/career/career'
import { cleanCareer } from './careerCodec'
import type { KeyValue } from './designs'

export const CAREER_KEY = 'hulldown.career'
export const ADVISOR_KEY = 'hulldown.advisor'
export const GUIDE_KEY = 'hulldown.guide'

/** The career kept here, or null when there is none or it cannot be read. */
export function loadCareer(storage: KeyValue): Career | null {
  try {
    const text = storage.getItem(CAREER_KEY)
    return text === null ? null : cleanCareer(JSON.parse(text))
  } catch {
    return null // Storage is blocked, or what is there is not a career.
  }
}

/** False when the browser would not keep it. */
export function saveCareer(storage: KeyValue, career: Career): boolean {
  try {
    storage.setItem(CAREER_KEY, JSON.stringify(career))
    return true
  } catch {
    return false
  }
}

export function loadAdvisorMode(storage: KeyValue): AdvisorMode {
  try {
    const text = storage.getItem(ADVISOR_KEY)
    return ADVISOR_MODES.find((mode) => mode === text) ?? ADVISOR.defaultMode
  } catch {
    return ADVISOR.defaultMode
  }
}

export function saveAdvisorMode(storage: KeyValue, mode: AdvisorMode): boolean {
  try {
    storage.setItem(ADVISOR_KEY, mode)
    return true
  } catch {
    return false
  }
}

/** True when the player has put the first-contract guide away. */
export function loadGuideHidden(storage: KeyValue): boolean {
  try {
    return storage.getItem(GUIDE_KEY) === 'off'
  } catch {
    return false
  }
}

export function saveGuideHidden(storage: KeyValue, hidden: boolean): boolean {
  try {
    storage.setItem(GUIDE_KEY, hidden ? 'off' : 'on')
    return true
  } catch {
    return false
  }
}

/** Forgets the career kept here. False when the browser would not. */
export function dropCareer(storage: KeyValue & { removeItem(key: string): void }): boolean {
  try {
    storage.removeItem(CAREER_KEY)
    return true
  } catch {
    return false
  }
}
