import { describe, expect, it } from 'vitest'
import { changeCue, createOfficeEar } from '../src/audio/office'
import { AUDIO, CUE_IDS } from '../src/data/audio'

const gap = AUDIO.office.gapS

describe('office sound', () => {
  it('has a cue and a loudness for every office sound, the tap quietest', () => {
    const gains = AUDIO.office.gain
    for (const [id, gain] of Object.entries(gains)) {
      expect(CUE_IDS).toContain(id)
      expect(gain).toBeGreaterThan(0)
      expect(gain).toBeLessThanOrEqual(1)
      if (id !== 'tap') expect(gain).toBeGreaterThan(gains.tap)
    }
  })

  it('clicks for a plain press', () => {
    const ear = createOfficeEar()
    expect(ear.tap(1)).toBe('tap')
    expect(ear.tap(2)).toBe('tap')
  })

  it('does not click when the press made a sound of its own', () => {
    const ear = createOfficeEar()
    expect(ear.say('pencil', 1)).toBe('pencil')
    expect(ear.tap(1)).toBeNull()
    expect(ear.tap(2)).toBe('tap')
  })

  it('clicks again after a sound that came later than the press', () => {
    const ear = createOfficeEar()
    expect(ear.say('stamp', 1)).toBe('stamp')
    expect(ear.tap(1 + gap * 10)).toBe('tap')
  })

  it('does not repeat one sound faster than the gap', () => {
    const ear = createOfficeEar()
    expect(ear.say('pencil', 1)).toBe('pencil')
    expect(ear.say('pencil', 1 + gap / 2)).toBeNull()
    expect(ear.say('stamp', 1 + gap / 2)).toBe('stamp')
    expect(ear.say('pencil', 1 + gap * 2)).toBe('pencil')
    expect(ear.tap(5)).toBe('tap')
    expect(ear.tap(5)).toBeNull()
  })

  it('warns only at the moment a design goes over the weight limit', () => {
    expect(changeCue(false, true)).toBe('warn')
    expect(changeCue(true, true)).toBe('pencil')
    expect(changeCue(true, false)).toBe('pencil')
    expect(changeCue(false, false)).toBe('pencil')
  })
})
