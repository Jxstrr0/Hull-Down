// The squad drop: the proving-ground test for an infantry fighting vehicle.
// It carries its squad across country to a drop point, halts, lets the
// soldiers out by the rear door and covers them with its gun while light
// targets open up on them.
// Game-level abstractions, not engineering data.
import type { GroundId } from './range'

export interface SquadTarget {
  /** How far off it is, metres. */
  rangeM: number
  /** The size of what shows, metres. */
  widthM: number
  heightM: number
  /** Hits that put it out of action. */
  hits: number
}

export interface SquadMarks {
  /** Soldiers carried, at least. */
  troops: number
  /** Seconds from the start line to the last soldier out at the drop point, at most. */
  dropS: number
  /** Targets put out of action while the squad gets clear, at least. */
  targets: number
}

export const SQUAD_TRIAL = {
  /** The run to the drop point: how far, over what, and the share of its top speed on that ground the vehicle holds. */
  approach: { km: 4, ground: 'firm' as GroundId, pace: 0.6 },
  /** Opening the rear door, seconds, and each soldier out of it after that. */
  doorS: 6,
  perSoldierS: 1.5,
  /** The targets that open up as the vehicle halts, in the order the commander picks them out. */
  targets: [
    { rangeM: 400, widthM: 1.6, heightM: 0.8, hits: 1 },
    { rangeM: 700, widthM: 2.4, heightM: 1.6, hits: 2 },
    { rangeM: 1000, widthM: 4.5, heightM: 2.2, hits: 1 },
    { rangeM: 1300, widthM: 2.4, heightM: 1.6, hits: 2 },
  ] as readonly SquadTarget[],
  /**
   * Switching to the next target, as a share of the time to the first shot:
   * they have all opened fire, so the commander already knows where they are.
   */
  switchShare: 0.5,
  /** The squad needs covering for this long from the halt, seconds. A target still firing after it counts against the vehicle. */
  coverS: 60,
  /** What the range asks of a vehicle that carries soldiers, until a tender sets its own. */
  marks: { troops: 6, dropS: 600, targets: 4 } satisfies SquadMarks,
  /** The replay in the report. Only for the picture: the times it shows are the trial's own. */
  replay: {
    /** Seconds of the drop played in each second watched. */
    speed: 4,
    /** Each round's tracer is drawn this long, seconds of the drop. */
    tracerS: 0.8,
    /** A burst stays on the sight picture this long, seconds of the drop. */
    burstS: 2,
    /** The replay runs on this long after the last round when the gun finishes early, seconds. */
    tailS: 4,
    /** A soldier takes this long to run from the door to cover, seconds. */
    walkS: 2,
    /** The map is drawn this far out from the vehicle, metres. */
    mapM: 1400,
    /** The bearing of each target from the vehicle's nose on the map, degrees. */
    bearingsDeg: [-22, 16, -8, 26],
    /** The sight picture is this many metres across. */
    sightM: 6,
  },
} as const
