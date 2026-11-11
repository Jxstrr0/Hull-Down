import { describe, expect, it } from 'vitest'
import { BASELINE_SPEC } from '../src/data/baseline'
import { SAVES } from '../src/data/saves'
import {
  BACKUP_KEY, FIRST_PLAYED_KEY, backupDue, backupFileName, backupFileText, codeIn, daysSinceBackup, noteBackup, noteFirstPlayed,
} from '../src/persist/backup'
import { addDesign, newStore, type KeyValue } from '../src/persist/designs'
import { SAVE_FORMAT, decodeSave, encodeSave, type SaveFile } from '../src/persist/saveCode'
import { DB_NAME, clearSlot, listSlots, memoryBackend, readSlot, writeSlot, type SlotBackend } from '../src/persist/slots'
import { buildPrototype, enterTender, newCareer } from '../src/sim/career/career'

const NOW = new Date(2026, 10, 11, 9, 30)

function chest(): SaveFile {
  return { format: SAVE_FORMAT, career: null, designs: newStore() }
}
function career(decided: boolean): SaveFile {
  let run = buildPrototype(newCareer(3), BASELINE_SPEC)
  if (decided) run = enterTender(run, 1)
  const designs = newStore()
  addDesign(designs)
  return { format: SAVE_FORMAT, career: run, designs }
}
function storage(): KeyValue & { kept: Map<string, string> } {
  const kept = new Map<string, string>()
  return { kept, getItem: (key) => kept.get(key) ?? null, setItem: (key, value) => { kept.set(key, value) } }
}
const broken: SlotBackend = {
  lasting: true,
  get: () => Promise.reject(new Error('no')),
  set: () => Promise.reject(new Error('no')),
  delete: () => Promise.reject(new Error('no')),
}

describe('save slots', () => {
  it('keep to the hulldown database and three slots', () => {
    expect(DB_NAME).toBe('hulldown')
    expect(SAVES.slots).toBe(3)
  })

  it('start empty', async () => {
    expect(await listSlots(memoryBackend())).toEqual([null, null, null])
  })

  it('keep a save and give it back whole', async () => {
    const backend = memoryBackend()
    const save = career(true)
    expect(await writeSlot(backend, 2, save, NOW)).toBe(true)
    const back = await readSlot(backend, 2)
    expect(back!.save).toEqual(save)
    expect(back!.info).toEqual({ slot: 2, savedAt: NOW.toISOString(), year: 1981, won: save.career!.outcome!.won, designs: 2 })
  })

  it('list what each slot holds', async () => {
    const backend = memoryBackend()
    await writeSlot(backend, 1, chest(), NOW)
    await writeSlot(backend, 3, career(false), NOW)
    const list = await listSlots(backend)
    expect(list[0]).toMatchObject({ slot: 1, year: null, won: null, designs: 1 })
    expect(list[1]).toBeNull()
    expect(list[2]).toMatchObject({ slot: 3, year: 1981, won: null, designs: 2 })
  })

  it('overwrite and clear one slot without touching the others', async () => {
    const backend = memoryBackend()
    await writeSlot(backend, 1, chest(), NOW)
    await writeSlot(backend, 2, chest(), NOW)
    await writeSlot(backend, 1, career(false), NOW)
    expect((await readSlot(backend, 1))!.save.career).not.toBeNull()
    expect(await clearSlot(backend, 1)).toBe(true)
    expect(await listSlots(backend)).toMatchObject([null, { slot: 2 }, null])
  })

  it('have no slot nought, four or one and a half', async () => {
    const backend = memoryBackend()
    for (const slot of [0, 4, 1.5, -1]) {
      expect(await writeSlot(backend, slot, chest(), NOW)).toBe(false)
      expect(await readSlot(backend, slot)).toBeNull()
      expect(await clearSlot(backend, slot)).toBe(false)
    }
  })

  it('clean what they read, and treat rubbish as an empty slot', async () => {
    const backend = memoryBackend()
    await backend.set(1, 'rubbish')
    await backend.set(2, { savedAt: 'yesterday', save: { format: 1, career: { seed: 4, budgetKr: -5 }, designs: null } })
    await backend.set(3, { savedAt: NOW.toISOString(), save: { format: 99 } })
    expect(await readSlot(backend, 1)).toBeNull()
    const two = await readSlot(backend, 2)
    expect(two!.save.career!.budgetKr).toBe(0)
    expect(two!.save.designs).toEqual(newStore())
    expect(two!.info.savedAt).toBe(new Date(0).toISOString())
    expect(await readSlot(backend, 3)).toBeNull()
  })

  it('say so when the browser will not keep or give back a save', async () => {
    expect(await writeSlot(broken, 1, chest(), NOW)).toBe(false)
    expect(await readSlot(broken, 1)).toBeNull()
    expect(await clearSlot(broken, 1)).toBe(false)
    expect(await listSlots(broken)).toEqual([null, null, null])
  })
})

describe('the backup file', () => {
  it('is named for the day by the player\'s calendar', () => {
    expect(backupFileName(NOW)).toBe('hull-down-backup-2026-11-11.txt')
    expect(backupFileName(new Date(2027, 0, 5))).toBe('hull-down-backup-2027-01-05.txt')
  })

  it('holds the code on a line of its own, and gives it back', async () => {
    const code = await encodeSave(career(false))
    const text = backupFileText(code, NOW, 'Hull Down backup,', 'Paste the last line into the game to restore it.')
    expect(text.split('\n')[0]).toBe('Hull Down backup, 2026-11-11')
    expect(codeIn(text)).toBe(code)
    expect((await decodeSave(codeIn(text))).ok).toBe(true)
  })

  it('finds a code broken over lines, with Windows line ends, or pasted bare', async () => {
    const code = await encodeSave(chest())
    expect(codeIn(`Notes\r\n\r\n${code.slice(0, 50)}\r\n${code.slice(50)}\r\n\r\nmore notes`)).toBe(code)
    expect(codeIn(`  ${code}  `)).toBe(code)
    expect(codeIn('no code here')).toBe('no code here')
  })
})

describe('the backup reminder', () => {
  const day = (n: number): Date => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000)

  it('uses only hulldown keys', () => {
    expect(BACKUP_KEY.startsWith('hulldown.')).toBe(true)
    expect(FIRST_PLAYED_KEY.startsWith('hulldown.')).toBe(true)
  })

  it('says nothing before the game has been played here', () => {
    const store = storage()
    expect(daysSinceBackup(store, NOW)).toBeNull()
    expect(backupDue(store, NOW)).toBe(false)
  })

  it('counts a fortnight from the first day played, noted once', () => {
    const store = storage()
    noteFirstPlayed(store, NOW)
    noteFirstPlayed(store, day(5))
    expect(store.kept.get(FIRST_PLAYED_KEY)).toBe(NOW.toISOString())
    expect(backupDue(store, day(SAVES.remindDays - 1))).toBe(false)
    expect(backupDue(store, day(SAVES.remindDays))).toBe(true)
  })

  it('starts the fortnight again when a backup is taken', () => {
    const store = storage()
    noteFirstPlayed(store, NOW)
    expect(noteBackup(store, day(20))).toBe(true)
    expect(daysSinceBackup(store, day(21))).toBe(1)
    expect(backupDue(store, day(33))).toBe(false)
    expect(backupDue(store, day(34))).toBe(true)
  })

  it('stays quiet when storage is blocked or holds rubbish', () => {
    const blocked: KeyValue = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(backupDue(blocked, NOW)).toBe(false)
    expect(noteBackup(blocked, NOW)).toBe(false)
    const store = storage()
    store.setItem(BACKUP_KEY, 'last Tuesday')
    expect(backupDue(store, NOW)).toBe(false)
  })
})
