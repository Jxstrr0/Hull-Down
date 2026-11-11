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
    /** Broken ground with no made track, on the last leg of the endurance run. */
    rut: '#77724f',
    smoke: '#2c2c2a',
    sun: '#ffffff',
    /** The firing range: the target board, a round in the air, the flash at the muzzle, and where a round landed. */
    board: '#e9ece6',
    boardMark: '#2f3429',
    tracer: '#ffd98a',
    flash: '#fff3c4',
    strikeHit: '#1f2320',
    strikeMiss: '#c2ad84',
    nightSky: '#232a36',
  },
  light: {
    /** An overcast sky: soft light from above, a little from the ground, a weak sun. */
    skyStrength: 2.6,
    groundTint: '#7a735f',
    sunStrength: 2.4,
    sunFrom: { x: -30, y: 60, z: 40 },
  },
  /** Seconds of the run played for each second watched. */
  playRate: { acceleration: 4, obstacles: 2, endurance: 1, shoot: 1 },
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
      /** On the endurance run the director gives each leg one travelling camera. */
      endurance: { road: 'behind', tracks: 'front', hills: 'side', rough: 'side' },
      /**
       * On a shoot the director stays with the tank until a round is `cutShare`
       * of the way to the target, then cuts to a camera standing by the board:
       * this far short of it, this high and this far to the side.
       */
      shoot: { seat: 'behind', cutShare: 0.35, shortM: 11, upM: 2.8, sideM: 6.5 },
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
  /**
   * The endurance run is shown as a time-lapse: the kilometres count up fast
   * while the tank is seen driving each leg, and the picture stops with it at
   * every breakdown.
   */
  endurance: {
    /** Seconds of watching for each kilometre of the run. */
    secondsPerKm: 0.08,
    /** Seconds the picture holds on a roadside repair, and on a breakdown that ends the run. */
    holdS: 1.8,
    endHoldS: 4,
    /** The ground goes by this many times faster than the tank really drives. */
    showRate: 3,
    laneWidthM: 8,
    /**
     * The ground of each leg, which repeats every `periodM`: it rises and
     * falls by `riseM`, with a smaller ripple of `rippleShare` on top, and is
     * drawn with `samples` flat pieces to a period. A marker post stands
     * every `postEvery` periods.
     */
    legs: {
      road: { lane: 'concrete', periodM: 60, riseM: 0, rippleShare: 0, samples: 1, postEvery: 1 },
      tracks: { lane: 'earth', periodM: 60, riseM: 0, rippleShare: 0, samples: 1, postEvery: 1 },
      hills: { lane: 'earth', periodM: 140, riseM: 5, rippleShare: 0.12, samples: 28, postEvery: 1 },
      rough: { lane: 'rut', periodM: 11, riseM: 0.28, rippleShare: 0.5, samples: 10, postEvery: 5 },
    },
    /**
     * Smoke from a wrecked engine or transmission: puffs that rise from the engine
     * deck, `deckShare` of the hull's length from its middle, and spread as they go.
     */
    smoke: { puffs: 5, riseM: 6, everyS: 1.8, fromM: 0.35, toM: 1.7, driftM: 1.5, opacity: 0.6, sides: 8, deckShare: 0.3 },
  },
  /**
   * A firing test is shown target by target. The waits are cut short: the
   * crew's work before each shot takes `waitS` to watch however long it
   * really took. A round's flight is shown as long as it really was, held
   * between `flightMinS` and `flightMaxS`. The picture then holds on the
   * strike for `strikeS`. A target that drew no shot goes by in `passS`.
   */
  shoot: {
    waitS: 1.4,
    flightMinS: 0.6,
    flightMaxS: 1.8,
    strikeS: 1.4,
    passS: 1.8,
    /** How fast the tank is seen to drive in the test on the move. */
    driveKmh: 25,
    /**
     * The ground under the whole range runs from `fromM` behind the start to
     * `toM` past it. The lane the tank fires from stops at `laneToM`; the
     * boards stand in open ground beyond it.
     */
    laneWidthM: 10,
    fromM: -400,
    laneToM: 400,
    toM: 3400,
    /** The ground is laid in pieces this long. */
    pieceM: 100,
    /** Marker posts beside the lane, this far apart and this many each way from the tank. */
    postEveryM: 50,
    postsEachWay: 6,
    /** The board stands this far clear of the ground and is this thick. A dark square marks its middle. */
    boardFootM: 0.3,
    boardThickM: 0.12,
    boardMarkM: 0.6,
    /** A board that is hit stays up this long, so the hit is seen, and then goes down. */
    fallAfterS: 0.55,
    /** A round in the air is drawn as a bright bar this long and this thick. */
    tracerLongM: 2.4,
    tracerThickM: 0.16,
    /** The flash at the muzzle: how big it starts and how long it lasts. */
    flashM: 1.5,
    flashS: 0.16,
    /** The mark where a round landed. One that fell short is drawn on the ground. */
    markM: 0.24,
    markFloorM: 0.15,
    /** At night the sky and the fog go dark and the lights are turned down to this share. */
    nightLight: 0.22,
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
