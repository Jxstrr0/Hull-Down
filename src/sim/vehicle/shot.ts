// The quick test shot: one round at one zone, layer by layer. A first cut of
// the layer part of the hit model. The shot comes in level, a chosen angle
// off square to the zone's face. No tile wear, nothing behind the armour and
// no luck: the answer is an estimate with a stated margin of error.
// Game-level abstractions, not engineering data.
import type { Round, RoundKind } from '../../data/ammo'
import { MATERIALS } from '../../data/materials'
import { TUNING } from '../../data/tuning'
import { PI, detCos } from '../det'
import { penetrationAt, tileWorthMm, verdictOf, type Verdict } from './protection'
import type { ArmourLayer } from './spec'

export interface ShotSetup {
  round: Round
  rangeM: number
  /** How far the shot comes in off square to the zone's face, degrees. */
  angleDeg: number
  /** True when the shot meets a reactive tile before the plate. */
  tile: boolean
}

/** What happened at one thing in the shot's way. */
export interface ShotStep {
  /** A reactive tile, or the layer at `layer` in the stack (outside first). */
  what: 'tile' | 'layer'
  layer?: number
  /** Millimetres of rolled steel this step is worth to this round on this path. */
  worthMm: number
  /** What the round could still go through after it. */
  leftMm: number
  fate: 'through' | 'stopped' | 'notReached'
  /** Share of the way through this step the round got, 0 to 1. */
  crossed: number
}

export interface ShotResult {
  /** What the round goes through at this range, square on. */
  penMm: number
  /** Cosine of the angle between the shot and square-on to the plate. */
  cosine: number
  /** How many times the plate thickness the shot must cross. */
  pathFactor: number
  /** A kinetic round that meets the plate too steeply skids off. */
  ricochet: boolean
  /** Outside first. A tile, when there is one, comes before the layers. */
  steps: ShotStep[]
  /** Everything in the way, in millimetres of rolled steel. */
  worthMm: number
  /** Worth less what the round goes through. Above nought it stops, on paper. */
  spareMm: number
  /** The answer could be out by this much either way. */
  marginMm: number
  verdict: Verdict
  /** What the round can still go through once it is past everything. Nought when it was stopped. */
  leftMm: number
}

function rad(deg: number): number {
  return (deg * PI) / 180
}

/** Cosine of the angle between a level shot `angleDeg` off square and a plate leaning `slopeDeg`. */
export function shotCosine(slopeDeg: number, angleDeg: number): number {
  return detCos(rad(slopeDeg)) * detCos(rad(angleDeg))
}

/** A round meeting a stack of plates along a known line. */
export interface StackShot {
  kind: RoundKind
  /** What the round goes through when it arrives, square on. */
  penMm: number
  /** Cosine of the angle between the shot and square-on to the plate. */
  cosine: number
  /** True when the shot meets a reactive tile before the plate. */
  tile: boolean
  /** True for a tandem warhead, which a tile does little to. */
  tandem?: boolean
}

/** One round through one stack, layer by layer. No luck: the same shot always gives the same answer. */
export function shotThrough(layers: readonly ArmourLayer[], shot: StackShot): ShotResult {
  const { penMm, cosine } = shot
  const pathFactor = 1 / cosine
  const kinetic = shot.kind === 'kinetic'
  const ricochet = kinetic && cosine < detCos(rad(TUNING.protection.ricochetDeg))

  const worths: { what: 'tile' | 'layer'; layer?: number; worthMm: number }[] = []
  // A tile is worth the same whatever the angle.
  if (shot.tile) worths.push({ what: 'tile', worthMm: tileWorthMm(shot) })
  layers.forEach((layer, index) => {
    const material = MATERIALS[layer.material]
    worths.push({ what: 'layer', layer: index, worthMm: layer.mm * (kinetic ? material.ke : material.ce) * pathFactor })
  })

  let left = penMm
  let stopped = ricochet
  let worthMm = 0
  const steps = worths.map((item): ShotStep => {
    worthMm += item.worthMm
    if (stopped) return { ...item, leftMm: 0, fate: 'notReached', crossed: 0 }
    if (left > item.worthMm || item.worthMm === 0) {
      left -= item.worthMm
      return { ...item, leftMm: left, fate: 'through', crossed: 1 }
    }
    const crossed = left / item.worthMm
    left = 0
    stopped = true
    return { ...item, leftMm: 0, fate: 'stopped', crossed }
  })

  return {
    penMm,
    cosine,
    pathFactor,
    ricochet,
    steps,
    worthMm,
    spareMm: worthMm - penMm,
    marginMm: penMm * TUNING.protection.marginShare,
    verdict: ricochet ? 'holds' : verdictOf(worthMm, penMm),
    leftMm: stopped ? 0 : left,
  }
}

export function testShot(layers: readonly ArmourLayer[], slopeDeg: number, setup: ShotSetup): ShotResult {
  return shotThrough(layers, {
    kind: setup.round.kind,
    penMm: penetrationAt(setup.round, setup.rangeM),
    cosine: shotCosine(slopeDeg, setup.angleDeg),
    tile: setup.tile,
    tandem: setup.round.tandem,
  })
}
