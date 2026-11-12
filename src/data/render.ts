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
    /** Woods, the tower and the flags stand beside this stretch of the range. */
    sceneryFromM: -60,
    sceneryToM: 760,
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
  /**
   * Dust thrown up behind a moving tank, and mud flung from the course's pit: puffs left at the back of each
   * track, one for every `everyM` the tank goes on that ground (no more than `mostPerFrame` a picture, so a
   * fast run or a jump in time does not bury the tank). Each puff lives `lifeS` seconds of watching, swells
   * from `fromM` to `toM` across, `size` times over, rises `riseM` times `rise`, and shrinks away over the
   * last `fadeShare` of its life. One mesh holds every puff: `trials` of them at a trial, `battle` in battle.
   * The endurance time-lapse throws none.
   */
  /**
   * Track marks: a dark strip `longM` long and `widthShare` of the track wide
   * laid under each track every `everyM` driven, `liftM` off the ground. Each
   * lasts `lifeS` watched seconds, narrowing away over the last `fadeShare` of
   * it; the pool holds `trials` on the range and `battle` in a battle, the
   * oldest given up first. See-through `opacity`, so ruts laid over ruts darken.
   */
  marks: {
    trials: 160, battle: 560, everyM: 1.2, longM: 1.35, widthShare: 0.8, liftM: 0.03,
    lifeS: 14, fadeShare: 0.4, opacity: 0.4,
    colours: { concrete: '#5f5c55', earth: '#3f3222', mud: '#241b12' },
  },
  /**
   * Sparks where a round strikes a tank in battle: `count` of them (most when
   * it bounces off), thrown back off the plate at up to `speedMs`, some
   * `speedSpread` slower, over a cone `spreadRad` wide, with a `liftMs` lift,
   * falling at `fallMs2`. Each lives `lifeS` watched seconds, shrinking to
   * `endShare` of `sizeM` and cooling from `hot` to `cool`. The pool holds
   * `battle`: anything over waits for the next strike's to go out.
   */
  sparks: {
    battle: 48, count: { bounce: 12, through: 7, track: 6 },
    speedMs: 9, speedSpread: 0.5, spreadRad: 0.9, liftMs: 2.5, fallMs2: 9.8,
    lifeS: 0.5, sizeM: 0.35, endShare: 0.3, hot: '#fff4c2', cool: '#ff7a1f',
  },
  dust: {
    trials: 64, battle: 120, mostPerFrame: 2,
    lifeS: 1.6, fromM: 0.3, toM: 1.3, riseM: 0.9, fadeShare: 0.4, opacity: 0.38, sides: 8, rings: 5,
    behindM: 0.25, spreadM: 0.6, sizeSpread: 0.45, driftM: 0.8,
    kinds: {
      concrete: { colour: '#bdb7aa', everyM: 5, size: 0.7, rise: 0.6 },
      earth: { colour: '#a38c68', everyM: 1.8, size: 1, rise: 1 },
      mud: { colour: '#4d3d29', everyM: 0.8, size: 0.75, rise: 1.6 },
    },
    /**
     * Exhaust from the engine deck, `deckShare` of the hull's length from its middle
     * and `upM` above the roof: a thin grey puff every `everyS` watched seconds,
     * thick and dark every `hardEveryS` while the tank speeds up by more than
     * `hardAccelMs2` or climbs steeper than `climbRad`. It drifts `driftM` back.
     */
    /**
     * Muzzle blast: when the gun fires, `puffs` of dust thrown up off the ground
     * under the muzzle, in a ring `ringM` across, each blown `driftM` outward.
     */
    blast: {
      puffs: 8, ringM: 0.7, driftM: 2.6,
      look: { colour: '#a8936f', size: 1.35, rise: 0.45 },
    },
    exhaust: {
      everyS: 0.18, hardEveryS: 0.09, hardAccelMs2: 0.8, climbRad: 0.06,
      deckShare: 0.32, upM: 0.1, pipeShare: 0.5, driftM: 1.4,
      light: { colour: '#85847e', size: 0.7, rise: 1.8 },
      hard: { colour: '#3b3a37', size: 0.8, rise: 2.3 },
    },
  },
  battle: {
    /** Seconds of battle shown in each second of watching. */
    rate: 3,
    /** The most the whole scene may hold, so a phone draws it at speed. A test builds every ground and counts. */
    maxTriangles: 52000,
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
    wood: { trees: 12, fewestTrees: 4, heightM: 16, radiusM: 6, sides: 5, colour: '#3f4a34' },
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
  /**
   * What stands round the proving ground: woods, far hills, a range tower
   * and warning flags. Looks only. The cameras stand on the near side of the
   * lane, so that side is kept clear further out.
   */
  scenery: {
    /** The most triangles the scenery of one range may be built from. A test counts. */
    maxTriangles: 5200,
    /** Woods start this far from the middle of the lane, on the far side and on the camera's side, and are this deep. */
    farSideFromM: 26,
    nearSideFromM: 48,
    depthM: 110,
    /** One tree for every this many metres of range, each side. */
    treeEveryM: 9,
    tree: { minHeightM: 7, maxHeightM: 15, widthShare: 0.26, skirtShare: 0.05, sides: 5 },
    treeColours: ['#3f4a34', '#4a5638', '#36422f'],
    /** Low hills on the skyline: this many each side, this far off, this long and high at most. */
    hills: { eachSide: 3, fromM: 190, toM: 300, lengthM: 260, heightM: 34, sides: 8, colour: '#7f8667' },
    /** The range tower: a cabin on four legs beside the start, on the far side. */
    tower: { alongM: -14, offM: 16, legHighM: 5, legWidthM: 0.3, cabinM: 3.4, cabinHighM: 2.4, roofM: 4.2, roofThickM: 0.25 },
    towerColours: { legs: '#55584e', cabin: '#c9c3ad', roof: '#5a3f33' },
    /** Red flags fly at each end of the range while it is in use: one each side of the lane. */
    flag: { offM: 4.5, poleHighM: 6, poleRadiusM: 0.07, longM: 1.5, highM: 0.9, thickM: 0.05, pole: '#e9ece6', cloth: '#b23a2e' },
    /** Every range lays its scenery out from this number, so it is the same on every device. */
    seed: 4107,
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
    /** If the kit has not come, road wheels are thin discs that stand a little proud of the track, so they show from the side. */
    wheelThickM: 0.08,
    wheelProudM: 0.02,
    /**
     * The running gear from the kit: how thick the track plate is, how far the
     * sprocket and idler stand in from the ends of the loop, and the return
     * rollers along the top run, how many and how big.
     */
    runningGear: { trackThickM: 0.09, endInM: 0.08, returnRollers: 3, returnRollerM: 0.1 },
    /**
     * The track's links, painted on: bare steel, whatever the paint. One link is this long, as on the blueprint.
     * The picture is this many pixels along a link and across the track; each is a shade of the steel, 1 the steel itself:
     * the gap between links, the pin at the front of each link, and the guide horns down the middle.
     * The links run round as the tank moves, but never more than `mostLinksPerFrame` from one picture to
     * the next: any faster and they would seem to stand still or run backwards, as wheels do on film.
     */
    trackLinks: {
      linkM: 0.16, steel: '#5d5e55', alongPx: 16, acrossPx: 8,
      gapShare: 0.2, gapShade: 0.3, pinShade: 0.65, hornShare: 0.2, hornShade: 0.75,
      mostLinksPerFrame: 0.4,
    },
    /**
     * Mud on the running gear and the lower hull: `colour` laid over the paint, at most `most` of the way,
     * fully up to `lineM` above the track tops and fading out over `fadeM` above that. The turret stays clean.
     * Endurance: each kilometre adds `perKm` for its lane, so a long run off the road shows. Obstacle course:
     * `course` from the start, rising to `pit` once through the mud pit. A battle: how far each ground's
     * tanks have come across the fields to it. Under the mud, the darkest part of a painted picture (a gap
     * between links) shows as mud `underShade` as bright, so the links still read.
     */
    mud: {
      colour: '#5a4a35', most: 0.8, lineM: 0.15, fadeM: 0.4, underShade: 0.45,
      perKm: { concrete: 0.0005, earth: 0.004, rut: 0.006 },
      course: 0.15, pit: 0.75,
      battle: { defend: 0.25, meeting: 0.45, advance: 0.55, night: 0.4 },
    },
    /**
     * Wear: paint rubbed through to bare `colour` steel in patches, on the hull
     * and turret. Patches come from a noise `scale` times a metre; faces looking
     * up wear most, sides `sideShare` as much. Every trial tank starts with
     * `trial` worth, an endurance run adds `perKm`, a battle tank has `battle`,
     * and none goes past `most`. `edgeShare` softens a patch's edge.
     */
    wear: {
      colour: '#77746b', most: 0.4, scale: 4, sideShare: 0.4, edgeShare: 0.04,
      trial: 0.16, perKm: 0.0008, battle: 0.3,
    },
    /**
     * Where rounds struck a tank in battle: soot `soot` over a patch
     * `bounceM` across (`throughM` where it went in), `sootShare` of the way
     * to black at the middle, and at its heart a bright gouge of bare steel
     * where it bounced off, or a dark hole where it went through. The last
     * `most` on the hull and on the turret each are kept.
     */
    scorch: {
      most: 8, bounceM: 0.42, throughM: 0.52, sootShare: 0.92, coreShare: 0.3,
      soot: '#1b1916', gouge: '#c9c5b9', hole: '#060606',
    },
    /**
     * Gun recoil: the barrel slides back `kickShare` of its length (no more than
     * `mostM`) in `backS` watched seconds, and runs out again over `returnS`.
     * The tank rocks back `rockRad` at the kick and settles with it.
     */
    recoil: { kickShare: 0.12, mostM: 0.6, backS: 0.05, returnS: 0.45, rockRad: 0.02 },
    /** A bustle is a box behind the turret: its width as a share of the turret radius. */
    bustleWidthShare: 1.5,
    /**
     * The most triangles one tank may be built from. A test builds every turret
     * with every tile and the most road wheels, and counts. Kelbo chose about
     * 5,000 a tank, so the kit's detail shows; a tank tiled all over may go a
     * little past that.
     */
    maxTriangles: 6500,
    /** Sides to the sprocket, the idler, the fume extractor and the cupola. */
    endWheelSides: 8,
    extractorSides: 8,
    cupolaSides: 8,
    /** The upper hull's underside, the deck over the tracks, sits this far above them. */
    fenderLiftM: 0.02,
    /**
     * The upper hull, reaching out over the tracks as on the kit's renders.
     * Seen from the front: a bevel under each sponson (`underInM` in, `underUpShare`
     * of the hull's height up), sides leaning in by `leanM` up to a chamfer
     * `chamferShare` of the height below the roof, the roof set in `roofInM`.
     * Seen from the side: the tail drops `tailDropShare` of the height over its last `tailRunM`.
     */
    sponson: { underInM: 0.2, underUpShare: 0.2, leanM: 0.16, chamferShare: 0.17, roofInM: 0.32, tailDropShare: 0.4, tailRunM: 0.5, frontM: 0.02 },
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
    /** How many panels of the kit's tiles cover each place, along and across: few, so a fully tiled tank stays near its budget. */
    /** Side skirts: how far out from the hull side they hang, how low they reach (a share of the track's height), and the gap between plates. */
    skirts: { outM: 0.05, bottomShare: 0.3, gapM: 0.03 },
    tilePanels: { glacis: { panelsLong: 1, panelsWide: 2 }, hullSide: { panelsLong: 1, panelsWide: 1 }, turretFront: { panelsLong: 1, panelsWide: 1 }, turretSide: { panelsLong: 1, panelsWide: 1 } },
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
