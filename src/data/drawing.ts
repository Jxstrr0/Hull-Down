// Proportions for the blueprint drawing. These only decide how the tank is
// drawn. Nothing here feeds the simulation; where things sit is in layout.ts.
export const DRAWING = {
  /** Drawn thickness of the barrel, in calibres. Its length comes from the barrel fitted. */
  barrelThicknessCalibres: 1.5,
  /** Fume extractor: where along the barrel (from the turret), how long, how thick. */
  extractorAt: 0.45,
  extractorLengthM: 0.55,
  extractorThicknessCalibres: 2.4,
  /** Track loop: how far it stops short of the hull ends, and the corner cut. */
  trackInsetFrontM: 0.1,
  trackInsetRearM: 0.05,
  trackCornerM: 0.38,
  trackThicknessM: 0.06,
  roadWheelMaxRadiusM: 0.34,
  /** Share of the room between wheel centres that a wheel fills. */
  wheelFill: 0.92,
  hubShare: 0.35,
  hatchRadiusM: 0.27,
  /** A crewman's head on the cutaway. */
  crewHeadM: 0.13,
  cupolaHeightM: 0.18,
  sightHeadM: { width: 0.3, height: 0.3 },
  rearUndercutM: 0.15,
  /** Blank space kept around the drawing, in metres. */
  marginM: 0.3,
  /** Extra tap room above the turret and below the ground. */
  tapSkyM: 0.85,
  tapGroundM: 0.5,
  /** The finer details of the drawing. Shares are of the part they sit on. */
  detail: {
    tyreShare: 0.84,
    boltRingShare: 0.24,
    boltShare: 0.035,
    wheelBolts: 6,
    sprocketTeeth: 12,
    toothRootShare: 0.84,
    idlerSpokes: 5,
    /** Length of one track link. */
    linkM: 0.16,
    returnRollers: 3,
    rollerR: 0.075,
    /** The track guard sits this far above the top run. */
    fenderGapM: 0.03,
    /** A weld seam this far below the roof line. */
    seamM: 0.05,
    /** Spacing of the engine grille's louvres. */
    louvreM: 0.09,
    /** The turret's casting line, as a share of its height. */
    castLineShare: 0.14,
    basketM: 0.38,
    muzzleRingM: 0.14,
    muzzleRingShare: 1.25,
    sleeveBandM: 0.55,
  },
  /** Dimension lines, in metres of drawing. */
  dims: {
    arrowM: 0.12,
    /** How far each extension line reaches either side of its dimension line. */
    extensionM: 0.08,
    /** Below the ground (side and front): the first line, then the second. */
    firstM: 0.2,
    secondM: 0.4,
    /** Beside the tank: an upright line this far out from its end. */
    besideM: 0.18,
  },
  /** The top view's own details. */
  top: {
    /** Spacing of the seams along a track guard. */
    guardSeamM: 0.9,
    binM: 0.6,
    ventR: 0.08,
  },
  /** How wide the band of section hatching along the armour is drawn on the cutaway (half of it shows, inside). */
  sectionWallM: 0.2,
  /** The front view's own details. */
  front: {
    /** Track guard thickness, seen end on. */
    guardM: 0.05,
    /** Half the gap between the guide horns. */
    hornM: 0.025,
    /** How far below the roof the glacis meets it. */
    roofLipM: 0.06,
    lightR: 0.07,
    visionM: 0.22,
    coaxR: 0.03,
  },
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
