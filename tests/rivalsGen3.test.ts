// Generation three: what the rival bureaux fit by the tender of 2016.
import { describe, expect, it } from 'vitest'
import { BUREAU_IDS, BUREAUS } from '../src/data/opponents'
import { TURRETS } from '../src/data/parts'
import { TENDERS } from '../src/data/tenders'
import { designRival, draftRival, reviseRival } from '../src/sim/ai/designer'
import { buildStatSheet } from '../src/sim/vehicle'

const T2 = TENDERS.tank2001
const T3 = TENDERS.tank2016
const SEEDS = [101, 102, 103, 104, 105, 106, 107, 108]

describe('the rival bureaux in generation three', () => {
  it('each has something new for 2016', () => {
    for (const bureau of BUREAU_IDS) expect(BUREAUS[bureau].later[3], bureau).toBeDefined()
  })

  it('fit active protection, and one the unmanned turret', () => {
    for (const seed of SEEDS) {
      const heavy = designRival('heavy', T3.limits, seed)
      expect(heavy.protection.active).toBe('hardKill')
      expect(heavy.powerpack.apu).toBe(true)
      expect(designRival('light', T3.limits, seed).protection.active).toBe('softKill')
      const firepower = designRival('firepower', T3.limits, seed)
      expect(firepower.turret.shape).toBe('unmanned')
      expect(firepower.protection.active).toBe('softKill')
    }
  })

  it('put in tanks that can be built and powered', () => {
    for (const seed of SEEDS) {
      for (const bureau of BUREAU_IDS) {
        const sheet = buildStatSheet(designRival(bureau, T3.limits, seed), T3.limits)
        expect(sheet.issues.filter((issue) => issue.severity === 'error'), `${bureau} ${seed}`).toEqual([])
        expect(sheet.electrics.drawKw).toBeLessThanOrEqual(sheet.electrics.supplyKw)
      }
    }
  })

  it('fit none of it a generation early', () => {
    for (const seed of SEEDS) {
      for (const bureau of BUREAU_IDS) {
        const spec = designRival(bureau, T2.limits, seed)
        expect(spec.protection.active, bureau).toBe('none')
        expect(TURRETS[spec.turret.shape].crewed, bureau).toBe(true)
      }
    }
  })

  it('keep a tank that can be built when a trial teaches them something', () => {
    for (const seed of SEEDS) {
      const draft = draftRival('firepower', T3.limits, seed)
      const next = reviseRival(draft, 'firepower', T3.limits, ['berm', 'night', { zone: 'turretRoof' }]) ?? draft
      expect(buildStatSheet(next.spec, T3.limits).issues.filter((issue) => issue.severity === 'error')).toEqual([])
    }
  })
})
