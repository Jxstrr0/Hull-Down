// What a firing test's result points back to: which design-office control
// would mend a failure, and how to describe where a shot fell. No DOM in
// here, so it can be tested.
import { GUNNERY } from '../data/gunnery'
import type { ComputerId } from '../data/parts'
import type { Generation } from '../data/tech'
import type { STRINGS } from '../data/strings'
import type { GunneryRun, MissCause, ShotRecord, TurretPartId } from '../sim/trials'
import type { StatSheet, VehicleSpec } from '../sim/vehicle'
import { available } from '../sim/vehicle/tech'

type FixPart = keyof typeof STRINGS.controls

const CAUSE_FIX: Record<MissCause, FixPart> = {
  lay: 'fireControl.sight',
  scatter: 'gun',
  drift: 'fireControl.computer',
  ranging: 'fireControl.rangefinder',
  shake: 'fireControl.stabiliser',
}

/** The control that would cut the time to the first shot most, skipping any that is already the quickest there is. */
export function slowFix(sheet: StatSheet, spec: VehicleSpec, generation: Generation = 1): FixPart {
  const t = sheet.fire.times
  const fc = spec.fireControl
  const setS = GUNNERY.computers[fc.computer].setS
  // No computer the tender allows sets the gun any quicker than this one.
  const quickest = !(Object.keys(GUNNERY.computers) as ComputerId[])
    .some((id) => available('fireControl.computer', id, generation) && GUNNERY.computers[id].setS < setS)
  const ways: { seconds: number; part: FixPart; best: boolean }[] = [
    { seconds: t.findS, part: 'fireControl.commanderSight', best: fc.commanderSight },
    { seconds: t.rangeS, part: 'fireControl.rangefinder', best: fc.rangefinder === 'laser' },
    { seconds: setS, part: 'fireControl.computer', best: quickest },
  ]
  ways.sort((a, b) => b.seconds - a.seconds)
  // With the quickest of everything, only an easier tank to fight is left.
  return ways.find((way) => !way.best)?.part ?? 'crew.comfort'
}

/** The control where a turret part that failed is chosen. */
export function faultFix(part: TurretPartId): FixPart {
  return `fireControl.${part}`
}

/** The control that would have got more hits in this test. */
export function hitsFix(run: GunneryRun, sheet: StatSheet, spec: VehicleSpec): FixPart {
  const missed = run.targets.filter((target) => target.shots.length > 0 && !target.hit).length
  if (run.unseen >= missed && run.unseen >= run.tooSlow && run.unseen > 0) return 'fireControl.night'
  // A tank that stops for every shot has no time for a second one.
  if (run.halted) return 'fireControl.stabiliser'
  if (run.tooSlow >= missed && run.tooSlow > 0) return slowFix(sheet, spec)
  return run.blame ? CAUSE_FIX[run.blame] : 'fireControl.sight'
}

export type Place = 'high' | 'low' | 'left' | 'right'

/** Which way a shot missed by most, and how far from the middle of the board it fell. */
export function placeOf(shot: ShotRecord): { place: Place; distM: number } {
  const sideways = Math.abs(shot.acrossM) / GUNNERY.target.widthM > Math.abs(shot.upM) / GUNNERY.target.heightM
  const place: Place = sideways ? (shot.acrossM > 0 ? 'right' : 'left') : shot.upM > 0 ? 'high' : 'low'
  return { place, distM: Math.abs(sideways ? shot.acrossM : shot.upM) }
}
