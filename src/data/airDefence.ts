// The air defence trial: the proving-ground test for an anti-aircraft gun
// vehicle. It stands on the range while raiders come at it one after
// another: fast jets running in low, helicopters that pop up from behind the
// trees to fire, and small slow drones. It is marked on how many it brings
// down before they reach their line, and on how quickly it opens fire.
// Game-level abstractions, not engineering data.

export const AIR_KIND_IDS = ['jet', 'helicopter', 'drone'] as const
export type AirKindId = (typeof AIR_KIND_IDS)[number]

export interface AirKind {
  /** Where it first shows: over the horizon, or popping up from behind the trees, metres off. */
  appearM: number
  /** How fast it closes, metres a second. Nought for one that hovers where it popped up. */
  speedMs: number
  /** Where it does its harm (drops its bombs), metres off. Not used by one that hovers. */
  lineM: number
  /** Seconds a hoverer stays up before it fires its missile, which is its line. Nought for one that closes. */
  hoverS: number
  /** Farthest the search radar picks it up, metres. */
  radarM: number
  /** Farthest the crew can pick it up by eye, metres. */
  eyeM: number
  /** Seconds, on average, for a commander with the plain sight to find it by eye once it is that close. */
  searchS: number
  /** The crew holds its fire until it is this close, metres: further off a burst is wasted. */
  openM: number
  /** Chance one burst brings it down at short range with perfect fire control. */
  hit: number
  /** How hard it is to aim ahead of: multiplies what the computer leaves uncorrected. */
  lead: number
}

export interface AirMarks {
  /** Raiders brought down before their line, at least. */
  downed: number
  /** Seconds from a raider coming within range to the first burst, on average, at most. */
  reactionS: number
}

export const AIR_TRIAL = {
  kinds: {
    // Low and fast: the radar sees it far out, the eye only once it clears the trees, and it is soon gone.
    jet: { appearM: 15000, speedMs: 240, lineM: 1500, hoverS: 0, radarM: 15000, eyeM: 4000, searchS: 4, openM: 4000, hit: 0.4, lead: 2 },
    // Pops up from behind the trees, already close, and hovers while it aims its missile.
    helicopter: { appearM: 3200, speedMs: 0, lineM: 0, hoverS: 22, radarM: 8000, eyeM: 3200, searchS: 8, openM: 4000, hit: 0.35, lead: 0.3 },
    // Small, slow and quiet: hard to see and hard to hit, but there is time.
    drone: { appearM: 6000, speedMs: 45, lineM: 400, hoverS: 0, radarM: 5000, eyeM: 1200, searchS: 6, openM: 2000, hit: 0.12, lead: 0.4 },
  } satisfies Record<AirKindId, AirKind>,
  /** The raiders, one after another, in the order they come. */
  raids: ['jet', 'drone', 'helicopter', 'jet', 'helicopter', 'drone'] as readonly AirKindId[],
  radar: {
    /** Seconds, on average, for the turning dish to come round onto something new. */
    scanS: 2,
    /** The radar measures the range itself: its error as a share of the range, in place of the rangefinder's. */
    rangeError: 0.005,
  },
  /**
   * How a burst's chance falls with range: it is `hit` divided by one plus
   * this times the error share times the range in kilometres squared. The
   * error share is what the computer leaves of the lead uncorrected, plus the
   * error in the range.
   */
  spread: 1,
  /** A gun built for tanks cannot track an aircraft: its bursts are this much as likely to hit. */
  tankMount: 0.15,
  /** What the range asks of an anti-aircraft gun, until a tender sets its own. */
  marks: { downed: 4, reactionS: 6 } satisfies AirMarks,
  /** The replay in the report. Only for the picture: the times it shows are the trial's own. */
  replay: {
    /** Seconds of the trial played in each second watched. */
    speed: 6,
    /** Each raider stays on the maps this long after it comes down or gets through, so the end shows. */
    holdS: 5,
    /** The replay runs on this long after the last raider, in the same seconds. */
    tailS: 6,
    /** A burst's tracer shows this long after it is fired. */
    tracerS: 1.2,
    /** How far out the two maps are drawn, metres: the radar's reach, and the gun's. */
    farM: 15000,
    nearM: 4500,
    /** The bearing each raider comes in on, from the vehicle's nose, degrees, in the order they come. */
    bearingsDeg: [-28, 16, -6, 30, -22, 8] as readonly number[],
    /** The radar's sweep on the far map: this far either side of the nose, and back again in this many seconds. */
    sweepDeg: 60,
    sweepS: 4,
  },
} as const
