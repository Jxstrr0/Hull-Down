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
    /** Reactive tiles: a shade apart from the plate, so they read as bolted on. */
    tankTile: '#5f6a50',
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
  /** A platoon battle, played back. Up to eight tanks on the ground at once. */
  battle: {
    /** Seconds of battle shown in each second of watching. */
    rate: 3,
    /** The most the whole scene may hold, so a phone draws it at speed. A test builds every ground and counts. */
    maxTriangles: 12000,
    maxMeshes: 260,
    theirTank: '#6d6248',
    theirTankDark: '#40392b',
    theirTankTile: '#83775a',
    /** How far the camera sees, and where the haze starts and ends, metres. */
    farM: 4200,
    fog: { nearM: 500, farM: 3800 },
    /** The ground reaches this far past the edge of the battle, metres. */
    marginM: 1200,
    /** A ridge is a low mound this long, deep and high, its crest this far ahead of the tank behind it. */
    ridge: { longM: 150, deepM: 36, highM: 2.2, aheadM: 12, sides: 10 },
    /** A wood is this many trees of this size, with this many sides each. */
    wood: { trees: 12, heightM: 16, radiusM: 6, sides: 5, colour: '#3f4a34' },
    /** The camera that travels with a tank: behind and above it, looking this far past it along its gun. */
    chase: { backM: 19, upM: 6.5, aheadM: 90, lookUpM: 2 },
    /** The camera that stands by a tank being put out of the fight: this far off, this high, for this long (battle seconds). */
    close: { awayM: 24, upM: 6, holdS: 7, leadS: 0.8 },
    /** The director stays with one tank at least this long before it goes to another, battle seconds. */
    minCutS: 9,
    /** It goes to a tank this long before that tank fires or is hit. */
    leadS: 1.5,
    /** A round in the air, the flash at the muzzle and the flash where a round strikes. */
    tracerLongM: 16,
    tracerThickM: 0.45,
    flashM: 2.6,
    flashS: 0.35,
    strikeM: 3.2,
    strikeS: 0.5,
    /** A smoke screen round a tank, and the smoke standing over one put out of the fight. */
    screenM: 9,
    wreckSmoke: { puffs: 3, sizeM: 3.2, riseM: 4.5 },
    nightLight: 0.3,
  },
  /** The open ground lies a hair under the lane, so the two never fight over a pixel. */
  ground: { sizeM: 1400, underM: 0.03 },
  tank: {
    /** Sides to a road wheel and to the turret. Few, so a phone draws them fast. */
    wheelSides: 10,
    turretSides: 20,
    gunSides: 8,
    /** How much of the hull length rests on the ground, for working out how the tank tilts. */
    footprintShare: 0.62,
    /** Road wheels are thin discs that stand a little proud of the track, so they show from the side. */
    wheelThickM: 0.08,
    wheelProudM: 0.02,
    /** A bustle is a box behind the turret: its width as a share of the turret radius. */
    bustleWidthShare: 1.5,
    /** The most triangles one tank may be built from. A test builds every turret with every tile and counts. */
    maxTriangles: 1100,
    /** Sides to the sprocket, the idler, the fume extractor and the cupola. */
    endWheelSides: 8,
    extractorSides: 8,
    cupolaSides: 8,
    /** The guard over each track: how thick, and how far above the track it sits. */
    fenderThickM: 0.04,
    fenderLiftM: 0.02,
    /** The grille over the engine: how thick, and its width as a share of the hull's. */
    grilleThickM: 0.03,
    grilleWidthShare: 0.7,
    /** The mantlet round the root of the gun: how long, and its height and width as shares of the turret's height and radius. */
    mantlet: { longM: 0.3, highShare: 0.5, wideShare: 0.5 },
    /** The commander's cupola sits this far back and across from the middle of the ring, as shares of the turret's radius. */
    cupola: { backShare: 0.3, acrossShare: 0.35 },
    /** Smoke launchers: one block a side, this big, this far back as a share of the radius and this far up the turret. */
    launcher: { longM: 0.34, highM: 0.16, wideM: 0.12, backShare: 0.45, upShare: 0.5 },
    /** Reactive tiles stand this far off the plate and are this thick. A full grid covers this share of the plate. */
    tile: { offM: 0.04, thickM: 0.07, cover: 0.9 },
    /**
     * Each turret, seen from above, as rings one over the other. A ring is
     * given as shares of the turret's radius: how far it reaches ahead of the
     * middle and behind it, its half width, and how much is cut off each
     * corner. `up` is the share of the turret's height the ring sits at.
     */
    turrets: {
      castDome: [
        { up: 0, ahead: 1, behind: 1, half: 1, cut: 0.55 },
        { up: 0.6, ahead: 0.9, behind: 0.9, half: 0.9, cut: 0.5 },
        { up: 1, ahead: 0.35, behind: 0.25, half: 0.42, cut: 0.2 },
      ],
      lowProfile: [
        { up: 0, ahead: 1, behind: 1, half: 1, cut: 0.55 },
        { up: 0.55, ahead: 0.92, behind: 0.92, half: 0.92, cut: 0.5 },
        { up: 1, ahead: 0.5, behind: 0.4, half: 0.55, cut: 0.28 },
      ],
      weldedWedge: [
        { up: 0, ahead: 1, behind: 1, half: 0.95, cut: 0.3 },
        { up: 0.52, ahead: 0.82, behind: 1, half: 0.9, cut: 0.3 },
        { up: 1, ahead: 0.25, behind: 0.7, half: 0.7, cut: 0.2 },
      ],
      bustle: [
        { up: 0, ahead: 1, behind: 0.92, half: 0.9, cut: 0.25 },
        { up: 0.6, ahead: 0.82, behind: 0.92, half: 0.9, cut: 0.25 },
        { up: 1, ahead: 0.3, behind: 0.92, half: 0.85, cut: 0.2 },
      ],
      unmanned: [
        { up: 0, ahead: 1, behind: 1, half: 0.55, cut: 0.15 },
        { up: 0.65, ahead: 0.85, behind: 1, half: 0.55, cut: 0.15 },
        { up: 1, ahead: 0.5, behind: 0.8, half: 0.5, cut: 0.12 },
      ],
    },
  },
} as const
