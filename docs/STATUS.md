# Hull Down: status

Newest first. One line per PR, plus anything waiting on Kelbo.

## Waiting on Kelbo

- **Career numbers and the designation** (0.8.2.0), decided without you
  and easy to change:
  - Grant for the first tender Kr 22M. First prototype 4 x unit cost,
    each revision 1.5 x. That just pays for every revision of a tank at
    the Type 1's price; a dearer tank gets fewer.
  - Standing starts at 50 of 100 with each body. Army: +12 for winning,
    +3 for second, -4 below that, -6 for a fourth revision. Ministry: +4
    won, -2 lost, up to 6 either way for cost, -1 a revision, -4 for the
    fourth. Pact: up to 8 either way for how many main parts are still
    the Type 1's.
  - Service designation "Model 81" (the year), "Model 81/2" for a second
    that year, a letter for an upgrade later ("Model 81A"). Working
    scheme, in `docs/NAMES.md`.
  - You may enter any prototype you built, not only the last.
- **How a bid is marked** (0.8.0.0), decided without you and easy to
  change: weights protection 30, firepower 25, mobility 15, reliability
  15, cost 15; each failed range test costs 4 marks out of 100; a design
  that breaks a limit is thrown out. The first tender's catch is the
  night shoot: the Type 1 as issued fails it.
- **Try the duels** (0.7.3.0): Trials tab, "Send it to the duels". Say
  if the report reads clearly, if the opponents feel fair (the Type 1 as
  it stands beats the light rival and the Warden, and loses to the heavy
  rival, the firepower rival and the Palisade), and whether you want to
  watch a duel in 3D (not built; the plan leaves 3D battles to PR 9).
- **How a duel is fought** (0.7.1.0), decided without you and easy to
  change: the five grounds and their ranges; a fight is called off as a
  draw after 4 minutes; crews have been in the tank 2 hours; a hull-down
  tank hides as much as its gun depression allows (the berm test's sum);
  smoke blinds both tanks for 25 s, once a duel; a tank is out of the
  fight when it blows up, burns, loses its gun or sight, or loses both
  commander and gunner. You can judge these once the duel screen is in.
- **Names for the opponents** (0.7.0.0), all working names: the rival
  bureaus "Heavy Machine Plant No. 2", "Tractor Works No. 7" and "Ordnance
  Institute No. 4", and the Accord tanks "Warden" and "Palisade". Say if
  you want others. Also say if three rivals is right (the plan says two or
  three), and whether the Palisade should be in from the start or held
  back as a later surprise.
- **Voice** is still open: the plan says to decide it after the first
  playable. Nothing is generated without a quote and your yes.
- **The cover image** for the hidden studio listing: free from the game's
  own blueprint, or one Higgsfield picture (the account showed 0 credits
  and no price could be quoted without submitting).
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
  and a first shot in 22 s, 3 of 4 on the move, 3 of 5 at night) and if the
  cards say clearly why a shoot failed.
- **Try the loading drill** (0.5.2.0): the last card on the range. Swap the
  autoloader for a loader on the Gun tab and send it again. Say if the mark
  feels fair (3.3 a minute): a loader with 125 mm rounds and basic crew
  fittings fails it (3.2 a minute), and passes with standard fittings or
  the 120 mm or 100 mm gun.
- **Look at the crew stations** (0.5.3.0): Crew tab. Say if who does what
  reads right: the commander works the optical rangefinder, the gunner the
  stadia lines and the laser, and with an autoloader the commander also
  carries the radio and the lookout.
- **Look at comfort and fatigue** (0.5.4.0): Crew tab, then the range.
  Three things were decided without you and are easy to change. The shoots
  and the loading drill are fired after 8 hours in the tank, so every crew
  comes to them tired. Comfort comes from the crew fittings, the suspension
  and where the engine sits; hatches and noise are not counted yet. A fully
  tired crewman is 30 % slower and aims no worse.
- **Look at barrel length and the recoil mount** (0.5.5.0): Gun tab. The
  three barrels and three mounts, their names and what each trades were
  decided without you. A long barrel is +0.4 t and puts the 125 mm sabot
  through 495 mm, not 460; a short one saves 0.3 t and manages 419 mm. The
  long-stroke mount lets the 125 mm gun sit in a 1900 mm ring (2050 as
  standard); the short-stroke mount needs 2150.
- **Look inside the tank** (0.6.0.0): tap "Inside" beside Side, Top and
  Front. Where everything sits was decided without you and is easy to move:
  the gunner sits ahead of the commander when there is a loader and across
  from him when there is not; a carousel autoloader lies flat under the
  turret floor; spare rounds and fuel go either side of the driver and
  across the hull ahead of the engine (behind the turret if the engine is
  in front). Blow-out panels only cover rounds kept in the bustle: the
  bustle holds 24 with a loader, or the autoloader's 18 and 6 more. Say if
  any of that reads wrong.
- **What a hit does** (0.6.1.0): on the Armour tab, a test shot that gets
  through now lists what it reaches. The numbers were picked without you
  and all sit in one table (`src/data/hits.ts`): rounds that are hit
  explode 75% of the time in plain racks or an autoloader, 60% in armoured
  bins (which also take 25 mm to get into), 30% in wet stowage; behind
  blow-out panels the blast goes outside and the tank lives. A holed fuel
  tank burns 40% of the time, a hit engine 25%; fire suppression puts out
  85% of fires. Fragments reach crew within 1.4 m of the hole (0.5 m with
  a spall liner). A track in the way takes 20 mm off a kinetic round and
  60 mm off a shaped charge, and breaks 60% of the time. Say if any of
  these feel too harsh or too kind once you can play the armour trial.
- **How revisions are kept** (0.6.5.0): one is recorded each time a
  changed design goes to the range, numbered from 1, twelve kept per
  design (the oldest goes). They cost nothing and have no limit yet: the
  three-plus-a-costly-fourth rule arrives with the career. Say if you
  would rather press a button to keep one, or keep more or fewer.
- **What the after-action report calls decisive** (0.6.3.0): it names
  three things, ranked in this order: a plate that had to hold and did
  not; the ammunition exploding; a fire nobody put out; rounds finding
  bare plate between reactive tiles; fragments catching crew with no spall
  liner; the weakest plate fired on for the record; blow-out panels or
  fire suppression saving the tank; a plate that only just held (under 12%
  to spare); nothing getting through. Say if the order should change.
- **The armour trial's pass marks and the berm** (0.6.2.0): picked so the
  Radan baseline passes, and all in `src/data/range.ts`. Must hold: upper
  glacis and turret front against the Accord 105 mm sabot at 2000 m; upper
  glacis against the 105 mm shaped charge; turret front against the
  infantry rocket; front hull sides and turret sides against the 25 mm
  autocannon. Fired for the record only: lower glacis, mantlet, rear hull
  sides, hull rear, and the turret front against the shaped charge (the
  baseline is weak at all of them). Three rounds a serial. The berm is a
  rounded ridge 100 m in radius; the mark is 1.9 m showing over the crest
  (the baseline shows 1.80 m with its 5.25° of dip). A tender will set its
  own marks later; say if these defaults look wrong.
- **Watch a shoot in 3D** (0.5.6.0): Trials tab, any of the three gunnery
  cards, "Watch the run". Three things were decided without you: the long
  waits (finding, ranging, laying, loading) are cut to about a second and a
  half each so a shoot takes 20 to 40 seconds to watch; the director's
  camera jumps to the board when a round is a third of the way there; a
  board that is hit drops flat half a second later. Say if the pace, the
  cuts and the board read well on your phone.
- **Say how the endurance run should treat luck.** As built: every part
  within its rating gives trouble about one run in five, mended at the
  roadside, and one stop is allowed. A part 10 % over its rating breaks in
  about three runs in four. The same project always gets the same luck, so
  sending it again changes nothing; only a design change does.
- Choose how the hidden studio-site listing gets its cover image (see Notes).
- Say if the project numbers ("Project 101", counting up, never reused) suit
  you, or if you want a different scheme. See `docs/NAMES.md`.

Done: GitHub Pages is on and `hulldown.longlight.games` is live (checked
11 November 2026).

## Log

- **0.8.2.0, PR 8c: the career itself.** Sim and data only.
  `src/sim/career/career.ts` is the bureau's run as a plain value that
  can be saved: the tender it is on, the ministry's grant, three
  reputations (army, ministry, Pact committee), the prototypes built and
  the army's decision. A first prototype costs four tanks' worth, a
  revision one and a half; three revisions are inside the rule and a
  fourth costs standing with the army and the ministry. The bureau
  enters any one of its prototypes; the army ranks it with the three
  rivals' bids. A winner is adopted as "Model 81"; a loser keeps its
  budget and the career goes on. The Pact counts how many of 16 main
  parts are still the Type 1's.
- **0.8.1.0, PR 8b: rival bureaus revise against the tender.** Sim only.
  A rival now bids the way you do: it draws up its tank, sends a
  prototype to the tender's proving ground and duels, reads the report
  and revises, up to three times (the same rule as yours). A failed
  shoot gets the next better sight, stabiliser or rangefinder; a failed
  sprint or slope a stronger engine; a failed trench a longer hull; a
  holed plate more of the armour, taken from elsewhere inside the same
  weight. A revision that marks no better is dropped. The heavy bureau
  is now real competition: over 30 trial seeds it beat a Type 1 with
  only a better night sight about two times in three.
- **0.8.0.0, PR 8a: the first tender and how a bid is marked.** Sim and
  data only; nothing new on screen. `src/data/tenders.ts` holds the first
  tender (1981, an improved Type 1: the Pact limits, a unit-cost ceiling
  of Kr 3.2M, the usual range marks but four night targets hit, duels with
  the Warden and the Palisade) and the scoring table.
  `src/sim/career/score.ts` puts any bid through that proving ground and
  those duels, marks it out of 100 on protection, firepower, mobility,
  reliability and cost, weighs the five as the tender says, takes marks
  off for each range test failed, and ranks the bids. PR 8 is split to
  keep each piece phone-sized: 8a this, 8b rivals revise against the
  tender, 8c the career (phases, budget, revisions, reputations, the
  decision, designations), 8d saves and the `HD1:` code, 8e the chief
  engineer, 8f the career screens.
- **0.7.3.0, PR 7d: the duel screen.** Trials tab, "Send it to the
  duels". Pick one of five opponents (three rival bureaus, two Accord
  tanks) and read what is known of its tank, the score over all five
  grounds, and a card for each ground: won, lost and drawn as numbers and
  a patterned bar, who got the first round off, how each tank's rounds
  went, up to three things that decided it (each marked For or Against,
  with a fix button that opens the control or the plate), and any one of
  the 20 duels told round by round. PR 7 is done with this.
- **0.7.2.0, PR 7c: a duel fought many times, and what decided it.** The
  last piece with nothing on screen. A duel is fought 20 times on each
  ground and the results added up: won, lost and drawn; who got the first
  round off; rounds fired, hit and through for each tank; which of the
  tank's plates were holed. From those the report names up to three things
  that decided it, heaviest first, each with a duel that shows it and the
  control or plate that would change it: shot first or outdrawn, never got
  a round off, missing, hits doing nothing, one plate letting most of it
  through, the ammunition going up, fire; and on the good side shooting
  first, the armour holding, and getting through. The thresholds are in
  `src/data/duel.ts`.
- **0.7.1.0, PR 7b: the one-against-one fight.** Still nothing new on
  screen. Two tanks meet at a set range on set ground and fight it out:
  each crew finds the other, ranges, lays and fires as it does on the
  range, and each round that lands is followed through the armour and the
  inside as in the armour trial. Five grounds: a meeting at 1500 m, the
  same at 2500 m, attacking a tank behind a ridge, holding the ridge, and
  a meeting at night at 900 m. The tank's own sense is simple: after two
  hits on one part that do nothing the gunner tries the other part, after
  three in all the crew changes round, and a tank that is holed and can
  still fight fires its smoke once. Losing crew slows the rest. The same
  tanks, ground and seed always give the same fight. Numbers are in
  `src/data/duel.ts`.
- **0.7.0.0, PR 7a: who the tank is measured against.** Nothing new on
  screen yet; this is the groundwork for duels. Three rival bureaus each
  have a way of thinking (heavy and well protected; light and cheap;
  firepower first), and a bot designer builds each one's tank from the
  same parts list, under the same limits and checks as the player's. The
  same bureau and seed always give the same tank; different seeds give
  different ones. Two Accord threat tanks are drawn up from the same parts
  but fire Accord rounds: the Warden (105 mm, plain steel) and the Palisade
  (120 mm, layered armour). Their numbers are in `src/data/opponents.ts`.
- **0.6.6.0, PR 6g: trial results side by side, with a ghost.** The
  side-by-side screen now sends both builds through the range under the
  same conditions and shows every measured thing for each: tests passed,
  the sprint, top speed, each obstacle, the endurance run, hits on each
  shoot, time to first shot, the loading drill, rounds through the armour
  and the height over the berm. Each has a tick or a cross for the mark
  and an arrow with "better" or "worse". The speed chart draws the later
  build as a solid line and the earlier as a faint dashed ghost. The
  Radan baseline is now named "Type 1" (Kelbo's choice). This is the
  first playable: design, proving ground and report work end to end.
- **0.6.5.0, PR 6f: prototype revisions and the side-by-side view.**
  Sending a design to the range now builds a prototype and keeps it as a
  numbered revision (only when the build has changed; a new name does not
  count). The Trials tab lists them with weight and cost, can put any one
  back on the board (two taps), and can set any two side by side, or one
  against the drawing board: parts changed, armour changed layer by layer
  and tile by tile, weight by area, and every readout that moved, each
  with an arrow and the word better or worse. Readouts that did not move
  fold away. Old saves read as having no revisions yet. Trial results
  side by side, with the ghost, are 6g.
- **0.6.4.0, PR 6e: the report's share card.** At the foot of the
  after-action report, "Make a share card" draws the report as one
  picture, 1080 by 1350: the design's name, project number and weight, the
  pass stamp, the count of rounds, the worst round's path on the cutaway,
  and the three things that decided the trial, over the studio's credit
  line. Share sends it through the phone's share sheet where the phone
  takes picture files; Save picture downloads it. Always the paper look.
  Nothing is stored or sent anywhere by the game. Its sizes and colours
  are in `src/data/card.ts`.
- **0.6.3.0, PR 6d: the after-action report.** A new card at the end of
  the range, after the armour trial and the berm. It opens with a count
  (rounds fired, stopped, through, tracks broken) and "What decided it":
  the three things that mattered most, each with a button to see the round
  that shows it and a fix link to the plate or part to change. Then every
  round on one strip (a tick above the line was stopped, a bar below went
  through, longer for worse), stepped through with two buttons or by
  tapping the strip. The picked round's path is drawn on the cutaway, from
  the side or from above, with what it met: the angle, each layer and
  whether it held, each thing reached inside and what became of it,
  fragments, fire. Last come the crew by station and the parts hit. The
  weights that rank the findings are in `src/data/report.ts`; the analysis
  is `src/sim/trials/afterAction.ts`.
- **0.6.2.0, PR 6c: the armour trial and the hull-down berm.** Two new
  tests on the range, so a visit is now nine tests. The armour trial fires
  three real rounds at each named plate: they land where they land, what a
  round goes through varies a little, and a reactive tile works once. The
  plates that must hold decide the pass; the rest are fired for the record
  and show where the tank is weak, each with a link back to that zone on
  the Armour tab. The berm test noses the tank up the back of a ridge and
  measures how much shows over the crest with the gun laid level: more gun
  depression, less tank showing. A side-on picture shows what is hidden.
- **0.6.1.0, PR 6b: a shot followed all the way.** The hit model itself.
  A shot is now a line that strikes the tank at a real angle, goes through
  the layers of whichever zone it meets, and then carries on inside to
  whatever lies on its line: crew (out of action), rounds (may explode),
  fuel and the engine (may burn), the gun, the sight, the gearbox. Each
  thing takes something out of the round until it stops. Fragments off the
  plate, fire suppression, blow-out panels, armoured bins, tracks in the
  way and used-up reactive tiles are all in. On the Armour tab the test
  shot now carries on "Behind the armour" when it gets through, listing
  what it reaches and the chances. The armour trial that fires real shots
  with luck is 6c.
- **0.6.0.0, PR 6a: what is inside the armour.** The first piece of the hit
  model. Every design now has an inside worked out from its choices: a seat
  for each crewman, the gun's breech, the gunner's sight, the autoloader,
  the racks of rounds, the fuel tanks, the engine and the gearbox, each
  with a place and a size. An "Inside" button on the blueprint draws it on
  the side and top views, with a key and a line saying where the rounds and
  the fuel are ("22 in the autoloader under the turret, 6 beside the
  driver"). Nothing is hit yet; that is 6b.
- **0.5.6.0, PR 5g: the shoots in 3D.** Each gunnery card on the range
  (halted, on the move, night) has a "Watch the run" button. It plays the
  shoot the tank really fired, target by target: the board stands at its
  range, the gun flashes, the round flies for as long as it really flew and
  leaves a mark where it landed, and a board that is hit goes down. A line
  under the picture says what is happening ("Miss: 1.2 m left.", "Not seen.
  Past the reach of the night sight."). On the move the tank drives, or
  halts for each shot if it has no stabiliser; at night the range is dark.
  Same grey boxes, cameras, Play and scrubber as the driving tests, and
  three.js is still only fetched on the first watch. This finishes plan
  stage PR 5.
- **0.5.5.0, PR 5f: barrel length and recoil mount.** Two new choices on
  the Gun tab. Barrel length (short, standard, long): a longer barrel
  throws every round faster, so rounds fly flatter and kinetic rounds go
  through more, but it is heavier and dearer and whips when the tank is
  moving. The blueprint draws the barrel to its length and the ammunition
  list shows the rounds as that barrel fires them. Recoil mount
  (short-stroke, standard, long-stroke): a longer stroke lets the gun sit
  in a smaller turret ring and rocks the tank less, so the gunner sees
  where a shot fell and corrects the next one better; it costs weight,
  turret room, money and some reliability. The Gunnery box has a new line
  for how much of a misjudged range the next round puts right. Designs
  saved before this load with the standard barrel and mount.
- **0.5.4.0, PR 5e: comfort and fatigue.** The tank now has a comfort
  score out of 100, from the crew fittings, the suspension and where the
  engine sits. Each crewman tires by the hour: faster at a busy station,
  faster in an uncomfortable tank. A tired crewman is slower at every job.
  The Crew tab shows comfort and how tired each station is after 8 hours,
  and the Gunnery box shows the first shot fresh and after 8 hours. The
  range now fires its three shoots and the loading drill at the end of the
  day, 8 hours in, and each card says how tired the crew was. When a fresh
  crew would have passed, the card says so and its Fix button goes to crew
  comfort. Marks moved to suit: first shot 22 s, loading drill 3.3 rounds a
  minute, and targets on the move now stay up 34 s.
- **0.5.3.0, PR 5d: crew stations.** Each crewman now has a workload of
  his own, shown as a bar on the Crew, Fire control and Readouts tabs with
  what adds to it and what eases it. The commander's workload sets how fast
  targets are found, the gunner's how fast the gun is laid, and whoever
  works the rangefinder how fast the range is taken. With no loader the
  commander carries the radio and the lookout as well (+12). The optical
  rangefinder is the commander's job; the lines in the sight and the laser
  are the gunner's. The old single "crew workload" is now the busiest
  station.
- **0.5.2.0, PR 5c: the loading drill and turret faults.** A seventh test:
  the crew fires 20 rounds as fast as the gun can be fed, and the card shows
  a bar for every round. A human loader tires (taller bars), a machine keeps
  its pace, jams now and then (J) and is fed by hand once it is empty (H).
  Mark: 3.7 rounds a minute kept up. Turret parts can now fail before a
  shoot: the crew falls back on the plainest way of doing that job, the card
  says so, and its Fix button goes to that part.
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
  5b the static, moving and night gunnery tests on the range (0.5.1.0), 5c
  the loading drill and turret parts that fail in a shoot (0.5.2.0), 5d crew
  stations and their workload (0.5.3.0), 5e comfort and fatigue (0.5.4.0),
  5f barrel length and recoil mount (0.5.5.0), 5g the gunnery tests played
  back in 3D (0.5.6.0). All seven are done.
- PR 6 is split too: 6a what is inside the armour and the cutaway
  (0.6.0.0), 6b a shot followed through the armour and the inside, with the
  damage it does and the protection systems, 6c the armour trial and the
  hull-down berm on the range, 6d the after-action report (0.6.3.0), 6e
  the report's share card (0.6.4.0), 6f prototype revisions and the
  side-by-side view of two designs (0.6.5.0), 6g trial results side by
  side with the earlier revision as a ghost (0.6.6.0). All seven are done.
  (The share card was first folded into 6d; it is its own small PR so the
  report stays readable on a phone.) The plan calls the first playable
  0.6.0.0; with the split it is the last of these, and that is where to
  stop for Kelbo to play and decide on voice.
- PR 7 (duels) is split as well: 7a the opponents, built by bot designers
  (0.7.0.0); then 7b the one-against-one fight and the single-tank AI, 7c
  runs over several seeds and the duel report (0.7.2.0), 7d the duel
  screen in the Trials tab (0.7.3.0). All four are done. Kelbo said to carry on past the first playable on 11
  November 2026; voice is still his to decide.
- 6a moved the measurements the blueprint shares with the 3D range (turret
  centre, engine bay, gun height, bustle) from `src/data/drawing.ts` to
  `src/data/layout.ts`, because the hit model now uses them too. The
  numbers are the same.
- 5d retuned three numbers. The first-shot mark went from 21 s to 20 s,
  because the gunner is no longer slowed by the commander's extra jobs (the
  baseline now fires in 18 s; stadia lines and no computer still miss the
  mark). A tank with no stabiliser now rocks more after its halt, and the
  one-plane stabiliser holds a little better, so the moving shoot ranks them
  none, one plane, two planes (about 1 in 4, 1 in 2 and 9 in 10 visits
  passed).
- 5e moved the marks again, because the range now shoots with a crew 8
  hours tired. The baseline fires its first shot in 18 s fresh and 21 s
  tired, against a 22 s mark; stadia lines or no computer still miss it,
  and stadia lines with improved crew fittings pass. The loading drill mark
  went from 3.7 to 3.3 a minute. Targets on the move stay up 34 s, not 30,
  so the one-plane stabiliser still gets its second round away.
- The firing marks are a Pact standard for now, like the driving marks.
  The baseline passes each shoot about nine times in ten; which time is
  down to the project number. From 5c a turret part (sight, rangefinder,
  stabiliser, computer, night sight, commander's sight) can fail before a
  shoot: about one shoot in thirty for the baseline, more with the less
  reliable parts. The same part fails on the same project number until it is
  swapped for another.
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
- Left out of the spec on purpose, to be added when its PR needs it:
  driver position and where each crewman sits (PR 6, when hits need them).
- The recoil mount does not change how fast the gun fires: the loader is
  always slower than the gun settling. What it changes is how well a miss
  is corrected, and the turret ring. A heavier tank does not rock less yet.
- All PR 1 numbers are first-pass game values. Expect them to move once
  trials exist.
- The repo is `Jxstrr0/Hull-Down` (the plan said `HullDown`). The live site
  is `https://hulldown.longlight.games/`.
- Studio site listing: Kelbo wants it added now but hidden (`"hidden": true`
  in `projects.json`). It needs a cover image first; see the plan, section 15.
