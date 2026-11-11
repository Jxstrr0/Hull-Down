// The endurance run: a long drive over road, range tracks, hills and rough
// ground, to see what breaks. Wear builds up on each part as it goes. A part
// within its rating is mended at the roadside. An overloaded engine or
// transmission breaks for good and the run ends there.
import {
  GROUNDS, RANGE, RUN_PARTS, RUN_PART_IDS, type ClimateId, type RunPartId,
} from '../../data/range'
import { topSpeedOf, type Drive } from '../mobility/drive'
import { hazardOnLeg, legLoad, legSpans, ratedIn, runLengthKm, type LegId, type Wear } from '../reliability/wear'
import { unitWait } from '../rng'

export interface EnduranceEvent {
  part: RunPartId
  /** The kilometre of the run it happened in, counting from 1. */
  km: number
  leg: LegId
  /** The part's load on that leg as a share of its rating. Over 1 is overloaded. */
  load: number
  /** True when this ended the run. */
  ended: boolean
  /** Hours lost mending it. Nought when it ended the run. */
  haltH: number
}

export interface EnduranceLeg {
  id: LegId
  fromKm: number
  toKm: number
  /** The speed the tank holds on it, km/h. Every leg is listed, reached or not. */
  speedKmh: number
}

export interface PartLoad {
  /** The part's heaviest load of the run as a share of its rating, and the leg it came on. */
  load: number
  leg: LegId
  /** What it carries and what it is rated for in this climate. Null rating for a part with no rated load. */
  have: number
  rated: number | null
}

export interface EnduranceRun {
  seed: number
  climate: ClimateId
  lengthKm: number
  /** How far it got. The whole length when it finished. */
  reachedKm: number
  finished: boolean
  events: EnduranceEvent[]
  /** Stops for repairs, not counting a breakdown that ended the run. */
  stops: number
  /** Hours on the move and hours stopped for repairs. */
  movingH: number
  haltedH: number
  legs: EnduranceLeg[]
  loads: Record<RunPartId, PartLoad>
}

export interface EnduranceSetup {
  seed: number
  climate?: ClimateId
}

export function runEndurance(drive: Drive, wear: Wear, setup: EnduranceSetup): EnduranceRun {
  const climate = setup.climate ?? RANGE.endurance.climate
  const stepKm = RANGE.endurance.stepKm
  const spans = legSpans()

  // Each part fails when its wear passes a drawn mark. Mending it draws the next.
  const worn: number[] = []
  const failsAt: number[] = []
  const draws: number[] = []
  RUN_PART_IDS.forEach((_, index) => {
    worn.push(0)
    failsAt.push(unitWait(setup.seed, index, 0))
    draws.push(1)
  })

  const loads = {} as Record<RunPartId, PartLoad>
  for (const id of RUN_PART_IDS) {
    const first = spans[0]!.leg
    const load: PartLoad = { load: legLoad(id, wear[id], first, climate), leg: first.id, have: wear[id].have, rated: ratedIn(id, wear[id], climate) }
    for (const { leg } of spans) {
      const here = legLoad(id, wear[id], leg, climate)
      if (here > load.load) {
        load.load = here
        load.leg = leg.id
      }
    }
    loads[id] = load
  }

  const events: EnduranceEvent[] = []
  const legs: EnduranceLeg[] = spans.map(({ leg, fromKm, toKm }) => ({
    id: leg.id, fromKm, toKm, speedKmh: topSpeedOf(drive, GROUNDS[leg.ground]).speedMs * 3.6 * leg.pace,
  }))
  let movingH = 0
  let haltedH = 0
  let reachedKm = 0
  let finished = true

  run: for (let at = 0; at < spans.length; at++) {
    const { leg, fromKm, toKm } = spans[at]!
    const speedKmh = legs[at]!.speedKmh
    for (let km = fromKm; km < toKm; km += stepKm) {
      movingH += stepKm / speedKmh
      reachedKm = km + stepKm
      for (let index = 0; index < RUN_PART_IDS.length; index++) {
        const id = RUN_PART_IDS[index]!
        worn[index]! += hazardOnLeg(id, wear[id], leg, km, km + stepKm, climate)
        if (worn[index]! < failsAt[index]!) continue
        const load = legLoad(id, wear[id], leg, climate)
        const ended = load > 1 && RUN_PARTS[id].wrecks
        const haltH = ended ? 0 : RUN_PARTS[id].repairH
        events.push({ part: id, km: reachedKm, leg: leg.id, load, ended, haltH })
        if (ended) {
          finished = false
          break run
        }
        haltedH += haltH
        failsAt[index]! += unitWait(setup.seed, index, draws[index]!)
        draws[index]! += 1
      }
    }
  }

  return {
    seed: setup.seed,
    climate,
    lengthKm: runLengthKm(),
    reachedKm,
    finished,
    events,
    stops: events.filter((event) => !event.ended).length,
    movingH,
    haltedH,
    legs,
    loads,
  }
}
