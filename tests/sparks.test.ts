import { Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import { RENDER } from '../src/data/render'
import { struckAt } from '../src/render/battleScene'
import { sparkAt, sparkCount, sparkFlights } from '../src/render/sparks'

const K = RENDER.sparks

describe('hit sparks', () => {
  it('are most when a round bounces off, fewer when it goes through, and none for a clean miss', () => {
    expect(sparkCount({ through: false, zone: 'upperGlacis', track: false })).toBe(K.count.bounce)
    expect(sparkCount({ through: true, zone: 'upperGlacis', track: false })).toBe(K.count.through)
    expect(sparkCount({ through: false, zone: null, track: true })).toBe(K.count.track)
    expect(sparkCount({ through: false, zone: null, track: false })).toBe(0)
    expect(K.count.bounce).toBeGreaterThan(K.count.through)
  })

  it('fly back off the plate, spread out, the same every time', () => {
    const flights = sparkFlights(K.count.bounce)
    expect(flights).toEqual(sparkFlights(K.count.bounce))
    for (const f of flights) {
      expect(f.outMs).toBeGreaterThan(0)
      expect(Math.hypot(f.outMs, f.upMs - K.liftMs, f.acrossMs)).toBeLessThanOrEqual(K.speedMs + 1e-9)
    }
    expect(new Set(flights.map((f) => Math.sign(f.acrossMs))).size).toBe(2)
  })

  it('fall, shrink and cool, and go out at the end of their life', () => {
    const [flight] = sparkFlights(1)
    expect(sparkAt(flight!, -0.01)).toBeNull()
    const start = sparkAt(flight!, 0)!
    expect(start.sizeM).toBe(K.sizeM)
    expect(start.cooled).toBe(0)
    const late = sparkAt(flight!, K.lifeS * 0.9)!
    expect(late.sizeM).toBeLessThan(start.sizeM)
    expect(late.cooled).toBeGreaterThan(0.8)
    expect(late.outM).toBeGreaterThan(0)
    expect(sparkAt(flight!, K.lifeS)).toBeNull()
  })
})

describe('where a round struck', () => {
  const parts = { turret: new Object3D(), turretXM: 0.5, halfM: 3, trackSideM: 1.4, trackUpM: 0.5 }

  it('turns the hit model\'s nose-back measure into the tank\'s middle-forward one', () => {
    // Head on, at the nose, a little to the right: straight back out toward the shooter.
    const { at, out } = struckAt(parts, { entry: { x: 0, y: 1.2, z: 0.3 }, zone: 'upperGlacis', direction: { x: 1, y: 0, z: 0 } })
    expect(at.x).toBeCloseTo(3, 9)
    expect(at.y).toBeCloseTo(1.2, 9)
    expect(at.z).toBeCloseTo(0.3, 9)
    expect(out.x).toBeCloseTo(1, 9)
  })

  it('turns a turret strike with the turret', () => {
    parts.turret.rotation.y = Math.PI / 2
    const { at, out } = struckAt(parts, { entry: { x: 2.5 - 1, y: 2.2, z: 0 }, zone: 'turretFrontLeft', direction: { x: 1, y: 0, z: 0 } })
    // A metre ahead of the ring, turned a quarter to the left, is a metre out on the left.
    expect(at.x).toBeCloseTo(0.5, 9)
    expect(at.z).toBeCloseTo(-1, 9)
    expect(out.z).toBeCloseTo(-1, 9)
    parts.turret.rotation.y = 0
  })

  it('puts a strike on the tracks alone on the side the round came from', () => {
    const fromLeft = struckAt(parts, { entry: null, zone: null, direction: { x: 0, y: 0, z: 1 } })
    expect(fromLeft.at.z).toBe(-parts.trackSideM)
    expect(fromLeft.out.z).toBeLessThan(0)
  })
})
