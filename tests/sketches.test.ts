import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONTROLS } from '../src/office/controls'
import { SKETCHES } from '../src/data/sketches'

describe('part sketches', () => {
  it('points every sketch at a file that ships', () => {
    for (const [key, file] of Object.entries(SKETCHES)) expect(existsSync(`public/${file}`), key).toBe(true)
  })

  it('keys every sketch to a real option of a real part, or to a switch', () => {
    for (const key of Object.keys(SKETCHES)) {
      const [id, option] = key.split(':')
      const control = CONTROLS.find((each) => each.id === id)
      expect(control, key).toBeDefined()
      if (option === undefined) expect(control?.kind, key).toBe('toggle')
      else expect(control?.kind === 'choice' && (control.options as readonly string[]).includes(option), key).toBe(true)
    }
  })

  it('has one for every switch', () => {
    for (const control of CONTROLS) if (control.kind === 'toggle') expect(SKETCHES[control.id], control.id).toBeDefined()
  })

  it('has one for every option of every part, but "none"', () => {
    for (const control of CONTROLS) {
      if (control.kind !== 'choice') continue
      const id = control.id
      for (const option of control.options) {
        if (option !== 'none') expect(SKETCHES[`${id}:${option}`], `${id}:${option}`).toBeDefined()
      }
    }
  })
})
