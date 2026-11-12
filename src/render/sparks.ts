// Sparks where a round strikes a tank: a spray of hot points thrown back off
// the plate, falling and cooling as they go. Pure: no three.js here.
import { RENDER } from '../data/render'

/** One spark's flight, in a frame where `out` runs back off the plate, `up` is up and `across` is along the plate. */
export interface SparkFlight {
  outMs: number
  upMs: number
  acrossMs: number
}

/** A spark at a moment: how far it has gone each way, metres, how big it is, and how far it has cooled, 0 to 1. */
export interface SparkNow {
  outM: number
  upM: number
  acrossM: number
  sizeM: number
  cooled: number
}

/** How many sparks a strike throws: a round that bounces off throws the most. */
export function sparkCount(hit: { through: boolean; zone: string | null; track: boolean }): number {
  const k = RENDER.sparks.count
  if (hit.zone === null) return hit.track ? k.track : 0
  return hit.through ? k.through : k.bounce
}

/** The flights of a strike's sparks, spread over a cone about `out`, the same every time. */
export function sparkFlights(count: number): SparkFlight[] {
  const k = RENDER.sparks
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: count }, (_, i) => {
    const round = i * golden
    const off = k.spreadRad * Math.sqrt((i + 0.5) / count)
    const speed = k.speedMs * (1 - k.speedSpread * ((i * 0.618034) % 1))
    return {
      outMs: speed * Math.cos(off),
      upMs: speed * Math.sin(off) * Math.sin(round) + k.liftMs,
      acrossMs: speed * Math.sin(off) * Math.cos(round),
    }
  })
}

/** Where a spark is `ageS` seconds of watching after the strike; null before it and once it has gone out. */
export function sparkAt(flight: SparkFlight, ageS: number): SparkNow | null {
  const k = RENDER.sparks
  if (ageS < 0 || ageS >= k.lifeS) return null
  const life = ageS / k.lifeS
  return {
    outM: flight.outMs * ageS,
    upM: flight.upMs * ageS - 0.5 * k.fallMs2 * ageS * ageS,
    acrossM: flight.acrossMs * ageS,
    sizeM: k.sizeM * (1 - (1 - k.endShare) * life),
    cooled: life,
  }
}
