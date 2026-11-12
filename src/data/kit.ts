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
  } satisfies Record<TurretId, `turret-${string}`>,
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
    /** The engine deck: its plate's length and width, and its height with the slats on. */
    engineDeckM: { x: 1.6, y: 0.045, z: 2.0 },
    /** A panel of reactive tiles: its length and width, the middle of its face, and its back, which sits on the plate. */
    eraTilesM: { x: 1.06, z: 0.5, middle: { x: 0.34, z: -0.12 }, backY: -0.02 },
  },
  /**
   * How each turret piece is fitted out, as it was modelled (art/tank-kit.py,
   * TURRET_FIT). The gun's root sits `gunAhead` turret radii forward of the
   * ring's middle and `gunUp` turret heights above the roof it stands on: the
   * unmanned turret carries its gun in a cradle above it. The mantlet sits
   * `mantletBackM` behind the gun's root, stretched by `mantletStretch`. Smoke
   * launchers and the side tiles stand `sideOut` turret radii out to each
   * side. Tiles on the front go on each cheek: its middle `x` ahead and `z`
   * across (turret radii), facing `yawDeg` out from straight ahead, `long` radii long.
   */
  fit: {
    castDome: { gunUp: 0.5, gunAhead: 1.0, mantlet: 'mantlet-cast', mantletBackM: 0.05, mantletStretch: { x: 1, y: 1, z: 1 }, sideOut: 1.0, tileFront: { x: 1.02, z: 0.5, yawDeg: 25, long: 0.6 } },
    lowProfile: { gunUp: 0.52, gunAhead: 1.0, mantlet: 'mantlet-cast', mantletBackM: 0.05, mantletStretch: { x: 1, y: 1, z: 1 }, sideOut: 1.05, tileFront: { x: 1.02, z: 0.52, yawDeg: 20, long: 0.6 } },
    weldedWedge: { gunUp: 0.545, gunAhead: 0.72, mantlet: 'mantlet-block', mantletBackM: 0.3, mantletStretch: { x: 1.6, y: 1, z: 0.5 }, sideOut: 0.97, tileFront: { x: 1.035, z: 0.6, yawDeg: 59, long: 1.0 } },
    bustle: { gunUp: 0.53, gunAhead: 0.95, mantlet: 'mantlet-block', mantletBackM: 0, mantletStretch: { x: 1, y: 1, z: 1 }, sideOut: 0.94, tileFront: { x: 1.0, z: 0.3, yawDeg: 0, long: 0.45 } },
    unmanned: { gunUp: 1.57, gunAhead: 0.5, mantlet: null, mantletBackM: 0, mantletStretch: { x: 1, y: 1, z: 1 }, sideOut: 0.62, tileFront: { x: 0.96, z: 0.2, yawDeg: 0, long: 0.3 } },
  } satisfies Record<TurretId, { gunUp: number; gunAhead: number; mantlet: 'mantlet-cast' | 'mantlet-block' | null; mantletBackM: number; mantletStretch: { x: number; y: number; z: number }; sideOut: number; tileFront: { x: number; z: number; yawDeg: number; long: number } }>,
  /** The cupola and the sight head stand on the roof at these shares of the turret's height; the sight is this far across, as a share of the radius, from the cupola's side. */
  roof: { cupolaUp: 0.97, sightUp: 0.9, sightBackShare: 0.02, sightAcrossShare: 0.42 },
} as const

export type KitPiece = keyof typeof KIT.pieces
