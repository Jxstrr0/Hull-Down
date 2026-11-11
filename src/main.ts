import '@fontsource/archivo-narrow/latin-600.css'
import '@fontsource/archivo-narrow/latin-700.css'
import '@fontsource/archivo/latin-400.css'
import '@fontsource/archivo/latin-600.css'
import '@fontsource/spline-sans-mono/latin-400.css'
import '@fontsource/spline-sans-mono/latin-500.css'
import '@fontsource/space-grotesk/latin-500.css'
import './style.css'
import { STRINGS, fill } from './data/strings'
import { TENDER_IDS, TENDERS } from './data/tenders'
import { sound, switchSound } from './audio/gameSound'
import { renderDesignScreen } from './office/designScreen'
import { finishLoading } from './ui/loading'
import { applyTheme, loadTheme, otherTheme, type Theme } from './ui/theme'

const startedAt = performance.now()

function themeName(theme: Theme): string {
  return theme === 'paper' ? STRINGS.theme.toPaper : STRINGS.theme.toBlueprint
}

function mount(): void {
  const app = document.getElementById('app')
  if (!app) return

  const header = document.createElement('header')
  header.className = 'bar'
  const title = document.createElement('h1')
  title.className = 'bar-title'
  title.textContent = STRINGS.title
  const toggle = document.createElement('button')
  toggle.className = 'bar-theme'
  toggle.type = 'button'

  let theme = loadTheme()
  const showTheme = (): void => {
    applyTheme(theme)
    const next = themeName(otherTheme(theme))
    toggle.textContent = next
    toggle.setAttribute('aria-label', fill(STRINGS.theme.switchTo, { name: next }))
  }
  toggle.addEventListener('click', () => {
    theme = otherTheme(theme)
    showTheme()
  })
  showTheme()

  const mute = document.createElement('button')
  mute.className = 'bar-theme'
  mute.type = 'button'
  mute.dataset.key = 'sound'
  const showSound = (): void => {
    mute.textContent = sound.on() ? STRINGS.sound.on : STRINGS.sound.off
    mute.setAttribute('aria-pressed', String(sound.on()))
    mute.setAttribute('aria-label', sound.on() ? STRINGS.sound.turnOff : STRINGS.sound.turnOn)
  }
  mute.addEventListener('click', () => {
    switchSound(!sound.on())
    showSound()
  })
  showSound()
  const buttons = document.createElement('div')
  buttons.className = 'bar-buttons'
  buttons.append(mute, toggle)
  header.append(title, buttons)

  const footer = document.createElement('footer')
  footer.className = 'foot'
  const studio = document.createElement('a')
  studio.className = 'foot-studio'
  studio.href = STRINGS.studioLink
  studio.rel = 'noopener'
  studio.textContent = STRINGS.credit
  const build = document.createElement('span')
  build.className = 'foot-build'
  build.textContent = `v${__GAME_VERSION__} · ${__BUILD_SHA__} · ${__BUILD_DATE__}`
  footer.append(studio, build)

  app.append(header, renderDesignScreen(TENDERS[TENDER_IDS[0]]), footer)
}

mount()
void finishLoading(startedAt)
