// How finely the 3D views are drawn. Looks and speed only: no result changes.
export const TIER_IDS = ['high', 'medium', 'low'] as const
export type TierId = (typeof TIER_IDS)[number]

/** What the player can pick: a tier, or leave the game to find one. */
export const GRAPHICS_SETTINGS = ['auto', ...TIER_IDS] as const
export type GraphicsSetting = (typeof GRAPHICS_SETTINGS)[number]

export interface Tier {
  /** The picture is never drawn finer than this many screen dots for each CSS pixel. */
  pixelRatio: number
  /** Smooths the stepped edges of shapes. It costs a slow phone a good deal. */
  antialias: boolean
  /** The share of the woods that is planted. */
  scenery: number
}

export const TIERS: Record<TierId, Tier> = {
  high: { pixelRatio: 2, antialias: true, scenery: 1 },
  medium: { pixelRatio: 1.5, antialias: true, scenery: 0.6 },
  low: { pixelRatio: 1, antialias: false, scenery: 0.3 },
}

/** Left to itself the game starts here, and only ever steps down. */
export const FIRST_TIER: TierId = 'high'

/**
 * Measuring the frame rate. The first frames of a view are thrown away
 * while the device warms up, then this many are timed. Under
 * `stepDownFps` the picture goes down one tier; under `lowFps` it goes
 * straight to the lowest.
 */
export const FRAME_METER = { skipFrames: 30, sampleFrames: 90, stepDownFps: 40, lowFps: 22 } as const
