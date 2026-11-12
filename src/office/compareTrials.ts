// Two visits to the range side by side: every measured thing, what it came
// to for each build, and which way it moved. Plain data, no DOM.
import { GUNNERY_TEST_IDS, OBSTACLES, RANGE } from '../data/range'
import { STRINGS, fill } from '../data/strings'
import type { RangeReport } from '../sim/trials'
import { fixed } from '../ui/format'
import type { Move } from './compare'

const R = STRINGS.range
const T = STRINGS.office.compare.trials

export interface TrialMove {
  key: string
  label: string
  before: string
  after: string
  /** Whether each build met the mark. Null for a thing that has no mark of its own. */
  beforePassed: boolean | null
  afterPassed: boolean | null
  move: Move
  verdict: 'better' | 'worse' | null
}

interface Reading {
  /** The number that is compared. */
  value: number
  text: string
  passed: boolean | null
}

interface Measure {
  key: string
  label: string
  better: 'more' | 'less'
  read(report: RangeReport): Reading
}

const passWord = (passed: boolean): string => (passed ? R.pass : R.fail)

function measures(): Measure[] {
  const A = R.acceleration
  const list: Measure[] = [
    {
      key: 'passes', label: T.passes, better: 'more',
      read: (r) => ({ value: r.passes, text: fill(T.passesValue, { passes: String(r.passes), tests: String(r.tests) }), passed: r.passes === r.tests }),
    },
    {
      key: 'sprint', label: fill(A.sprint, { kmh: String(RANGE.acceleration.sprintKmh) }), better: 'less',
      read: (r) => ({
        value: r.acceleration.sprintS ?? Infinity,
        text: r.acceleration.sprintS === null ? T.never : fill(A.sprintValue, { n: fixed(r.acceleration.sprintS, 1) }),
        passed: r.acceleration.sprintPassed,
      }),
    },
    {
      key: 'top', label: A.top, better: 'more',
      read: (r) => ({ value: r.acceleration.topKmh, text: fill(A.topValue, { n: fixed(r.acceleration.topKmh, 0) }), passed: r.acceleration.topPassed }),
    },
  ]
  for (const id of OBSTACLES) {
    list.push({
      key: `obstacle:${id}`, label: T.obstacles[id], better: 'more',
      read: (r) => {
        const result = r.obstacles.results.find((each) => each.id === id)
        const passed = result?.passed ?? false
        return { value: passed ? 1 : 0, text: passWord(passed), passed }
      },
    })
  }
  list.push(
    {
      key: 'endurance', label: T.enduranceReached, better: 'more',
      read: (r) => ({ value: r.endurance.reachedKm, text: fill(T.km, { n: fixed(r.endurance.reachedKm, 0) }), passed: r.endurance.finished }),
    },
    {
      key: 'stops', label: T.enduranceStops, better: 'less',
      read: (r) => ({ value: r.endurance.stops, text: String(r.endurance.stops), passed: r.endurance.stops <= r.marks.enduranceStops }),
    },
  )
  for (const id of GUNNERY_TEST_IDS) {
    list.push({
      key: `hits:${id}`, label: fill(T.hits, { test: R.gunnery.titles[id] }), better: 'more',
      read: (r) => ({
        value: r.gunnery[id].hits,
        text: fill(T.hitsValue, { hits: String(r.gunnery[id].hits), n: String(r.gunnery[id].targets.length) }),
        passed: r.gunnery[id].hitsPassed,
      }),
    })
  }
  list.push(
    {
      key: 'firstShot', label: T.firstShot, better: 'less',
      read: (r) => {
        const s = r.gunnery.halted.firstShotS
        return { value: s ?? Infinity, text: s === null ? T.never : fill(R.gunnery.timeValue, { n: fixed(s, 1) }), passed: r.gunnery.halted.timePassed }
      },
    },
    {
      key: 'drill', label: R.drill.title, better: 'more',
      read: (r) => ({ value: r.drill.rpm, text: fill(T.rpm, { n: fixed(r.drill.rpm, 1) }), passed: r.drill.passed }),
    },
    {
      key: 'armour', label: T.through, better: 'less',
      read: (r) => {
        const shots = r.armour.serials.reduce((sum, serial) => sum + serial.shots.length, 0)
        const through = r.armour.serials.reduce((sum, serial) => sum + serial.through, 0)
        return { value: through, text: fill(T.throughValue, { n: String(through), shots: String(shots) }), passed: r.armour.passed }
      },
    },
    {
      key: 'berm', label: T.berm, better: 'less',
      read: (r) => ({ value: r.berm.showsM, text: fill(T.metres, { n: fixed(r.berm.showsM, 2) }), passed: r.berm.passed }),
    },
  )
  return list
}

/** The measures only a tank's tender counts. */
const TANK_ONLY = /^(hits:|firstShot$|drill$|berm$)/

/** The fire mission's measures, for two builds that both went through one. */
function missionMeasures(): Measure[] {
  const mission = (r: RangeReport): NonNullable<RangeReport['fireMission']> => {
    if (!r.fireMission) throw new Error('No fire mission')
    return r.fireMission
  }
  return [
    {
      key: 'missionFirst', label: T.missionFirst, better: 'less',
      read: (r) => {
        const s = mission(r).firstRoundS
        return { value: s ?? Infinity, text: s === null ? T.never : fill(T.seconds, { n: fixed(s, 0) }), passed: mission(r).timePassed }
      },
    },
    {
      key: 'missionRate', label: T.missionRate, better: 'more',
      read: (r) => ({ value: mission(r).rpm, text: fixed(mission(r).rpm, 1), passed: mission(r).ratePassed }),
    },
    {
      key: 'missionClose', label: T.missionClose, better: 'less',
      read: (r) => {
        const m = mission(r).missM
        return { value: m ?? Infinity, text: m === null ? T.never : fill(T.metres, { n: fixed(m, 0) }), passed: mission(r).closePassed }
      },
    },
  ]
}

/** Sets the later build's visit to the range against the earlier one's. */
export function compareTrials(before: RangeReport, after: RangeReport): TrialMove[] {
  // A self-propelled gun's or an infantry fighting vehicle's shoots, drill and berm are run but do not count, so they are left out.
  const notTank = (r: RangeReport): boolean => r.selfPropelled || r.carrier || r.scouting
  const counted = notTank(before) && notTank(after) ? measures().filter((m) => !TANK_ONLY.test(m.key)) : measures()
  const all = before.fireMission && after.fireMission ? [...counted, ...missionMeasures()] : counted
  return all.map((measure): TrialMove => {
    const a = measure.read(before)
    const b = measure.read(after)
    const same = a.value === b.value || a.text === b.text
    const move: Move = same ? 'same' : b.value > a.value ? 'up' : 'down'
    const verdict = move === 'same' ? null : (move === 'up') === (measure.better === 'more') ? 'better' : 'worse'
    return { key: measure.key, label: measure.label, before: a.text, after: b.text, beforePassed: a.passed, afterPassed: b.passed, move, verdict }
  })
}
