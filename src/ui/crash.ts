// The crash screen. If the game breaks, the player is not left with a dead
// page: the screen says so plainly, hands over the save code read from what
// the browser last kept, and offers to start the game again. The broken
// screen is taken away, so nothing more is saved over a good save.
import { STRINGS } from '../data/strings'
import { backupFileName, backupFileText, downloadText, storedSave } from '../persist/backup'
import type { KeyValue } from '../persist/designs'
import { encodeSave } from '../persist/saveCode'
import { crashReport, isCrash } from './crashWords'
import { el } from './dom'

const S = STRINGS.crash

/** The browser's own storage, read only when asked: reaching for it can itself fail when storage is blocked. */
const kept: KeyValue = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
}

let shown = false

function button(key: string, label: string): HTMLButtonElement {
  const node = el('button', 'btn', label)
  node.type = 'button'
  node.dataset.key = key
  return node
}

function copyButton(key: string, text: () => string, said: HTMLElement): HTMLButtonElement {
  const node = button(key, S.copy)
  node.addEventListener('click', () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(text())
        said.textContent = S.copied
      } catch {
        said.textContent = S.copyByHand
      }
    })()
  })
  return node
}

function box(label: string, key: string, rows: number): HTMLTextAreaElement {
  const out = el('textarea', 'sv-code')
  out.readOnly = true
  out.rows = rows
  out.dataset.key = key
  out.setAttribute('aria-label', label)
  out.addEventListener('focus', () => out.select())
  return out
}

/** Puts the crash screen in place of the game. Only the first crash is shown. */
export function showCrash(reason: unknown, storage: KeyValue = kept): void {
  if (shown) return
  shown = true
  const app = document.getElementById('app')
  if (!app) return

  const screen = el('main', 'crash')
  screen.setAttribute('role', 'alert')
  const said = el('p', 'sv-said')
  said.setAttribute('aria-live', 'polite')

  const code = box(S.codeLabel, 'crash:code', 4)
  code.value = S.codeMaking
  const copyCode = copyButton('crash:copy', () => code.value, said)
  const file = button('crash:file', S.file)
  copyCode.disabled = true
  file.disabled = true
  file.addEventListener('click', () => {
    const now = new Date()
    try {
      downloadText(backupFileName(now), backupFileText(code.value, now, STRINGS.saves.backup.fileHeading, STRINGS.saves.backup.fileHint))
      said.textContent = S.fileDone
    } catch {
      said.textContent = S.fileFailed
    }
  })
  void encodeSave(storedSave(storage)).then(
    (text) => {
      code.value = text
      copyCode.disabled = false
      file.disabled = false
    },
    () => {
      code.value = S.codeFailed
    },
  )

  const again = button('crash:again', S.again)
  again.classList.add('btn-go')
  again.addEventListener('click', () => window.location.reload())

  const report = box(S.reportLabel, 'crash:report', 6)
  report.value = crashReport({
    reason,
    version: __GAME_VERSION__,
    commit: __BUILD_SHA__,
    built: __BUILD_DATE__,
    browser: navigator.userAgent,
  })
  const details = el('details', 'crash-more')
  details.append(el('summary', 'crash-sum', S.reportHeading), el('p', 'ctl-note', S.reportAbout), report, copyButton('crash:copy-report', () => report.value, said))

  const codeActions = el('div', 'sv-actions')
  codeActions.append(copyCode, file)
  screen.append(
    el('h2', 'crash-title', S.title),
    el('p', 'crash-lead', S.lead),
    el('h3', 'ds-group-title', S.codeHeading),
    el('p', 'ctl-note', S.codeAbout),
    code,
    codeActions,
    said,
    again,
    el('p', 'ctl-note', S.againAbout),
    details,
  )
  app.replaceChildren(screen)
  window.scrollTo(0, 0)
}

/** Call once, before the game is drawn: any error nobody caught brings up the crash screen. */
export function watchForCrashes(storage: KeyValue = kept): void {
  window.addEventListener('error', (event) => {
    const reason: unknown = event.error ?? event.message
    if (isCrash(reason)) showCrash(reason, storage)
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason
    if (isCrash(reason)) showCrash(reason, storage)
  })
}
