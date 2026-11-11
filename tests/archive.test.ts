import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { SERVICE } from '../src/data/service'
import { STRINGS } from '../src/data/strings'
import { ARCHIVE_KEY, cleanArchive, loadArchive, saveArchive } from '../src/persist/archiveStore'
import {
  buildPrototype, enterTender, fitUpgrade, newCareer, reportOf, serviceYear, startProduction, type Career,
} from '../src/sim/career/career'
import { fileRecord, mergeRecord, recordId, recordTotals, recordYear, serviceRecord } from '../src/sim/career/record'
import { packageLines, recordRows, recordTitle, servedLine, yearLine } from '../src/ui/archiveWords'

const SLOW = 30_000
const A = STRINGS.archive
const LASER = structuredClone(BASELINE_SPEC)
LASER.fireControl.night = 'imageIntensifier'
LASER.fireControl.rangefinder = 'laser'
LASER.name = 'Night owl'
const EASIER = structuredClone(LASER)
EASIER.crew.comfort = 'improved'

function memory(): { getItem(key: string): string | null; setItem(key: string, value: string): void } {
  const kept = new Map<string, string>()
  return { getItem: (key) => kept.get(key) ?? null, setItem: (key, value) => { kept.set(key, value) } }
}

/** A tank with two years of service and a package fitted after the first. */
function served(): Career {
  const won = enterTender(buildPrototype(newCareer(2), LASER), 1)
  const first = serviceYear(startProduction(won, 0, SERVICE.defaultProduction), 0)
  return serviceYear(fitUpgrade(first, 0, EASIER), 0)
}

describe('a service record', () => {
  const career = served()
  const reports = [reportOf(career, 0, 1)!, reportOf(career, 0, 2)!]
  const record = serviceRecord(career, 0, reports)!

  it('keeps a few plain figures a year', () => {
    expect(record.id).toBe(recordId(career, 0))
    expect(record.designation).toBe(`${career.adopted[0]!.designation}A`)
    expect(record.name).toBe('Night owl')
    expect(record.years.map((year) => year.year)).toEqual([1, 2])
    expect(record.years[0]).toEqual(recordYear(reports[0]!))
    expect(record.packages).toEqual([{ letter: 'A', afterYear: 1, ask: { kind: 'workload' } }])
    const totals = recordTotals(record)
    expect(totals.built).toBe(reports[0]!.built + reports[1]!.built)
    expect(totals.royaltyKr).toBe(reports[0]!.royaltyKr + reports[1]!.royaltyKr)
  }, SLOW)

  it('is not opened for a tank that is not in production', () => {
    const won = enterTender(buildPrototype(newCareer(2), LASER), 1)
    expect(serviceRecord(won, 0, [])).toBeNull()
    expect(serviceRecord(won, 3, [])).toBeNull()
  }, SLOW)

  it('is brought up to date without losing the years already filed', () => {
    const early = serviceRecord(career, 0, [reports[0]!])!
    const late = serviceRecord(career, 0, [reports[1]!])!
    expect(mergeRecord(early, late).years.map((year) => year.year)).toEqual([1, 2])
    const other = { ...record, id: '9:0' }
    const filed = fileRecord(fileRecord([other], early, 5), late, 5)
    expect(filed.map((each) => each.id)).toEqual([record.id, '9:0'])
    expect(filed[0]).toEqual(record)
    expect(fileRecord(filed, { ...record, id: '8:0' }, 2).map((each) => each.id)).toEqual(['8:0', record.id])
  }, SLOW)

  it('is kept in the browser under the game\'s own key, and cleaned on the way back', () => {
    const storage = memory()
    expect(loadArchive(storage)).toEqual([])
    expect(saveArchive(storage, [record])).toBe(true)
    expect(ARCHIVE_KEY.startsWith('hulldown.')).toBe(true)
    expect(loadArchive(storage)).toEqual([record])
    storage.setItem(ARCHIVE_KEY, 'not json')
    expect(loadArchive(storage)).toEqual([])
    const bad = JSON.parse(JSON.stringify(record))
    bad.years.push({ year: 99 }, { year: 1, stops: 7 }, 'x')
    bad.years[0].stops = -4
    bad.packages.push({ letter: 'Q', afterYear: 2, ask: { kind: 'protection' } })
    const cleaned = cleanArchive([bad, bad, { id: 'x' }, 5, { ...bad, id: '1:1', tender: 'nonsense' }])
    expect(cleaned).toHaveLength(1)
    expect(cleaned[0]!.years.map((year) => year.year)).toEqual([1, 2])
    expect(cleaned[0]!.years[0]!.stops).toBe(0)
    expect(cleaned[0]!.packages).toEqual(record.packages)
    expect(cleanArchive({})).toEqual([])
  }, SLOW)

  it('reads as a page', () => {
    expect(recordTitle(record)).toBe(`${record.designation} · Night owl · adopted ${record.year}`)
    expect(recordTitle({ ...record, name: '' })).toBe(`${record.designation} · adopted ${record.year}`)
    expect(servedLine(record)).toBe('2 years of service on record')
    expect(servedLine({ ...record, years: [] })).toBe(A.noYears)
    expect(servedLine({ ...record, years: [record.years[0]!] })).toBe(A.servedOne)
    expect(packageLines(record)).toEqual([`${record.designation} · after year 1 · less work for the crew`])
    expect(recordRows(record).map((row) => row.label)).toEqual([STRINGS.service.production.heading, A.built, A.stops, A.exercises, A.fees])
    const line = yearLine({ ...record.years[0]!, stops: 6, tanks: 40, won: 4, lost: 1, drawn: 1, army: -2 })
    expect(line).toBe('Year 1: 6 stops in 40 tanks · exercise 4–1–1 · army down 2')
    expect(yearLine({ ...record.years[0]!, army: 0 })).toContain(A.armySame)
  }, SLOW)
})
