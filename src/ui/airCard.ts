// The air defence trial in the range report: how many raiders came down
// before their line and how quickly the gun opened fire, with each raider
// told as it came.
import { AIR_TRIAL } from '../data/airDefence'
import { STRINGS, fill } from '../data/strings'
import type { RangeReport } from '../sim/trials'
import type { VehicleSpec } from '../sim/vehicle'
import { el } from './dom'
import { fixed } from './format'
import type { CardKit } from './gunneryCards'

const K = STRINGS.range.air
/** Metres to the nearest hundred: the card tells ranges as a crew would. */
const hundreds = (m: number): string => String(Math.round(m / 100) * 100)

/** The card for the air defence trial, or nothing when the range did not run it. */
export function airCards(report: RangeReport, spec: VehicleSpec, kit: CardKit): HTMLElement[] {
  const run = report.air
  if (!run) return []
  const box = kit.card(K.title, fill(K.about, { n: String(AIR_TRIAL.raids.length) }), run.passed)
  const lines = el('ul', 'rg-lines')
  const fc = spec.fireControl
  // A miss is most often the radar, then the computer, then the rounds.
  // A better computer also hits sooner, so it saves rounds: it comes before more of them.
  const downedFix = !fc.searchRadar ? 'fireControl.searchRadar'
    : fc.computer !== 'digital' ? 'fireControl.computer'
      : run.ranOut ? 'ammo.rounds' : 'fireControl.sight'
  lines.append(
    kit.line(K.downed, [
      fill(K.downedValue, { n: String(run.downed), of: String(run.raiders.length) }),
      fill(K.bursts, { n: String(run.bursts), of: String(run.carried) }),
      ...(run.ranOut ? [K.ranOut] : []),
      fill(K.downedMark, { n: String(run.marks.downed) }),
    ], run.downedPassed, run.downedPassed ? undefined : kit.fixButton(downedFix, 'air-downed')),
    kit.line(K.reaction, [
      run.reactionS === null ? K.reactionNone : fill(K.reactionValue, { s: fixed(run.reactionS, 1) }),
      fill(K.reactionMark, { n: String(run.marks.reactionS) }),
    ], run.reactionPassed, run.reactionPassed ? undefined
      : kit.fixButton(fc.searchRadar ? 'fireControl.computer' : 'fireControl.searchRadar', 'air-reaction')),
  )
  for (const [n, raider] of run.raiders.entries()) {
    const words: string[] = []
    if (raider.foundM === null) words.push(K.notFound)
    else {
      words.push(fill(raider.byRadar ? K.foundRadar : K.foundEye, { m: hundreds(raider.foundM) }))
      if (raider.reactionS === null) words.push(raider.dry ? K.dryAt : K.tooLate)
      else {
        // Under a tenth of a second: the radar had it, and the gun was already on it.
        words.push(raider.reactionS < 0.05 ? K.firstWaiting : fill(K.firstAfter, { s: fixed(raider.reactionS, 1) }))
        const k = raider.bursts === 1 ? K.burstOne : fill(K.burstsMany, { n: String(raider.bursts) })
        const K1 = k.charAt(0).toUpperCase() + k.slice(1)
        words.push(raider.downedM !== null ? fill(K.downedAt, { m: hundreds(raider.downedM), k })
          : fill(raider.dry ? K.dryAfter : K.gotThrough, { K: K1 }))
      }
    }
    // Each raider is told as it came: it has no mark of its own, so no verdict.
    const item = el('li', 'rg-line-item')
    const head = el('div', 'rg-line-head')
    head.append(el('span', 'rg-line-name', fill(K.raider, { n: String(n + 1), name: K.names[raider.kind] })))
    item.append(head, ...words.map((text) => el('p', 'rg-line-text', text)))
    lines.append(item)
  }
  box.append(lines)
  const notes: string[] = []
  if (!fc.searchRadar && !run.passed) notes.push(K.radarNote)
  if (fc.computer !== 'digital' && !run.downedPassed) notes.push(K.computerNote)
  if (run.ranOut) notes.push(K.roundsNote)
  box.append(...notes.map((text) => el('p', 'ctl-note rg-note', text)))
  return [box]
}
