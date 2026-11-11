// The two looks of the design office. Paper is the default (decided by Kelbo,
// plan section 16 Q7); blueprint is the dark option.
export type Theme = 'paper' | 'blueprint'

export const THEME_KEY = 'hulldown.theme'

export function parseTheme(stored: string | null): Theme {
  return stored === 'blueprint' ? 'blueprint' : 'paper'
}

export function otherTheme(theme: Theme): Theme {
  return theme === 'paper' ? 'blueprint' : 'paper'
}

/** Read the saved look. Storage can be blocked (private mode), so never throw. */
export function loadTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY))
  } catch {
    return 'paper'
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'paper' ? '#e9ece6' : '#12305a')
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Not saved; the look still changes for this visit.
  }
}
