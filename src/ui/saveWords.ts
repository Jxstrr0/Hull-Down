// What the slot list says about a save. No DOM here, so it can be tested.
import { STRINGS, fill } from '../data/strings'
import type { SlotInfo } from '../persist/slots'

const S = STRINGS.saves.slots

/** "11 Nov 2026, 14:20": the player's own calendar and clock. */
export function savedWhen(savedAt: string, locale?: string): string {
  const at = new Date(savedAt)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** "Saved 11 Nov 2026, 14:20 · Tender of 1981, won · 3 designs". */
export function slotLine(info: SlotInfo, locale?: string): string {
  const career = info.year === null ? S.noCareer
    : fill(info.won === null ? S.open : info.won ? S.won : S.lost, { year: String(info.year) })
  const designs = fill(info.designs === 1 ? S.oneDesign : S.designs, { n: String(info.designs) })
  return fill(S.line, { when: savedWhen(info.savedAt, locale), career, designs })
}
