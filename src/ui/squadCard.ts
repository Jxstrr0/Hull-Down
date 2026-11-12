// The squad drop in the range report: the squad carried, the time to the drop
// point and how many of the targets the gun put out of action while the
// soldiers got clear, with each target told as it went.
import { SQUAD_TRIAL } from '../data/squad'
import { STRINGS, fill } from '../data/strings'
import type { RangeReport } from '../sim/trials'
import { el } from './dom'
import { fixed } from './format'
import type { CardKit } from './gunneryCards'

const Q = STRINGS.range.squad
const rounds = (n: number): string => n === 1 ? Q.rounds.one : fill(Q.rounds.many, { n: String(n) })

/** The squad drop's card, or nothing when the range did not run one. */
export function squadCards(report: RangeReport, kit: CardKit): HTMLElement[] {
  const run = report.squad
  if (!run) return []
  const S = SQUAD_TRIAL
  const ranges = run.targets.map((target) => target.rangeM)
  const box = kit.card(Q.title, fill(Q.about, {
    km: String(S.approach.km), n: String(run.targets.length),
    near: String(Math.min(...ranges)), far: String(Math.max(...ranges)), s: String(S.coverS),
  }), run.passed)
  const lines = el('ul', 'rg-lines')
  lines.append(
    kit.line(Q.troops, [
      run.troops > 0 ? fill(Q.troopsValue, { n: String(run.troops) }) : Q.troopsNone,
      fill(Q.troopsMark, { n: String(run.marks.troops) }),
    ], run.troopsPassed, run.troopsPassed ? undefined : kit.fixButton('crew.troops', 'squad-troops')),
    kit.line(Q.drop, [
      run.dropS === null || run.driveS === null ? Q.dropStuck
        : fill(Q.dropValue, { s: fixed(run.dropS, 0), drive: fixed(run.driveS, 0), out: fixed(run.outS, 0) }),
      fill(Q.dropMark, { n: String(run.marks.dropS) }),
    ], run.dropPassed, run.dropPassed ? undefined : kit.fixButton('powerpack.engine', 'squad-drop')),
    kit.line(Q.cover, [
      fill(Q.coverValue, { n: String(run.knocked), of: String(run.targets.length), s: String(S.coverS), rounds: rounds(run.roundsFired) }),
      fill(Q.coverMark, { n: String(run.marks.targets) }),
    ], run.coverPassed, run.coverPassed ? undefined : kit.fixButton(run.roundsFired === 0 ? 'gun' : 'fireControl.rangefinder', 'squad-cover')),
  )
  for (const [n, target] of run.targets.entries()) {
    const hits = target.shots.filter((shot) => shot.hit).length
    const words = [
      target.shots.length === 0 ? Q.targetNone
        : fill(target.downS !== null ? Q.targetDown : Q.targetUp, {
          s: fixed(target.downS ?? 0, 0), rounds: rounds(target.shots.length), h: String(hits),
        }),
    ]
    if (target.hits > 1) words.push(fill(Q.hitsNeeded, { n: String(target.hits) }))
    // Each target is told as it went: it has no mark of its own, so no verdict.
    const item = el('li', 'rg-line-item')
    const head = el('div', 'rg-line-head')
    head.append(el('span', 'rg-line-name', fill(Q.target, { name: Q.targetNames[n] ?? '', m: String(target.rangeM) })))
    item.append(head, el('p', 'rg-line-text', words.join(' ')))
    lines.append(item)
  }
  box.append(lines)
  const notes: string[] = []
  if (run.ranOut) notes.push(Q.ranOut)
  if (!run.coverPassed) notes.push(Q.slowGun)
  box.append(...notes.map((text) => el('p', 'ctl-note rg-note', text)))
  return [box]
}
