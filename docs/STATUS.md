# Hull Down: status

Newest first. One line per PR, plus anything waiting on Kelbo.

## Waiting on Kelbo

- **Tank destroyer (1.3.0.0 onward).** Your picks: a tank destroyer first, as a career tender, in small PRs, with me making the smaller calls. Step 1, the casemate (1.3.0.0), is in. I chose: it is a turret shape, not a new hull, so every other part works as before; 0.45 t and 120,000 kr against the cast dome's 0.7 t and 180,000 kr; its front plate leans back 60°; the gun needs 70% of the ring it would in a turret; the gunner takes 1.6 times as long to lay on each new target; the gun swings 12° each way, and in battle the gun stops at that, as the hull does not turn to aim yet. The carousel autoloader still needs its 2,000 mm ring, so the small mount pays off with a hand loader or a bustle loader. The casemate is hidden in the career until a tank destroyer tender comes (next PR), and open in the sandbox. Next: the tender itself, then rivals that bid casemates.

- **Tank kit (1.2.8.0 onward).** Your picks: block out the trial tank kit in Blender in this session (no Higgsfield), grey renders first; keep the full detail, about 5,000 triangles a tank; round 2 with a less boxy hull and turrets with more character, then put it in the game. All four steps are in: the kit file (1.2.8.0), the running gear (1.2.9.0), the turrets (1.2.10.0) and the hull (1.2.11.0). I split the last step in two to keep each PR small. I chose: one file for the whole kit (about 120 KB, cached with the game); the hull is not a piece, the game will keep building it from your design's measurements, with the new bevelled sponsons; the track links are left out for now (a painted texture later, to save triangles). For the running gear I chose: the sprocket goes at whichever end the engine is, three return rollers a side for every design, and if the kit cannot load the old simple wheels stand in. For the turrets I chose: the gun sits where each kit turret carries it (the unmanned one high in its cradle), not quite where the blueprint draws it; the sight head stands on the other side of the roof from the cupola. For the hull I chose: the sponsons cover the tracks on every design (the old flat track guards are gone). Your later picks: kit tiles in place of the plain tile blocks (in, 1.2.12.0: I kept two panels across the glacis and one on each other face, to stay near the budget); skirts as a new running-gear design option, with a little weight, cost and lower-side protection, drawn only when fitted (in, 1.2.13.0). I chose: 0.6 t and 25,000 kr; they count at trials only, not on the protection map; the rivals do not fit them yet; the sketch is drawn by a small script, not Blender, as Blender could not be installed in this session. The tank kit work is done. Your next pick: skirts follow-ups. On the blueprint (1.2.14.0): I chose to show the wheels behind the skirts as dashed hidden lines, as a drawing office would, and left the width figure as the hull's own width, without the skirts. Rivals (1.2.15.0): the rockets at the hull side are fired for the record and never fail a tender, so the bureaus could not learn skirts from a trial; I made skirts a part each bureau takes up by generation instead, like its other new parts (heavy from 2001, gunnery from 2016, light never). The skirts follow-ups are done. Your next pick: track links (1.2.16.0), painted on, no extra triangles. I chose: bare steel on every paint scheme and every tank, rivals included; each link as long as the blueprint draws it (16 cm), with a dark gap, a pin and a guide horn down the middle; the picture is made by the game from a few numbers, so there is no file to fetch, and both tracks are one extra piece to draw. Your next pick: moving tracks (1.2.17.0). I chose: the links run at the tank's own pace, backwards when it backs up, still when it stands; past a steady crawl (0.4 of a link a frame) they go no faster, so a fast run or the endurance time-lapse never makes them flicker or seem to run backwards, as wheels do on film. Your next pick: turning wheels (1.2.18.0). I chose: every wheel turns, road wheels, sprocket, idler and return rollers, each at its own size's pace, so they keep step with the links and share their steady crawl; the wheels are now painted the plain base colour rather than the camouflage, as they are turned apart from the hull. Your next pick: track wear and mud (1.2.19.0). I chose: mud only, a brown laid over the tracks, wheels and lower hull, strongest at the bottom and fading out a little above the track tops; the turret stays clean, and the links and camouflage still show faintly through. How much: none on the acceleration strip or the firing range; a little on the obstacle course, much more once through its mud pit; on the endurance run it builds up with the distance, slowly on the road and faster on the earth tracks, hills and rough ground; in battle a set amount for each ground, as the tanks have come across the fields. No wear on the metal for now. Your next pick: camouflage back on the wheels (1.2.20.0): the pattern is laid on the wheels as on the hull and turns with them; the rubber stays dark. Your next pick: dust and spray (1.2.21.0): small puffs behind a moving tank, thicker and darker in the mud pit, and earth thrown up by tanks in battle. Your next picks, one at a time: exhaust smoke (1.2.22.0): a grey wisp from the engine deck, a dark plume when the tank pulls away or climbs; then wear on the metal (1.2.23.0): the paint on the hull and turret rubs through to bare steel in patches, a little on a trial tank, more over an endurance run; then gun recoil (1.2.24.0): the barrel snaps back when it fires and runs out again, and the hull rocks with the kick. Your next picks, one at a time: track marks (1.2.25.0): dark ruts under the tracks that narrow away; then muzzle blast dust (1.2.26.0): a ring of dust thrown up off the ground under the muzzle when a tank fires, drifting out and settling, on the firing range and in battle; then hit sparks (1.2.27.0): a spray of hot sparks thrown back off the plate where a round strikes, most when it bounces off, fewer when it goes through, falling and cooling from white to orange in half a second; the strike flash now sits where the round struck rather than in the middle of the tank, and turns with the turret. I split your pick: dents and scorch marks (1.2.28.0): where a round strikes, the paint is blackened in a soft patch that stays for the rest of the battle, with a bright gouge of bare steel at its heart where the round bounced off, or a dark hole where it went in; they move with the tank and turn with the turret; the last eight on the hull and eight on the turret show; no extra triangles, they are painted on in the tank's own shader. I chose to draw the dent as that bright gouge rather than bending the armour, which would cost triangles the battle does not have. Your last pick: engine sound (1.2.29.0): a real recording now, "Engine-loop heavy vehicle/tank" by Nayckron (from a car engine loop by qubodup), CC BY 3.0, from OpenGameArt, credited in the game's credits and in CREDITS.md. It loops under the old synth engine, which is turned well down; it plays faster as the engine works harder and drops back at each gear change, a multi-fuel engine a little slower and rougher, a bigger engine lower; a gas turbine keeps its synth whine and rush of air over it, as I found no free turbine recording that fits. The picks from this round are all in. Your next picks, one at a time, then back to the plan: track sound (1.2.30.0): the tracks are a real recording too, a winch's ratchet, "Chain winch sounds" by bart (CC0, OpenGameArt), credited; it loops under the synth clatter, turned down, and plays faster with speed so its clicks keep step with the links, within limits so it never drones or chatters; turbine recording (1.2.31.0): a gas turbine now has its own recording, a low steady roar, "Rocket Engine" by theMinesAreShakin (CC0, OpenGameArt), credited; it plays faster as the turbine spools up, with the synth whine kept over it; the diesel and multi-fuel engines keep their recording; then smoke on burning wrecks (1.2.32.0): a column of smoke now rises off every tank put out of the fight, puff after puff, swelling as it climbs about 15 m and leaning over in the wind; black where the tank blew up or burned, grey where it only stopped. It is worked out from when the tank went out, so it is the same column when you wind the replay back or on. I chose to drop the three still smoke balls that stood over a wreck before, to pay for it in the phone budget, and to draw each puff with a few triangles, smooth-shaded and rolling as it rises. The picks from this round are all in; next, back to the plan.

- **Blueprint quality (1.2.1.0 to 1.2.7.0).** Your picks from the pitch: all four tiers (detail pass, drawing-office furniture, paper finish, Blender part sketches) and a CC0 paper scan for the grain. Tier 1 came in two PRs: side view (1.2.1.0), then front, top and the cutaway (1.2.2.0). I chose: details follow the parts (the sprocket moves with the engine; no basket on bustle or unmanned turrets); no radio aerial, as it would make the whole drawing smaller on a phone. Tier 2 (1.2.3.0): I left out a drawing scale ("1:50"), as the drawing is sized to the screen and any scale would be wrong; the title strip says Metres instead. Figures are in metres to two places, like the old caption. Tier 3 (1.2.4.0): the grain covers the drawing board only (the strip with the drawing, weight bar and numbers), not the parts list, so text there stays clean; I kept it faint, especially in the Blueprint look, where a strong mottle made the labels look like stickers. Tier 4 (1.2.5.0): Claude installed Blender 4.2 LTS in its own container (not in the game), modelled simple game-level parts in a script (`art/part-sketches.py`) and drew them as ink lines. First batch is the 4 guns and 4 engines; a sketch shows only on the fitted option, under its note, so lists stay short. Kelbo said do them all: the second batch (1.2.6.0) is hull, turret, gun and ammunition parts; the last batch is fire control, powerpack, running gear, crew and protection. "None" options have no sketch.

- **Build screen, Scrapline style (1.1.1.0 to 1.2.0.0).** Your picks from the pitch: Idea A, one row open at a time, descriptions only on the fitted option. Step 1 of 3 is in. I chose: the drawing folds after about a thumb's flick (48 px) and comes back only when you tap Drawing, so it never jumps under your finger; the name, weight bar and numbers stay on screen; held sideways nothing folds. Switches (smoke, sandbox) keep their description, as they have only one option. Step 2: every row starts shut when you open a tab; a jump from Faults or the guide opens the right row; the tapped row stays under your finger when the one above closes. The Armour tab is unchanged for now. Switches (smoke, fire, lining) are rows too, so they take two taps; say if you would rather they switch straight from the row. Step 3: the game opens on the design list with every system shut; the bottom bar's Design button goes back to the system you left open, and a second tap shuts it; Designs moved onto the Saves page, above the save slots; opening Armour unfolds the drawing, because it is the protection map; the bottom bar shows "Design !" while the design has a fault that blocks trials.

- **The ☰ menu (1.1.0.0).** I read "housing setting" as "the menu holds the settings", so Sound and the Paper/Blueprint switch moved off the top bar into the menu; say if you meant something else. Graphics stays on the Trials tab and the menu links to it. Restart is still on the Bureau tab too.

- **Hull Down 1.0 (1.0.0.0).** Bumped to 1.0 as you asked, at the end of stage 18. Still yours: the cover, from the prompt Claude wrote. Not done: a short card clip recorded from the live game; Claude can record one with a test browser if you want it, say where it should go.
- **Releases (0.18.2.0).** Every merge that bumps the version now publishes a GitHub Release by itself. The first, v0.18.2.0, was published on 11 November; v1.0.0.0 follows with this merge. Old releases can be deleted on GitHub if you only want 1.0 and later listed.
- **Credits (0.18.1.0).** Claude put the credits at the foot of the Saves tab, folded shut, next to the offline line. Say if you would rather have them somewhere else.
- **Launch (0.18.0.0).** Kelbo's answers: 1.0.0.0 at the end of stage 18 without asking again; the cover is made by Kelbo from a prompt Claude wrote; the studio site listing already exists, so no PR there.
- **Challenge screen (0.17.5.0).** I chose: it sits at the top of the Bureau tab, above the sandbox; trials on the Trials tab use the day's pass marks while it is on; the shared text carries no name. Say if you want it somewhere else, or a streak count added.
- **Challenge of the day (0.17.4.0).** I chose: the day changes at midnight on the player's own clock, so two players in different time zones share a challenge by date, not by the hour; every part of that tender's generation is open, as in the sandbox; a rival is now and then thrown out when the day's cost ceiling is tight (about one day in twenty), which I left in as it reads as part of the story. Say if you want any of these changed.
- **Offline (0.17.3.0).** I chose: the home screen line lives at the bottom of the Saves tab, since the game has no menu of its own; the whole game is kept for offline play, the 3D range included (about 1.4 MB on the phone); after a deploy the new version shows on the second open, not the first. Say if you want any of these changed.
- **Tender weights (0.17.2.0).** I chose which tender wants what: 1981 firepower and mobility (it is the night-shooting tender), 2001 armour and firepower as before, 2016 a cheap, reliable tank in numbers. The 2016 roof tests are still there, so a cheap tank must still hold a bomblet. The Type 1 with the night sight fixed still wins the first tender on every seed tried. Say if you would rather the order was different. The light rival still never wins before 2016.
- **Sandbox (0.17.0.0).** I chose: the switch lives at the top of the Bureau page; trials in the sandbox still use the current tender's marks and opponents; the 1980s and 1990s share one choice because their weight limit is the same (44 t). Say if you want the switch somewhere more obvious. Still to come in PR 17: bot designers for balance, offline play and install, challenge of the day.
- **Wind outdoors (0.16.4.0).** Very quiet on purpose, under the engine. Say if you cannot hear it at all on the phone speaker, or if it reads as hiss rather than wind. With this, the sound pass (plan PR 16) is done apart from the range officer voice, which needs your yes on the quote below. Next is plan PR 17 (sandbox, balance, offline).
- **Sound in the office (0.16.3.0).** You asked for every tap to click. The click is deliberately very quiet; the pencil, warning and stamp are louder. Say if the click gets tiresome (it can drop to key moments only) or if any of the four is the wrong sound. Still to come in PR 16: wind outdoors (your pick), then the cue map is complete.
- **Sound in the battles (0.16.2.0).** I chose: you hear the fight from the tank the camera follows (switch camera, switch ears); sounds halve in loudness every 350 m but never vanish; at most four new bangs per picture so a salvo is not a wall of noise. The three new strike sounds (ricochet, held, penetration) are synth only and are first guesses: say if you cannot tell them apart by ear. Still to come in PR 16: the office and ambience.
- **Free recordings** (0.16.1.0): three public-domain (CC0) recordings
  from OpenGameArt are now laid over the synth: a cannon shot for the
  gun, a steel ring for a hit, a thud for a round that falls short. A
  miss stays synth only (I found no free recording of a round going
  by). They add 43 KB, fetched only when sound first starts, and each
  has its line in `CREDITS.md`. I picked them by description and by
  measuring them, not by ear: if one sounds wrong, say which and I
  will swap it or drop back to the synth for that sound.
- **Sound, first slice** (0.16.0.0): the range playbacks now have sound,
  all of it made in the browser with no files. The engine note comes
  from the engine you fitted (a diesel chugs, the multi-fuel is rougher,
  the turbine whines) and rises and falls through the gears; the tracks
  clatter with speed; the gun is lower and longer the bigger the
  calibre; and a hit (the board rings), a miss (the round tears past)
  and a round that falls short (a thud in the ground) each sound
  different. A "Sound on / Sound off" button sits beside Blueprint and
  is remembered. **I cannot hear it from here**, so every level is a
  first guess: tell me what is too loud, too quiet or just wrong and I
  will retune `src/data/audio.ts`. Still to come in PR 16: battles,
  then the office.
- **Range officer voice: the quote you asked for.** Nothing has been
  generated. The script sheet, 12 short lines, one speaker:

  | Line | Speaker | Text | File | Characters |
  | --- | --- | --- | --- | --- |
  | RO-01 | Range officer | Range is clear. Carry on. | `public/audio/voice/ro-01-range-clear.mp3` | 25 |
  | RO-02 | Range officer | Target up. | `public/audio/voice/ro-02-target-up.mp3` | 10 |
  | RO-03 | Range officer | Hit. | `public/audio/voice/ro-03-hit.mp3` | 4 |
  | RO-04 | Range officer | Miss. Short. | `public/audio/voice/ro-04-miss-short.mp3` | 12 |
  | RO-05 | Range officer | Miss. Over. | `public/audio/voice/ro-05-miss-over.mp3` | 11 |
  | RO-06 | Range officer | Miss. Left. | `public/audio/voice/ro-06-miss-left.mp3` | 11 |
  | RO-07 | Range officer | Miss. Right. | `public/audio/voice/ro-07-miss-right.mp3` | 12 |
  | RO-08 | Range officer | Target down. No shot fired. | `public/audio/voice/ro-08-no-shot.mp3` | 27 |
  | RO-09 | Range officer | Target not seen. | `public/audio/voice/ro-09-not-seen.mp3` | 16 |
  | RO-10 | Range officer | Stoppage. The loader has a jam. | `public/audio/voice/ro-10-jam.mp3` | 31 |
  | RO-11 | Range officer | Cease fire. Shoot complete. | `public/audio/voice/ro-11-cease-fire.mp3` | 27 |
  | RO-12 | Range officer | Breakdown on the lane. Recovery is on its way. | `public/audio/voice/ro-12-breakdown.mp3` | 46 |

  That is 232 characters. ElevenLabs charges about one credit a
  character on its standard voice models, so **about 232 credits for
  one take of every line, about 464 if it makes its usual two takes
  to choose from**, out of your 2,700. I would pick one stock voice (no
  credits to pick) and ask for one take first. The exact figure shows
  before anything is spent; if it is more than 464 I stop and ask
  again. Say yes, change the lines, or say no and the range stays
  wordless.
- **Picture quality** (0.15.3.0): a setting on the Trials tab, Auto,
  High, Medium or Low, as you chose. On Auto the game times each 3D
  playback and steps down a tier if it runs under 40 frames a second
  (straight to Low under 22). It never steps back up by itself; picking
  Auto again starts from High. The last frame rate measured is shown
  under the buttons, so you can read it off your phone and tell me.
  This finishes plan PR 15 as you sliced it. Blender, built in Actions,
  is still open if the code-made shapes look too plain to you.

- **Scenery on the range** (0.15.2.0): the strip, the obstacle course
  and the three shoots now have conifer woods on both sides, low hills
  on the skyline, a range tower by the start and red flags at each end.
  All made in code, about 5,000 triangles at most. The camera side is
  kept clear further out so no tree blocks the view. The endurance run
  and the battles are as they were (the battles already have woods and
  ridges); say if you want those dressed too, or other props (sheds,
  fences, wrecks as hard targets).

- **The paint shop** (0.15.1.0): four schemes to start, picked on the
  Trials tab: Plain green, Sand, Three colour, Winter whitewash. Looks
  only, as you chose: no mark, weight or cost changes, and a repaint is
  not a new revision. The names, the colours and the list itself are my
  working picks; say if you want others (a desert two-tone, a digital
  pattern, a parade finish). The enemy keeps its own tan in battles so
  the two sides never look alike. The office drawings stay ink on paper.

- **The tank on the range** (0.15.0.0): first slice of the art pass. You
  chose: parts made in code first (Blender later if it still looks
  plain), paint as a cosmetic pick, graphics tiers automatic with a
  switch, and the tank first. The tank at the trials and in battles now
  has a track loop with cut corners, a sprocket and idler, track guards,
  an engine grille, a mantlet, a fume extractor, the commander's hatch
  and sight head, smoke launchers, and a different shape for each of the
  five turrets. Reactive tiles show where the design carries them: a
  panel on the glacis, panels hung over the tracks, blocks beside the
  gun and strips along the turret. The turret shapes and all the sizes
  are my picks, in `RENDER.tank`. A tank is at most 1,100 triangles and
  six meshes, so eight still fit on a phone. Say if any turret looks
  wrong against its blueprint. Still to come in PR 15: paint and
  camouflage, the ranges and props, graphics tiers and the frame-rate
  check.
- **The guided first contract** (0.14.2.0): Kelbo chose "guide plus
  gentler rivals". The guide is a card at the top of every tab during
  the first tender: fix the night sight, build the prototype, read the
  report, enter. It follows the career, so it is right after a reload,
  and "Hide the guide" puts it away (it can be brought back). The
  gentler rivals are my pick of how: on the first tender only, the other
  bureaus enter the tank they first drew and make no revisions. A player
  who fits the better night sight and nothing else wins 38 careers in 40
  (it was 8 in 40). The side effect to know about: a player who changes
  nothing now wins about 25 in 40, where it was 2 in 40. From the second
  tender the rivals revise as before. Say if the first tender is now too
  easy, or if any of the guide's wording reads wrong.
- **Active protection and electrical power** (0.13.2.0): a new choice on
  the Crew and protection tab. Soft kill (generation two, research
  Kr 4.0M; 0.25 t, Kr 320,000, draws 4 kW) throws off about half the
  guided missiles and does nothing about rockets. Hard kill (generation
  three, research Kr 9.0M after soft kill; 0.9 t, Kr 1.1M, draws 12 kW)
  shoots down about four in five rockets and missiles, top-attack
  included. Neither touches a round from a gun or a bomblet from a drone,
  so the roof still needs its plate. The tank makes 8 kW from its
  generator and 8 kW more with the auxiliary power unit, so hard kill
  cannot be fitted without the unit: a new fault says so. Readouts shows
  power drawn and made. For now it counts at the armour trial only; duel
  and battle opponents fire gun rounds, which it leaves alone. All
  numbers, and soft kill arriving with the tender of 2001, are my picks
  (the plan says "generations two and three").
- **Roof threats** (0.13.1.0): the range of 2016 fires three new serials.
  A drone bomblet (goes through 70 mm) is dropped on the turret roof and
  the hull roof, and both must hold or the armour test is failed. A
  top-attack missile (280 mm) is fired at the turret roof for the record
  only. The Type 1's roof (20 mm hull, 35 mm turret) lets every bomblet
  through. A composite sandwich on both roofs (10 mm steel, 40 mm layered
  composite, 10 mm steel) holds for about 2.3 t. Tiles alone do not pass,
  because hatches and grilles stay bare, but tiles over a good plate stop
  the missile wherever a tile sits. Nothing passive stops the missile
  everywhere: that is the job of active protection, next. Rival bureaus
  get no new roof parts yet; they thicken a roof that failed, as they do
  any plate. Threat names ("Drone bomblet", "Top-attack missile") and all
  numbers are my picks.
- **The tender of 2016** (0.13.0.0): a third tender, "A tank for a watched
  battlefield", opens after the tender of 2001. Weight limit 48 t (the
  Pact rebuilt its bridges: a new rule I made up, so the roof armour and
  protection systems to come have room), unit cost up to Kr 8.00M, grant
  Kr 60M, protection weighed at 35 in 100. Only the Palisade B is named
  as a threat so far and the trial marks are those of 2001: the
  generation-three parts and threats (active protection, top attack,
  drones, the unmanned turret) arrive in the next slices. Name, brief and
  every number are my picks.
- **Export trials** (0.12.3.0): before it orders, a customer runs twelve
  of the tank over the endurance run on its own ground. Desert: cooling
  manages 85% of its rating. Jungle: the ground pounds the suspension and
  tracks 10% harder. Mountain: the climbs work the engine and transmission
  10% harder. A good trial (about a stop for every three tanks or fewer,
  none towed in) keeps the whole order; a poor one halves it; a bad one
  leaves a quarter. The desk says, before you sell, which parts would be
  worked past their rating there, so a cut order is never a surprise. All
  the numbers are my picks. The trial is a report in words, not a 3D
  scene: say if you want the customer's ground as a watchable trial with
  its own light, which the plan mentions and which would be a bigger job.
  This finishes plan PR 12; next is PR 13, generation three.
- **Export variants** (0.12.2.0): the design on the drawing board can be
  sold to a customer as a version of a tank in service. It keeps the
  tank's hull, turret, gun, loading and running gear (the same line builds
  it) but may change the cooling, fuel, sights, armour and the rest. The
  bureau pays one tank's cost to work it up, then takes the 3% fee. It is
  called by the tank's designation plus a mark: "-D" for Dahrat, "-J" for
  Ilandu, "-M" for Tolmar (so "Model 81-D"). The same ministry rules apply
  as for a plain sale. The marks, the work-up cost and what a version may
  change are my picks. The Export desk card has a button to put a tank in
  service on the drawing board as a starting point.
- **Export sales** (0.12.1.0): a tank in service that suits a customer can
  now be sold from the Export desk card. Each customer orders once. The
  bureau's fee is 3% of the order at the tank's own unit cost (a Kr 2.27M
  tank sold to Dahrat's 120 pays Kr 8.16M) and goes straight into the
  budget; the
  ministry thinks 3 better of the bureau for each sale. The ministry
  refuses the licence in two cases: the tank carries anything the bureau
  researched (digital fire control, thermal sight, layered armour, the
  bureau's own rounds), or the ministry's opinion of the bureau is under
  40. All of these rules and numbers are my picks. The "no research
  abroad" rule is there to give the "simpler sights" variants of the next
  slice a reason; say if you would rather the ministry decided another way.
- **Export customers** (0.12.0.0): the export desk opens on the Bureau tab
  once the army has adopted a tank. Three customers, all working names:
  "Emirate of Dahrat" (desert: heavy-duty cooling, 450 km range, at most
  Kr 2.60M; 120 tanks), "Republic of Ilandu" (jungle: at most 38 t and
  0.82 kg/cm², at most Kr 2.00M; 60 tanks), "Kingdom of Tolmar" (mountain:
  20 hp/t, 7° of gun depression, at most Kr 2.80M; 80 tanks). Names, what
  each asks and the order sizes are my picks. The Type 1 as issued suits
  none of them, on purpose. The desk only reports for now: sales, ministry
  approval, variants and export trials are the next slices.
- **Rivals in the tender of 2001** (0.11.6.0): the three rival bureaus now
  fit generation-two parts there. The heavy bureau takes layered armour, a
  thermal sight and the tandem warhead; the light one the long rod and the
  tandem warhead; the firepower one the digital computer, a thermal sight
  and the gun-launched missile. Which bureau takes what is my pick. **To
  know:** this makes them look and fight like tanks of 2001, but it barely
  moves their marks (38 to 60 out of 100, as before), because the new parts
  cost about as many marks as they earn. If the tender of 2001 is too easy
  to win, that is a numbers question (how the army weighs cost against the
  new parts) for the balance pass: tell me how it feels.
- **The bureau's own ammunition** (0.11.5.0): three rounds to research and
  then pick on the Gun tab. "Long rod" (Kr 5.00M to research; goes through
  a quarter more, loses less with range; too long for a carousel
  autoloader; Kr 1,500 a round). "Tandem warhead" (Kr 4.00M; a tenth more,
  and reactive tiles do little against it; Kr 1,000 a round). "Gun-launched
  missile" (Kr 7.00M, needs Digital fire control; slow, very accurate,
  goes through 30% more; smoothbore and digital computer only; Kr 6,000 a
  round). Names, numbers and what each asks of the tank are my picks. Two
  things to know: a tank carries one kinetic and one shaped round, so the
  missile takes the place of the shaped charge; and the trial reports still
  call the round by its Pact name ("125 mm sabot") even when it is a long
  rod. Rivals carry Pact rounds only.
- **Intelligence files** (0.11.4.0): the Bureau tab now has a file on each
  Accord tank the tender names, with figures as ranges that close in on
  the truth. Four grades: Rumour (25% either way), Report (12%), Assessed
  (5%), Confirmed. A file gains a grade for each prototype built and when
  the army decides, and two for each tender since. The Warden is confirmed
  from the start. **Design question for you:** the files are for reading
  only so far. The armour test shot, the chief engineer and the duels all
  still use the true figures, so nothing "turns out better than feared"
  yet. Making the estimates bite (the office only shows you the estimate
  until the file is confirmed) is a bigger change: say if you want it.
- **Research** (0.11.3.0): the generation-two parts now have to be
  researched before they can be fitted. Three projects on the Bureau tab:
  "Digital fire control" Kr 4.00M, "Thermal imaging" Kr 6.00M (needs the
  digital one first), "Layered armour" Kr 5.00M. Paid once, kept from tender
  to tender. Names, prices and the one dependency are my picks. All three
  cost Kr 15M of the Kr 40M grant, so a bureau that buys everything has
  less left for revisions: say if that is too tight or too easy. Rivals and
  the Accord do not pay for research.
- **The tender of 2001** (0.11.2.0): "A tank for the new century". Still
  44 t, unit cost up to Kr 5.00M, grant Kr 40M added to whatever the bureau
  has left, threats Palisade and Palisade B, firepower weighed as heavily as
  protection. My picks; say what you want changed. Three things I chose
  that you may want otherwise: leftover budget carries over; a tank in
  service can take generation-two parts in an upgrade once the bureau is on
  the 2001 tender; and the office proving ground now marks to the tender's
  own standard (so the first tender's night shoot asks for 4 hits there too,
  as the army always did). The rival bureaus do not reach for
  generation-two parts on their own yet, so the 2001 tender is easy to win.
- **New Accord kit** (0.11.1.0): "Palisade B" (the Palisade rebuilt, for
  generation-two tenders), and three rounds: the 120 mm long rod, the tandem
  rocket and the tandem missile. A tandem warhead gets back all but 15% of
  what a reactive tile adds. Names and numbers are my picks. The new rounds
  can already be chosen on the Armour tab so you can try them.
- **Generation two parts, first three** (0.11.0.0): a thermal sight, a
  digital computer and a layered composite armour insert. They show in the
  office as locked ("Generation 2") until a later tender opens them. The
  names and numbers are my picks; say if you want others. More parts come
  with the rest of PR 11.
- **The archive stays on the phone** (0.10.4.0): it is kept in this
  browser and survives a new career, but it is not in the save code or the
  backup file yet. Say if you want it carried in those.
- **Try an upgrade** (0.10.3.0): with a tank in service, read the year 1
  report. If the army opens a contract, tap "Put the service tank on the
  drawing board" twice, change something that answers it (Crew tab,
  Improved comfort eases the crew's work), come back to Bureau and fit it.
  The loaded tank replaces the design on the board, keeping its name. Say
  if you would rather it opened as a new design.
- **Upgrade contract numbers** (0.10.2.0): my picks, yours to change. A
  package costs one tank's price to work up, pays 4,000,000 kr, gives army
  +3 and ministry +1. It must add 4 reliability points, or 10% on the plate
  named, or cut the first shot 10%, or take 4 off workload, or add 10
  comfort. Three packages a tank (A, B, C).
- **Try a tank in service** (0.10.1.0): win the tender (a Type 1 with
  the image-intensifier night sight and the laser rangefinder usually
  does), then on the Bureau tab set production and read the six field
  reports. Say if the reports read clearly and if the choices feel like
  real ones.
- **How service life works** (0.10.0.0), decided without you and easy
  to change.
  - Production is set once, when a tank is adopted. Rate: slow (60 a
    year, 6% dearer, fewer faults), steady (120), rush (200, 3%
    cheaper, 30% more faults; the army and the ministry like the speed,
    +2 each, and dislike slow, -2 each). Quality: economy (10% cheaper,
    half as many faults again), standard, careful (12% dearer, a third
    fewer faults). Over the tender's cost ceiling costs 3 with the
    ministry. The army orders 600.
  - A field report for each of 6 years. There is no "next contract"
    yet to hang them on (only one tender exists), so each is asked for
    with a button. When later tenders exist, finishing one can bring
    the report instead.
  - A report has four parts: 40 tanks followed over a year's running;
    what conscript crews complain of (an overworked station, a tank
    that is hard to live in, a tank only experts can shoot, three men
    doing four men's upkeep); conscripts against the range's crew at
    the firing camp; and an exercise, a platoon with conscript crews
    against the tender's threat tanks with trained crews, a different
    ground each year.
  - Each report moves standing by a point or two, and pays the bureau
    1% of the cost of the year's tanks (about Kr 2.5M a year for the
    Type 1 at the steady rate).

- **Watch a battle in 3D** (0.9.3.0): say if the director's camera
  shows the right things, and if it runs smoothly on your phone. Platoon
  battles are open from the Trials tab for now; the plan has them
  unlocked by passing the gates, which I have left for the career work.
- **Try a battle** (0.9.1.0): Trials tab, "Send a platoon to battle".
  Say if the two orders read clearly and feel like real choices, and if
  the results look fair (the Type 1 as issued holds a ridge well against
  the Warden and badly against the heavy rival, and loses to the
  Palisade everywhere).

- **How a platoon battle is fought** (0.9.0.0), decided without you and
  easy to change. You can judge these once the battle screen is in:
  - Grounds: hold a ridge (3 of yours against 4), a meeting (4 against
    4), attack a ridge (4 of yours against 3), a night meeting (3
    against 3). Called off after 10 minutes.
  - Your two orders. Range: "long" opens fire as soon as a target is
    seen and an attack stops at the last ridge; "close" holds a
    defender's fire to 1,000 m and sends an attack on into the open.
    Pace: "careful" moves half the platoon at a time and stops to shoot;
    "fast" goes straight on and shoots on the move. For a defender,
    "fast" means shifting along the ridge after every three rounds.
  - A tank behind a ridge that has not fired is not seen by day beyond
    about 900 m. A holding platoon wins if the attack runs out of time.

- **Try the saves** (0.8.7.0): Saves tab. Send yourself a save code and
  paste it back, ideally on another device.
- **Try a tender** (0.8.6.0): Bureau tab. Tell me if the Type 1 as issued
  placing third of four feels right, and whether the tab reads well on
  your phone.
- **The chief engineer's name** (0.8.5.0): working name Radek Stanek.
  Say if you want another.
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

- **1.3.0.1, visit counts.** Kelbo asked for Cloudflare Web Analytics on every Longlight game. A cookieless beacon at the end of `index.html` counts visits and load speed; nothing about the player or the saves. The loading screen ignores it if an ad blocker stops it. It shares the studio's zone-wide analytics site (the free limit of 11 sites is used up).
- **1.3.0.0, the casemate.** Tank destroyer step 1. A new turret shape: the gun in a low box on the hull behind a steep front plate. Lighter and cheaper, its gun needs a ring 30% smaller, but it lays on each new target 60% slower and the gun swings only 12° each way. Allowed only on a tank destroyer's tender (none yet) and in the sandbox, with its own blueprint, sketch and 3D shape.
- **1.2.32.0, smoke on burning wrecks.** A rising, wind-blown column of smoke off every tank put out of the fight, black where it blew up or burned and grey where it only stopped. It replaces the three still smoke balls and stays inside the phone budget.
- **1.2.31.0, turbine recording.** A gas turbine now has its own recorded roar ("Rocket Engine" by theMinesAreShakin, CC0, from OpenGameArt), looped under its synth whine and played faster as it spools up. The diesel and multi-fuel engines keep their chug. Credited in the game and in CREDITS.md.
- **1.2.30.0, track sound.** The tracks are a real recording now: a winch's ratchet, "Chain winch sounds" by bart (CC0, OpenGameArt), credited in the game and in CREDITS.md. A steady 2 s cut from it loops seamlessly under the synth clatter and plays faster with speed, its clicks keeping step with the track links. 32 KB, fetched when the sound first starts.
- **1.2.29.0, engine sound.** The tank engine is a real recording now: "Engine-loop heavy vehicle/tank" by Nayckron, from a car engine loop by qubodup (CC BY 3.0, OpenGameArt), credited in the game and in CREDITS.md. It loops seamlessly under the synth engine, faster as the revs climb and falling back at each gear change; bigger engines sound lower; a turbine keeps its whine over it. 64 KB, fetched when the sound first starts.
- **1.2.28.0, dents and scorch marks.** Where a round strikes a tank in battle, a blackened patch stays on the paint for the rest of the fight, with a bright gouge of bare steel where it bounced off, or a dark hole where it went in. They ride with the tank and turn with the turret; the last eight on the hull and eight on the turret show. Painted in the tank's own shader, so no extra triangles; rewinding takes them off again.
- **1.2.27.0, hit sparks.** Where a round strikes a tank in battle, a spray of sparks flies back off the plate, falling and cooling as it goes: twelve when it bounces off, seven when it goes through, six off the tracks. The strike flash now sits at the place the round struck, turned with the turret. One small glowing pool for the whole battle, inside the phone budget.
- **1.2.26.0, muzzle blast dust.** When a tank fires, the blast throws up a ring of pale dust off the ground under the muzzle, which drifts outward and settles over about a second and a half. On the firing range and in battle; it uses the same dust pool as the track dust, so no extra drawing cost.
- **1.2.25.0, track marks.** A moving tank now leaves two dark ruts on the ground under its tracks: faint on the concrete strip, darker on earth, darkest in the mud pit. They narrow away after about fourteen seconds of watching, and winding a replay back wipes the ground clean. In battle every tank still fighting leaves ruts the way it drives. Each rut is two triangles in one shared mesh, so the eight-tank battle stays inside the phone budget (the battle's dust pool is a little smaller to make room).
- **1.2.24.0, gun recoil.** When a tank fires, in the shooting trial or in battle, its barrel now snaps back a short way and slowly runs out again, and the hull rocks back with the kick and settles. The barrel moves in the shader, like the wheels turn, so the tank is no more meshes than before.
- **1.2.23.0, wear on the metal.** The paint on the hull and turret now rubs through to bare steel in small patches, more on the faces looking up (the deck, the turret roof) than on the sides. A trial tank shows a few scuffs; an endurance run wears it more with every kilometre; a battle tank has seen some use. Mud still covers the wear low down, the camouflage shows round the patches, and the wheels and tracks are left alone. No extra meshes: it is laid on in the same per-tank paint as the mud.
- **1.2.22.0, exhaust smoke.** A tank on the range or in battle now breathes exhaust from its engine deck (at the back, or the front for a front-engined design): a thin grey wisp while it cruises or stands, and a thick dark plume that blows back over the hull when it pulls away or climbs. It shares the dust's one-mesh pool, so the battle stays inside the phone budget. Knocked-out tanks stop smoking this way.
- **1.2.21.0, dust and spray.** A tank on the move now leaves small puffs behind both tracks that swell, rise and fade: pale and thin on the concrete strip, earthy on the obstacle course, and dark, thick mud flung higher in the course's mud pit. Tanks in a battle kick up earth as they drive. Every puff is a copy of one shape, so a whole cloud is drawn as one thing and the eight-tank battle stays inside the phone budget. Endurance laps throw none (a lap is hours long, so a puff would be gone before you saw it).
- **1.2.20.0, camouflage on the wheels again.** A camouflaged tank's wheels carry its pattern once more, and it turns with them; plain paint schemes are unchanged.
- **1.2.19.0, mud on the tanks.** A hard run now shows: tracks, wheels and lower hull take on mud, building up over the endurance run, coming on through the obstacle course's mud pit, and already there in battle. The turret stays clean; the strip and the firing range leave the tank clean.
- **1.2.18.0, the wheels turn with the tracks.** Road wheels, sprocket, idler and return rollers now turn as the tank drives, at trials and in battle, each in step with the moving links. No extra triangles; on camouflaged tanks the wheels take the plain base colour.
- **1.2.17.0, the tracks run round as the tank drives.** At trials and in battle the links now move round the wheels as each tank moves, at its own pace, and stop when it stops. Above a steady crawl they move no faster, so fast runs and the endurance time-lapse do not flicker.
- **1.2.16.0, track links on the trial tanks.** The tracks at trials and in battle are no longer a plain dark band: each shows its links, bare steel with a dark gap between them, a pin and a guide horn, the same on every paint scheme. The links are painted on, so a tank has no more triangles than before; both tracks together are one more piece to draw.
- **1.2.15.0, rival bureaus hang side skirts.** The armour-first bureau fits skirts from the 2001 tender, alongside its tandem warheads; the gunnery-first bureau from the 2016 tender; the light bureau never, as it fights for every tonne. The balance check still passes: the armour-first bureau wins 21 of the 24 runs of the 2001 tender instead of 23, as the skirts' 0.6 t comes off its armour.
- **1.2.14.0, side skirts on the blueprint.** With skirts fitted, the side view hangs a row of bolted plates from the track guard, and the wheels, rollers, sprocket and idler behind them become dashed hidden lines; the front and top views show a thin plate outside each track.
- **1.2.13.0, side skirts.** A new switch on the Running gear tab: side skirts, thin plates hung over the tracks outside the wheels. They weigh 0.6 t and cost 25,000 kr, and take nothing from inside. At trials, a round that comes through the tracks to the lower hull side loses 80 mm more if it is a shaped charge and 10 mm more if it is not. The protection map leaves them out, as it does the tracks. The trial tanks wear a row of the kit's skirt plates when they are fitted, and the side tiles hang on the skirts. Old saves and save codes come in with skirts off. The rival bureaus do not fit them yet.
- **1.2.12.0, the tank kit in the trials: tile panels.** Trial tanks wear the kit's tile panels wherever the design carries tiles (glacis, hull sides, turret cheeks and sides), in the tile colour with dark frames. A tank tiled all over may run to 6,500 triangles.
- **1.2.11.0, the tank kit in the trials (4 of 4): the hull.** The trial tanks have a new hull, still built from your design's own measurements: the upper hull reaches out over the tracks as sponsons, bevelled underneath, its sides leaning in to a chamfered roof, and the tail slopes down at the back. The flat track guards are gone. The engine grille is now the kit's engine deck with its slats, wherever the engine sits. Reactive tiles are still plain blocks for now.
- **1.2.10.0, the tank kit in the trials (3 of 4): turrets.** Each of the five turrets now has its own modelled shape in the trials: the cast dome, the flat low profile, the welded wedge with its arrowhead cheeks, the bustle turret with its long overhang and basket rails, and the low unmanned turret with its gun carried in a cradle on top and a sensor mast. The mantlet, the gun (with its fume extractor and bands), the commander's cupola with periscopes, the sight head and the smoke launchers come from the kit too. The gun now sits where each turret was modelled to carry it, so shots and the muzzle flash start from there. If the kit cannot load, the old shapes are drawn. The hull is next.
- **1.2.9.0, the tank kit in the trials (2 of 3).** The running gear on every trial tank now comes from the kit: spoked road wheels, a toothed sprocket at the engine end, an idler at the other, three return rollers a side, and a hollow track loop you can see the wheels through. The kit (about 120 KB) loads alongside the trial scene and is kept for offline play; if it cannot load, the old simple wheels are drawn instead, so a trial never fails for want of it. A tank is now up to about 5,000 triangles (your pick), so the eight-tank battle budget went up to match. Hull and turrets are still the old shapes; they come next.
- **1.2.8.0, the tank kit (1 of 3).** The trial tanks have a kit of 18 pieces, modelled in Blender for this game: five turrets, two mantlets, the gun, road wheels, sprocket, idler, return rollers, skirt panels, reactive tiles, smoke launchers, cupola, sight head and engine deck. Nothing on screen changes yet; the trials start using it in the next two steps. A check in GitHub rebuilds the kit from its script each time it changes, so the file always matches.
- **1.2.7.1, repo housekeeping.** Nothing in the game changes. From the studio security cycle: the build no longer keeps its GitHub login after checking out the code, `.env` files can never be committed, and Dependabot will open one grouped pull request a month for small package updates (major versions and three.js are left to do by hand).
- **1.2.7.0, part sketches (last batch).** Sketches now cover fire control (sights, rangefinders, stabilisers, computers, night sights, the commander's sight), the powerpack (transmissions, cooling, auxiliary power), running gear (suspension), crew comfort and protection (smoke, fire suppression, spall liner, active protection): 30 more, 66 in all. Every part with something to draw has one.
- **1.2.6.0, part sketches (second batch).** Sketches now cover the hulls, engine position, turrets, barrels, recoil mounts, loading, ammunition stowage and the rounds: 28 more. The guns and engines were drawn again a little larger, after a framing fix.
- **1.2.5.0, part sketches (first batch).** The fitted main gun and engine now show a small line sketch under their description, modelled and drawn in Blender for this game and painted in the page's ink, so it suits both looks. Eight so far: the four guns and the four engines.
- **1.2.4.0, paper you can feel.** The drawing board now has faint paper grain in the Paper look, and a soft cyanotype mottle in the Blueprint look, from two CC0 paper scans (ambientCG Paper 001 and 003, credited in CREDITS.md). The lines stay crisp. About 85 KB more on first load.
- **1.2.3.0, the drawing on its sheet.** Each view now carries dimension lines with arrowheads and the figures on them (hull length, length with the gun, height, width), corner marks round the sheet, and a title strip under it (Side elevation · Sheet 1 of 3 · Metres) in place of the old caption line. The figures are text laid over the drawing, so they stay readable on a phone.
- **1.2.2.0, sharper front, top and cutaway (blueprint detail, 2 of 2).** The front view gains track guards, the tracks end on with link plates and guide horns, headlights, the driver's vision block, tow hooks, the turret's casting line, sight window, coaxial gun port, mantlet bolts, muzzle ring, periscopes and smoke dischargers end on. The top view gains grille slats, two cooling fans, guard seams, stowage bins, headlights, tow hooks, turret periscopes, a vent and the basket. The cutaway hatches the armour where it is cut, the drawing-office way.
- **1.2.1.0, a sharper side view (blueprint detail, 1 of 3).** The side drawing gains road wheels with a tyre line and bolt circle, track links, a toothed drive sprocket at the engine end and a spoked idler, return rollers, a track guard, an engine grille, tow hooks, a weld seam, the turret's casting line, periscopes, a stowage basket, and barrel bands with a muzzle ring. It is drawn in three line weights now. The share card picks up the detail too.
- **1.2.0.0, the new build screen (3 of 3).** The sideways strip of 14 tabs is gone. The design is one list of systems (Hull to Crew and protection, then Readouts and Faults); each row shows what is fitted and a ✕ if it has a fault, and opens to its part rows. A bar along the bottom holds Design, Trials, Bureau and Saves; your saved designs are on Saves.
- **1.1.2.0, part rows (2 of 3).** On the part tabs every control is now one row: its name, what is fitted, and a ✕ if it has a fault. Tap a row to open its options; opening another closes it. The readouts under the parts (ammunition, gunnery, crew stations) fold the same way. The Hull tab goes from about 1,100 px of scrolling to 450 px, Fire control from 3,200 px to under 1,000.
- **1.1.1.0, a shorter build screen (1 of 3).** Each part option is now one line: its name, then the weight and cost it changes, with the description shown only for the fitted one. On a phone held upright the drawing folds away once you scroll the parts, so the list gets about twice the room; tap Drawing to bring it back.
- **1.1.0.0, the ☰ menu.** A menu button in the top bar opens a sheet that holds the settings (sound, paper or blueprint look, a way to the graphics settings), quick ways to the bureau, saves and credits, and "start a new career" (tap twice). Opening it pauses any trial or battle that is playing.
- **1.0.0.0, PR 18: Hull Down 1.0.** The launch version. Crash screen, credits, brand check and releases (PR 18a to 18c) are in; the studio site already lists the game. This merge publishes the v1.0.0.0 release.
- **0.18.2.0, PR 18c: brand check and releases.** `tests/brand.test.ts` holds the studio pieces to the Longlight brand: the official logo files unchanged, the splash in brand colours and Space Grotesk, the credit line, the full studio name and the studio link. `publish-release.yml` publishes a GitHub Release (`v<VERSION>`) each time the version changes on `main`, with that version's line from this log as its notes; a test now fails if a version has no log line.
- **0.18.1.0, PR 18b: credits in the game.** A folded Credits list at the foot of the Saves tab: the studio line, then every font, sound and library with its maker, licence and a link to its source. A test keeps it in step with `CREDITS.md`.
- **0.18.0.0, PR 18a: the crash screen.** If the game breaks, the page is replaced by a plain account, the save code read from what the browser last kept (copy or backup file), a button to start again, and a short fault report (version, fault, browser; nothing about the player). Harmless browser complaints do not trigger it. Add `#crash-test` to the address to see it.
- **0.17.5.0, PR 17f: the challenge of the day on screen.** The Bureau tab opens with the day's challenge: the date, the brief, what the army weighs, and a switch, Work on the challenge. With it on the office works to the day's limits with every part of that time unlocked, the proving ground uses the day's marks, and the career waits (the sandbox and the challenge switch each other off). Enter this design runs the day's trials and shows the order of merit against the three rival bureaus. Kelbo chose as many tries as you like, best counts: the best of the day and the number of tries are kept on the device (`hulldown.daily`) and start afresh at midnight; entering the same design twice is one try. Kelbo chose a short text to copy: four lines with the date, the brief, the placing and the game's address. With this, plan PR 17 is done.
- **0.17.4.0, PR 17e: the rules of the challenge of the day.** No screen yet; that is the next slice. Kelbo chose a one-off tender each day. The date alone decides it (`src/sim/career/daily.ts`, numbers in `src/data/daily.ts`): which career tender it stands on (its technology, proving ground and threats), what the army wants most (armour, gun, pace, upkeep, price or all-round), and how far the weight limit (0, 2 or 4 t) and the cost ceiling (to 90 % or 80 %) are tightened. The three rival bureaus bid as in a career tender, and the player's design is placed among the four. A best-try rule (place first, then marks) is ready for the screen. Nothing reads a clock in the sim: the page will hand it the date.
- **0.17.3.0, PR 17d: offline play and the home screen.** A service worker (`scripts/sw.template.js`, filled in by `scripts/make-sw.mjs` after every build) keeps a copy of the whole game, 24 files, in a cache named `hulldown-<version>-<fingerprint>`, so the game opens with no signal. It deletes only older caches that start `hulldown-`. Kelbo chose a quiet update: a new version downloads in the background and is swapped in the next time the game is opened, under the splash. A web manifest and PNG icons made from the game's own icon let a phone add it to the home screen. Kelbo chose a line in the menu: the Saves tab has a new section, Offline and home screen, with an Add button where the browser allows one and the steps where it does not (iPhone). Tests run the real worker file against a pretend browser. First load 855 KB.
- **0.17.2.0, PR 17c: each tender wants something different.** Kelbo chose to put the balance right through what the army weighs. 1981 now weighs firepower 35 and mobility 25 (was protection 30, firepower 25); 2001 is unchanged (protection 30, firepower 30); 2016 weighs cost 40 and reliability 25 (was protection 35). The briefs say so. `npm run sim` on 24 seeds: firepower leads 1981, heavy leads 2001, light leads 2016; shares 44 / 18 / 38 %. A test now fails the build if one bureau leads every tender or one never wins.
- **0.17.1.0, PR 17b: the balance check.** `npm run sim` runs every tender over 24 seeds with only the three rival bureaus bidding and prints who won, their marks on each count and a verdict (`src/sim/career/balance.ts`, `scripts/sim.mjs`, numbers in `src/data/balance.ts`). Nothing in the game changes. First finding: the heavy bureau leads all three tenders (83 % of wins), firepower takes 17 % and light never wins. The retune is the next slice.
- **0.17.0.0, PR 17a: the sandbox.** First slice of plan PR 17. A Sandbox switch at the top of the Bureau page: every part and generation unlocked, no cost ceiling, any trial. Kelbo chose to pick the weight limit (44 t, 48 t or none) and to share designs with the career. While it is on, the bureau page waits, the first-contract guide is hidden and the project line says sandbox. With no limit the weight bar shows the total only. The choice is kept in `hulldown.sandbox`.
- **0.16.4.0, PR 16e: wind outdoors.** Kelbo chose ambience outdoors only. While a range playback or a battle plays there is a light wind that swells and fades slowly. It comes up gently, stops when the playback is paused or closed, and the office stays quiet. Synth, no files. This completes the cue map for plan PR 16; the range officer voice still waits on the quote.
- **0.16.3.0, PR 16d: sound in the office.** Kelbo chose "every tap too". Every button, tab and fold makes a quiet click; changing the design makes a pencil scratch; the moment a design goes over the weight limit there is a soft two-note warning instead; entering a prototype for the tender brings the stamp down. A press that makes its own sound does not also click, and a dragged slider does not rattle. All synth, no files.
- **0.16.2.0, PR 16c: sound in the battles.** Watching a battle now has sound, heard from beside the tank the camera is with: its engine and tracks, every gun (each side with its own calibre), and a different sound for each way a round lands: a ricochet, a hit the armour holds, a penetration, a round into the ridge, a miss. Far-off sounds are quieter. Nothing plays while paused or while the bar is dragged. Still synth only for the three new strike sounds.
- **0.16.1.0, PR 16b: free recordings over the synth.** Second slice of plan PR 16. Three CC0 recordings from OpenGameArt (`public/audio/gun.mp3`, `hit.mp3`, `short.mp3`; originals in `art/third-party/sounds/`), listed in `CREDITS.md`. `AUDIO.recordings` says which cue each belongs to and how loud; `src/audio/sound.ts` fetches them when sound first starts and plays them over the synth, slowed for a bigger gun. Without them the synth plays alone.
- **0.16.0.0, PR 16a: sound on the range.** First slice of plan PR 16. `src/data/audio.ts` holds every number and the cue map (gun, hit, miss, short). `src/audio/cues.ts` works out what a playback should sound like from what it shows (engine note from the engine and gearbox, track beat from speed, gun from calibre, one cue a round fired and one a round landed), with tests. `src/audio/sound.ts` makes it with the browser's own synth: no sound files, nothing fetched. A Sound button in the header, kept under `hulldown.sound`. First load 770 KB.
- **0.15.3.0, PR 15d: picture quality.** Last slice of plan PR 15. Three tiers in `src/data/graphics.ts` (pixel ratio, smooth edges, how much of the woods is planted). `src/render/frameMeter.ts` times the frames of every 3D view; on Auto the game steps down when the device is slow and remembers it under `hulldown.graphics`. A picker and the last measured frame rate on the Trials tab. First load 762 KB.
- **0.15.2.0, PR 15c: scenery on the range.** Third slice of plan PR 15. `src/render/scenery.ts` lays out woods, skyline hills, a range tower and warning flags as a plain list of shapes, the same on every device, and `buildSolids` joins them into one mesh a colour. On the strip, the course and the shoots. A test holds each range to 5,200 triangles and keeps the lane and the camera side clear. A `density` setting thins the woods, ready for the graphics tiers.
- **0.15.1.0, PR 15b: the paint shop.** Second slice of plan PR 15. Four cosmetic paint schemes in `src/data/paint.ts`, picked on the Trials tab and kept beside the design (`SavedDesign.paint`), so a repaint is never a new build. Two are camouflage: `src/render/camo.ts` makes a small repeating pattern in code (no image files), the same on every device, and the tank's plate is painted with it in the range and battle 3D views. No more meshes or triangles than a plain tank. First load 758 KB.
- **0.15.0.0, PR 15a: the tank on the range.** First slice of plan PR 15 (art pass), made in code as Kelbo chose. `tankShapeOf` now gives a list of parts (boxes, drums, slabs and a lofted turret) and `src/render/tankModel.ts` joins them into one mesh per colour. Five turret shapes in `RENDER.tank.turrets`; tiles drawn from `spec.era`. `tankTriangles` and a test hold a tank to 1,100 triangles.
- **0.14.2.0, PR 14: the guided first contract.** A guide card on every tab walks a newcomer through the first tender (night sight, prototype, report, enter), and the rival bureaus make no revisions on that tender. Kelbo confirmed the glossary, the unmanned turret and the rivals' 2016 picks as built. This finishes plan PR 14.
- **0.14.1.0, PR 14b: the glossary.** `STRINGS.glossary` (43 entries, each with the word beginnings it explains), `src/ui/glossaryWords.ts` (`termsIn`), `src/ui/glossary.ts` (the row of buttons), drawn at the foot of every design office tab. `tests/glossary.test.ts` checks every entry is used by the game and every control has a word explained. Phone test: open the Hull tab, scroll to "Words on this page", tap Glacis, read it, tap it again to close; change the hull and the open word stays open; tap "Show every word".
- **0.14.0.0, PR 14a: the hard-coded-text test.** First slice of plan PR 14 (Teaching). `tests/hardCodedText.test.ts` reads every source file outside `src/data/` and fails on anything that looks like English for the player. It found two: the korona format (`STRINGS.money`) and the army designation "Model 81" (`STRINGS.career.designation`), both now in the string table. Nothing changes on screen. Phone test: money still reads "Kr 2.60M" and an adopted tank is still "Model 81".
- **0.13.4.0, PR 13e: the rivals in generation three.** `LaterPicks` gains `turret`, `active` and `apu`; each bureau has a `later[3]`. The designer can repair `overPowerBudget`, `turretNeedsAutoloader` and `turretNeedsComputer`. `tests/rivalsGen3.test.ts`. Plan PR 13 is complete. Phone test: play to the 2016 tender, send a tank to the range, win or lose the decision, and read the rival tanks on the Bureau tab: one has an unmanned turret, all have active protection.
- **0.13.3.0, PR 13d: the unmanned turret.** `TURRETS.unmanned` (`crewed: false`, `drawKw`, `workload`), research project `unmannedTurret`, `turret.shape` now a tech field. Faults `turretNeedsAutoloader`, `turretNeedsRearEngine`, `turretNeedsComputer`. The interior seats the gunner and commander in the hull nose and moves the front rack and tank across the hull. Commander work source `screens`. Drawn in all three views with two hull hatches and no cupola. `tests/unmannedTurret.test.ts`. Phone test: in the 2016 tender, research the digital computer then the unmanned turret on the Bureau tab, pick it on the Turret tab, tap Fix it on any fault, look at Side, Top, Front and Inside, then send it to the range.
- **0.13.2.0, PR 13c: active protection and power demands.** `protection.active` (none, soft kill, hard kill) with two research projects, an electrical power budget (`electricsOf`, fault `overPowerBudget`), and rockets and missiles marked by how they fly so `traceShot` can have active protection deal with them. The armour trial report says how many it dealt with.
- **0.13.1.0, PR 13b: top-attack and drone threats, roof protection.** Two new threats and the generation-three trial marks: bomblets on both roofs must hold, a top-attack missile is fired for the record. The tender of 2016 uses them and its brief says so.
- **0.13.0.0, PR 13a: the tender of 2016.** `tank2016` in
  `src/data/tenders.ts` (generation three); `PACT_LIMITS_GEN3` in
  `src/data/tuning.ts` raises the bridge class to 48 t. No new parts yet.
- **0.12.3.0, PR 12d: export trials.** `exportTrial`, `strained` and
  `orderOf` in `src/sim/career/exportDesk.ts`; jungle and mountain join
  desert in `CLIMATES` (`src/data/range.ts`), each with how hard its ground
  works the drive and the ride; `Sale.trial` is kept in saves. The Export
  desk card warns of strained parts before a sale and reports the trial
  after it. Plan PR 12 is complete.
- **0.12.2.0, PR 12c: export variants.** `variantBlock`, `sellVariant`,
  `variantCostKr`, `variantFixed` and `variantDesignation` in
  `src/sim/career/exportDesk.ts`; `Sale.variant` keeps the version's
  design; marks and the work-up cost in `src/data/export.ts`. The Export
  desk card checks the design on the board against each customer.
- **0.12.1.0, PR 12b: export sales.** `saleBlock`, `sell`, `secrets` and
  `saleFeeKr` in `src/sim/career/exportDesk.ts`; `Career.sales` (kept in
  saves, one order a customer); fee share, the ministry's standing bar and
  its thanks in `src/data/export.ts`. The Export desk card gets a sell
  button, the ministry's refusal in words, and a stamp once ordered.
- **0.12.0.0, PR 12a: the export desk opens.** Customers and their needs
  in `src/data/export.ts`; `src/sim/career/exportDesk.ts` checks a tank
  against them; a card on the Bureau tab, once a tank is adopted, lists
  each customer, what it asks, and where each tank in service falls short.
  No sales yet.
- **0.11.6.0, PR 11g: rivals fit generation-two parts.** Each bureau's
  philosophy names the newer parts it moves on to (`later` in
  `src/data/opponents.ts`); the bot designer fits them when the tender's
  generation allows and goes back to the Pact round where the tank cannot
  fire the new one. Generation-one tenders are untouched.
- **0.11.5.0, PR 11f: the bureau's own ammunition.** Long rod, tandem
  warhead and gun-launched missile: three research projects, two new
  choices on the Gun tab, three new faults (rod and carousel, missile and
  rifled gun, missile and no digital computer), dearer rounds in the unit
  cost. Old designs load on Pact rounds. 814 tests. This closes plan PR 11.
- **0.11.4.0, PR 11e: intelligence files.** A file on each Accord tank the
  tender expects to meet: gun, front armour, weight and speed as ranges
  that sharpen with every prototype built and every tender that passes.
  The truth is always inside the range. Shown on the Bureau tab. 806 tests.
- **0.11.3.0, PR 11d: research.** The bureau pays for research projects
  that unlock the generation-two parts (digital computer, thermal sight,
  layered composite). A research card on the Bureau tab; unresearched parts
  show "Needs research" in the office and are a fault if fitted. Research
  is kept in the career and the save code. 800 tests.
- **0.11.2.0, PR 11c: the tender of 2001.** A second tender, generation
  two, with its own proving-ground marks (long rod and tandem warheads on
  the armour trial, night as hard as day). After the army decides the
  first tender the Bureau tab offers "Go on to the tender of 2001" (tap
  twice): the grant is added to the budget, prototypes stay behind, tanks
  in service carry on. The office then works to the new tender's limits,
  the locked parts open, and Palisade B joins the duels and battles.
- **0.11.1.0, PR 11b: tandem and improved threats.** Three new Accord
  rounds (120 mm long rod, tandem rocket, tandem missile). A tandem warhead
  sets a reactive tile off first, so the tile adds only 15% of its worth
  against it. New threat tank, Palisade B, with a thermal sight and layered
  composite; the duel and battle screens only list the Accord tanks a
  tender of that generation expects, so it does not show yet.
- **0.11.0.0, PR 11a: technology generations.** Every tender now carries a
  generation, and a design cannot fit a part newer than its tender allows
  (a new fault, "Not to be had yet"). First generation-two parts: thermal
  sight, digital computer, layered composite. The office shows them locked
  with a "Generation 2" tag; the armour material list greys them out. Rival
  bureaus keep to what the tender allows. Nothing unlocks them yet: the
  second tender comes in the next slices.
- **0.10.4.0, PR 10e: the bureau archive.** The Bureau tab ends with "The
  archive": one page for every tank the army has taken, with its
  production, tanks built, stops, exercise results, fees, packages and a
  line for each year. A page opens when the tank goes into production, is
  brought up to date as reports are read, and is kept when a new career
  starts (`hulldown.archive`, the newest 40 tanks). This finishes plan
  PR 10.
- **0.10.3.0, PR 10d: upgrade contracts on the Bureau tab.** A tank in
  service now shows its upgrade contract: what the army asks for, the
  design on the drawing board judged against it (the figure asked about,
  weight, cooling, cost, fee), and why it cannot be fitted if it cannot.
  "Put the service tank on the drawing board" loads it to work from; "Fit
  it as the Model 81A" fits the package. Both take two taps.
- **0.10.2.0, PR 10c: upgrade contract rules (no screen yet).** After a
  year of service the army can open one upgrade contract on a tank, on what
  the year showed: breakdowns, a plate that was holed, a slow first shot,
  crew workload or comfort. A package must keep the hull, turret, gun,
  loading, suspension and cooling, stay inside the weight and cooling the
  design had to spare, and move the figure the army asked about. Fitting it
  costs one tank's price, pays a fee, lifts army standing and adds a letter
  (Model 81A). Reports from the next year are of the upgraded tank. Up to
  three packages a tank. Rules and saves only; the screen is PR 10d.
- **0.10.1.0, PR 10b: production and field reports on the Bureau tab.**
  A tank the army adopts gets its own section: pick the build rate and
  the quality, see what they do to cost, trouble and standing, start
  production, then read a field report for each of six years.
- **0.10.0.0, PR 10a: production and field reports (sim only).** A tank
  the army adopts can now be put into production at a rate and a
  quality, which set what it costs and how often it gives trouble, and
  the army reports on each of its years in service: breakdowns, crew
  complaints, how conscripts shoot in it, and an exercise. Saves from
  before still load. No screen yet: that is PR 10b. Nothing new to
  test on a phone.
- **0.9.3.0, PR 9d: the battle in 3D.** Under the map, "Watch it in 3D"
  opens the battle on the ground it was fought on: ridges, woods, all
  the tanks, tracers, hits and wrecks, and the dark for the night
  ground. Play, pause and a slider. The director follows whichever of
  your tanks is about to fire or be hit; "No. 1" and the rest ride
  with one tank. Loaded only when opened, so the first load is
  unchanged. This finishes PR 9.

- **0.9.2.0, PR 9c: the battle map.** "One battle, as it happened" now
  opens with a map of the ground from above, your platoon at the
  bottom. Play, pause and a slider; a battle plays back at eight times
  its speed. Yours are solid, theirs hollow, a tank out of the fight is
  crossed out and one in smoke is ringed, and the count is written
  underneath.

- **0.9.1.0, PR 9b: the battle screen.** Trials tab, "Send a platoon to
  battle". Pick who it meets, the ground and the two orders; the platoon
  fights 12 battles and the report gives won and lost, tanks lost for
  tanks knocked out, rounds, breakdowns, the three things that decided
  it (each with a Fix button) and any one battle told as it happened.
  The orders are worded for the ground: holding a ridge they read "Open
  fire at once / Hold fire" and "Stay put / Shoot and shift"; attacking,
  "Stand off / Close in" and "By bounds / Straight on". Words only so
  far: the map and the 3D playback come next.

- **0.9.0.0, PR 9a: the platoon battle, sim only.** Nothing new on
  screen yet. Three or four tanks a side (never more than eight) on four
  grounds: holding a ridge, a meeting, an attack on a ridge, a meeting at
  night. Each tank finds, lays and fires as in a duel, and rounds now
  come in from the side they were really fired from. Tanks go from ridge
  to ridge, share targets out, pass on what they find by radio, fire
  smoke, and can break down. The platoon takes two orders: open fire at
  long range or hold until close, and move carefully or fast. A battle
  takes about 3 ms to work out.

- **0.8.7.0, PR 8h: the Saves tab. PR 8 is complete.** Three save slots
  (IndexedDB `hulldown`), a save code to show, copy and paste back, and a
  backup file to download and load. Loading a save puts it in the
  browser's storage and reloads the page. The first save asks the browser
  to keep the game's storage. After 14 days without a backup the tab
  shows "Saves !" and a reminder. Checked in a phone-sized browser: a
  decided career comes back from the code, from a slot and from the file.
- **0.8.6.0, PR 8g: the Bureau tab.** The career can now be played. A
  new Bureau tab in the design office shows the tender (limits, grant, how
  the army weighs a bid), the budget and standing, the chief engineer with
  his three settings and "Look at" links, the prototype shop, each
  prototype's marks and failed tests, and the army's decision with the
  order of merit. The career is kept in the browser (`hulldown.career`,
  `hulldown.advisor`) and survives a reload. The design office now also
  flags a design over the tender's unit cost ceiling. Still to come in
  PR 8: 8h save slots, save code and backup on screen.
- **0.8.5.0, PR 8f: the chief engineer.** No screen yet.
  `src/sim/career/advisor.ts` reviews a design against the tender on
  paper, the same every time and quick enough to run after every change.
  Worst first: what cannot be built; plates that must hold at the armour
  trial and will not (with the round that beats them); firing tests it
  will fail; a slow first shot; loading that will not keep up; the
  sprint, top speed, obstacles and berm; then design warnings, poor
  reliability and a unit cost close to the ceiling. Each remark names
  the control or plate to look at; he never says what to fit. He says
  six things at most and counts the rest. `src/ui/advisorWords.ts` has
  his sentences. Three settings: never, when asked, after every change
  (the default). Working name Radek Stanek.
- **0.8.4.0, PR 8e: save slots, the backup file and the reminder.** No
  screen yet. Three save slots kept in the IndexedDB database `hulldown`
  (`src/persist/slots.ts`), falling back to memory where a browser will
  not open one. Each slot lists when it was saved, the tender's year,
  whether it was won and how many designs are in the chest; what is read
  back goes through the same cleaning and migrations as a save code. The
  backup file is `hull-down-backup-YYYY-MM-DD.txt` with the code on a
  line of its own, and a code is found again even if an editor broke it
  over lines. The game notes the first day it was played and the last
  backup under `hulldown.` keys and counts 14 days to the reminder; it
  also asks the browser not to clear its storage. Checked against a real
  browser database in a headless phone browser.
- **0.8.3.0, PR 8d: the save code.** No screen yet. A whole save (the
  career and the plan chest) packs into one line of text that starts
  `HD1:`: deflated, base64url, with a checksum, so a code spoiled in
  copying is caught and spaces or line breaks picked up on the way do
  not matter. Anything read back is cleaned part by part
  (`src/persist/careerCodec.ts`); a decision that does not add up is
  dropped and the army decides again. Saves carry a format number with a
  ladder of migrations, and `tests/fixtures/save-v1.txt` holds codes
  written by format 1 that every later version must still load. The
  split of PR 8 now runs: 8e save slots, backup file and reminder, 8f
  the chief engineer, 8g the career screens.
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
