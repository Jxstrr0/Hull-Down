// A tank's service record: what the bureau's archive keeps of a tank the
// army adopted. A few plain figures a year, so it can outlast the career
// that made it.
import type { Production } from '../../data/service'
import type { TenderId } from '../../data/tenders'
import { serviceDesignation, type Career } from './career'
import type { FieldReport } from './service'
import type { UpgradeAsk } from './upgrade'

/** One year of service, as the archive keeps it. */
export interface RecordYear {
  year: number
  built: number
  fleet: number
  /** Tanks followed on the tank park, the stops among them, and how many of those were towed in. */
  tanks: number
  stops: number
  towed: number
  /** The exercise: battles won, lost and drawn. */
  won: number
  lost: number
  drawn: number
  /** What the year did to the bureau's standing with the army and the ministry. */
  army: number
  ministry: number
  royaltyKr: number
}

export interface RecordPackage {
  letter: string
  afterYear: number
  ask: UpgradeAsk
}

export interface ServiceRecord {
  /** The career it belongs to and its place among that career's tanks. */
  id: string
  /** As the army last called it, with the letter of its last package. */
  designation: string
  name: string
  /** The year of the tender it won. */
  year: number
  tender: TenderId
  production: Production
  /** Years of service reported on, oldest first. */
  years: RecordYear[]
  packages: RecordPackage[]
}

export function recordId(career: Pick<Career, 'seed'>, index: number): string {
  return `${career.seed}:${index}`
}

export function recordYear(report: FieldReport): RecordYear {
  const { running, exercise, standing } = report
  return {
    year: report.year, built: report.built, fleet: report.fleet,
    tanks: running.tanks, stops: running.stops, towed: running.towed,
    won: exercise.won, lost: exercise.lost, drawn: exercise.drawn,
    army: standing.army, ministry: standing.ministry, royaltyKr: report.royaltyKr,
  }
}

/**
 * The record of an adopted tank, from whichever of its years' reports are to
 * hand. Null for a tank that has not gone into production.
 */
export function serviceRecord(career: Career, index: number, reports: readonly FieldReport[]): ServiceRecord | null {
  const tank = career.adopted[index]
  if (!tank?.production) return null
  const years = reports.filter((report) => report.year >= 1 && report.year <= tank.years).map(recordYear)
  years.sort((a, b) => a.year - b.year)
  return {
    id: recordId(career, index), designation: serviceDesignation(tank), name: tank.name, year: tank.year, tender: tank.tender,
    production: { ...tank.production }, years,
    packages: tank.upgrades.map((upgrade) => ({ letter: upgrade.letter, afterYear: upgrade.afterYear, ask: { ...upgrade.ask } })),
  }
}

/** A record brought up to date: the newer one, with any years only the older one has. */
export function mergeRecord(older: ServiceRecord, newer: ServiceRecord): ServiceRecord {
  const have = new Set(newer.years.map((each) => each.year))
  const years = [...newer.years, ...older.years.filter((each) => !have.has(each.year))].sort((a, b) => a.year - b.year)
  return { ...newer, years }
}

/** The archive with a record filed: in place of the one it brings up to date, or at the front. */
export function fileRecord(archive: readonly ServiceRecord[], record: ServiceRecord, most: number): ServiceRecord[] {
  const at = archive.findIndex((each) => each.id === record.id)
  if (at < 0) return [record, ...archive].slice(0, most)
  return archive.map((each, index) => (index === at ? mergeRecord(each, record) : each))
}

export interface RecordTotals {
  built: number
  stops: number
  won: number
  lost: number
  drawn: number
  royaltyKr: number
}

export function recordTotals(record: ServiceRecord): RecordTotals {
  const sum = (pick: (year: RecordYear) => number): number => record.years.reduce((total, year) => total + pick(year), 0)
  return {
    built: sum((y) => y.built), stops: sum((y) => y.stops), won: sum((y) => y.won), lost: sum((y) => y.lost),
    drawn: sum((y) => y.drawn), royaltyKr: sum((y) => y.royaltyKr),
  }
}
