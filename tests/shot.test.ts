import { describe, expect, it } from 'vitest'
import { THREATS, THREAT_IDS } from '../src/data/ammo'
import { BASELINE_SPEC } from '../src/data/baseline'
import { ERA_TILE } from '../src/data/era'
import { ZONES } from '../src/data/materials'
import { STRINGS } from '../src/data/strings'
import { PACT_LIMITS_GEN1, TUNING } from '../src/data/tuning'
import {
  buildStatSheet, penetrationAt, shotCosine, testShot, verdictsAgainst, type ArmourLayer, type ShotSetup,
} from '../src/sim/vehicle'

const P = TUNING.protection
const sheet = buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1)
const glacis = BASELINE_SPEC.armour.upperGlacis
const glacisSlope = sheet.protection.upperGlacis.slopeDeg

function setup(change: Partial<ShotSetup> = {}): ShotSetup {
  return { round: THREATS.accord105Sabot, rangeM: 1000, angleDeg: 0, tile: false, ...change }
}

const plate = (mm: number): ArmourLayer[] => [{ material: 'rolledSteel', mm }]

describe('the test shot', () => {
  it('agrees with the protection map for a square-on shot at bare plate', () => {
    for (const id of THREAT_IDS) {
      for (const rangeM of P.mapRangesM) {
        const verdicts = verdictsAgainst(sheet.protection, THREATS[id], rangeM)
        for (const zone of ZONES) {
          const result = testShot(BASELINE_SPEC.armour[zone], sheet.protection[zone].slopeDeg, setup({ round: THREATS[id], rangeM }))
          expect(result.ricochet, `${id} ${zone}`).toBe(false)
          expect(result.verdict, `${id} ${zone}`).toBe(verdicts[zone])
        }
      }
    }
  })

  it('walks the stack from the outside, layer by layer', () => {
    const result = testShot(glacis, glacisSlope, setup())
    expect(result.penMm).toBe(penetrationAt(THREATS.accord105Sabot, 1000))
    expect(result.steps.map((step) => step.layer)).toEqual([0, 1, 2])
    expect(result.steps.map((step) => step.fate)).toEqual(['through', 'through', 'stopped'])
    let left = result.penMm
    for (const step of result.steps) {
      expect(step.what).toBe('layer')
      expect(step.leftMm).toBeLessThanOrEqual(left)
      expect(step.crossed).toBeGreaterThanOrEqual(0)
      expect(step.crossed).toBeLessThanOrEqual(1)
      left = step.leftMm
    }
    expect(result.steps[0]?.leftMm).toBeCloseTo(result.penMm - (result.steps[0]?.worthMm ?? 0), 6)
    expect(result.worthMm).toBeCloseTo(sheet.protection.upperGlacis.keMm, 6)
    expect(result.spareMm).toBeCloseTo(result.worthMm - result.penMm, 6)
    expect(result.marginMm).toBeCloseTo(result.penMm * P.marginShare, 6)
  })

  it('stops reaching layers once the round is spent', () => {
    const result = testShot([...plate(300), ...plate(100), ...plate(50)], 0, setup())
    expect(result.steps.map((step) => step.fate)).toEqual(['through', 'stopped', 'notReached'])
    expect(result.steps[1]?.crossed).toBeCloseTo((result.penMm - 300) / 100, 6)
    expect(result.steps[2]).toMatchObject({ leftMm: 0, crossed: 0 })
    expect(result.verdict).toBe('holds')
  })

  it('goes through thin plate with plenty left', () => {
    const result = testShot(plate(60), 0, setup())
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0]).toMatchObject({ fate: 'through', crossed: 1 })
    expect(result.steps[0]?.leftMm).toBeCloseTo(result.penMm - 60, 6)
    expect(result.verdict).toBe('fails')
    expect(result.spareMm).toBeLessThan(0)
  })

  it('finds nothing in the way of a shot at a bare zone', () => {
    const result = testShot([], 0, setup())
    expect(result.steps).toEqual([])
    expect(result.worthMm).toBe(0)
    expect(result.verdict).toBe('fails')
  })

  it('lets a kinetic round cross an air gap for nothing', () => {
    const stack: ArmourLayer[] = [...plate(20), { material: 'airGap', mm: 100 }, ...plate(20)]
    const result = testShot(stack, 0, setup({ round: THREATS.autocannon, rangeM: 0 }))
    expect(result.steps[1]).toMatchObject({ worthMm: 0, fate: 'through', crossed: 1 })
    expect(result.steps[1]?.leftMm).toBe(result.steps[0]?.leftMm)
  })
})

describe('the angle of the shot', () => {
  it('makes the shot cross more plate', () => {
    expect(shotCosine(0, 0)).toBeCloseTo(1, 12)
    expect(shotCosine(0, 60)).toBeCloseTo(0.5, 12)
    expect(shotCosine(60, 60)).toBeCloseTo(0.25, 12)
    const square = testShot(plate(100), 0, setup())
    const turned = testShot(plate(100), 0, setup({ angleDeg: 60 }))
    expect(square.pathFactor).toBeCloseTo(1, 9)
    expect(turned.pathFactor).toBeCloseTo(2, 9)
    expect(turned.worthMm).toBeCloseTo(square.worthMm * 2, 6)
  })

  it('turns a marginal glacis into one that holds', () => {
    expect(testShot(glacis, glacisSlope, setup({ rangeM: 500 })).verdict).toBe('marginal')
    expect(testShot(glacis, glacisSlope, setup({ rangeM: 500, angleDeg: 30 })).verdict).toBe('holds')
  })

  it('makes a kinetic round skid off a plate met too steeply, but never a shaped charge', () => {
    // A 75 degree glacis seen from 60 degrees off square is past the limit.
    expect(shotCosine(75, 60)).toBeLessThan(Math.cos((P.ricochetDeg * Math.PI) / 180))
    const kinetic = testShot(plate(20), 75, setup({ angleDeg: 60, rangeM: 0 }))
    expect(kinetic.ricochet).toBe(true)
    expect(kinetic.verdict).toBe('holds')
    expect(kinetic.steps.map((step) => step.fate)).toEqual(['notReached'])

    const shaped = testShot(plate(20), 75, setup({ angleDeg: 60, round: THREATS.guidedMissile }))
    expect(shaped.ricochet).toBe(false)
    expect(shaped.verdict).toBe('fails')

    // The baseline glacis, square on, is well inside the limit.
    expect(testShot(glacis, glacisSlope, setup()).ricochet).toBe(false)
  })

  it('offers angles the drawing can show', () => {
    expect(P.shotAnglesDeg[0]).toBe(0)
    for (const angle of P.shotAnglesDeg) expect(angle).toBeLessThan(90)
    expect(P.ricochetDeg).toBeLessThan(90)
    expect(P.ricochetDeg).toBeGreaterThan(TUNING.limits.glacisAngleDeg.max)
  })
})

describe('a test shot at a reactive tile', () => {
  const side = BASELINE_SPEC.armour.hullSideFront

  it('meets the tile first, and the tile takes its share of a shaped charge', () => {
    const bare = testShot(side, 0, setup({ round: THREATS.infantryRocket }))
    const tiled = testShot(side, 0, setup({ round: THREATS.infantryRocket, tile: true }))
    expect(tiled.steps[0]).toMatchObject({ what: 'tile', worthMm: ERA_TILE.ceMm, fate: 'through' })
    expect(tiled.steps[0]?.layer).toBeUndefined()
    expect(tiled.worthMm).toBeCloseTo(bare.worthMm + ERA_TILE.ceMm, 6)
    expect(bare.verdict).toBe('fails')
    expect(tiled.verdict).toBe('marginal')
  })

  it('is worth the same whatever the angle', () => {
    const turned = testShot(side, 0, setup({ round: THREATS.infantryRocket, tile: true, angleDeg: 60 }))
    expect(turned.steps[0]?.worthMm).toBe(ERA_TILE.ceMm)
    expect(turned.steps[1]?.worthMm).toBeCloseTo(120, 6)
  })

  it('does nothing to a kinetic round', () => {
    const bare = testShot(side, 0, setup())
    const tiled = testShot(side, 0, setup({ tile: true }))
    expect(tiled.steps[0]).toMatchObject({ what: 'tile', worthMm: 0, fate: 'through', crossed: 1 })
    expect(tiled.worthMm).toBe(bare.worthMm)
    expect(tiled.verdict).toBe(bare.verdict)
  })

  it('can stop a weak shaped charge on its own', () => {
    const weak = { ...THREATS.infantryRocket, penMm: 100 }
    const result = testShot(side, 0, setup({ round: weak, tile: true }))
    expect(result.steps.map((step) => step.fate)).toEqual(['stopped', 'notReached'])
    expect(result.verdict).toBe('holds')
  })
})

describe('test shot wording', () => {
  it('has a sentence for every outcome', () => {
    const A = STRINGS.office.armour
    for (const text of [
      A.shotStopped, A.shotStoppedTile, A.shotSpent, A.shotThrough, A.shotCloseStopped, A.shotCloseThrough, A.shotSkids,
      A.shotNote, A.shotNone, A.shotSetup,
    ]) expect(text).toBeTruthy()
    expect(A.shotNote).toContain('{pct}')
  })
})
