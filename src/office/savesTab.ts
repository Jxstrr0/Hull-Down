// Saves: three slots on this device, a save code to copy anywhere, and a
// backup file to keep outside the browser. A phone's browser can clear a
// site's storage without asking, so the game reminds the player to take one.
import { SAVES } from '../data/saves'
import { STRINGS, fill } from '../data/strings'
import {
  askToPersist, backupDue, backupFileName, backupFileText, codeIn, daysSinceBackup, downloadText, noteBackup, noteFirstPlayed,
} from '../persist/backup'
import type { KeyValue } from '../persist/designs'
import { decodeSave, encodeSave, type SaveFile } from '../persist/saveCode'
import { listSlots, openBackend, readSlot, writeSlot, type SlotBackend, type SlotInfo } from '../persist/slots'
import { el } from '../ui/dom'
import { slotLine } from '../ui/saveWords'

const S = STRINGS.saves

export interface SavesOptions {
  storage: KeyValue
  /** Everything worth keeping, as it stands now. */
  snapshot: () => SaveFile
  /** Put a save in place of what is here. False when the browser would not keep it. */
  restore: (save: SaveFile) => boolean
  redraw: () => void
}

export interface Saves {
  draw: () => HTMLElement
  /** True when it is time to remind the player to take a backup. */
  due: () => boolean
}

export function createSaves(options: SavesOptions): Saves {
  const { storage } = options
  noteFirstPlayed(storage, new Date())

  let backend: Promise<SlotBackend> | null = null
  let slots: (SlotInfo | null)[] | null = null
  /** The action whose button has been tapped once: it wants a second tap. */
  let armed: string | null = null
  /** What the last action came to, and whether it went wrong. */
  let said: { text: string; bad: boolean } | null = null
  let code: string | null = null
  let pasted = ''
  /** Null until the browser has been asked to keep the game's storage. */
  let persisted: boolean | null = null

  const open = (): Promise<SlotBackend> => (backend ??= openBackend())

  function say(text: string, bad = false): void {
    said = { text, bad }
    armed = null
    options.redraw()
  }

  async function refresh(): Promise<void> {
    slots = await listSlots(await open())
    options.redraw()
  }

  /** The first time something is saved, ask the browser not to throw it away. */
  async function ask(): Promise<void> {
    if (persisted === null) persisted = await askToPersist()
  }

  function button(key: string, label: string, className = 'btn'): HTMLButtonElement {
    const node = el('button', className, label)
    node.type = 'button'
    node.dataset.key = key
    return node
  }

  /** A button that does nothing until it is tapped twice. */
  function twoTap(key: string, label: string, confirm: string, act: () => void): HTMLButtonElement {
    const on = armed === key
    const node = button(key, on ? confirm : label, on ? 'btn btn-armed' : 'btn')
    node.addEventListener('click', () => {
      if (!on) {
        armed = key
        options.redraw()
        return
      }
      armed = null
      act()
    })
    return node
  }

  function load(save: SaveFile): void {
    if (!options.restore(save)) say(S.notRestored, true)
  }

  async function loadCode(text: string): Promise<void> {
    const read = await decodeSave(codeIn(text))
    if (read.ok) load(read.save)
    else say(S.errors[read.error], true)
  }

  function drawReminder(): HTMLElement | null {
    if (!backupDue(storage, new Date())) return null
    const days = daysSinceBackup(storage, new Date()) ?? SAVES.remindDays
    return el('p', 'ctl-issue', fill(S.reminder, { n: String(days) }))
  }

  function drawSlots(): HTMLElement {
    const box = el('section', 'bu')
    box.append(el('h3', 'ds-group-title', S.slots.heading), el('p', 'ctl-note', S.slots.about))
    if (slots === null) {
      box.append(el('p', 'bu-busy', S.slots.reading))
      void refresh()
      return box
    }
    const list = el('ul', 'bu-protos')
    slots.forEach((info, index) => {
      const slot = index + 1
      const item = el('li', 'bu-proto')
      item.append(el('p', 'bu-proto-name', fill(S.slots.name, { n: String(slot) })))
      item.append(el('p', 'bu-proto-sum', info ? slotLine(info) : S.slots.empty))
      const row = el('div', 'sv-actions')
      const save = async (): Promise<void> => {
        await ask()
        const ok = await writeSlot(await open(), slot, options.snapshot(), new Date())
        said = ok ? { text: fill(S.slots.saved, { n: String(slot) }), bad: false } : { text: S.notKept, bad: true }
        await refresh()
      }
      row.append(info
        ? twoTap(`save:${slot}`, S.slots.save, S.slots.overwrite, () => void save())
        : (() => {
            const node = button(`save:${slot}`, S.slots.save)
            node.addEventListener('click', () => void save())
            return node
          })())
      if (info) {
        row.append(twoTap(`load:${slot}`, S.slots.load, S.confirmLoad, () => {
          void (async () => {
            const kept = await readSlot(await open(), slot)
            if (kept) load(kept.save)
            else say(S.slots.unreadable, true)
          })()
        }))
      }
      item.append(row)
      list.append(item)
    })
    box.append(list)
    return box
  }

  function drawCode(): HTMLElement {
    const X = S.code
    const box = el('section', 'bu')
    box.append(el('h3', 'ds-group-title', X.heading), el('p', 'ctl-note', X.about))
    const show = button('code:show', X.show)
    show.addEventListener('click', () => {
      void (async () => {
        code = await encodeSave(options.snapshot())
        said = null
        options.redraw()
      })()
    })
    box.append(show)
    if (code !== null) {
      const text = code
      const out = el('textarea', 'sv-code')
      out.readOnly = true
      out.rows = 5
      out.value = text
      out.setAttribute('aria-label', X.heading)
      out.dataset.key = 'code:out'
      out.addEventListener('focus', () => out.select())
      const copy = button('code:copy', X.copy)
      copy.addEventListener('click', () => {
        void (async () => {
          try {
            await navigator.clipboard.writeText(text)
            say(X.copied)
          } catch {
            out.focus()
            out.select()
            say(X.copyByHand, true)
          }
        })()
      })
      box.append(out, copy)
    }

    const label = el('label', 'bu-sub', X.pasteLabel)
    label.htmlFor = 'save-paste'
    const input = el('textarea', 'sv-code')
    input.id = 'save-paste'
    input.rows = 4
    input.placeholder = X.pastePlaceholder
    input.autocomplete = 'off'
    input.spellcheck = false
    input.value = pasted
    input.dataset.key = 'code:in'
    input.addEventListener('input', () => {
      pasted = input.value
    })
    box.append(label, input, twoTap('code:load', X.load, S.confirmLoad, () => {
      if (pasted.trim() === '') say(X.nothing, true)
      else void loadCode(pasted)
    }))
    return box
  }

  function drawBackup(): HTMLElement {
    const B = S.backup
    const box = el('section', 'bu')
    box.append(el('h3', 'ds-group-title', B.heading), el('p', 'ctl-note', B.about))
    const days = daysSinceBackup(storage, new Date())
    if (days !== null) box.append(el('p', 'ctl-note', fill(days === 1 ? B.oneDay : B.days, { n: String(days) })))
    const take = button('backup:take', B.take, 'btn btn-go')
    take.addEventListener('click', () => {
      void (async () => {
        await ask()
        const now = new Date()
        try {
          downloadText(backupFileName(now), backupFileText(await encodeSave(options.snapshot()), now, B.fileHeading, B.fileHint))
          noteBackup(storage, now)
          say(fill(B.taken, { name: backupFileName(now) }))
        } catch {
          say(B.failed, true)
        }
      })()
    })
    box.append(take)

    const label = el('label', 'bu-sub', B.loadLabel)
    label.htmlFor = 'save-file'
    const file = el('input', 'sv-file')
    file.id = 'save-file'
    file.type = 'file'
    file.accept = '.txt,text/plain'
    file.dataset.key = 'backup:file'
    file.addEventListener('change', () => {
      const picked = file.files?.[0]
      if (!picked) return
      void (async () => {
        try {
          await loadCode(await picked.text())
        } catch {
          say(S.errors.notACode, true)
        }
      })()
    })
    box.append(label, el('p', 'ctl-note', B.loadAbout), file)
    if (persisted !== null) box.append(el('p', 'ctl-note', persisted ? B.persisted : B.notPersisted))
    return box
  }

  function draw(): HTMLElement {
    const box = el('div', 'bureau')
    const reminder = drawReminder()
    if (reminder) box.append(reminder)
    if (said) {
      const line = el('p', said.bad ? 'ctl-issue' : 'sv-said', said.text)
      line.setAttribute('role', 'status')
      box.append(line)
    }
    box.append(drawSlots(), drawBackup(), drawCode())
    return box
  }

  return { draw, due: () => backupDue(storage, new Date()) }
}
