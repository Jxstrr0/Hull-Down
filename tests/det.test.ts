import { describe, expect, it } from 'vitest'
import { PI, detAtan2, detCos, detExp, detLog, detPow, detSin, powInt, sCurve } from '../src/sim/det'

describe('deterministic maths', () => {
  it('matches the built-in functions closely', () => {
    for (const x of [-7.5, -1, -0.3, 0, 0.2, 1, 2.5, 9]) {
      expect(detSin(x)).toBeCloseTo(Math.sin(x), 12)
      expect(detCos(x)).toBeCloseTo(Math.cos(x), 12)
      expect(detExp(x)).toBeCloseTo(Math.exp(x), 8)
    }
    for (const x of [0.001, 0.5, 1, 3, 1200]) expect(detLog(x)).toBeCloseTo(Math.log(x), 12)
    expect(detPow(2.5, 1.7)).toBeCloseTo(Math.pow(2.5, 1.7), 10)
    expect(detAtan2(1, -1)).toBeCloseTo(Math.atan2(1, -1), 12)
    expect(PI).toBe(Math.PI)
  })

  it('has exact whole-number powers and a centred S-curve', () => {
    expect(powInt(3, 4)).toBe(81)
    expect(powInt(2, -2)).toBe(0.25)
    expect(sCurve(0)).toBe(0.5)
  })
})
