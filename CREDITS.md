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

## Fonts (npm packages, self-hosted in the build)

| Package | Font | Authors | Source | Licence | Changes |
| --- | --- | --- | --- | --- | --- |
| `@fontsource/archivo-narrow` | Archivo Narrow | The Archivo Narrow Project Authors | https://github.com/Omnibus-Type/ArchivoNarrow | SIL OFL 1.1 | None |
| `@fontsource/archivo` | Archivo | The Archivo Project Authors | https://github.com/Omnibus-Type/Archivo | SIL OFL 1.1 | None |
| `@fontsource/spline-sans-mono` | Spline Sans Mono | The Spline Sans Mono Project Authors | https://github.com/SorkinType/SplineSansMono | SIL OFL 1.1 | None |
| `@fontsource/space-grotesk` | Space Grotesk (studio pieces only) | The Space Grotesk Project Authors | https://github.com/floriankarsten/space-grotesk | SIL OFL 1.1 | None |

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
