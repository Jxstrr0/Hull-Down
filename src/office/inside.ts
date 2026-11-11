// What the cutaway shows, in words: where the rounds and the fuel are kept.
import { STRINGS, fill } from '../data/strings'
import type { Interior } from '../sim/vehicle'

const C = STRINGS.office.cutaway

/** One line for the ammunition and one for the fuel. */
export function insideLines(interior: Interior): string[] {
  const rounds: string[] = []
  const fuel: string[] = []
  for (const item of interior.items) {
    if (item.rounds > 0) {
      const place = fill(C.rounds[item.id as keyof typeof C.rounds], { n: String(item.rounds) })
      rounds.push(item.vented ? place + C.vented : place)
    }
    if (item.litres > 0) fuel.push(fill(C.fuel[item.id as keyof typeof C.fuel], { n: String(item.litres) }))
  }
  const lines: string[] = []
  if (rounds.length > 0) lines.push(fill(C.roundsLine, { list: rounds.join(', ') }))
  if (fuel.length > 0) lines.push(fill(C.fuelLine, { list: fuel.join(', ') }))
  return lines
}
