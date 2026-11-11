# Hull Down: status

Newest first. One line per PR, plus anything waiting on Kelbo.

## Waiting on Kelbo

- **Try the armour toy** (plan stage PR 3 is done at 0.3.3.0): Armour tab,
  protection map, reactive tiles and the test shot. Say what feels wrong,
  slow or confusing; fixes can go in at any point.
- **Try the Trials tab** (0.4.1.0). Say if the range marks feel fair: the
  light hull cannot cross the standard trench, and the smallest engine only
  climbs the slope in a tank of about 34 to 36 t or less.
- **Watch a run in 3D** (0.4.4.0): Trials, "Send it to the range", then
  "Watch the run" on any of the three tests. It is a grey box on purpose. Say
  if the speed of the playback or the cameras feel wrong, if the bar is
  easy to drag with a thumb, and if it stutters on your phone.
- **Try the gunnery tests** (0.5.1.0): Trials, "Send it to the range", and
  scroll past the endurance run. Say if the marks feel fair (4 of 6 halted
  and a first shot in 21 s, 3 of 4 on the move, 3 of 5 at night) and if the
  cards say clearly why a shoot failed.
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

- **0.5.1.0, PR 5b: the gunnery tests.** The proving ground now has six
  tests. The three new ones are shoots: halted (six targets from 800 to
  2400 m, sabot and shaped charge), on the move (four targets, 600 to
  1500 m) and at night (five targets, 400 to 1200 m). The crew gets two
  rounds a target and corrects after a miss. Each card shows the score and
  its mark, a board with every shot on it (a dot for a hit, a cross for a
  miss), each target in turn, and what most of the misses came from, with a
  Fix button to the part. The halted shoot also marks the time to the first
  shot. Every shot is rolled from the project number, so the same design
  shoots the same score every time.
- **0.5.0.0, PR 5a: the gunnery model.** The design office now works out how
  the tank shoots, and shows it in a Gunnery box at the foot of the Gun and
  Fire control tabs and on Readouts: time to first shot (halted and on the
  move), rate of fire fresh and kept up over 20 rounds, the chance of a hit
  on the move and at night, and a table of first-round hit chance at 500 to
  2500 m for each round. A rifled gun groups its shots tighter; a smoothbore
  throws them faster and flatter, so it forgives a badly judged range. A
  better rangefinder mostly helps slow rounds at long range. A tank with no
  stabiliser halts to shoot; one-plane wanders sideways on the move. A human
  loader tires round by round, sooner with a heavy round or a cramped
  turret; an autoloader keeps its pace, loses a little to jams, and is fed
  by hand once it is empty. No range tests for it yet: they are 5b.
- **0.4.5.0, PR 4f: the range runs on its own thread.** Sending a design to
  the proving ground now hands the tests to a Web Worker, a second thread
  beside the page, and shows the report when it answers. Nothing looks
  different today, because these three tests take about a thousandth of a
  second. It matters from PR 5 on, when gunnery and armour trials take real
  time: the page will stay smooth while they run. A phone that cannot start
  the worker runs the same tests on the page and gets the same report. This
  finishes plan stage PR 4.
- **0.4.4.0, PR 4e: the endurance run in 3D.** The endurance card has a
  "Watch the run" button too. It plays the 300 km as a time-lapse of under
  half a minute: the hours and kilometres count up fast while the tank is
  seen driving each leg in turn, on the road, the range tracks, the hills
  and the rough ground. A slow tank is seen to crawl. At each breakdown the
  tank stops and a caption says what broke and how long it cost. When an
  overloaded engine or transmission is wrecked, smoke rises from the engine
  deck and the run ends there. Pause, the scrub bar and the four cameras
  work the same as on the other two tests.
- **0.4.3.0, PR 4d: pause, scrub and cameras.** The 3D view has a Play /
  Pause button, a bar that shows how far through the run it is and can be
  dragged to any moment, and four cameras: Director, Side, Behind and Above.
  Director is the default. On the strip it cuts between cameras that travel
  with the tank. On the course a camera stands beside each obstacle and
  turns to follow the tank over it. At the end the button reads "Again".
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
  runs back (0.4.2.0), 4d the director camera, pause and scrub (0.4.3.0),
  4e the endurance run played back in 3D as a time-lapse (0.4.4.0), 4f the
  trials run in a Web Worker so a slow phone stays smooth (0.4.5.0). All six
  are done.
- PR 5 is split as well: 5a the gunnery model and its readouts (0.5.0.0),
  5b the static, moving and night gunnery tests on the range, 5c crew
  stations, comfort, fatigue and the loading drill, 5d barrel length and
  recoil system, 5e the gunnery tests played back in 3D. PR 6 is then
  0.6.0.0.
- The firing marks are a Pact standard for now, like the driving marks.
  The baseline passes each shoot about nine times in ten; which time is
  down to the project number. Turret parts (sights, rangefinder, stabiliser)
  do not break during a shoot yet: that comes with the loading drill in 5c.
- Gunnery numbers are quoted for the proving ground's trained crew.
  Conscripts aim 30 % wider and take 35 % longer; that starts to matter in
  field reports (PR 8). The scatter of the Pact rounds was retuned in 5a so
  rifled and smoothbore guns differ: rifled rounds group tighter.
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
