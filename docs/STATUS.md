# Hull Down: status

Newest first. One line per PR, plus anything waiting on Kelbo.

## Waiting on Kelbo

- **Try the armour toy** (plan stage PR 3 is done at 0.3.3.0): Armour tab,
  protection map, reactive tiles and the test shot. Say what feels wrong,
  slow or confusing; fixes can go in at any point.
- **Try the Trials tab** (0.4.1.0). Say if the range marks feel fair: the
  light hull cannot cross the standard trench, and the smallest engine only
  climbs the slope in a tank of about 34 to 36 t or less.
- **Watch a run in 3D** (0.4.2.0): Trials, "Send it to the range", then
  "Watch the run" on the first two tests. It is a grey box on purpose. Say
  if the speed of the playback or the camera angle feels wrong, and if it
  stutters on your phone.
- **Say how the endurance run should treat luck.** As built: every part
  within its rating gives trouble about one run in five, mended at the
  roadside, and one stop is allowed. A part 10 % over its rating breaks in
  about three runs in four. The same project always gets the same luck, so
  sending it again changes nothing; only a design change does.
- Confirm or replace the working name "Pattern 3" for the Radan baseline tank.
- Choose how the hidden studio-site listing gets its cover image (see Notes).
- Say if the project numbers ("Project 101", counting up, never reused) suit
  you, or if you want a different scheme. See `docs/NAMES.md`.

Done: GitHub Pages is on and `hulldown.longlight.games` is live (checked
11 November 2026).

## Log

- **0.4.2.0, PR 4c: watch the run in 3D.** The acceleration test and the
  obstacle course each have a "Watch the run" button on the proving ground
  screen. It opens a small 3D view above the numbers and plays the run back:
  a plain grey-box tank, built from the same measurements as the blueprint,
  drives down the strip or over the trench, the step, the mud and the slope.
  It tilts over the step and up the slope, sits lower in the mud, and stops
  where the report says it stuck. A line under the picture shows time, speed
  and distance. "Watch again" replays it, "Close" puts it away. The strip
  plays at four times real speed and the course at twice. The 3D code
  (three.js) is only fetched when a run is first watched, so the page opens
  as fast as before. A phone that cannot do 3D says so and the report still
  has everything.
- **0.4.1.0, PR 4b: the endurance run.** A third range test: 300 km over
  road, range tracks, hills and rough ground. Each part has a load it is
  rated for. Within it, a part gives trouble now and then and the crew mends
  it at the roadside. Over it, trouble comes fast: narrow tracks get thrown
  again and again, an overloaded suspension breaks arms, and an overloaded
  transmission or an engine too hot for its cooling breaks for good and the
  tank is towed in. The report draws the run leg by leg with a mark where
  each thing broke, and lists every overloaded part with a "Fix" button,
  whether or not it broke this time. To pass, the tank has to finish with no
  more than one stop. Tracks now have a weight rating that grows with their
  width, with a new warning in the Faults tab. The Reliability readout comes
  from the same model, so it now drops hard for an overloaded part.
- **0.4.0.0, PR 4a: how the tank moves, and the first two range tests.** A
  new Trials tab sends a design with no faults to the proving ground, which
  opens as its own screen. Two tests so far. Acceleration and top speed: a
  standing start down the strip, with the 0 to 32 km/h time, the top speed
  and a speed chart. Obstacle course: a 2.7 m trench, a 0.8 m step, a mud pit
  and a 30 degree slope, each passed or failed with the reason and a "Fix"
  button that opens the part. Narrow tracks on a heavy tank bog in the mud, a
  weak engine stalls on the slope, a short hull drops into the trench and an
  overloaded suspension sags too low for the step. Readouts gain steepest
  slope, trench, step and ground clearance. Top speed now comes from the same
  model the range uses.
- **0.3.3.0, PR 3d: the quick test shot.** A "Test shot" box in the Armour
  tab fires the chosen round at the zone you are working on. Pick the angle
  (square on, or 15 to 60 degrees off), and where the zone has reactive tiles,
  whether the shot meets a tile or bare plate. The section view shows how far
  the round gets, and a list under it shows what each layer took from it. A
  kinetic round that meets the plate more than 80 degrees from square skids
  off. The answer comes with its margin of error (12 %). This finishes plan
  stage PR 3: the armour is a small toy to try.
- **0.3.2.0, PR 3c: reactive tiles.** A "Reactive tiles" box at the bottom of
  the Armour tab. Each zone has a grid of tile places; tap a place to fit or
  strip a tile. Places under a hatch, a sight or the exhaust are blocked, and
  the rear plates, belly and mantlet take none. A tile adds 250 mm against
  shaped charges where a shot meets one, nothing against kinetic rounds, and
  costs weight and money. The drawing shows the tiles where they are fitted,
  each marked by how it stands up to the chosen round; the plate around them
  keeps its own hatching. Tiles are saved with the design.
- **0.3.1.0, PR 3b: armour zones on the drawing, ammunition and the
  protection map.** With the Armour tab open the blueprint shows each armour
  zone as a face you can tap; the Front, Side and Top views show the zones
  they see square on. Pick a round and a range under "Protection map" and
  every zone is marked holds, marginal or fails, by mark and hatching as well
  as colour. The round list covers kinetic rounds and shaped charges, so both
  maps are there. The Gun tab lists the Pact ammunition for the chosen gun.
- **0.3.0.0, PR 3a: armour layers.** A new Armour tab. Pick one of the 13
  zones, build its stack of up to four layers (material and thickness), and
  see what it stops against kinetic rounds and shaped charges. A section view
  draws the layers to scale, leaning at the plate's slope, with a level shot
  through them. Each material has its own strengths and a thickest plate;
  inserts and air gaps need a steel plate on both sides. Slope now costs
  weight on the turret as well as the glacis. The baseline is now 42.0 t.
- **0.2.3.0, PR 2c: save, load, names and project numbers.** Designs are
  kept on the device as you work and are still there after a reload. A new
  Designs tab names the design, starts a new one from the baseline, copies or
  scraps one, and lists the designs on file (up to 30) with weight, cost and
  fault count. Each design gets a project number from 101 that is never
  reused. "Start again" now keeps the name and number.
- **0.2.2.0, PR 2b: the blueprint.** Side, top and front views drawn from the
  spec, with a Side / Top / Front switch. The drawing changes with the hull,
  glacis, turret, gun, wheels, tracks, engine position, hatches and sights.
  Tapping a part of the drawing opens its control. "Start again" moved to the
  Faults tab.
- **0.2.1.0, PR 2a: design office, parts and readouts.** Pick parts on seven
  tabs, sliders for the numbers, a live weight bar and headline numbers, a
  Readouts tab, and a Faults tab whose "Fix it" buttons jump to the part.
  Each option shows what it would do to weight and cost, and any fault it
  would cause. The design is not saved yet (PR 2c).
- **0.2.0.0, PR 1: the vehicle model.** Spec format, generation-one parts,
  materials and tuning tables, weight, space and cost roll-up, derived stats,
  constraint checks that name the part to fix. The Radan baseline ("Pattern
  3", working name) comes out at 42.2 t against the 44 t Pact limit. The page
  shows its data sheet until the design office arrives in PR 2.
- **0.1.0.0, PR 0: scaffold and deploy.** Vite, TypeScript, Vitest, ESLint
  with the sim bans, deploy workflow, studio splash, empty blueprint sheet
  with paper and blueprint looks. Plan questions Q1 to Q9 answered.

## Notes

- PR 2 is split into three small PRs: 2a parts and readouts (0.2.1.0), 2b the
  blueprint drawing (0.2.2.0), 2c save, load, names and project numbers
  (0.2.3.0). PR 3 is then 0.3.0.0, so PR 6 lands on 0.6.0.0 as the plan says.
- PR 3 is split the same way: 3a armour layers, protection numbers and the
  section view (0.3.0.0), 3b armour zones on the blueprint, the Pact
  ammunition lists and the two protection maps (0.3.1.0), 3c reactive (ERA)
  tiles (0.3.2.0), 3d the quick test shot (0.3.3.0). PR 4 is then 0.4.0.0.
- PR 4 is split too: 4a the mobility model with the acceleration test and the
  obstacle course, shown as a report (0.4.0.0), 4b the endurance run and
  stress-based breakdowns (0.4.1.0), 4c the grey-box 3D range that plays the
  runs back (0.4.2.0), 4d the director camera, pause and scrub, with the
  endurance run played back as a time-lapse (0.4.3.0).
  PR 5 is then 0.5.0.0.
- The range marks (12 s to 32 km/h, 50 km/h top speed, the course as built,
  one stop on the endurance run) are a Pact standard for now. Tenders set
  their own marks in PR 8.
- The endurance run's luck is seeded by the project number. The sim also
  knows a desert climate (cooling sheds 15 % less), with no screen for it
  yet: export trials are PR 12. Sights, autoloaders and the other turret
  parts count in the Reliability readout but are not worn by the endurance
  run; they get their turn in the gunnery tests (PR 5).
- Reactive tiles work once in a real trial. That wear arrives with the hit
  model in PR 6; the design office shows a fresh tile.
- The section view shows armour only. The interior (crew, ammunition, fuel,
  engine) joins it in PR 6, when the hit model needs an interior layout.
- Left out of the spec on purpose, to be added when their PR needs them:
  barrel length, recoil system and gunnery numbers (PR 5), driver position
  and crew stations (PR 6, when hits need them), protection values per zone
  (PR 3).
- All PR 1 numbers are first-pass game values. Expect them to move once
  trials exist.
- The repo is `Jxstrr0/Hull-Down` (the plan said `HullDown`). The live site
  is `https://hulldown.longlight.games/`.
- Studio site listing: Kelbo wants it added now but hidden (`"hidden": true`
  in `projects.json`). It needs a cover image first; see the plan, section 15.
