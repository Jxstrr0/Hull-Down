import '@fontsource/archivo-narrow/latin-600.css'
import '@fontsource/archivo-narrow/latin-700.css'
import '@fontsource/archivo/latin-400.css'
import '@fontsource/archivo/latin-600.css'
import '@fontsource/spline-sans-mono/latin-400.css'
import '@fontsource/spline-sans-mono/latin-500.css'
import '@fontsource/space-grotesk/latin-500.css'
import './style.css'
import { BASELINE_SPEC } from './data/baseline'
import { STRINGS, fill } from './data/strings'
import { PACT_LIMITS_GEN1 } from './data/tuning'
import { renderDataSheet } from './office/dataSheet'
import { renderSheet } from './office/sheet'
import { buildStatSheet } from './sim/vehicle'
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
  header.append(title, toggle)

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

  // PR 1: show the reference tank's data sheet. PR 2 replaces this with the design office.
  const stats = buildStatSheet(BASELINE_SPEC, PACT_LIMITS_GEN1)
  app.append(header, renderSheet(stats.name, renderDataSheet(stats, PACT_LIMITS_GEN1)), footer)
}

mount()
void finishLoading(startedAt)
