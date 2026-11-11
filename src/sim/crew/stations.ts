// Who is in the tank and how hard each of them has to work. A busy
// crewman is slow at his own jobs: the commander at finding targets, the
// gunner at laying the gun.
import { CREW, type ComfortSource, type StationId, type WorkSource } from '../../data/crew'
import { GUNNERY } from '../../data/gunnery'
import {
  COMFORT, COMMANDER_SIGHT, COMPUTERS, GUNS, LOADING, NIGHT_SIGHTS, RANGEFINDERS, SIGHTS, STABILISERS, TRANSMISSIONS,
} from '../../data/parts'
import { TUNING } from '../../data/tuning'
import type { VehicleSpec } from '../vehicle/spec'

export interface WorkShare {
  source: WorkSource
  /** Points added to the station's workload. Negative is help. */
  points: number
}

export interface Station {
  id: StationId
  /** How hard the station is to work, 10..100. */
  workload: number
  /** True for the crewman who works the rangefinder. */
  ranges: boolean
  /** What the design adds or takes away, biggest first. Nothing that comes to nought is listed. */
  shares: WorkShare[]
  /** Fatigue gained for each hour in the tank. 1 is worn out. */
  tiringPerHour: number
}

export interface Comfort {
  /** How easy the tank is to live in, 0..100. */
  score: number
  /** What the design adds or takes away, biggest first. */
  shares: { source: ComfortSource; points: number }[]
}

/** How easy a design is to live in: room and heating, the ride, and where the engine sits. */
export function comfortOf(spec: VehicleSpec): Comfort {
  const C = CREW.comfort
  const shares = [
    { source: 'fittings' as const, points: C.fittings[spec.crew.comfort] },
    { source: 'ride' as const, points: C.ride[spec.runningGear.suspension] },
    { source: 'engine' as const, points: spec.hull.engineAt === 'front' ? C.engineAtFront : 0 },
  ].filter((share) => share.points !== 0).sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
  const sum = shares.reduce<number>((total, share) => total + share.points, C.base)
  return { score: clamp(sum, C.min, C.max), shares }
}

/** Fatigue a crewman gains in an hour at a station this busy, in a tank this comfortable. */
export function tiringPerHour(workload: number, comfort: number): number {
  const F = CREW.fatigue
  const work = 1 + (workload - F.referenceWorkload) * F.perWorkloadPoint
  const ease = 1 + (F.referenceComfort - comfort) * F.perComfortPoint
  return F.perHour * Math.max(F.leastShare, work * ease)
}

/** How worn a crewman is after so many hours, 0 (fresh) to 1 (worn out). */
export function fatigueAfter(hours: number, perHour: number): number {
  return clamp(hours * perHour, 0, 1)
}

/** How much longer a crewman this worn takes over his jobs. 1 is fresh. */
export function slowOf(fatigue: number): number {
  return 1 + fatigue * CREW.fatigue.slowAtFull
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

/** The crew of a design, commander first. The loader is only there when the gun is loaded by hand. */
export function stationsOf(spec: VehicleSpec): Station[] {
  const fc = spec.fireControl
  const fourth = LOADING[spec.loading].crew === 4
  const comfort = COMFORT[spec.crew.comfort].workload
  const ranger: StationId = CREW.ranging[fc.rangefinder]
  const ranging: WorkShare = { source: 'rangefinder', points: RANGEFINDERS[fc.rangefinder].workload }
  const ease = comfortOf(spec).score
  const roundKg = Math.round((GUNS[spec.gun].roundMassT - GUNNERY.loading.referenceRoundT) * 1000)

  const work: [StationId, WorkShare[]][] = [
    ['commander', [
      { source: 'noLoader', points: fourth ? 0 : CREW.noLoader },
      { source: 'commanderSight', points: fc.commanderSight ? COMMANDER_SIGHT.workload : 0 },
      ...(ranger === 'commander' ? [ranging] : []),
    ]],
    ['gunner', [
      { source: 'sight', points: SIGHTS[fc.sight].workload },
      ...(ranger === 'gunner' ? [ranging] : []),
      { source: 'stabiliser', points: STABILISERS[fc.stabiliser].workload },
      { source: 'computer', points: COMPUTERS[fc.computer].workload },
      { source: 'night', points: NIGHT_SIGHTS[fc.night].workload },
    ]],
    ['driver', [
      { source: 'transmission', points: TRANSMISSIONS[spec.powerpack.transmission].workload },
    ]],
  ]
  if (fourth) work.push(['loader', [{ source: 'rounds', points: roundKg * CREW.loaderPerRoundKg }]])

  return work.map(([id, own]) => {
    const shares = [...own, { source: 'comfort' as const, points: comfort }]
      .filter((share) => share.points !== 0)
      .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    const sum = shares.reduce<number>((total, share) => total + share.points, CREW.stationBase)
    const workload = clamp(sum, TUNING.crew.workloadMin, TUNING.crew.workloadMax)
    return { id, workload, ranges: id === ranger, shares, tiringPerHour: tiringPerHour(workload, ease) }
  })
}

/** How fast one station tires its crewman. Nought for a seat the design does not have. */
export function tiringAt(stations: Station[], id: StationId): number {
  return stations.find((station) => station.id === id)?.tiringPerHour ?? 0
}

/** The workload of one station. A design with no such seat gives the base figure. */
export function workloadAt(stations: Station[], id: StationId): number {
  return stations.find((station) => station.id === id)?.workload ?? CREW.stationBase
}

/** The station with the most to do. The first of them, if several are level. */
export function busiestOf(stations: Station[]): Station {
  return stations.reduce((worst, station) => (station.workload > worst.workload ? station : worst))
}
