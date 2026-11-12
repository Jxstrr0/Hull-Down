// The share card: a picture of a report, 1080 by 1350, for the phone's share
// sheet. Always the paper look: a picture has no theme. Sizes are in the
// card's own pixels.
export const CARD = {
  width: 1080,
  height: 1350,
  pad: 64,
  colour: { paper: '#e9ece6', grid: '#c9d0c8', ink: '#1f3558', inkDim: '#5b6b85', pencil: '#b23a2e', stamp: '#3d6b4f' },
  font: {
    head: '"Archivo Narrow", "Arial Narrow", sans-serif',
    ui: 'Archivo, system-ui, sans-serif',
    mono: '"Spline Sans Mono", ui-monospace, monospace',
    studio: '"Space Grotesk", system-ui, sans-serif',
  },
  /** The game's name, top left, with its letters spaced out. */
  title: { y: 102, px: 36, spacing: 7 },
  /** What kind of card it is, top right. */
  kind: { y: 102, px: 26 },
  rule: { y: 126 },
  /** The design's name. It shrinks to fit. */
  name: { y: 218, px: 78, minPx: 40 },
  subject: { y: 266, px: 28 },
  /** The pass stamp, and the count of rounds beside it. */
  stamp: { y: 300, height: 64, px: 30, padX: 22, tiltDeg: -2 },
  tally: { y: 342, px: 25 },
  /** The cutaway, on squared paper. */
  picture: { y: 400, height: 380, gridPx: 40, inset: 34 },
  caption: { y: 826, px: 27, lineHeight: 36, lines: 2 },
  /** The findings. The text shrinks, down to `minPx`, until it fits above the credit. */
  decided: { y: 930, px: 30, textY: 976, textPx: 28, minPx: 20, lineHeight: 1.25, gap: 12, indent: 40, bottom: 1250 },
  credit: { y: 1296, px: 23 },
  /** Line widths on the cutaway. */
  line: { solid: 3, thin: 1.6, fine: 1, ground: 4, item: 1.6, path: 5, mark: 6 },
  /** The marks on the round's path. */
  mark: { head: 20, bar: 20, ring: 9, cross: 11 },
  /** Hatching inside the tank: the size of one tile and the width of its line. */
  hatch: { size: 10, line: 2 },
} as const
