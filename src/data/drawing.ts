// Proportions for the blueprint drawing. These only decide how the tank is
// drawn. Nothing here feeds the simulation.
export const DRAWING = {
  /** Drawn thickness of the barrel, in calibres. Its length comes from the barrel fitted. */
  barrelThicknessCalibres: 1.5,
  /** Fume extractor: where along the barrel (from the turret), how long, how thick. */
  extractorAt: 0.45,
  extractorLengthM: 0.55,
  extractorThicknessCalibres: 2.4,
  /** Top of the track run, as a share of the hull roof height. */
  trackTopShare: 0.62,
  /** Track loop: how far it stops short of the hull ends, and the corner cut. */
  trackInsetFrontM: 0.1,
  trackInsetRearM: 0.05,
  trackCornerM: 0.38,
  trackThicknessM: 0.06,
  roadWheelMaxRadiusM: 0.34,
  /** Share of the room between wheel centres that a wheel fills. */
  wheelFill: 0.92,
  hubShare: 0.35,
  /** Turret centre along the hull, measured from the nose, by engine position. */
  turretCentre: { rear: 0.45, front: 0.62 },
  /** Gun axis height up the turret. */
  gunHeightShare: 0.45,
  /** Where the barrel leaves the turret, as a share of the turret radius ahead of centre. */
  gunRootShare: 0.9,
  /** Rear overhang of a bustle turret, as a share of the turret radius. */
  bustleOverhang: 0.7,
  hatchRadiusM: 0.27,
  cupolaHeightM: 0.18,
  sightHeadM: { width: 0.3, height: 0.3 },
  /** Engine bay, as shares of hull length from the nose, by engine position. */
  engineBay: { rear: [0.68, 0.97], front: [0.2, 0.42] },
  rearUndercutM: 0.15,
  /** Blank space kept around the drawing, in metres. */
  marginM: 0.3,
  /** Extra tap room above the turret and below the ground. */
  tapSkyM: 0.85,
  tapGroundM: 0.5,
} as const

/** The armour section view, in millimetres of drawing. */
export const SECTION = {
  /** Height of the strip of plate that is drawn. */
  stripMm: 220,
  /** Length of the shot line before the plate and after it. */
  leadMm: 170,
  tailMm: 90,
  marginMm: 25,
  /** The drawing is never narrower than this, so thin plate looks thin. */
  minWidthMm: 1200,
  arrowMm: 34,
  /** How thick a reactive tile is drawn, and the gap between it and the plate. */
  tileMm: 40,
  tileGapMm: 12,
  /** How far a round that skids off is drawn running up the plate, as a share of the strip. */
  skidShare: 0.45,
} as const
