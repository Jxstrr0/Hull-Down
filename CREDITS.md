# Credits

Hull Down is © 2026 Kelbo / Longlight Interactive.

Every third-party file and package is listed here, including public-domain
ones. `tests/repo.test.ts` fails the build if a file in `public/` or
`art/third-party/`, or a runtime package, has no line in this file.

Allowed licences without asking Kelbo: CC0 and CC BY (plan section 13.0).
Fonts are under the SIL Open Font License 1.1, the standard free font licence;
the plan names these fonts.

## Studio files (Longlight Interactive, not third-party)

| File | Note |
| --- | --- |
| `public/brand/longlight-logo-dark.svg` | Official Longlight logo for dark backgrounds, copied unchanged from Jxstrr0/Kelbo.Website `assets/press/`. |
| `public/brand/longlight-logo-light.svg` | Official Longlight logo for light backgrounds, copied unchanged from the same place. |
| `public/icons/icon.svg` | Hull Down icon, drawn for this game. |
| `public/icons/icon-192.png` | The same icon as a picture, for the home screen. |
| `public/icons/icon-512.png` | The same icon, larger. |
| `public/icons/icon-maskable-512.png` | The same icon on square paper, for phones that cut icons to their own shape. |
| `public/icons/apple-touch-icon.png` | The same icon on square paper, for the iPhone home screen. |
| `public/manifest.webmanifest` | Tells a phone how to add Hull Down to the home screen. Written for this game. |

## Fonts (npm packages, self-hosted in the build)

| Package | Font | Authors | Source | Licence | Changes |
| --- | --- | --- | --- | --- | --- |
| `@fontsource/archivo-narrow` | Archivo Narrow | The Archivo Narrow Project Authors | https://github.com/Omnibus-Type/ArchivoNarrow | SIL OFL 1.1 | None |
| `@fontsource/archivo` | Archivo | The Archivo Project Authors | https://github.com/Omnibus-Type/Archivo | SIL OFL 1.1 | None |
| `@fontsource/spline-sans-mono` | Spline Sans Mono | The Spline Sans Mono Project Authors | https://github.com/SorkinType/SplineSansMono | SIL OFL 1.1 | None |
| `@fontsource/space-grotesk` | Space Grotesk (studio pieces only) | The Space Grotesk Project Authors | https://github.com/floriankarsten/space-grotesk | SIL OFL 1.1 | None |

## Sounds (third-party recordings)

All three come from OpenGameArt and are CC0 1.0 (public domain):
https://creativecommons.org/publicdomain/zero/1.0/. The originals are kept
unchanged in `art/third-party/sounds/`; the files the game plays are made
from them with ffmpeg.

| File | Title | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- | --- |
| `art/third-party/sounds/cannon_fire_0.ogg` | Cannon fire | Thimras | https://opengameart.org/content/cannon-fire | CC0 1.0 | None (the original) |
| `public/audio/gun.mp3` | Cannon fire | Thimras | https://opengameart.org/content/cannon-fire | CC0 1.0 | Cut to 1.7 s, faded out, mixed to mono, saved as MP3 |
| `art/third-party/sounds/bong1.wav` | Metal Impact Sounds (bong1) | BMacZero | https://opengameart.org/content/metal-impact-sounds | CC0 1.0 | None (the original) |
| `public/audio/hit.mp3` | Metal Impact Sounds (bong1) | BMacZero | https://opengameart.org/content/metal-impact-sounds | CC0 1.0 | Cut to 1.9 s, faded out, saved as MP3 |
| `art/third-party/sounds/thud2.wav` | Metal Impact Sounds (thud2) | BMacZero | https://opengameart.org/content/metal-impact-sounds | CC0 1.0 | None (the original) |
| `public/audio/short.mp3` | Metal Impact Sounds (thud2) | BMacZero | https://opengameart.org/content/metal-impact-sounds | CC0 1.0 | Cut to 0.45 s, made 6 dB louder, faded out, saved as MP3 |

## Textures

From ambientCG (https://ambientcg.com), whose assets are all CC0 1.0. The
originals are kept unchanged in `art/third-party/textures/`; `art/paper-texture.py`
makes the tiles the game uses.

| File | Title | Author | Source | Licence | Changes |
| --- | --- | --- | --- | --- | --- |
| `art/third-party/textures/Paper001_1K-JPG_Color.jpg` | Paper 001 | ambientCG | https://ambientcg.com/view?id=Paper001 | CC0 1.0 | None (the original colour map) |
| `src/assets/paper-grain.jpg` | Paper 001 | ambientCG | https://ambientcg.com/view?id=Paper001 | CC0 1.0 | Grey, cropped square, 512 px, fine detail only (high-pass), made to tile, saved as JPEG |
| `art/third-party/textures/Paper003_1K-JPG_Color.jpg` | Paper 003 | ambientCG | https://ambientcg.com/view?id=Paper003 | CC0 1.0 | None (the original colour map) |
| `src/assets/blueprint-mottle.jpg` | Paper 003 | ambientCG | https://ambientcg.com/view?id=Paper003 | CC0 1.0 | Grey, 512 px, creases and mottle only (high-pass), made to tile, saved as JPEG |

## Libraries (npm packages, shipped in the build)

| Package | What it does | Authors | Source | Licence | Changes |
| --- | --- | --- | --- | --- | --- |
| `three` 0.187.0 | Draws the 3D range. Loaded only when a run is first watched. | three.js authors | https://github.com/mrdoob/three.js | MIT | None |

## Code adapted from other Longlight games

| File | From |
| --- | --- |
| `src/sim/det.ts` | Season Ticket `src/sim/spatial/det.ts` |
| Build setup, deploy workflow, splash pattern | Lombard |

## Third-party art and sound

None yet.
