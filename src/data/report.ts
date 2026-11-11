// The after-action report: how the things that happened in a trial are
// weighed against each other, so the three that mattered most can be named.
// Game-level abstractions, not engineering data.

export const REPORT = {
  /** How many deciding things the report names. */
  findings: 3,
  /**
   * What each kind of finding starts on. Whatever is added to it (rounds
   * through, crew caught and so on) is never enough to climb past the kind above.
   */
  weight: {
    /** A plate that had to hold let a round through. */
    gateFailed: 100,
    /** Rounds reached the ammunition and it went up. */
    magazine: 80,
    /** A fire nobody put out. */
    burned: 70,
    /** A round found bare plate between reactive tiles, or a tile already used up. */
    tileGap: 50,
    /** Fragments off the plate caught crew the round itself missed. */
    fragments: 40,
    /** A plate fired on for the record that let rounds through. */
    weakPlate: 30,
    /** Blow-out panels, or fire suppression, saved the tank. */
    saved: 20,
    /** A plate that had to hold, and only just did. */
    closeCall: 10,
    /** Nothing got through anywhere. */
    allHeld: 5,
  },
  /** A plate that held with less than this share of the round's reach to spare was a close call. */
  closeCallShare: 0.12,
  /** The round's path on the cutaway, in metres: how far out the line starts, how far past the far side it runs, and the room left round it. */
  picture: { leadInM: 1.6, exitM: 0.7, padM: 0.25 },
} as const
