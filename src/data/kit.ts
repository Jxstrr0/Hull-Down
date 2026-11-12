// The trial tank kit: pieces modelled in Blender (art/tank-kit.py) and
// shipped as one file, public/kit/tank-kit.glb. Each piece is built at a
// reference size; the range scales it to the design's own measurements.
// Every tank is assembled from these, so the triangle caps keep eight tanks
// light enough for a phone (Kelbo chose about 5,000 a tank).
import type { TurretId } from './parts'

export const KIT = {
  file: 'kit/tank-kit.glb',
  /** The most the kit file may weigh. It is cached with the game. */
  maxBytes: 200 * 1024,
  /** The two colours a piece is painted in, by material name. */
  tones: ['body', 'dark'],
  /** Each piece, and the most triangles it may have. */
  pieces: {
    'turret-cast-dome': 260,
    'turret-low-profile': 180,
    'turret-welded-wedge': 80,
    'turret-bustle': 160,
    'turret-unmanned': 100,
    'mantlet-cast': 80,
    'mantlet-block': 30,
    gun: 280,
    'road-wheel': 220,
    sprocket: 260,
    idler: 150,
    'return-roller': 60,
    'skirt-panel': 30,
    'era-tiles': 100,
    'smoke-launchers': 140,
    cupola: 150,
    'sight-head': 60,
    'engine-deck': 200,
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
