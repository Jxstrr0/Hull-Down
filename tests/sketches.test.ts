import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONTROLS } from '../src/office/controls'
import { SKETCHES } from '../src/data/sketches'

describe('part sketches', () => {
  it('points every sketch at a file that ships', () => {
    for (const [key, file] of Object.entries(SKETCHES)) expect(existsSync(`public/${file}`), key).toBe(true)
  })

  it('keys every sketch to a real option of a real part', () => {
    for (const key of Object.keys(SKETCHES)) {
      const [id, option] = key.split(':')
      const control = CONTROLS.find((each) => each.id === id)
      expect(control, key).toBeDefined()
      expect(control?.kind === 'choice' && (control.options as readonly string[]).includes(option ?? ''), key).toBe(true)
    }
  })

  it('has one for every main gun and every engine', () => {
    for (const id of ['gun', 'powerpack.engine']) {
      const control = CONTROLS.find((each) => each.id === id)
      if (control?.kind !== 'choice') throw new Error(id)
      for (const option of control.options) expect(SKETCHES[`${id}:${option}`], `${id}:${option}`).toBeDefined()
    }
  })
})
