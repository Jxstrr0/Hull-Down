// How the 3D range looks and plays back. Nothing here changes a result: the
// sim has already run by the time any of this is used.
export const RENDER = {
  colours: {
    sky: '#aeb7bd',
    ground: '#8b8c62',
    mud: '#5b4a3a',
    /** The floor and far end of the trench: dark, so the cut reads as a hole. */
    pit: '#3b382f',
    concrete: '#b3b6ae',
    /** The built-up course: trench walls, the step, the slope. */
    earth: '#9a9682',
    post: '#e9ece6',
    tank: '#4b5340',
    tankDark: '#2f3429',
    sun: '#ffffff',
  },
  light: {
    /** An overcast sky: soft light from above, a little from the ground, a weak sun. */
    skyStrength: 2.6,
    groundTint: '#7a735f',
    sunStrength: 2.4,
    sunFrom: { x: -30, y: 60, z: 40 },
  },
  /** Seconds of the run played for each second watched. */
  playRate: { acceleration: 4, obstacles: 2 },
  /** The scrub bar moves in steps of this many seconds of the run. */
  scrubStepS: 0.1,
  /** The picture is never drawn finer than this many screen dots for each CSS pixel. */
  maxPixelRatio: 2,
  /** Longest stretch of time one drawn frame may cover, seconds. A phone that stalls does not skip the run. */
  maxFrameS: 0.1,
  camera: {
    fovDeg: 38,
    nearM: 0.5,
    farM: 700,
    /** Height above the tank's tracks that the camera looks at. */
    lookUpM: 1.3,
    /** Cameras that travel with the tank. Each sits this far behind it, above it and off to its right. */
    seats: {
      behind: { backM: 12, upM: 4.5, sideM: 9 },
      side: { backM: 2, upM: 3.2, sideM: 21 },
      above: { backM: 5, upM: 36, sideM: 0 },
      front: { backM: -13, upM: 3, sideM: 10 },
    },
    director: {
      /** On the strip the director cuts to a travelling camera at each of these distances. */
      acceleration: [
        { fromM: 0, seat: 'front' },
        { fromM: 120, seat: 'behind' },
        { fromM: 700, seat: 'side' },
        { fromM: 1150, seat: 'front' },
      ],
      /**
       * On the course a camera stands beside each obstacle: this high, this far
       * off plus a share of the obstacle's length. It keeps the tank for `holdM`
       * past the obstacle, and a travelling camera takes the run-out.
       */
      obstacles: { upM: 3, sideM: 16, sidePerM: 0.3, holdM: 5, after: 'behind' },
    },
  },
  fog: { nearM: 120, farM: 520 },
  strip: {
    widthM: 10,
    /** A marker post stands beside the strip this often. */
    postEveryM: 100,
    postHeightM: 1.6,
    postWidthM: 0.25,
    /** How far the posts stand off the edge of the strip. */
    postOffM: 1,
    thickM: 0.1,
  },
  course: {
    /** Width of the built-up lane the obstacles sit on. */
    widthM: 12,
    trenchDepthM: 1.8,
    /** How far into the step's stretch the face stands, and the ground the tank takes to climb it. */
    stepFaceAtM: 1,
    stepClimbM: 2,
    /** Ground drawn before the start and after the finish. */
    leadM: 60,
    /** How far the built-up lane goes down below the lowest ground. */
    footM: 2,
    /** The mud is drawn as a skin this thick, this much narrower than the lane. */
    mudThickM: 0.06,
    mudInsetM: 0.4,
    /** The trench is closed at its far end by a wall this thick. */
    pitWallM: 0.2,
  },
  /** The open ground lies a hair under the lane, so the two never fight over a pixel. */
  ground: { sizeM: 1400, underM: 0.03 },
  tank: {
    /** Sides to a road wheel and to the turret. Few, so a phone draws them fast. */
    wheelSides: 12,
    turretSides: 20,
    gunSides: 8,
    /** How much of the hull length rests on the ground, for working out how the tank tilts. */
    footprintShare: 0.62,
    /** Road wheels are thin discs that stand a little proud of the track, so they show from the side. */
    wheelThickM: 0.08,
    wheelProudM: 0.02,
    /** A bustle is a box behind the turret: its height and width as shares of the turret's height and radius. */
    bustleHeightShare: 0.8,
    bustleWidthShare: 1.5,
  },
} as const
