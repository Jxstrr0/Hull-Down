// Drives the studio splash that index.html paints before the bundle arrives.
const MIN_SHOW_MS = 900
const FONT_WAIT_MS = 2500

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Hide the splash once fonts are in (or have had long enough) and it has been seen. */
export async function finishLoading(startedAt: number): Promise<void> {
  const root = document.getElementById('loading')
  if (!root) return
  await Promise.race([document.fonts.ready, wait(FONT_WAIT_MS)])
  const shown = performance.now() - startedAt
  if (shown < MIN_SHOW_MS) await wait(MIN_SHOW_MS - shown)
  root.setAttribute('aria-busy', 'false')
  root.classList.add('ld-out')
  await wait(450)
  root.remove()
}
