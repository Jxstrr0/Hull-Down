import '@fontsource/archivo-narrow/latin-600.css'
import '@fontsource/archivo-narrow/latin-700.css'
import '@fontsource/archivo/latin-400.css'
import '@fontsource/archivo/latin-600.css'
import '@fontsource/spline-sans-mono/latin-400.css'
import '@fontsource/spline-sans-mono/latin-500.css'
import '@fontsource/space-grotesk/latin-500.css'
import './style.css'
import { CRASH } from './data/crash'
import { STRINGS } from './data/strings'
import { TENDER_IDS, TENDERS } from './data/tenders'
import { showCrash, watchForCrashes } from './ui/crash'
import { renderDesignScreen } from './office/designScreen'
import { finishLoading } from './ui/loading'
import { startOffline } from './ui/offline'
import { createMenu } from './ui/menu'

const startedAt = performance.now()

function mount(): void {
  const app = document.getElementById('app')
  if (!app) return

  const header = document.createElement('header')
  header.className = 'bar'
  const title = document.createElement('h1')
  title.className = 'bar-title'
  title.textContent = STRINGS.title
  const office = renderDesignScreen(TENDERS[TENDER_IDS[0]])
  const buttons = document.createElement('div')
  buttons.className = 'bar-buttons'
  buttons.append(createMenu(office))
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

  app.append(header, office.root, footer)
}

watchForCrashes()
startOffline()
try {
  mount()
  if (window.location.hash === CRASH.testHash) showCrash(new Error(STRINGS.crash.testFault))
} catch (error) {
  showCrash(error)
}
void finishLoading(startedAt)
