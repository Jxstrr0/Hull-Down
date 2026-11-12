// What the in-game credits list. `CREDITS.md` at the top of the project is
// the full record; `tests/credits.test.ts` fails if anything shipped with the
// game is in one and not the other.

export interface Credit {
  /** The file or package, exactly as `CREDITS.md` names it. */
  id: string
  title: string
  by: string
  licence: string
  source: string
}

export const CREDIT_GROUPS = ['fonts', 'sounds', 'libraries'] as const
export type CreditGroup = (typeof CREDIT_GROUPS)[number]

export const CREDITS: Record<CreditGroup, readonly Credit[]> = {
  fonts: [
    { id: '@fontsource/archivo-narrow', title: 'Archivo Narrow', by: 'The Archivo Narrow Project Authors', licence: 'SIL OFL 1.1', source: 'https://github.com/Omnibus-Type/ArchivoNarrow' },
    { id: '@fontsource/archivo', title: 'Archivo', by: 'The Archivo Project Authors', licence: 'SIL OFL 1.1', source: 'https://github.com/Omnibus-Type/Archivo' },
    { id: '@fontsource/spline-sans-mono', title: 'Spline Sans Mono', by: 'The Spline Sans Mono Project Authors', licence: 'SIL OFL 1.1', source: 'https://github.com/SorkinType/SplineSansMono' },
    { id: '@fontsource/space-grotesk', title: 'Space Grotesk', by: 'The Space Grotesk Project Authors', licence: 'SIL OFL 1.1', source: 'https://github.com/floriankarsten/space-grotesk' },
  ],
  sounds: [
    { id: 'public/audio/gun.mp3', title: 'Cannon fire', by: 'Thimras', licence: 'CC0 1.0', source: 'https://opengameart.org/content/cannon-fire' },
    { id: 'public/audio/hit.mp3', title: 'Metal Impact Sounds (bong1)', by: 'BMacZero', licence: 'CC0 1.0', source: 'https://opengameart.org/content/metal-impact-sounds' },
    { id: 'public/audio/engine.mp3', title: 'Engine-loop heavy vehicle/tank', by: 'Nayckron, from a car engine loop by qubodup', licence: 'CC BY 3.0', source: 'https://opengameart.org/content/engine-loop-heavy-vehicletank' },
    { id: 'public/audio/short.mp3', title: 'Metal Impact Sounds (thud2)', by: 'BMacZero', licence: 'CC0 1.0', source: 'https://opengameart.org/content/metal-impact-sounds' },
  ],
  libraries: [
    { id: 'three', title: 'three.js', by: 'three.js authors', licence: 'MIT', source: 'https://github.com/mrdoob/three.js' },
  ],
}
