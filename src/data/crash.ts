// The crash screen: which browser complaints are not a crash, and how much of
// the technical detail goes in the report.
export const CRASH = {
  /** Complaints the game carries on from: a layout hiccup, a cancelled request, sound or copying refused before a tap. */
  harmless: ['ResizeObserver', 'AbortError', 'NotAllowedError'],
  /** Lines of the error's trace kept in the report. */
  traceLines: 6,
  /** Add this to the end of the game's address to see the crash screen without a real fault. */
  testHash: '#crash-test',
} as const
