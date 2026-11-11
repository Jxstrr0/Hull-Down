// The words for a service record in the bureau's archive. No DOM here, so
// they can be tested.
import { STRINGS, fill } from '../data/strings'
import { recordTotals, type RecordYear, type ServiceRecord } from '../sim/career/record'
import { money } from './format'

const A = STRINGS.archive
const U = STRINGS.service.upgrade

export function recordTitle(record: ServiceRecord): string {
  return fill(record.name ? A.titleNamed : A.title, { designation: record.designation, name: record.name, year: String(record.year) })
}

export function servedLine(record: ServiceRecord): string {
  const n = record.years.length
  return n === 0 ? A.noYears : n === 1 ? A.servedOne : fill(A.served, { n: String(n) })
}

/** "Model 81A · after year 1 · less work for the crew". */
export function packageLines(record: ServiceRecord): string[] {
  // The record carries the letter of the last package; each line carries its own.
  const base = record.designation.replace(/[A-Z]$/, '')
  return record.packages.map((each) => fill(U.fittedLine, {
    designation: `${base}${each.letter}`, n: String(each.afterYear),
    ask: fill(U.askShort[each.ask.kind], { zone: each.ask.zone ? STRINGS.zones[each.ask.zone].name.toLowerCase() : '' }),
  }))
}

/** The record's sums: a label and a value each. */
export function recordRows(record: ServiceRecord): { label: string; value: string }[] {
  const totals = recordTotals(record)
  const P = STRINGS.service.production
  return [
    { label: P.heading, value: `${P.rates[record.production.rate].name} · ${P.qualities[record.production.quality].name}` },
    { label: A.built, value: String(totals.built) },
    { label: A.stops, value: String(totals.stops) },
    { label: A.exercises, value: fill(A.exercisesValue, { won: String(totals.won), lost: String(totals.lost), drawn: String(totals.drawn) }) },
    { label: A.fees, value: money(totals.royaltyKr) },
  ]
}

export function yearLine(year: RecordYear): string {
  const army = year.army === 0 ? A.armySame : fill(year.army > 0 ? A.armyUp : A.armyDown, { n: String(Math.abs(year.army)) })
  return fill(A.yearLine, {
    n: String(year.year), stops: String(year.stops), tanks: String(year.tanks),
    won: String(year.won), lost: String(year.lost), drawn: String(year.drawn), army,
  })
}
