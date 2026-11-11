import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { ZONES, type ZoneId } from '../src/data/materials'
import { MARKS_GEN1, RANGE, type ArmourSerial } from '../src/data/range'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1 } from '../src/data/tuning'
import { serialWords } from '../src/ui/armourCards'
import { runArmourTrial, runBerm, runProvingGround, runRangeJob } from '../src/sim/trials'
import { allTiles, buildStatSheet, lineAt, plateOf, setTile, traceShot, type VehicleSpec } from '../src/sim/vehicle'
import { THREATS } from '../src/data/ammo'

function build(change?: (spec: VehicleSpec) => void) {
  const spec = structuredClone(BASELINE_SPEC)
  change?.(spec)
  return buildStatSheet(spec, PACT_LIMITS_GEN1)
}

const base = build()
const trial = (sheet = base, serials: readonly ArmourSerial[] = MARKS_GEN1.armour, seed = 101) =>
  runArmourTrial(sheet.target, sheet.geometry.zoneSlopeDeg, serials, seed)

describe('laying a shot on a plate', () => {
  it('strikes the named zone anywhere within the spread, square on', () => {
    const spread = RANGE.armour.spread
    // The plates that fill their box. The others are cut by a neighbour (the hull side by the glacis, the turret
    // front by the mantlet, the turret side and roof by the lean of the plates round them): the range lays a
    // round again when it strays off one of those.
    const whole: ZoneId[] = ['upperGlacis', 'lowerGlacis', 'hullSideRear', 'hullRear', 'hullRoof', 'mantlet', 'turretRear']
    for (const zone of whole) {
      for (const across of [-spread, 0, spread]) {
        for (const along of [-spread, 0, spread]) {
          const line = lineAt(base.target.shell, zone, 0, base.geometry.zoneSlopeDeg, across, along)
          const hit = traceShot(base.target, { ...line, round: THREATS.autocannon, rangeM: 500, seed: 1, shotNo: 0 })
          expect(hit.zone, `${zone} ${across} ${along}`).toBe(zone)
        }
      }
    }
  })

  it('puts the middle of every plate on the plate', () => {
    for (const zone of ZONES) {
      const plate = plateOf(base.target.shell, zone, base.geometry.zoneSlopeDeg)
      const line = lineAt(base.target.shell, zone, 0, base.geometry.zoneSlopeDeg)
      expect(line.aim).toEqual(plate.centre)
      const entry = traceShot(base.target, { ...line, round: THREATS.autocannon, rangeM: 500, seed: 1, shotNo: 0 }).entry!
      expect(Math.hypot(entry.x - plate.centre.x, entry.y - plate.centre.y, entry.z - plate.centre.z)).toBeLessThan(1e-6)
    }
  })
})

describe('the armour trial', () => {
  it('fires every serial the marks ask for, each round on its named zone', () => {
    const run = trial()
    expect(run.serials.length).toBe(MARKS_GEN1.armour.length)
    run.serials.forEach((serial, n) => {
      expect(serial).toMatchObject(MARKS_GEN1.armour[n]!)
      expect(serial.shots.length).toBe(RANGE.armour.shots)
      for (const shot of serial.shots) expect(shot.hit.zone).toBe(serial.zone)
      expect(serial.through).toBe(serial.shots.filter((shot) => shot.hit.through).length)
      expect(serial.held).toBe(serial.through === 0)
    })
  })

  it('spreads the rounds over the plate', () => {
    const serial = trial().serials[0]!
    const points = new Set(serial.shots.map((shot) => `${shot.hit.entry!.y.toFixed(2)},${shot.hit.entry!.z.toFixed(2)}`))
    expect(points.size).toBe(RANGE.armour.shots)
  })

  it('passes the baseline whatever the luck, and shows where it is weak', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const run = trial(base, MARKS_GEN1.armour, seed)
      expect(run.failed, `seed ${seed}`).toEqual([])
      const lower = run.serials.find((serial) => serial.zone === 'lowerGlacis')!
      expect(lower.gate).toBe(false)
      expect(lower.held).toBe(false)
      expect(lower.worst).toBe('destroyed')
    }
  })

  it('fails a zone that has to hold and does not, and names it once', () => {
    const thin = build((s) => { s.armour.upperGlacis = [{ material: 'rolledSteel', mm: 40 }] })
    const run = trial(thin)
    expect(run.failed).toEqual(['upperGlacis'])
    expect(runProvingGround(thin, { seed: 101 }).armour.passed).toBe(false)
    // Zones fired on for the record never fail the trial.
    const weakRear = build((s) => { s.armour.hullRear = [{ material: 'rolledSteel', mm: 5 }] })
    expect(trial(weakRear).failed).toEqual([])
  })

  it('finds a gap in the reactive tiles, and a tile that has already gone off', () => {
    // A side too thin for the rocket on its own, that holds wherever there is a tile.
    const serials: ArmourSerial[] = [{ zone: 'hullSideFront', threat: 'infantryRocket', rangeM: 200, angleDeg: 0, gate: true }]
    const plate = (s: VehicleSpec) => { s.armour.hullSideFront = [{ material: 'rolledSteel', mm: 150 }] }
    const bare = build(plate)
    const tiled = build((s) => { plate(s); s.era.hullSideFront = allTiles('hullSideFront') })
    let bareHeld = 0
    let tiledHeld = 0
    let tiledShots = 0
    let tiledThrough = 0
    for (let seed = 1; seed <= 40; seed++) {
      if (trial(bare, serials, seed).failed.length === 0) bareHeld++
      const run = trial(tiled, serials, seed)
      if (run.failed.length === 0) tiledHeld++
      for (const shot of run.serials[0]!.shots) {
        tiledShots++
        if (shot.hit.through) {
          tiledThrough++
          // Every round that got through met bare plate: a gap, or a tile an earlier round used up.
          expect(shot.hit.tile).toBe(false)
        }
      }
    }
    expect(bareHeld).toBe(0)
    expect(tiledHeld).toBeGreaterThan(bareHeld)
    expect(tiledThrough).toBeLessThan(tiledShots)
    // One tile only, and three rounds: the others find bare plate.
    const one = build((s) => { plate(s); s.era.hullSideFront = setTile('hullSideFront', 0, 0, true) })
    expect(trial(one, serials).failed).toEqual(['hullSideFront'])
  })

  it('gives the same result for the same tank and seed, and another for another seed', () => {
    expect(trial()).toEqual(trial())
    const entries = (seed: number) => trial(base, MARKS_GEN1.armour, seed).serials.map((s) => s.shots.map((x) => x.hit.entry))
    expect(entries(1)).not.toEqual(entries(2))
  })

  it('comes back from the range worker as plain data', () => {
    const report = runRangeJob({ spec: structuredClone(BASELINE_SPEC), limits: PACT_LIMITS_GEN1, setup: { seed: 7 } })
    expect(structuredClone(report.armour)).toEqual(report.armour)
    expect(report.armour.passed).toBe(true)
  })
})

describe('the hull-down berm', () => {
  const frame = base.interior.frame

  it('shows less of a tank whose gun dips further', () => {
    let last = Infinity
    for (const dip of [2, 4, 6, 8, 10]) {
      const run = runBerm(frame, dip)
      expect(run.showsM).toBeLessThan(last)
      expect(run.pitchDeg).toBe(dip)
      last = run.showsM
    }
  })

  it('shows the whole tank with a gun that cannot dip at all', () => {
    const run = runBerm(frame, 0)
    expect(run.showsM).toBeCloseTo(frame.top, 9)
    expect(run.hullShowsM).toBeCloseTo(frame.roof, 9)
    expect(run.hullDown).toBe(false)
  })

  it('gains nothing from more dip than the ridge can use', () => {
    const enough = runBerm(frame, 20)
    expect(enough.pitchDeg).toBeCloseTo(enough.neededDeg, 9)
    expect(enough.pitchDeg).toBeLessThanOrEqual(RANGE.berm.maxSlopeDeg)
    expect(runBerm(frame, 30).showsM).toBeCloseTo(enough.showsM, 9)
    // The bore just clears the crest, and the hull is out of sight.
    expect(enough.showsM - (frame.top - frame.gunY)).toBeCloseTo(RANGE.berm.clearM, 6)
    expect(enough.hullDown).toBe(true)
    expect(enough.hullShowsM).toBe(0)
  })

  it('never shows more than the tank is tall, nor less than what stands above the gun', () => {
    for (let dip = 0; dip <= 20; dip += 0.5) {
      const run = runBerm(frame, dip)
      expect(run.showsM).toBeLessThanOrEqual(run.heightM + 1e-9)
      expect(run.showsM).toBeGreaterThanOrEqual(frame.top - frame.gunY)
      expect(run.hullShowsM).toBeLessThanOrEqual(run.showsM)
    }
  })

  it('is marked on the height showing, with the baseline inside the mark', () => {
    const report = runProvingGround(base, { seed: 3 })
    expect(report.berm.depressionDeg).toBe(base.firepower.gunDepressionDeg)
    expect(report.berm.passed).toBe(report.berm.showsM <= MARKS_GEN1.bermShowsM)
    expect(report.berm.passed).toBe(true)
    const strict = runProvingGround(base, { seed: 3, marks: { ...MARKS_GEN1, bermShowsM: 1 } })
    expect(strict.berm.passed).toBe(false)
    expect(strict.passes).toBe(report.passes - 1)
  })
})

describe('the armour trial in words', () => {
  const run = trial()
  const words = (zone: ZoneId, threat: string) =>
    serialWords(run.serials.find((serial) => serial.zone === zone && serial.threat === threat)!)

  it('says how close a plate that held came to failing', () => {
    const lines = words('upperGlacis', 'accord105Sabot')
    expect(lines[0]).toBe('All 3 stopped.')
    expect(lines[1]).toMatch(/^Closest call: \d+ mm to spare\.$/)
  })

  it('says how many got through and the worst that came of it', () => {
    const lines = words('lowerGlacis', 'accord105Sabot')
    expect(lines[0]).toBe('All 3 went through.')
    expect(lines[1]).toBe('Worst of it: the ammunition exploded and the tank was lost.')
  })

  it('says when tiles were met, and when a round found bare plate', () => {
    const serials: ArmourSerial[] = [{ zone: 'hullSideFront', threat: 'infantryRocket', rangeM: 200, angleDeg: 0, gate: true }]
    const one = build((s) => { s.armour.hullSideFront = [{ material: 'rolledSteel', mm: 150 }]; s.era.hullSideFront = allTiles('hullSideFront') })
    const seen = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) for (const line of serialWords(trial(one, serials, seed).serials[0]!)) seen.add(line.replace(/\d+/g, 'N'))
    expect(seen).toContain('N met a reactive tile.')
    expect(seen).toContain('N found bare plate between the tiles, or a tile already used up.')
  })

  it('has words for every result a serial can end on', () => {
    const worst: Record<string, string> = STRINGS.range.armour.worst
    for (const serial of run.serials) if (!serial.held) expect(worst[serial.worst], serial.worst).toBeTruthy()
  })
})
