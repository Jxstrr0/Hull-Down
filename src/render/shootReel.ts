// A firing test laid out for watching. The sim has already shot it; this
// sets each target, each round's flight and each strike against the seconds
// a player watches. The long waits (finding, ranging, laying, loading) are
// cut short and the flights are shown as they were. Plain numbers, no
// three.js.
import { RENDER } from '../data/render'
import { flightOf, type Fire } from '../sim/gunnery/fire'
import type { GunneryRun } from '../sim/trials'

/**
 * What is happening to a target: the crew is working up to a shot, a round
 * is in the air, the picture is holding on where it landed, or the target
 * went by without a shot (never seen, or down again before the crew fired).
 */
export type ReelPhase = 'working' | 'flight' | 'strike' | 'unseen' | 'tooSlow'

export interface ReelFrame {
  /** Which target is up, counting from nought. */
  targetIndex: number
  phase: ReelPhase
  /** Which of the rounds at this target the phase belongs to, counting from nought. Nought when none was fired. */
  shotIndex: number
  /** Seconds of the real test since this target came up. */
  clockS: number
  /** Metres the tank has driven since the shoot began. */
  tankM: number
  /** Nought while it is halted. */
  speedKmh: number
  /** How far down the range the board stands, from where the shoot began. */
  boardM: number
  /** How far along its flight the round in the air is, 0 to 1. Null when none is. */
  flightShare: number | null
  /** Seconds of watching since the gun fired, while its round is in the air. Null otherwise. */
  sinceFiredS: number | null
  /** Rounds at this target that have landed. */
  landed: number
  /** True once a round that hit has landed. */
  struck: boolean
  /** True once the board has gone down: a little after the hit, so the hit is seen first. */
  fallen: boolean
  /** Rounds landed and targets hit so far in the whole shoot. */
  rounds: number
  hits: number
  /** True once the reel has run out. */
  done: boolean
}

interface Piece {
  fromS: number
  toS: number
  targetIndex: number
  phase: ReelPhase
  shotIndex: number
  fromClockS: number
  toClockS: number
  fromM: number
  toM: number
  speedKmh: number
  boardM: number
  landed: number
  struck: boolean
  rounds: number
  hits: number
}

export interface ShootReel {
  /** Seconds it takes to watch. */
  lengthS: number
  /** The second of watching each round is fired at, in the order they were fired. */
  firedS: number[]
  at(timeS: number): ReelFrame
}

export function reelOf(run: GunneryRun, fire: Fire): ShootReel {
  const k = RENDER.shoot
  const cruiseKmh = run.moving ? k.driveKmh : 0
  const pieces: Piece[] = []
  const firedS: number[] = []
  let atS = 0
  let atM = 0
  let rounds = 0
  let hits = 0

  run.targets.forEach((target, targetIndex) => {
    const boardM = atM + target.rangeM
    let clockS = 0
    let landed = 0
    let struck = false
    const add = (phase: ReelPhase, shotIndex: number, seconds: number, toClockS: number, speedKmh: number): void => {
      const metres = (speedKmh / 3.6) * seconds
      pieces.push({
        fromS: atS, toS: atS + seconds, targetIndex, phase, shotIndex, fromClockS: clockS, toClockS,
        fromM: atM, toM: atM + metres, speedKmh, boardM, landed, struck, rounds, hits,
      })
      atS += seconds
      atM += metres
      clockS = toClockS
    }

    if (target.shots.length === 0) {
      add(target.seen ? 'tooSlow' : 'unseen', 0, k.passS, clockS, cruiseKmh)
      return
    }
    const round = fire.rounds.find((each) => each.id === target.round)
    const realS = round ? flightOf(round, target.rangeM).timeS : k.flightMinS
    const flightS = Math.min(k.flightMaxS, Math.max(k.flightMinS, realS))
    target.shots.forEach((shot, shotIndex) => {
      // A tank that has to stop for its shots drives up to the first and then stays put.
      const rolling = run.halted ? (shotIndex === 0 ? cruiseKmh : 0) : cruiseKmh
      add('working', shotIndex, k.waitS, shot.atS, rolling)
      firedS.push(atS)
      add('flight', shotIndex, flightS, shot.atS + realS, run.halted ? 0 : cruiseKmh)
      landed++
      rounds++
      if (shot.hit) {
        struck = true
        hits++
      }
      add('strike', shotIndex, k.strikeS, clockS, run.halted ? 0 : cruiseKmh)
    })
  })

  const lengthS = atS
  const last = pieces.at(-1)

  const frame = (piece: Piece, share: number, done: boolean): ReelFrame => ({
    targetIndex: piece.targetIndex,
    phase: piece.phase,
    shotIndex: piece.shotIndex,
    clockS: piece.fromClockS + (piece.toClockS - piece.fromClockS) * share,
    tankM: piece.fromM + (piece.toM - piece.fromM) * share,
    speedKmh: piece.speedKmh,
    boardM: piece.boardM,
    flightShare: piece.phase === 'flight' ? share : null,
    sinceFiredS: piece.phase === 'flight' ? (piece.toS - piece.fromS) * share : null,
    landed: piece.landed,
    struck: piece.struck,
    fallen: piece.struck && (piece.toS - piece.fromS) * share >= RENDER.shoot.fallAfterS,
    rounds: piece.rounds,
    hits: piece.hits,
    done,
  })

  function at(timeS: number): ReelFrame {
    if (!last) {
      return {
        targetIndex: 0, phase: 'unseen', shotIndex: 0, clockS: 0, tankM: 0, speedKmh: 0, boardM: 0,
        flightShare: null, sinceFiredS: null, landed: 0, struck: false, fallen: false, rounds: 0, hits: 0, done: true,
      }
    }
    if (!(timeS > 0)) return frame(pieces[0]!, 0, false)
    if (timeS >= lengthS) return frame(last, 1, true)
    // Few pieces: a walk is quick enough.
    const piece = pieces.find((each) => timeS < each.toS) ?? last
    return frame(piece, (timeS - piece.fromS) / (piece.toS - piece.fromS), false)
  }

  return { lengthS, firedS, at }
}
