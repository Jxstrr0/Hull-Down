// The limits a sandbox design is held to: the newest technology, nothing
// locked, no cost ceiling, a casemate allowed, and the weight limit the player picked.
import { GUNS } from '../../data/parts'
import { SANDBOX, type SandboxLimitId } from '../../data/sandbox'
import type { Limits } from './spec'

export function sandboxLimits(id: SandboxLimitId): Limits {
  const pact = SANDBOX.limits[id]
  if (pact) return { ...pact, generation: 3, locked: [], casemate: true }
  const calibres = [...new Set(Object.values(GUNS).map((gun) => gun.calibreMm))].sort((a, b) => a - b)
  return { maxMassT: Infinity, maxWidthM: Infinity, allowedCalibresMm: calibres, generation: 3, locked: [], casemate: true }
}
