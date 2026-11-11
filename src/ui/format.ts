// Number formatting for anything shown to the player.

/** A number with a fixed count of decimal places. */
export function fixed(value: number, places: number): string {
  return value.toFixed(places)
}

/** Tarnovian korona, in the house style: `Kr 2.06M`, `Kr 850k`. */
export function money(kr: number): string {
  if (kr >= 1_000_000) return `Kr ${(kr / 1_000_000).toFixed(2)}M`
  if (kr >= 1_000) return `Kr ${Math.round(kr / 1_000)}k`
  return `Kr ${Math.round(kr)}`
}

/** A bare number of unknown size: whole numbers stay whole, small ones keep two places. */
export function plain(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(Math.abs(value) < 10 ? 2 : 1)
}
