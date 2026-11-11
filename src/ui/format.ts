// Number formatting for anything shown to the player.
import { fill, STRINGS } from '../data/strings'

/** A number with a fixed count of decimal places. */
export function fixed(value: number, places: number): string {
  return value.toFixed(places)
}

/** Tarnovian korona, in the house style: `Kr 2.06M`, `Kr 850k`. */
export function money(kr: number): string {
  if (kr >= 1_000_000) return fill(STRINGS.money.millions, { n: (kr / 1_000_000).toFixed(2) })
  if (kr >= 1_000) return fill(STRINGS.money.thousands, { n: String(Math.round(kr / 1_000)) })
  return fill(STRINGS.money.ones, { n: String(Math.round(kr)) })
}

/** A bare number of unknown size: whole numbers stay whole, small ones keep two places. */
export function plain(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(Math.abs(value) < 10 ? 2 : 1)
}

/** A change in a number, with its sign: `+0.8`, `−0.4`, `0.0`. */
export function signed(value: number, places: number): string {
  const text = Math.abs(value).toFixed(places)
  if (Number(text) === 0) return text
  return (value > 0 ? '+' : '−') + text
}

/** A change in korona, with its sign: `+Kr 35k`, `−Kr 12k`. */
export function signedMoney(kr: number): string {
  const text = money(Math.abs(kr))
  if (Math.abs(kr) < 500) return money(0)
  return (kr > 0 ? '+' : '−') + text
}
