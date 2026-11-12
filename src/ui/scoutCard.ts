// Spot and report in the range report: the time round the route, how many
// hidden vehicles the car found, and how many saw it first, with each
// lookout told as it went.
import { SCOUT_TRIAL } from '../data/scout'
import { STRINGS, fill } from '../data/strings'
import type { RangeReport } from '../sim/trials'
import type { VehicleSpec } from '../sim/vehicle'
import { el } from './dom'
import { fixed } from './format'
import type { CardKit } from './gunneryCards'

const K = STRINGS.range.scout
const minutes = (s: number): string => fixed(s / 60, 0)

/** The card for spot and report, or nothing when the range did not run it. */
export function scoutCards(report: RangeReport, spec: VehicleSpec, kit: CardKit): HTMLElement[] {
  const run = report.scout
  if (!run) return []
  const S = SCOUT_TRIAL
  const legs = [...S.lookouts, S.home]
  const km = legs.reduce((sum, leg) => sum + leg.roadKm + leg.crossKm, 0)
  const box = kit.card(K.title, fill(K.about, { km: String(km), watch: String(S.watchS) }), run.passed)
  const lines = el('ul', 'rg-lines')
  const stops = run.stops ?? []
  const watchS = stops.reduce((sum, stop) => sum + stop.watchS, 0)
  const seenWords = run.seen === 0 ? K.seenNone : run.seen === 1 ? K.seenOne : fill(K.seenMany, { n: String(run.seen) })
  lines.append(
    kit.line(K.time, [
      run.totalS === null ? K.timeStuck
        : fill(K.timeValue, { min: minutes(run.totalS), drive: minutes(run.totalS - watchS), watch: minutes(watchS) }),
      fill(K.timeMark, { n: minutes(run.marks.timeS) }),
    ], run.timePassed, run.timePassed ? undefined : kit.fixButton('powerpack.engine', 'scout-time')),
    kit.line(K.found, [
      fill(K.foundValue, { n: String(run.found), of: String(run.hidden) }),
      fill(K.foundMark, { n: String(run.marks.found) }),
    ], run.foundPassed, run.foundPassed ? undefined : kit.fixButton(spec.fireControl.commanderSight ? 'fireControl.night' : 'fireControl.commanderSight', 'scout-found')),
    kit.line(K.seen, [
      seenWords,
      fill(K.shows, { area: fixed(run.showsM2, 1) }),
      run.marks.seen === 0 ? K.seenMarkNone : fill(K.seenMark, { n: String(run.marks.seen) }),
    ], run.seenPassed, run.seenPassed ? undefined : kit.fixButton('turret.shape', 'scout-seen')),
  )
  let targetNo = 0
  let onKm = 0
  for (const [n, stop] of stops.entries()) {
    const lookout = S.lookouts[n]!
    onKm += lookout.roadKm + lookout.crossKm
    const words = stop.targets.map((target) => {
      const name = K.targetNames[targetNo++] ?? ''
      const said = target.foundS === null
        ? fill(K.targetMissed, { name, m: String(target.rangeM) })
        : fill(K.targetFound, { name, m: String(target.rangeM), s: fixed(target.foundS, 0) })
      return target.seenFirst && target.noticedS !== null ? `${said} ${fill(K.targetSaw, { s: fixed(target.noticedS, 0) })}` : said
    })
    words.push(fill(K.watched, { s: fixed(stop.watchS, 0) }))
    // Each lookout is told as it went: it has no mark of its own, so no verdict.
    const item = el('li', 'rg-line-item')
    const head = el('div', 'rg-line-head')
    head.append(el('span', 'rg-line-name', fill(K.lookout, { n: String(n + 1), km: String(onKm) })))
    item.append(head, ...words.map((text) => el('p', 'rg-line-text', text)))
    lines.append(item)
  }
  box.append(lines)
  const notes: string[] = []
  if (!run.foundPassed) notes.push(K.findNote)
  if (!run.seenPassed) notes.push(K.seenNote)
  box.append(...notes.map((text) => el('p', 'ctl-note rg-note', text)))
  return [box]
}
