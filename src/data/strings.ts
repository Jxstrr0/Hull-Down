// Every piece of text the player reads lives here, so it can be checked and
// later translated. PR 14 adds the test that fails on hard-coded text elsewhere.
export const STRINGS = {
  title: 'Hull Down',
  bureau: 'State Tank Design Bureau',
  country: 'Tarnovia',
  sheet: {
    label: 'Blueprint sheet',
    empty: 'No design on file',
    stamp: 'Awaiting requirement',
    note: 'The design office is being fitted out.',
    project: 'Project',
    projectNone: 'none',
    sheetNo: 'Sheet',
    sheetValue: '1 of 1',
    scale: 'Scale',
    scaleValue: '1:35',
    status: 'Status',
    statusValue: 'Planning',
  },
  theme: {
    toPaper: 'Paper',
    toBlueprint: 'Blueprint',
    switchTo: 'Switch to the {name} look',
  },
  credit: '© 2026 Kelbo / Longlight Interactive',
  studioLink: 'https://longlight.games/',
  studioName: 'Longlight Interactive',
} as const

/** Fill `{slot}` markers in a string. */
export function fill(text: string, slots: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => slots[key] ?? whole)
}
