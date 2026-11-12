// The trial tank kit: pieces modelled in Blender (art/tank-kit.py) and
// shipped as one file, public/kit/tank-kit.glb. Each piece is built at a
// reference size; the range scales it to the design's own measurements.
// Every tank is assembled from these. Kelbo chose detail over lightness:
// about 5,000 triangles a tank.
import type { TurretId } from './parts'

export const KIT = {
  file: 'kit/tank-kit.glb',
  /** The most the kit file may weigh. It is cached with the game. */
  maxBytes: 200 * 1024,
  /** The two colours a piece is painted in, by material name. */
  tones: ['body', 'dark'],
  /**
   * Each piece, and the triangles it is drawn with. A test checks these
   * against the file; the tank's own budget is in RENDER.tank.maxTriangles.
   */
  pieces: {
    'turret-cast-dome': 212,
    'turret-low-profile': 140,
    'turret-welded-wedge': 48,
    'turret-bustle': 128,
    'turret-unmanned': 76,
    'mantlet-cast': 68,
    'mantlet-block': 20,
    gun: 252,
    'road-wheel': 208,
    sprocket: 232,
    idler: 132,
    'return-roller': 48,
    'skirt-panel': 24,
    'era-tiles': 84,
    'smoke-launchers': 124,
    cupola: 136,
    'sight-head': 52,
    'engine-deck': 180,
  },
  /** The piece each turret is drawn with. */
  turrets: {
    castDome: 'turret-cast-dome',
    lowProfile: 'turret-low-profile',
    weldedWedge: 'turret-welded-wedge',
    bustle: 'turret-bustle',
    unmanned: 'turret-unmanned',
  } satisfies Record<TurretId, string>,
  /** The sizes the pieces are built at, in metres, to scale from. */
  reference: {
    turretRadiusM: 1.1,
    turretHeightM: { castDome: 0.8, lowProfile: 0.5, weldedWedge: 0.66, bustle: 0.85, unmanned: 0.42 } satisfies Record<TurretId, number>,
    gunLengthM: 5.2,
    gunRadiusM: 0.075,
    roadWheelRadiusM: 0.36,
    sprocketRadiusM: 0.36,
    idlerRadiusM: 0.3,
    returnRollerRadiusM: 0.11,
  },
} as const

export type KitPiece = keyof typeof KIT.pieces
