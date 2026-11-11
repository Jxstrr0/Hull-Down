// The after-action report on an armour trial, as plain data: every round in
// the order it was fired, what the crew and the parts came to, and the few
// things that decided the result. The words are put to it elsewhere.
import { STATION_IDS, type StationId } from '../../data/crew'
import type { ZoneId } from '../../data/materials'
import { REPORT } from '../../data/report'
import { ITEM_IDS, type ItemId } from '../hits/interior'
import { OUTCOMES, type Outcome } from '../hits/trace'
import type { VehicleSpec } from '../vehicle/spec'
import type { ArmourRun, SerialResult, TrialShot } from './armour'

/** One round of the trial, in the order it was fired. */
export interface ShotLine {
  /** Counting from nought through the whole trial. */
  index: number
  serialNo: number
  /** Which round of its serial, counting from nought. */
  roundNo: number
  serial: SerialResult
  shot: TrialShot
}

/** A design-office control, or an armour zone, that a finding points back to. */
export type Fix = { zone: ZoneId } | { control: 'ammo.stowage' | 'protection.fireSuppression' | 'protection.spallLiner' }

export const FINDING_KINDS = [
  'gateFailed', 'magazine', 'burned', 'tileGap', 'fragments', 'savedByPanels', 'savedBySuppression', 'weakPlate', 'closeCall', 'allHeld',
] as const
export type FindingKind = (typeof FINDING_KINDS)[number]

export interface Finding {
  kind: FindingKind
  /** How much it mattered. The report names the heaviest. */
  weight: number
  /** The plate it is about, when it is about one. */
  zone?: ZoneId
  /** How many times it happened. */
  count: number
  /** Out of how many: rounds at the plate, fires started, rounds that reached the ammunition. */
  of: number
  /** The worst that came of it, for a plate. */
  worst?: Outcome
  /** Millimetres to spare, for a close call. */
  spareMm?: number
  /** Where the ammunition that went up was kept. */
  item?: ItemId
  fix: Fix | null
  /** The first round that shows it, to look at. */
  shotIndex: number
}

export interface AfterAction {
  shots: ShotLine[]
  /** Rounds stopped by the armour, rounds through it, and rounds that broke a track. */
  stopped: number
  through: number
  tracks: number
  /** How many rounds put each station out of action. */
  crewOut: Record<StationId, number>
  /** The parts rounds reached, crew aside, and how many rounds reached each. In the order the tank lists them. */
  parts: { id: ItemId; rounds: number }[]
  /** How many rounds ended on each result. */
  outcomes: Record<Outcome, number>
  /** The round that did the most harm. Null when the trial fired none. */
  worstIndex: number | null
  /** The things that decided the result, heaviest first. */
  findings: Finding[]
}

const AMMO = new Set(['ammo', 'autoloader'])

/** Every round of a trial, in the order it was fired. */
export function timelineOf(run: ArmourRun): ShotLine[] {
  const shots: ShotLine[] = []
  run.serials.forEach((serial, serialNo) => {
    serial.shots.forEach((shot, roundNo) => shots.push({ index: shots.length, serialNo, roundNo, serial, shot }))
  })
  return shots
}

/** Everything worth saying about a trial, heaviest first. The report names only the first few. */
export function weigh(run: ArmourRun, spec: VehicleSpec): Finding[] {
  const W = REPORT.weight
  const shots = timelineOf(run)
  const firstOf = (test: (line: ShotLine) => boolean): number => shots.find(test)?.index ?? 0
  const found: Finding[] = []

  // Plate by plate.
  run.serials.forEach((serial, serialNo) => {
    const mine = (line: ShotLine): boolean => line.serialNo === serialNo
    const of = serial.shots.length
    if (!serial.held) {
      // The worst round of the serial is the one to look at.
      const worst = shots.filter(mine).reduce((a, b) =>
        (OUTCOMES.indexOf(b.shot.hit.outcome) > OUTCOMES.indexOf(a.shot.hit.outcome) ? b : a))
      found.push({
        kind: serial.gate ? 'gateFailed' : 'weakPlate',
        weight: (serial.gate ? W.gateFailed : W.weakPlate) + serial.through + OUTCOMES.indexOf(serial.worst) / OUTCOMES.length,
        zone: serial.zone, count: serial.through, of, worst: serial.worst, fix: { zone: serial.zone }, shotIndex: worst.index,
      })
      const gaps = serial.shots.filter((shot) => shot.hit.through && !shot.hit.tile).length
      if (spec.era[serial.zone] !== 0 && gaps > 0) {
        found.push({
          kind: 'tileGap', weight: W.tileGap + gaps, zone: serial.zone, count: gaps, of, fix: { zone: serial.zone },
          shotIndex: firstOf((line) => mine(line) && line.shot.hit.through && !line.shot.hit.tile),
        })
      }
    } else if (serial.gate) {
      let spare = Infinity
      let reach = 0
      for (const shot of serial.shots) {
        const armour = shot.hit.armour
        if (armour && !armour.ricochet && armour.spareMm < spare) {
          spare = armour.spareMm
          reach = armour.penMm
        }
      }
      if (spare < reach * REPORT.closeCallShare) {
        found.push({
          kind: 'closeCall', weight: W.closeCall + 1 - spare / Math.max(1, reach), zone: serial.zone, count: 1, of, spareMm: spare,
          fix: { zone: serial.zone },
          shotIndex: firstOf((line) => mine(line) && line.shot.hit.armour?.spareMm === spare),
        })
      }
    }
  })

  // The ammunition.
  const reachedAmmo = shots.filter((line) => line.shot.hit.reached.some((each) => AMMO.has(each.kind) && each.chance !== null))
  const lost = reachedAmmo.filter((line) => line.shot.hit.explosion === 'destroyed')
  if (lost.length > 0) {
    const item = lost[0]!.shot.hit.reached.find((each) => each.effect === 'explosion')?.id
    found.push({
      kind: 'magazine', weight: W.magazine + lost.length, count: lost.length, of: reachedAmmo.length, item,
      fix: { control: 'ammo.stowage' }, shotIndex: lost[0]!.index,
    })
  }
  const vented = shots.filter((line) => line.shot.hit.explosion === 'vented')
  if (vented.length > 0) {
    found.push({
      kind: 'savedByPanels', weight: W.saved + vented.length, count: vented.length, of: reachedAmmo.length, fix: null,
      shotIndex: vented[0]!.index,
    })
  }

  // Fire.
  const fires = shots.filter((line) => line.shot.hit.fire !== 'none')
  const burned = fires.filter((line) => line.shot.hit.fire === 'burned')
  // A fire put out in a tank that blew up all the same saved nothing.
  const putOut = fires.filter((line) => line.shot.hit.fire === 'putOut' && line.shot.hit.explosion !== 'destroyed')
  if (burned.length > 0) {
    found.push({
      kind: 'burned', weight: W.burned + burned.length, count: burned.length, of: fires.length,
      fix: spec.protection.fireSuppression ? null : { control: 'protection.fireSuppression' }, shotIndex: burned[0]!.index,
    })
  }
  if (putOut.length > 0) {
    found.push({
      kind: 'savedBySuppression', weight: W.saved + putOut.length, count: putOut.length, of: fires.length, fix: null,
      shotIndex: putOut[0]!.index,
    })
  }

  // Fragments. A liner that is fitted has already done what it can.
  const caught = shots.filter((line) => line.shot.hit.spalled.length > 0)
  if (caught.length > 0 && !spec.protection.spallLiner) {
    const crew = caught.reduce((sum, line) => sum + line.shot.hit.spalled.length, 0)
    found.push({
      kind: 'fragments', weight: W.fragments + crew, count: crew, of: caught.length,
      fix: { control: 'protection.spallLiner' }, shotIndex: caught[0]!.index,
    })
  }

  const through = shots.filter((line) => line.shot.hit.through).length
  if (through === 0 && shots.length > 0) {
    found.push({ kind: 'allHeld', weight: W.allHeld, count: shots.length, of: shots.length, fix: null, shotIndex: 0 })
  }

  // Ties keep the order they were found in, so the report never shuffles.
  return found
    .map((finding, order) => ({ finding, order }))
    .sort((a, b) => b.finding.weight - a.finding.weight || a.order - b.order)
    .map((each) => each.finding)
}

export function afterAction(run: ArmourRun, spec: VehicleSpec): AfterAction {
  const shots = timelineOf(run)
  const crewOut = Object.fromEntries(STATION_IDS.map((id) => [id, 0])) as Record<StationId, number>
  const outcomes = Object.fromEntries(OUTCOMES.map((id) => [id, 0])) as Record<Outcome, number>
  const reached = new Map<ItemId, number>()
  let worstIndex: number | null = null
  for (const line of shots) {
    const { hit } = line.shot
    outcomes[hit.outcome]++
    for (const station of hit.crewOut) crewOut[station]++
    for (const each of hit.reached) {
      if (each.kind !== 'crew' && each.effect !== 'binHeld') reached.set(each.id, (reached.get(each.id) ?? 0) + 1)
    }
    if (worstIndex === null || OUTCOMES.indexOf(hit.outcome) > OUTCOMES.indexOf(shots[worstIndex]!.shot.hit.outcome)) worstIndex = line.index
  }
  const through = shots.filter((line) => line.shot.hit.through).length
  return {
    shots,
    stopped: shots.length - through,
    through,
    tracks: shots.filter((line) => line.shot.hit.trackBroken).length,
    crewOut,
    parts: ITEM_IDS.filter((id) => reached.has(id)).map((id) => ({ id, rounds: reached.get(id) ?? 0 })),
    outcomes,
    worstIndex,
    findings: weigh(run, spec).slice(0, REPORT.findings),
  }
}
