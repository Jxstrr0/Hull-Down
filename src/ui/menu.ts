// The page menu: the ☰ button in the top bar opens a sheet that holds the
// settings (sound, look, graphics), quick ways to the bureau and saves,
// "start a new career", and the credits. Opening it holds any trial that is
// playing, so it doubles as the pause screen.

import { STRINGS, fill } from '../data/strings'
import { sound, switchSound } from '../audio/gameSound'
import type { Office } from '../office/designScreen'
import { drawCredits } from './credits'
import { el } from './dom'
import { holdAll } from './hold'
import { applyTheme, loadTheme, otherTheme, type Theme } from './theme'

const M = STRINGS.menu

function themeName(theme: Theme): string {
  return theme === 'paper' ? STRINGS.theme.toPaper : STRINGS.theme.toBlueprint
}

function row(label: string, control: HTMLElement): HTMLElement {
  const line = el('div', 'mn-row')
  line.append(el('span', 'mn-label', label), control)
  return line
}

function button(key: string, text: string, className = 'btn mn-btn'): HTMLButtonElement {
  const out = el('button', className, text)
  out.type = 'button'
  out.dataset.key = key
  return out
}

/** The ☰ button for the top bar. The sheet it opens is added to the page beside it. */
export function createMenu(office: Office): HTMLElement {
  const opener = button('menu', M.button, 'bar-theme bar-menu')
  opener.setAttribute('aria-label', M.open)
  opener.setAttribute('aria-haspopup', 'dialog')
  opener.setAttribute('aria-expanded', 'false')

  const veil = el('div', 'mn-veil')
  veil.hidden = true
  const sheet = el('div', 'mn-sheet')
  sheet.setAttribute('role', 'dialog')
  sheet.setAttribute('aria-modal', 'true')
  sheet.setAttribute('aria-labelledby', 'mn-title')
  veil.append(sheet)

  let theme = loadTheme()
  applyTheme(theme)
  let restartArmed = false

  const close = (): void => {
    if (veil.hidden) return
    veil.hidden = true
    restartArmed = false
    opener.setAttribute('aria-expanded', 'false')
    opener.focus({ preventScroll: true })
  }
  const go = (action: () => void): void => {
    close()
    action()
  }

  function draw(): void {
    const C = STRINGS.career.restart
    const head = el('div', 'mn-head')
    const title = el('h2', 'mn-title', M.title)
    title.id = 'mn-title'
    const back = button('menu:back', M.back, 'btn btn-go mn-back')
    back.addEventListener('click', close)
    head.append(title, back)

    // Settings.
    const settings = el('section', 'mn-group')
    settings.append(el('h3', 'ds-group-title', M.settings))
    const mute = button('menu:sound', sound.on() ? STRINGS.sound.on : STRINGS.sound.off)
    mute.setAttribute('aria-pressed', String(sound.on()))
    mute.setAttribute('aria-label', sound.on() ? STRINGS.sound.turnOff : STRINGS.sound.turnOn)
    mute.addEventListener('click', () => {
      switchSound(!sound.on())
      redraw('menu:sound')
    })
    const look = button('menu:look', fill(M.lookNow, { name: themeName(theme), other: themeName(otherTheme(theme)) }))
    look.setAttribute('aria-label', fill(STRINGS.theme.switchTo, { name: themeName(otherTheme(theme)) }))
    look.addEventListener('click', () => {
      theme = otherTheme(theme)
      applyTheme(theme)
      redraw('menu:look')
    })
    const graphics = button('menu:graphics', M.graphicsGo)
    graphics.addEventListener('click', () => go(() => office.openTab('trials')))
    settings.append(row(M.sound, mute), row(M.look, look), row(M.graphics, graphics), el('p', 'ctl-note', M.graphicsNote))

    // Quick ways round the office.
    const places = el('section', 'mn-group')
    places.append(el('h3', 'ds-group-title', M.goTo))
    const bureau = button('menu:bureau', M.bureau)
    bureau.addEventListener('click', () => go(() => office.openTab('bureau')))
    const saves = button('menu:saves', M.saves)
    saves.addEventListener('click', () => go(() => office.openTab('saves')))
    const links = el('div', 'mn-links')
    links.append(bureau, saves)
    places.append(links)

    // The career: tap twice to throw it away.
    const career = el('section', 'mn-group')
    career.append(el('h3', 'ds-group-title', M.career), el('p', 'ctl-note', C.about))
    const again = button('menu:restart', restartArmed ? C.confirm : C.button, restartArmed ? 'btn mn-btn btn-armed' : 'btn mn-btn')
    again.addEventListener('click', () => {
      if (!restartArmed) {
        restartArmed = true
        redraw('menu:restart')
        return
      }
      go(() => office.restartCareer())
    })
    career.append(again)

    // Who made it: folded shut until asked for.
    const credits = el('section', 'mn-group')
    credits.append(drawCredits())

    sheet.replaceChildren(head, el('p', 'ctl-note mn-held', M.held), settings, places, career, credits)
  }

  /** Draw the sheet again and put the finger's focus back where it was. */
  function redraw(key: string): void {
    draw()
    sheet.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus({ preventScroll: true })
  }

  opener.addEventListener('click', () => {
    holdAll()
    restartArmed = false
    draw()
    veil.hidden = false
    opener.setAttribute('aria-expanded', 'true')
    sheet.querySelector<HTMLElement>('[data-key="menu:back"]')?.focus({ preventScroll: true })
  })
  // A tap outside the sheet, or Escape, closes it.
  veil.addEventListener('click', (event) => {
    if (event.target === veil) close()
  })
  veil.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close()
    if (event.key !== 'Tab') return
    // Keep the keyboard inside the sheet while it is open.
    const stops = [...sheet.querySelectorAll<HTMLElement>('button, summary, a[href]')]
    const first = stops[0]
    const last = stops[stops.length - 1]
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })

  const holder = el('div', 'bar-menu-holder')
  holder.append(opener, veil)
  return holder
}
