// The chief engineer's words: one sentence for each remark, and the name of
// the part he points at. No DOM here, so it can be tested.
import { ZONES, type ZoneId } from '../data/materials'
import { STRINGS, fill } from '../data/strings'
import { issueText } from '../office/readouts'
import type { Remark } from '../sim/career/advisor'
import { fixed, money, plain } from './format'

const A = STRINGS.advisor
const R = A.remarks

function numbers(remark: Remark, show: (value: number) => string): { value: string; limit: string } {
  return {
    value: remark.value === undefined ? '' : show(remark.value),
    limit: remark.limit === undefined ? '' : show(remark.limit),
  }
}

/** What he says about one thing. */
export function remarkText(remark: Remark): string {
  switch (remark.kind) {
    case 'fault':
    case 'warning':
      return remark.issue ? fill(R[remark.kind], { issue: issueText(remark.issue) }) : ''
    case 'plate':
      return fill(R.plate, {
        zone: remark.zone ? STRINGS.zones[remark.zone].name.toLowerCase() : '',
        threat: remark.threat ? STRINGS.threats[remark.threat].name : '',
        range: remark.rangeM === undefined ? '' : plain(remark.rangeM),
        ...numbers(remark, plain),
      })
    case 'shoot':
      return fill(R.shoot[remark.test ?? 'halted'], numbers(remark, (value) => fixed(value, Number.isInteger(value) ? 0 : 1)))
    case 'slowShot':
    case 'top':
      return fill(R[remark.kind], numbers(remark, plain))
    case 'drill':
    case 'sprint':
      if (remark.kind === 'sprint' && remark.value === undefined) return R.sprintNever
      return fill(R[remark.kind], numbers(remark, (value) => fixed(value, 1)))
    case 'obstacle':
      return R.obstacle[remark.obstacle ?? 'trench']
    case 'berm':
      return fill(R.berm, numbers(remark, (value) => fixed(value, 2)))
    case 'reliability':
      return fill(R.reliability, numbers(remark, plain))
    case 'cost':
      return fill(R.cost, numbers(remark, money))
  }
}

/** The name of the part he points at, or null when no one part is to blame. */
export function remarkPart(remark: Remark): string | null {
  if (!remark.part) return null
  if (remark.part.startsWith('armour.')) {
    const zone = remark.part.slice('armour.'.length) as ZoneId
    return ZONES.includes(zone) ? STRINGS.zones[zone].name : null
  }
  const controls: Record<string, { label: string } | undefined> = STRINGS.controls
  return controls[remark.part]?.label ?? null
}

/** "Look at: Night sight", or null when there is nothing to open. */
export function remarkLink(remark: Remark): string | null {
  const part = remarkPart(remark)
  return part === null ? null : fill(A.look, { part })
}
