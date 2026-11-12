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
    { id: 'public/audio/turbine.mp3', title: 'Rocket Engine', by: 'theMinesAreShakin', licence: 'CC0 1.0', source: 'https://opengameart.org/content/rocket-engine' },
    { id: 'public/audio/tracks.mp3', title: 'Chain winch sounds (Marker #9)', by: 'bart', licence: 'CC0 1.0', source: 'https://opengameart.org/content/chain-winch-sounds' },
    { id: 'public/audio/short.mp3', title: 'Metal Impact Sounds (thud2)', by: 'BMacZero', licence: 'CC0 1.0', source: 'https://opengameart.org/content/metal-impact-sounds' },
    { id: 'public/audio/voice/ro-01-range-clear.mp3', title: 'Range officer: "Range is clear. Carry on."', by: 'ElevenLabs, voice Rolando', licence: 'ElevenLabs terms', source: 'https://elevenlabs.io' },
    { id: 'public/audio/voice/ro-02-target-up.mp3', title: 'Range officer: "Target up."', by: 'ElevenLabs, voice Rolando', licence: 'ElevenLabs terms', source: 'https://elevenlabs.io' },
    { id: 'public/audio/voice/ro-03-hit.mp3', title: 'Range officer: "Hit."', by: 'ElevenLabs, voice Rolando', licence: 'ElevenLabs terms', source: 'https://elevenlabs.io' },
    { id: 'public/audio/voice/ro-04-miss-short.mp3', title: 'Range officer: "Miss. Short."', by: 'ElevenLabs, voice Rolando', licence: 'ElevenLabs terms', source: 'https://elevenlabs.io' },
    { id: 'public/audio/voice/ro-05-miss-over.mp3', title: 'Range officer: "Miss. Over."', by: 'ElevenLabs, voice Rolando', licence: 'ElevenLabs terms', source: 'https://elevenlabs.io' },
    { id: 'public/audio/voice/ro-06-miss-left.mp3', title: 'Range officer: "Miss. Left."', by: 'ElevenLabs, voice Rolando', licence: 'ElevenLabs terms', source: 'https://elevenlabs.io' },
    { id: 'public/audio/voice/ro-07-miss-right.mp3', title: 'Range officer: "Miss. Right."', by: 'ElevenLabs, voice Rolando', licence: 'ElevenLabs terms', source: 'https://elevenlabs.io' },
    { id: 'public/audio/voice/ro-08-no-shot.mp3', title: 'Range officer: "Target down. No shot fired."', by: 'ElevenLabs, voice Rolando', licence: 'ElevenLabs terms', source: 'https://elevenlabs.io' },
    { id: 'public/audio/voice/ro-09-not-seen.mp3', title: 'Range officer: "Target not seen."', by: 'ElevenLabs, voice Rolando', licence: 'ElevenLabs terms', source: 'https://elevenlabs.io' },
    { id: 'public/audio/voice/ro-10-jam.mp3', title: 'Range officer: "Stoppage. The loader has a jam."', by: 'ElevenLabs, voice Rolando', licence: 'ElevenLabs terms', source: 'https://elevenlabs.io' },
    { id: 'public/audio/voice/ro-11-cease-fire.mp3', title: 'Range officer: "Cease fire. Shoot complete."', by: 'ElevenLabs, voice Rolando', licence: 'ElevenLabs terms', source: 'https://elevenlabs.io' },
    { id: 'public/audio/voice/ro-12-breakdown.mp3', title: 'Range officer: "Breakdown on the lane. Recovery is on its way."', by: 'ElevenLabs, voice Rolando', licence: 'ElevenLabs terms', source: 'https://elevenlabs.io' },
  ],
  libraries: [
    { id: 'three', title: 'three.js', by: 'three.js authors', licence: 'MIT', source: 'https://github.com/mrdoob/three.js' },
  ],
}
