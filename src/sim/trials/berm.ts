// The hull-down berm: the tank noses up the back of a rounded ridge until
// its gun, laid level, just clears the crest. The further back it can sit,
// the less of it shows, and how far back it can sit is set by how far the
// gun dips. Game-level abstraction, not engineering data.
import { RANGE } from '../../data/range'
import { PI, detAtan2, detCos } from '../det'
import type { Frame } from '../vehicle/frame'

export interface BermRun {
  /** How far the gun dips, degrees. */
  depressionDeg: number
  /** How steeply the tank stands where it fires from, nose up, degrees. */
  pitchDeg: number
  /** The dip that would hide everything below the gun on this ridge, degrees. */
  neededDeg: number
  /** How far below the crest the ground is where the tank stands, metres. */
  dropM: number
  /** Ground to turret roof, metres. */
  heightM: number
  /** Height of the tank showing over the crest, metres. */
  showsM: number
  /** Height of the hull showing over the crest, metres. Nought when the tank is hull down. */
  hullShowsM: number
  hullDown: boolean
}

function deg(rad: number): number {
  return (rad * 180) / PI
}

export function runBerm(frame: Frame, depressionDeg: number): BermRun {
  const k = RANGE.berm
  // The pitch at which the bore, laid level, clears the crest by the least allowed.
  const cosine = Math.max(-1, Math.min(1, 1 - Math.max(0, frame.gunY - k.clearM) / k.radiusM))
  const neededDeg = Math.min(k.maxSlopeDeg, deg(detAtan2(Math.sqrt(1 - cosine * cosine), cosine)))
  const pitchDeg = Math.max(0, Math.min(depressionDeg, neededDeg))
  const dropM = k.radiusM * (1 - detCos((pitchDeg * PI) / 180))
  const showsM = frame.top - dropM
  const hullShowsM = Math.max(0, frame.roof - dropM)
  return {
    depressionDeg, pitchDeg, neededDeg, dropM, heightM: frame.top, showsM, hullShowsM,
    hullDown: hullShowsM === 0,
  }
}
