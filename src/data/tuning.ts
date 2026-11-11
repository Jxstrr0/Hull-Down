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
    /** Each front-quarter plate: factor x radius x height. */
    turretFrontFactor: 0.8,
    /** Both side plates together: factor x radius x height x shape side factor. */
    turretSideFactor: 2.4,
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
    maxLayerMm: 600,
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
    /** Top speed from power: base + slope x (power at the tracks per tonne). */
    speedBaseKmh: 24,
    speedPerHpT: 2.3,
    /** Share of top speed lost for each millimetre of track wider than standard (gained if narrower). */
    speedLossPerExtraTrackMm: 0.0003,
  },
  gunnery: {
    /** Gun depression gained per 100 mm of turret ring beyond the gun's minimum. */
    depressionPerSpareRing100Mm: 0.5,
    maxSpareRingBonusDeg: 2,
    /** A taller turret for a standing loader lets the breech rise further. */
    loaderDepressionBonusDeg: 1,
  },
  reliability: {
    /** Loss of reliability per unit of overload (load / rated - 1). */
    overloadPenalty: 2.5,
    /** A stressed part never drops below this share of its normal reliability. */
    floor: 0.2,
  },
  crew: {
    workloadBase: { 3: 62, 4: 50 },
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
