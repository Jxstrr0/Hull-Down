// Every tuning number for the vehicle model. Change numbers here, never inline.
// Game-level abstractions, not engineering data.

export const TUNING = {
  geometry: {
    /** Track width the hull's overall width is quoted on. */
    standardTrackMm: 580,
    /** Share of the hull box height covered by the upper glacis; the rest is the lower glacis. */
    upperGlacisShare: 0.6,
    /** Lower glacis slope from vertical, fixed. */
    lowerGlacisAngleDeg: 55,
    /** Turret outer radius = ring radius + this. */
    turretOverhangM: 0.2,
    /** Each front-quarter plate, seen from the front: factor x radius x height. Slope makes the plate bigger. */
    turretFrontFactor: 0.655,
    /** Both side plates together, seen from the side: factor x radius x height x shape side factor. */
    turretSideFactor: 2.08,
    turretRearFactor: 1.4,
    mantletWidthM: 0.8,
    mantletHeightShare: 0.5,
    /** Share of hull length with track on the ground. */
    trackContactShare: 0.62,
    /** Track loop length as a multiple of hull length. */
    trackLoopFactor: 2.4,
  },
  limits: {
    maxLayersPerZone: 4,
    /** No layer of any material is thicker than this. Each material has its own, lower limit. */
    maxLayerMm: 600,
    minLayerMm: 5,
    layerStepMm: 5,
    /** Thickness of a layer when it is first added. */
    newLayerMm: 20,
    glacisAngleDeg: { min: 45, max: 75 },
    trackWidthMm: { min: 480, max: 700 },
    fuelL: { min: 400, max: 1800 },
    rounds: { min: 20, max: 60 },
    ringStepMm: 50,
    /** What the design office sliders offer. The hull and gun narrow these further. */
    ringMm: { min: 1800, max: 2400 },
    roadWheels: { min: 5, max: 7 },
    glacisStepDeg: 1,
    trackStepMm: 20,
    fuelStepL: 50,
  },
  protection: {
    /** Armour within this share of what a round goes through, either way, is marginal. */
    marginShare: 0.12,
    /** Ranges the protection map can be set to, metres. */
    mapRangesM: [500, 1000, 1500, 2000, 3000],
    defaultRangeM: 1000,
    /** Angles off square the test shot can be fired from, degrees. */
    shotAnglesDeg: [0, 15, 30, 45, 60],
    /** A kinetic round meeting the plate further than this from square skids off. */
    ricochetDeg: 80,
  },
  mass: {
    /** Tonnes per litre of fuel, with its tank. */
    fuelTPerL: 0.00088,
    crewmanT: 0.1,
    /** Tonnes per metre of track at the standard width. */
    trackTPerM: 0.08,
    roadWheelT: 0.15,
    /** Sprockets, idlers and return rollers, both sides. */
    runningGearFixedT: 0.5,
    /** Fittings, wiring, radios, tools: share of everything else. */
    fittingsShare: 0.03,
  },
  volume: {
    /** Cubic metres per litre of fuel carried inside. */
    fuelM3PerL: 0.0011,
    /** A steeper glacis squeezes the driver: cubic metres lost per degree above the reference. */
    glacisLossM3PerDeg: 0.03,
    glacisReferenceDeg: 60,
    /** Space lost to the drive shaft and layout when the engine sits in front. */
    frontEngineLossM3: 0.5,
  },
  cost: {
    /** Final assembly and inspection on top of parts. */
    assemblyShare: 0.15,
    roadWheelKr: 3_500,
    trackKrPerM: 1_800,
  },
  mobility: {
    wattsPerHp: 745.7,
    gravityMs2: 9.81,
    /** Rolling drag grows with speed: this much more, as a share of weight, for each metre a second. */
    dragPerMs: 0.0025,
    /** Share of drag gained for each millimetre of track wider than standard (lost if narrower). */
    dragPerExtraTrackMm: 0.0005,
    /** Tracks, wheels and gears have to be spun up too: the tank gets moving as if this much heavier. */
    spinUpFactor: 1.15,
    /** The longest trench a tank bridges, as a share of its hull length. */
    trenchShare: 0.42,
    /** The highest step it mounts, as a share of the height of its hull roof. */
    stepShare: 0.57,
    /** Metres the hull sags for each unit of suspension overload (load / rated - 1). */
    sagMPerOverload: 0.5,
  },
  gunnery: {
    /** Gun depression gained per 100 mm of turret ring beyond the gun's minimum. */
    depressionPerSpareRing100Mm: 0.5,
    maxSpareRingBonusDeg: 2,
    /** A taller turret for a standing loader lets the breech rise further. */
    loaderDepressionBonusDeg: 1,
  },
  reliability: {
    /**
     * Wear builds up over an endurance run as (distance / length) to this
     * power, so trouble comes late in the run more than early.
     */
    wearShape: 2,
    /**
     * How fast an overloaded part breaks: the failures to expect in a run
     * from a part worked at twice its rating on every leg. So a part 1% over
     * its rating, on every leg, adds 0.6 of a failure.
     */
    overloadHazard: 60,
  },
  tracks: {
    /** 0..1 chance a set of tracks gets through an endurance run unstressed. */
    reliability: 0.97,
    /** Tank weight a track carries for each millimetre of its width, tonnes. */
    ratedTPerMm: 0.076,
  },
  crew: {
    workloadMin: 10,
    workloadMax: 100,
  },
} as const

/** Hard limits set by the Kamen Pact standardisation committee for generation one. */
export const PACT_LIMITS_GEN1 = {
  /** Bridge weight class, tonnes. */
  maxMassT: 44,
  /** Rail transport width, metres. */
  maxWidthM: 3.5,
  /** Pact ammunition standard: calibres in common supply. */
  allowedCalibresMm: [100, 115, 125] as readonly number[],
} as const
