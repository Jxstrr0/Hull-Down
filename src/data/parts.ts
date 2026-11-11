// Generation-one parts (1980s to 1990s). Every number is a game-level
// abstraction tuned to teach the trade-offs. None of it is engineering data.
//
// Units: mass in tonnes, volume in cubic metres, cost in korona (Kr),
// reliability as a 0..1 chance of getting through an endurance run unstressed.

export interface Part {
  /** Tonnes. */
  massT: number
  /** Cubic metres taken from the inside of the tank. */
  volumeM3: number
  /** Korona. */
  costKr: number
  /** 0..1. Parts with nothing to break use 1. */
  reliability: number
}

// --- Hull -----------------------------------------------------------------

export interface HullPart extends Part {
  lengthM: number
  /** Overall width on the standard track (see TUNING.geometry.standardTrackMm). */
  widthM: number
  /** Width of the armoured box between the tracks. */
  bodyWidthM: number
  /** Height of the armoured box. */
  bodyHeightM: number
  /** Ground to hull roof. */
  roofHeightM: number
  /** Space inside the hull. */
  internalM3: number
  maxRingMm: number
  minWheels: number
  maxWheels: number
}

export const HULLS = {
  light: {
    massT: 1.6, volumeM3: 0, costKr: 260_000, reliability: 1,
    lengthM: 6.2, widthM: 3.1, bodyWidthM: 1.95, bodyHeightM: 0.95, roofHeightM: 1.45,
    internalM3: 10.0, maxRingMm: 1950, minWheels: 5, maxWheels: 6,
  },
  medium: {
    massT: 2.0, volumeM3: 0, costKr: 320_000, reliability: 1,
    lengthM: 6.8, widthM: 3.3, bodyWidthM: 2.1, bodyHeightM: 1.0, roofHeightM: 1.5,
    internalM3: 12.0, maxRingMm: 2200, minWheels: 6, maxWheels: 6,
  },
  heavy: {
    massT: 2.5, volumeM3: 0, costKr: 400_000, reliability: 1,
    lengthM: 7.5, widthM: 3.45, bodyWidthM: 2.25, bodyHeightM: 1.08, roofHeightM: 1.6,
    internalM3: 14.5, maxRingMm: 2400, minWheels: 6, maxWheels: 7,
  },
} as const satisfies Record<string, HullPart>
export type HullId = keyof typeof HULLS

// --- Turret ---------------------------------------------------------------

export interface TurretPart extends Part {
  /** Height of the turret above the hull roof. */
  heightM: number
  /** Share of the turret cylinder that is usable space. */
  volumeFactor: number
  /** Multiplier on side armour area (a bustle makes long sides). */
  sideFactor: number
  /** Multiplier on roof armour area. */
  roofFactor: number
  /** How far the front plates lean back from upright, degrees. More slope is more plate for the same cover. */
  frontSlopeDeg: number
  /** The same for the side plates. */
  sideSlopeDeg: number
  /** Gun depression in degrees before other effects. */
  depressionDeg: number
  /** Can carry a bustle autoloader and blow-out panels. */
  hasBustle: boolean
}

export const TURRETS = {
  castDome: {
    massT: 0.7, volumeM3: 0, costKr: 180_000, reliability: 1,
    heightM: 0.72, volumeFactor: 0.42, sideFactor: 1.0, roofFactor: 0.75, frontSlopeDeg: 35, sideSlopeDeg: 30,
    depressionDeg: 5, hasBustle: false,
  },
  weldedWedge: {
    massT: 0.8, volumeM3: 0, costKr: 230_000, reliability: 1,
    heightM: 0.82, volumeFactor: 0.5, sideFactor: 1.1, roofFactor: 1.0, frontSlopeDeg: 50, sideSlopeDeg: 10,
    depressionDeg: 7, hasBustle: false,
  },
  lowProfile: {
    massT: 0.65, volumeM3: 0, costKr: 210_000, reliability: 1,
    heightM: 0.62, volumeFactor: 0.36, sideFactor: 0.95, roofFactor: 0.9, frontSlopeDeg: 40, sideSlopeDeg: 25,
    depressionDeg: 4, hasBustle: false,
  },
  bustle: {
    massT: 1.1, volumeM3: 0, costKr: 290_000, reliability: 1,
    heightM: 0.85, volumeFactor: 0.62, sideFactor: 1.35, roofFactor: 1.3, frontSlopeDeg: 15, sideSlopeDeg: 5,
    depressionDeg: 8, hasBustle: true,
  },
} as const satisfies Record<string, TurretPart>
export type TurretId = keyof typeof TURRETS

// --- Gun ------------------------------------------------------------------

export interface GunPart extends Part {
  calibreMm: number
  bore: 'rifled' | 'smoothbore'
  /** Smallest turret ring that takes the recoil. */
  minRingMm: number
  /** One complete round, tonnes. */
  roundMassT: number
  /** One complete round in a plain rack, cubic metres. */
  roundVolumeM3: number
  /** Rounds a minute with a fresh human loader, tank halted. */
  loaderRof: number
}

export const GUNS = {
  rifled100: {
    massT: 1.9, volumeM3: 0.8, costKr: 150_000, reliability: 0.99,
    calibreMm: 100, bore: 'rifled', minRingMm: 1800, roundMassT: 0.03, roundVolumeM3: 0.035, loaderRof: 7,
  },
  smooth115: {
    massT: 2.2, volumeM3: 0.9, costKr: 190_000, reliability: 0.99,
    calibreMm: 115, bore: 'smoothbore', minRingMm: 1900, roundMassT: 0.028, roundVolumeM3: 0.038, loaderRof: 6,
  },
  smooth125: {
    massT: 2.5, volumeM3: 1.0, costKr: 240_000, reliability: 0.99,
    calibreMm: 125, bore: 'smoothbore', minRingMm: 2050, roundMassT: 0.033, roundVolumeM3: 0.045, loaderRof: 4.5,
  },
  rifled120: {
    massT: 2.8, volumeM3: 1.1, costKr: 270_000, reliability: 0.99,
    calibreMm: 120, bore: 'rifled', minRingMm: 2100, roundMassT: 0.036, roundVolumeM3: 0.048, loaderRof: 5,
  },
} as const satisfies Record<string, GunPart>
export type GunId = keyof typeof GUNS

// --- Loading --------------------------------------------------------------

export interface LoadingPart extends Part {
  crew: 3 | 4
  /** Rounds a minute, or null to use the gun's human-loader rate. */
  fixedRof: number | null
  /** Rounds held ready in the machine (0 for a human loader). Their space is part of volumeM3. */
  readyRounds: number
  minRingMm: number
  needsBustle: boolean
  /** Extra turret height so a standing loader fits. */
  extraTurretHeightM: number
}

export const LOADING = {
  // The fourth crewman. His mass and space are counted with the crew.
  loader: {
    massT: 0, volumeM3: 0.6, costKr: 0, reliability: 1,
    crew: 4, fixedRof: null, readyRounds: 0, minRingMm: 0, needsBustle: false, extraTurretHeightM: 0.12,
  },
  carousel: {
    massT: 1.0, volumeM3: 1.5, costKr: 90_000, reliability: 0.93,
    crew: 3, fixedRof: 7, readyRounds: 22, minRingMm: 2000, needsBustle: false, extraTurretHeightM: 0,
  },
  bustleLoader: {
    massT: 1.2, volumeM3: 1.3, costKr: 140_000, reliability: 0.92,
    crew: 3, fixedRof: 10, readyRounds: 18, minRingMm: 0, needsBustle: true, extraTurretHeightM: 0,
  },
} as const satisfies Record<string, LoadingPart>
export type LoadingId = keyof typeof LOADING

// --- Ammunition stowage (for rounds outside an autoloader) ------------------

export interface StowagePart extends Part {
  /** Extra tonnes per stowed round. */
  massPerRoundT: number
  /** Multiplier on the space each stowed round takes. */
  volumeFactor: number
  costPerRoundKr: number
  needsBustle: boolean
}

export const STOWAGE = {
  plainRacks: {
    massT: 0, volumeM3: 0, costKr: 0, reliability: 1,
    massPerRoundT: 0, volumeFactor: 1.0, costPerRoundKr: 0, needsBustle: false,
  },
  wetStowage: {
    massT: 0, volumeM3: 0, costKr: 8_000, reliability: 1,
    massPerRoundT: 0.008, volumeFactor: 1.3, costPerRoundKr: 400, needsBustle: false,
  },
  armouredBins: {
    massT: 0, volumeM3: 0, costKr: 12_000, reliability: 1,
    massPerRoundT: 0.015, volumeFactor: 1.2, costPerRoundKr: 700, needsBustle: false,
  },
  blowOutPanels: {
    massT: 0.3, volumeM3: 0, costKr: 60_000, reliability: 1,
    massPerRoundT: 0.01, volumeFactor: 1.15, costPerRoundKr: 500, needsBustle: true,
  },
} as const satisfies Record<string, StowagePart>
export type StowageId = keyof typeof STOWAGE

// --- Fire control ---------------------------------------------------------

export interface FireControlPart extends Part {
  /** Change to crew workload (negative is easier). Gunnery effects arrive in PR 5. */
  workload: number
}

export const SIGHTS = {
  daySight: { massT: 0.03, volumeM3: 0.03, costKr: 20_000, reliability: 0.99, workload: 0 },
  improvedDaySight: { massT: 0.04, volumeM3: 0.04, costKr: 55_000, reliability: 0.985, workload: -2 },
} as const satisfies Record<string, FireControlPart>
export type SightId = keyof typeof SIGHTS

export const RANGEFINDERS = {
  stadiametric: { massT: 0, volumeM3: 0, costKr: 0, reliability: 1, workload: 8 },
  coincidence: { massT: 0.08, volumeM3: 0.1, costKr: 45_000, reliability: 0.98, workload: 3 },
  laser: { massT: 0.03, volumeM3: 0.03, costKr: 110_000, reliability: 0.97, workload: -6 },
} as const satisfies Record<string, FireControlPart>
export type RangefinderId = keyof typeof RANGEFINDERS

export const STABILISERS = {
  none: { massT: 0, volumeM3: 0, costKr: 0, reliability: 1, workload: 6 },
  singlePlane: { massT: 0.12, volumeM3: 0.08, costKr: 40_000, reliability: 0.975, workload: 0 },
  twoPlane: { massT: 0.2, volumeM3: 0.12, costKr: 95_000, reliability: 0.965, workload: -5 },
} as const satisfies Record<string, FireControlPart>
export type StabiliserId = keyof typeof STABILISERS

export const COMPUTERS = {
  none: { massT: 0, volumeM3: 0, costKr: 0, reliability: 1, workload: 6 },
  mechanical: { massT: 0.05, volumeM3: 0.05, costKr: 30_000, reliability: 0.98, workload: 0 },
  electronic: { massT: 0.04, volumeM3: 0.04, costKr: 120_000, reliability: 0.96, workload: -6 },
} as const satisfies Record<string, FireControlPart>
export type ComputerId = keyof typeof COMPUTERS

export const NIGHT_SIGHTS = {
  none: { massT: 0, volumeM3: 0, costKr: 0, reliability: 1, workload: 0 },
  activeInfrared: { massT: 0.09, volumeM3: 0.05, costKr: 35_000, reliability: 0.975, workload: 2 },
  imageIntensifier: { massT: 0.05, volumeM3: 0.04, costKr: 130_000, reliability: 0.97, workload: 0 },
} as const satisfies Record<string, FireControlPart>
export type NightSightId = keyof typeof NIGHT_SIGHTS

/** An independent sight for the commander, so he can search while the gunner aims. */
export const COMMANDER_SIGHT: FireControlPart = {
  massT: 0.07, volumeM3: 0.06, costKr: 90_000, reliability: 0.975, workload: -4,
}

// --- Powerpack ------------------------------------------------------------

export interface EnginePart extends Part {
  kind: 'diesel' | 'multiFuel' | 'gasTurbine'
  powerHp: number
  /** Litres per 100 km per tonne of tank. */
  fuelPer100KmPerT: number
}

export const ENGINES = {
  diesel580: {
    massT: 1.0, volumeM3: 1.4, costKr: 110_000, reliability: 0.955,
    kind: 'diesel', powerHp: 580, fuelPer100KmPerT: 5.6,
  },
  diesel780: {
    massT: 1.15, volumeM3: 1.6, costKr: 160_000, reliability: 0.94,
    kind: 'diesel', powerHp: 780, fuelPer100KmPerT: 6.0,
  },
  multiFuel700: {
    massT: 1.2, volumeM3: 1.7, costKr: 175_000, reliability: 0.92,
    kind: 'multiFuel', powerHp: 700, fuelPer100KmPerT: 6.6,
  },
  turbine1000: {
    massT: 1.05, volumeM3: 1.3, costKr: 430_000, reliability: 0.9,
    kind: 'gasTurbine', powerHp: 1000, fuelPer100KmPerT: 10.5,
  },
} as const satisfies Record<string, EnginePart>
export type EngineId = keyof typeof ENGINES

export interface TransmissionPart extends Part {
  /** Tank weight it is built for. Above this it wears fast. */
  ratedT: number
  /** Share of engine power that reaches the tracks. */
  efficiency: number
  /** Top speed the gearing allows, km/h. */
  gearedKmh: number
  /** Speed in bottom gear at full power, km/h. Lower is a harder pull up a slope. */
  lowGearKmh: number
  gears: number
  /** Seconds without drive at each gear change. */
  shiftS: number
  workload: number
}

export const TRANSMISSIONS = {
  manual38: {
    massT: 1.4, volumeM3: 0.9, costKr: 70_000, reliability: 0.95,
    ratedT: 38, efficiency: 0.8, gearedKmh: 50, lowGearKmh: 6.5, gears: 5, shiftS: 0.9, workload: 3,
  },
  manual44: {
    massT: 1.7, volumeM3: 1.0, costKr: 95_000, reliability: 0.945,
    ratedT: 44, efficiency: 0.82, gearedKmh: 60, lowGearKmh: 7, gears: 5, shiftS: 0.8, workload: 3,
  },
  hydro50: {
    massT: 2.0, volumeM3: 1.2, costKr: 185_000, reliability: 0.93,
    ratedT: 50, efficiency: 0.78, gearedKmh: 65, lowGearKmh: 5.5, gears: 4, shiftS: 0, workload: -3,
  },
} as const satisfies Record<string, TransmissionPart>
export type TransmissionId = keyof typeof TRANSMISSIONS

export interface CoolingPart extends Part {
  /** Engine power it can keep cool in the home climate. */
  capacityHp: number
}

export const COOLING = {
  standard: { massT: 0.4, volumeM3: 0.5, costKr: 20_000, reliability: 0.985, capacityHp: 800 },
  heavyDuty: { massT: 0.6, volumeM3: 0.8, costKr: 38_000, reliability: 0.98, capacityHp: 1100 },
} as const satisfies Record<string, CoolingPart>
export type CoolingId = keyof typeof COOLING

/** Auxiliary power unit: runs the turret and radios with the main engine off. */
export const APU: Part = { massT: 0.15, volumeM3: 0.2, costKr: 30_000, reliability: 0.985 }

// --- Running gear ---------------------------------------------------------

export interface SuspensionPart extends Part {
  /** Tonnes for each wheel station (arm, spring, damper). */
  massPerStationT: number
  /** Space inside the hull for each wheel station. */
  volumePerStationM3: number
  costPerStationKr: number
  /** Tank weight each wheel station is built for. */
  ratedPerStationT: number
  /** Ground to belly, metres, at or under the rated weight. */
  clearanceM: number
}

export const SUSPENSIONS = {
  torsionBar: {
    massT: 0, volumeM3: 0, costKr: 0, reliability: 0.97,
    massPerStationT: 0.09, volumePerStationM3: 0.035, costPerStationKr: 6_000, ratedPerStationT: 3.6, clearanceM: 0.43,
  },
  hydropneumatic: {
    massT: 0, volumeM3: 0, costKr: 0, reliability: 0.94,
    massPerStationT: 0.12, volumePerStationM3: 0, costPerStationKr: 17_000, ratedPerStationT: 3.9, clearanceM: 0.48,
  },
} as const satisfies Record<string, SuspensionPart>
export type SuspensionId = keyof typeof SUSPENSIONS

// --- Protection systems ---------------------------------------------------

export const SMOKE_LAUNCHERS: Part = { massT: 0.08, volumeM3: 0, costKr: 15_000, reliability: 1 }
export const FIRE_SUPPRESSION: Part = { massT: 0.12, volumeM3: 0.15, costKr: 45_000, reliability: 0.99 }
export const SPALL_LINER: Part = { massT: 0.45, volumeM3: 0.5, costKr: 60_000, reliability: 1 }

// --- Crew comfort ---------------------------------------------------------

export interface ComfortPart extends Part {
  /** Space each crewman gets. */
  volumePerCrewM3: number
  massPerCrewT: number
  costPerCrewKr: number
  workload: number
}

export const COMFORT = {
  basic: {
    massT: 0, volumeM3: 0, costKr: 0, reliability: 1,
    volumePerCrewM3: 0.9, massPerCrewT: 0.02, costPerCrewKr: 2_000, workload: 5,
  },
  standard: {
    massT: 0, volumeM3: 0, costKr: 0, reliability: 1,
    volumePerCrewM3: 1.05, massPerCrewT: 0.04, costPerCrewKr: 6_000, workload: 0,
  },
  improved: {
    massT: 0, volumeM3: 0, costKr: 0, reliability: 1,
    volumePerCrewM3: 1.25, massPerCrewT: 0.07, costPerCrewKr: 14_000, workload: -5,
  },
} as const satisfies Record<string, ComfortPart>
export type ComfortId = keyof typeof COMFORT
