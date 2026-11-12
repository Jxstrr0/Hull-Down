# Hull Down: design doc and build plan

> **Handoff for a Claude Code session.** Drafted 11 November 2026 for Kelbo /
> Longlight Interactive. It is the plan of record; the repo's `CLAUDE.md` wins
> where the two disagree.
>
> **Status: building.** Sections marked **Decided** were chosen by Kelbo.
> Sections marked **Proposal** are Claude's suggestions. Kelbo answered
> section 16 on 11 November 2026. Progress is in `docs/STATUS.md`.
>
> The repo is `Jxstrr0/Hull-Down`; where this plan says `HullDown`, read
> `Hull-Down`.

---

## 1. Read this first

1. Read `LONGLIGHT-STUDIO.md` (the public studio catalogue) and copy it into
   this repo at `.github/LONGLIGHT-STUDIO.md`. Its shared rules (section 4),
   brand rules (section 3), taken names (section 8) and reuse map (section 10)
   all apply here.
2. Hull Down is a new public repo, `Jxstrr0/HullDown`, deployed by GitHub Pages
   to `hulldown.longlight.games`.
3. Kelbo is a beginner-plus coder who tests on his phone from the live site.
   End every task with a plain-language summary and how to test it on a phone.
4. Work through the staged PRs in section 14, in order. Branch, PR, merge when
   checks pass. Never push to `main`. Keep PRs small enough to read on a phone.
5. Use the name Kelbo only. No real name, initials or email anywhere.
6. This doc pitches; Kelbo decides. Ask him about any real design question
   that section 16 doesn't cover.
7. **Always quote and ask before using Higgsfield or ElevenLabs.** Before any
   generation with either, tell Kelbo exactly what you plan to make and what it
   will cost, then wait for his explicit yes. This applies to every
   generation, including free ones. No yes, no generation.

---

## 2. The game in one paragraph

You run a state tank design bureau in Tarnovia, a member of an eastern-style
military bloc, from the 1980s to today. The army issues a requirement. You
design a tank part by part and layer by layer, always fighting the weight
limit. Then the prototype goes to trial, and you watch: a mobility course, a
gunnery range, test shots at your armour, duels against rival prototypes and
foreign threat tanks, and finally platoon battles. When it fails, a full
after-action report shows every shot path, every damaged part and why. You
fix the design, win the contract, and then live with it: field reports come
back from the army, and upgrade packages keep the tank alive for decades.

**What hooks the player (from Kelbo):** tuning numbers until they're right,
and watching it break and learning why.

---

## 3. Decisions so far

**Decided by Kelbo**

| Topic | Decision |
| --- | --- |
| Era | Cold War to modern, in three generations: 1980s-90s, 2000-2010, 2016 onward. |
| World | Fictional countries with a real-history flavour. |
| Home country | Tarnovia, inside the eastern-style bloc. The bloc stays together for the whole game. |
| Player | A state design bureau. Export sales come later as a side business; the bureau never leaves the state. |
| Vehicles | Tanks first. Other armoured vehicles after 1.0. |
| Design depth | Parts chosen from lists, with deeper choices for armour layering, smoothbore vs rifled gun, autoloader vs fourth crewman, turret shape and ERA placement. |
| Trials | The player watches. Trials are automated. |
| Trial ladder | Proving ground, then 1v1 duels, then platoon battles. |
| Opponents | Both rival bureaus on the same tender and foreign threat tanks. |
| Failure report | Full after-action: shot paths, parts damaged, crew status. |
| Look | Blueprint design screen, 3D trials. |
| Time | No calendar. Contract to contract. |
| Service life | Yes: field reports and upgrade packages. |
| Voice | Decide after the first playable. |
| Generated art | Higgsfield kept minimal. ElevenLabs preferred. |
| Stack | Claude's pick (section 11). |
| Ammunition | Pick from Pact-supplied rounds first; develop your own later through R&D. |
| Design comparison view | In. |
| Quick test shot in the design office | In. |
| Crew quality and comfort | In, as a real system. |
| Chief engineer advisor | In, optional. |
| Tank naming and designations | In. |
| Paint and camouflage | In. |
| Photo mode | Not for now. |
| Soundtrack | None. Sound effects and ambience only. |

**Not in the game:** real countries, real wars, real vehicle or company names,
gore. This is an engineering game about trade-offs.

---

## 4. Design pillars

1. **Everything costs weight.** Armour, gun, engine, fuel and ammo all fight
   over one limit. There is no best tank, only a best answer to this requirement.
2. **Trials tell the truth.** The readouts in the design office are estimates.
   The proving ground finds what they missed.
3. **Every failure has a cause you can trace.** A shot path, a part, a number.
   The report always ends with what to change.
4. **You live with your decisions.** A tank that wins the tender still has to
   serve. A design with no room to grow becomes a problem ten contracts later.
5. **Watch, don't drive.** The player is the designer. No twitch controls.

---

## 5. Setting, tone and names (proposal, except where decided)

- **Tarnovia** (decided): a mid-sized industrial member of an eastern-style
  bloc. Rail-linked factories, a cold wet proving ground, conscript crews.
- **The bloc** (proposal): the **Kamen Pact**, led by the larger **Radan
  Union**. The Pact's standardisation committee sets rules everyone must
  follow: common ammunition calibres, a rail transport width, a bridge weight
  class. In generation one the bureau mostly improves and licence-builds a
  Radan baseline design. Independence grows with reputation.
- **The other side** (proposal): the **Northern Accord**, a western-style
  alliance. Its tanks are the threat files the army worries about.
- **Export customers** (proposal): non-aligned countries with desert, jungle,
  mountain and coastal terrain. They give the trials new ground and new problems.
- **Money:** the Tarnovian korona, written `Kr 4.2M`.
- **Tone:** dry, bureaucratic, technical, with some dark office humour in
  memos and committee notes. Crew are shown as status icons at their stations
  ("out of action"), never graphically.
- **Names:** check section 8 of the catalogue before adding any name. Avoid
  Kestrel, Kessel, Harbourline, Hollis, Lantern, Halyard, Sable, Ember, Kite,
  Harrow, and any new country starting with V. Red Skies already has aircraft
  and weapon names; don't reuse them. Keep a running `docs/NAMES.md`.
- **Real terms:** generic engineering terms are used as they are (smoothbore,
  autoloader, composite armour, ERA, APFSDS, HEAT, thermal sight, active
  protection). Vehicles, guns, makers and people are fictional.

This is its own world, separate from Varenna, Velmark and Mostograd.

---

## 6. The contract loop

There is no calendar. The game moves from contract to contract, and each
contract carries a year label for flavour and to gate technology.

1. **Requirement.** The army (or the Pact committee, or later an export
   customer) issues a tender: must-haves, hard limits (weight, width, unit
   cost), the threats to survive, and scoring weights for protection,
   firepower, mobility, reliability and cost.
2. **Concept.** Design on paper in the design office. Readouts are estimates.
3. **Prototype.** Pay to build it. This spends budget and a prototype slot.
4. **Trials.** Proving ground first. Pass the gates to reach duels, then
   platoon battles.
5. **Revision.** Read the reports, change the design, rebuild. Each revision
   costs money and some of the committee's patience. Revisions are limited.
6. **Decision.** The army scores every bid and picks a winner.
7. **Production.** Set the build rate and quality level. Unit cost and
   reliability follow.
8. **Service.** Over the next contracts, field reports arrive: breakdowns,
   crew complaints, combat lessons from exercises. They change your reputation
   and open upgrade contracts.
9. **Upgrade packages.** Mid-life upgrades to a tank already in service, built
   inside the old hull's spare weight and space. A design with no growth
   margin can't take them.

Losing a tender is not game over. The bureau takes smaller jobs: upgrade
packages, licence production, component work.

---

## 7. The design office

### 7.1 What the player chooses

Parts come from lists, unlocked by generation and R&D. Every part has mass,
volume, cost and reliability.

| Area | Choices |
| --- | --- |
| **Hull** | Size class (sets internal volume and base weight), glacis angle, engine at rear or front, driver position. |
| **Turret** | Shape: cast dome, welded wedge, low-profile, bustle turret, unmanned turret (generation three). Turret ring diameter, which limits the gun. |
| **Gun** | Calibre, **rifled or smoothbore**, barrel length, recoil system. Ammunition types carried. |
| **Loading** | **Fourth crewman (human loader)**, carousel autoloader in the hull, or bustle autoloader in the turret rear. Each changes crew size, rate of fire, turret size, and what happens when the ammunition is hit. |
| **Ammunition stowage** | How many rounds, where they sit, and protection: plain racks, wet stowage, armoured bins, blow-out panels. |
| **Fire control** | Sights, rangefinder, stabiliser, ballistic computer, night vision or thermal, an independent commander's sight. |
| **Powerpack** | Diesel, multi-fuel or gas turbine. Power, transmission, cooling, fuel capacity, auxiliary power unit. |
| **Running gear** | Torsion bar or hydropneumatic suspension, number of road wheels, track width. |
| **Protection systems** | Smoke launchers, fire suppression, spall liner, laser warning, soft-kill and hard-kill active protection (generations two and three). |
| **Crew** | Three or four, their stations, and comfort (heating, space, hatches). |

### 7.2 Armour, layer by layer

The tank is divided into about 14 **zones**: upper glacis, lower glacis, hull
sides (front and rear), hull rear, hull roof, belly, turret front (left and
right), mantlet, turret sides, turret rear, turret roof.

Each zone has a **stack of up to four layers**. Each layer is a material and a
thickness. Materials include rolled steel, high-hardness steel, cast steel, an
air gap, composite inserts, reactive inserts, and add-on modules.

**ERA** (explosive reactive armour) is placed per zone as tile coverage. Tiles
leave gaps around sights, the gun and hatches. A tile works once: after a hit,
that spot is bare. Later generations add heavier tiles that also resist
kinetic rounds, and side skirts or cage armour.

Each zone shows two protection values, because the two main threat types are
beaten by different things: one against kinetic rounds and one against
shaped-charge warheads. Slope multiplies both.

### 7.3 Live readouts

- Combat weight against the limit, and the weight by area as a bar.
- Power-to-weight, top speed, range, ground pressure.
- **Protection map:** the blueprint coloured by zone, switchable between
  kinetic and shaped-charge, against the tender's named threats.
- Silhouette height and **gun depression**, which decides how well the tank
  can fight from behind a ridge with only the turret showing. That position is
  called hull down, and it is one of the proving ground tests.
- Rate of fire, time to first shot, estimated hit chance by range.
- Unit cost, reliability index, crew workload.
- **Growth margin:** spare weight, space and power for future upgrades.
- Hard limits from the tender: rail width, bridge class, Pact ammunition standard.

A constraint that is broken shows in red with a "fix it" link to the part.

### 7.4 The blueprint

Side, top and front views in technical-drawing style. Tap a zone or a part on
the drawing to edit it. A section view shows the layers of the selected zone
to scale, and the interior: crew, ammunition, fuel, engine, autoloader.

### 7.5 Ammunition

- **At first you pick** from the rounds the Pact supplies for your gun's
  calibre and type. Each round has a speed, accuracy and effect against the
  two armour types. The Pact standard limits which calibres are allowed.
- **Later you develop your own** through R&D (from generation two): longer
  kinetic rounds, tandem warheads, gun-launched missiles. A new round can need
  a longer autoloader, a stronger breech or a different barrel, so it feeds
  back into the tank design.
- Enemy rounds improve each generation too. The tender names the threat
  rounds your armour is tested against.

### 7.6 Quick test shot

In the design office, tap a zone on the blueprint, pick a threat round, a
range and an angle, and see an estimated result at once, drawn on the section
view layer by layer. This is the fast tuning loop: change a layer, fire again.
It uses the same hit model as the real trial, but with no ERA wear, no
interior randomness and a stated margin of error. The proving ground still has
the final word.

### 7.7 Comparison view

Every prototype revision is kept. Any two can be shown side by side:

- what changed (parts, layers, weight by area);
- how every readout moved, with up and down arrows;
- trial results overlaid, with the earlier revision as a faint "ghost"
  (Prairie Engine Works' ghost curve is the model);
- rival and threat tanks can be loaded into the same view once their details
  are known.

### 7.8 The chief engineer (optional advisor)

A named character who reviews the design on request, or automatically if the
player turns that on. He flags clear problems in plain words ("the lower
glacis will not stop the tender's threat round", "this transmission is rated
for six tonnes less") and links to the part. He points at problems; he never
designs the tank. Three settings: off, on request, always. Early contracts
default to always.

### 7.9 Names, designations and paint

- The player names each design. The bureau also gives it an automatic project
  number, and the army gives a service designation when it is adopted. Upgrade
  packages add a suffix. The scheme is fictional; write it down in `docs/NAMES.md`.
- Paint and camouflage: a base colour and a pattern from a set, with climate
  schemes for export customers (desert, jungle, winter). Markings are invented
  numbers and symbols only. Paint is cosmetic and shows in trials, reports and
  share cards.

---

## 8. The simulation

The sim is pure TypeScript in `src/sim/`. No DOM, no three.js, no
`Math.random`, no `Date.now`. Seeded RNG only. Fixed time step. All tuning
numbers live in tables in `src/data/`. The same tank and the same seed always
give the same result, so every trial can be replayed.

All models are **game-level abstractions**, tuned to feel right and teach the
real trade-offs. They are not engineering data.

### 8.1 Mobility and reliability

- Engine power and gearing against rolling, slope and soft-ground resistance
  give acceleration, top speed and climbing ability.
- Ground pressure decides whether the tank bogs in mud or sand.
- Suspension type and travel decide how steady the gun is on the move.
- Cooling against climate: an engine that is fine in Tarnovia overheats in a
  desert export trial.
- **Reliability is stress-based**, like Prairie Engine Works. Each major part
  has a rated load. Run it above that (an overweight tank on a small
  transmission) and its failure chance rises over the endurance run.

### 8.2 Gunnery

- Gun and ammunition set speed and accuracy. Fire control sets ranging error,
  aiming time and how much accuracy is lost on the move or at night.
- Loading method sets rate of fire, and how it drops as a human loader tires
  or when the tank is moving.
- Output: hit chance by range, time to first shot, sustained rate of fire.

### 8.3 What happens when a shot hits

This is the heart of the game.

1. The shot is a ray. It strikes a zone at a real angle from the firing position.
2. It passes through that zone's layer stack. Slope increases the thickness
   it must cross. Each material resists kinetic and shaped-charge threats
   differently. An intact ERA tile at that spot takes its share and is used up.
   Steep angles can deflect kinetic rounds.
3. If anything gets through, it enters the **interior layout**: a simple 3D
   arrangement of crew stations, ammunition, fuel, engine, transmission,
   autoloader, gun breech and sights, placed by the player's design choices.
4. What it reaches decides the result: a crew member out of action, a fire, an
   ammunition explosion, a mobility kill, a firepower kill, or nothing vital.
5. Protection systems then act: fire suppression, blow-out panels, spall liner.

Design choices show up directly. A carousel autoloader keeps ammunition low
in the hull, hard to hit but catastrophic when reached. A bustle with blow-out
panels is safer for the crew but makes a bigger turret. A fourth crewman adds
a larger, taller fighting compartment to armour.

### 8.4 Later-generation threats

- Generation two: tandem warheads that defeat simple ERA, better kinetic
  rounds, thermal sights that end the advantage of night.
- Generation three: top-attack weapons and drones that strike the thin roof,
  answered by active protection and roof armour, which cost weight and power.

### 8.5 Crew quality and comfort

Tarnovian crews are mostly conscripts, so the tank has to be easy to fight.

- Each station has a **workload** set by the design: a commander who must also
  load or range the gun is slower at everything.
- **Comfort** comes from space per crewman, hatches, heating and cooling,
  noise, and ride quality from the suspension.
- Workload and comfort feed **fatigue**, which builds over a long trial or
  battle and lowers spotting, aiming speed and loading speed. A human loader
  tires; an autoloader doesn't, but it can jam and it takes the fourth pair of
  hands away from maintenance.
- **Crew quality** is set by who is using the tank: conscripts at home, a
  trained cadre at the proving ground, varied crews for export customers. A
  tank that only performs with expert crews does badly in field reports.
- The after-action report shows fatigue and workload on the timeline, so
  "they saw us first" can be traced to a cause.

---

## 9. Trials

All trials are automated. The player watches with a director camera, can
pause, scrub and change the view, and gets a report at the end. The sim runs
ahead in a Web Worker and the 3D view plays it back.

### 9.1 Proving ground

| Test | Checks | Typical failure |
| --- | --- | --- |
| Acceleration and top speed | Power-to-weight, gearing | Too heavy for the engine |
| Obstacle course | Slope, trench, step, mud | Bogs down; belly grounds; can't climb |
| Endurance run | Reliability over distance | Transmission, cooling or track failure |
| Gunnery, static and moving | Hit rate, time to first shot | Poor stabiliser; slow ranging |
| Night gunnery | Night sights | Blind without thermal |
| Armour trial | Test shots at named zones with the tender's threat rounds | A zone fails; ERA gap found |
| Hull-down berm | How little shows when firing over a ridge | Not enough gun depression |
| Loading drill | Sustained rate of fire | Loader fatigue; autoloader jam |

Each test is a gate with a pass mark from the tender.

### 9.2 Duels

One against one, at set ranges and on set ground, against each rival
prototype and each threat tank. Run across several seeds and report the win
rate, who shot first, and what decided it.

### 9.3 Platoon battles

Three or four tanks a side on scenario maps: defend prepared positions, a
meeting engagement, an advance across open ground, a night action. A simple
battle AI uses cover, range and hull-down positions. Results are loss ratios,
ammunition used and breakdowns. Cap a battle at eight tanks for phone performance.

### 9.4 The after-action report

- A **timeline** of the trial with every shot and event.
- For each hit: the **shot path** drawn on the blueprint cutaway, the zone,
  the angle, each layer and whether it held, what was reached inside, and the result.
- **Crew status** by station and **parts damaged**.
- A summary: the three things that decided the outcome.
- **Fix links** that jump straight to the part or zone to change.
- Model the layout on Scrapline's post-mortem. Add a share card.

---

## 10. Career systems

### 10.1 Rivals and threats

- **Rival bureaus:** two or three inside Tarnovia and the Pact, each with a
  design philosophy (heavy and well protected; light and cheap; firepower
  first). Their bids are built by the same rules as the player's, from the
  same parts lists.
- **Threat tanks:** Accord designs in intelligence files. Early files are
  estimates with wide ranges. Intelligence improves over time, so the tank you
  designed against may turn out better than feared.

### 10.2 The bureau

- **Budget** from the ministry, spent on prototypes, trials and R&D.
- **Reputation** with three bodies: the army (wants a good tank), the ministry
  (wants a cheap one, on time), the Pact committee (wants standard parts).
- **R&D** unlocks parts within each generation and opens the next.
- **Design teams** as a simple capacity: how many projects at once.

### 10.3 Service life

- Field reports arrive after each later contract: reliability in service,
  crew comfort, lessons from exercises, export customer feedback.
- Upgrade contracts: new armour packages, sights, engines, protection systems,
  fitted within growth margin.
- A tank's service record is a permanent page in the bureau's archive.

### 10.4 The export desk (side business)

- Opens after the first tender win. The ministry approves each sale.
- Customers want variants: desert cooling, simpler sights, lower cost.
- Export trials happen on the customer's terrain.
- Income funds R&D. It never replaces the state bureau.

### 10.5 Modes

- **Career:** the full run through three generations.
- **Design office (sandbox):** all parts, any trial, no budget.
- **Challenge of the day** (late): one shared requirement and seed.

---

## 11. Tech stack (Claude's pick)

**TypeScript, Vite and three.js from npm**, the same shape as Lombard.

- The sim is large and must be trustworthy. Strict types, Vitest and a lint
  rule banning the DOM and three.js in `src/sim` protect it.
- Lombard already runs Blender headless in GitHub Actions, started from a
  phone, with Draco and KTX2 packing. Kelbo can't leave a PC running.
- Trials run in a Web Worker and play back, like Season Ticket's match runner.

| Piece | Choice |
| --- | --- |
| Build | TypeScript (strict), Vite, `base: './'`. |
| 3D | three.js from npm, pinned to the version Lombard uses at the time. Loaded only when a trial opens. |
| Design office | 2D: SVG and canvas blueprint views, plain DOM controls. No UI framework. |
| Tests | Vitest. `npm run sim` runs tenders with bot designers for balance. |
| Determinism | Copy Season Ticket's `det.ts`. A test scans the sim for `Math.random` and `Date.now`. |
| Saves | IndexedDB database `hulldown` for careers (they will be large), settings in localStorage `hulldown.*`. Save code `HD1:` (deflate, base64url, checksum). Backup file `hull-down-backup-YYYY-MM-DD.txt`. `persist()` and a 14-day reminder. |
| Offline | Service worker with caches starting `hulldown-`. It deletes only its own caches. |
| Version | Four numbers in a root `VERSION` file. Start at `0.1.0.0`. |
| Graphics | Lite / Full / Ultra with auto step-down. |

**Folders**

```
src/sim/      vehicle model, mobility, gunnery, hits, battle AI, career
src/data/     parts, materials, threats, tenders, tuning, strings
src/office/   blueprint views and the design screen
src/render/   three.js trials: terrain, tank assembly, effects, replay
src/ui/       reports, career screens, menus
src/audio/    cues and engine
src/persist/  saves, save code, safety
art/          Blender scripts, audio build
scripts/      packers, bundle check, screenshot tour
docs/         this plan, NAMES.md, STATUS.md
```

**Budgets:** 30 fps or better on a 2021 mid-range Android during an
eight-tank battle on Lite. First load under 3 MB before the title (the design
office needs no 3D). A CI check enforces both.

---

## 12. Look and feel

- **Design office:** pale drafting paper with dark blue ink, red-pencil notes
  and rubber stamps. Light-first, which most Longlight games are not. An
  optional dark "blueprint" theme (white lines on deep blue).
- **Trials:** realistic 3D in daylight. A wet, overcast Tarnovian range for
  home trials; export ranges bring desert, jungle and mountain light.
- **Fonts (proposal):** Archivo Narrow (headings), Archivo (UI), Spline Sans
  Mono (numbers), self-hosted. No other Longlight game uses them.
- **Palette (starting point):**
  - Paper `#e9ece6`, grid `#c9d0c8`, ink `#1f3558`, pencil red `#b23a2e`, stamp green `#3d6b4f`.
  - Dark theme: blueprint `#12305a`, line `#e8eef6`, dim `#8fa6c4`.
  - Protection map ramp: `#b23a2e` (fails), `#d9a13a` (marginal), `#3d6b4f` (holds).
  - Range: olive `#5a6038`, mud `#4a4036`, sky `#aeb7bd`.
- **Studio pieces** follow the Longlight brand rules exactly: official logo
  files, Space Grotesk, `© 2026 Kelbo / Longlight Interactive`.
- **Accessibility:** the protection map must not rely on colour alone (add
  hatching and numbers). Reduced motion, text size, and every spoken line also
  shown as text.
- **Phone layout:** portrait first. Blueprint on top, parts and readouts in a
  bottom sheet. Landscape and desktop put them side by side.

---

## 13. Assets: Blender, ElevenLabs, Higgsfield

**The game must build, run and be fun with none of these.** Grey boxes and
synth sound come first.

### 13.0 Third-party assets: CC0 and CC BY allowed

Ready-made assets can be used anywhere in the game (Blender kit pieces,
props, terrain, textures, HDRIs, decals, sound effects, ambience, fonts) if
their licence is one of these:

- **CC0** (public domain). No credit required, but list it in `CREDITS.md` anyway.
- **CC BY** (attribution). Allowed with a full citation: the asset's title,
  author, source link, licence name and version, and a note of any changes made.

Rules:

- **Not allowed without asking Kelbo first:** NonCommercial (NC),
  NoDerivatives (ND), ShareAlike (SA), "editorial use only", or any licence
  that is unclear.
- **No real military vehicles, insignia or brands**, whatever the licence. A
  free model of a real tank can't be used as a tank; generic parts (a road
  wheel, a hatch, a jerry can) are fine.
- Good sources: Poly Haven (CC0 HDRIs, textures, models), ambientCG (CC0
  materials), Kenney (CC0), OpenGameArt and Freesound (check each file's
  licence; many are CC0 or CC BY).
- Every third-party file gets a line in `CREDITS.md` with the citation, and a
  test fails the build if a file in the asset folders has no line (Season
  Ticket's `tests/credits.test.ts`). The in-game credits screen shows all CC BY
  citations.
- Keep each downloaded original's licence alongside it, or a link to it, in
  `art/third-party/`. Scrapline's `tools/get-polyhaven.py` is a ready-made fetcher.

### 13.1 Blender (planned)

- Kit pieces, props and textures can be scripted from scratch or built from
  CC0 / CC BY assets (13.0), cited in `CREDITS.md`.
- Tanks are **assembled in code** from a kit of parts, so any design the
  player makes can be shown. The hull is built from its dimensions. Turret
  shapes, guns, wheels, tracks, ERA tiles, skirts and engine decks are kit pieces.
- The kit, the ranges and the props are **written as Blender Python scripts**
  in `art/` and built by headless Blender in GitHub Actions. Copy Lombard's
  `bake/`, `bake.yml`, `items.yml` and packers. Commit the packed `.glb` files.
- Keep a triangle budget per piece. Eight tanks must fit on a phone.

### 13.2 ElevenLabs (preferred for generated audio; optional)

- **Voice is decided after the first playable** (PR 6). Likely uses if yes: a
  range officer calling results, and short committee briefings.
- Generated sound effects are possible where no free recording fits.
- **Always quote and ask first.** Kelbo's limit is 2,700 ElevenLabs credits.
  Before any generation, write the script sheet (line ID, speaker, text, file
  name), quote the cost in credits, and wait for his explicit yes. Use the
  `11l-base-skill` workflow where available. Keep the first batch small.
- If the code session has no ElevenLabs connector, don't work around it. List
  what's wanted in `docs/STATUS.md` for Kelbo to make in a chat session.

### 13.3 Higgsfield (minimal)

- Cover and key art for the studio site only, if at all. Nothing in-game.
- **Always quote and ask first.** Before any Higgsfield generation, free or
  paid, tell Kelbo what you plan to make and its cost, and wait for his
  explicit yes.
- No real people, real vehicles, real flags or real insignia.

### 13.4 Sound without generated audio

- Engine note synthesized from the powerpack choice (Prairie Engine Works'
  approach), track clatter from speed, gun report from calibre.
- Impact sounds differ by result: a ricochet, a hit that holds, a penetration.
  The player should be able to hear what happened.
- **No soundtrack** (decided). Sound effects and ambience only.
- CC0 and CC BY recordings for impacts, mechanical sounds and ambience
  (13.0). Every third-party file gets a line in `CREDITS.md`, checked by a test.

---

## 14. Build plan: staged PRs

Each PR ends with checks green, a version bump, a line in `docs/STATUS.md`
and a phone test note for Kelbo.

### PR 0: Scaffold and deploy
`CLAUDE.md`, README, `VERSION`, `CREDITS.md`, docs, the studio catalogue copy.
Vite, TypeScript, Vitest, ESLint with the sim bans, `deploy.yml`. A loading
screen with the studio splash and an empty blueprint sheet.
**Done when:** the live page loads on Kelbo's phone.

### PR 1: The vehicle model (sim only)
Vehicle spec format. Generation-one parts tables. Mass, volume and cost
roll-up. Derived stats. Constraint checks. Tests.
**Done when:** a spec file in gives a full, tested stat sheet out.

### PR 2: Design office, first version
Blueprint side, top and front views drawn from the spec. Parts lists, live
readouts, red constraint warnings with fix links. Save and load a design.
Design names and project numbers.
**Done when:** Kelbo can build a tank on his phone and watch the weight bar move.

### PR 3: Armour
Zones, layer stacks, materials, the section view, ERA tile placement with
gaps, the two protection maps. The quick test shot tool (needs a first cut of
the layer part of the hit model). Pact-supplied ammunition lists.
**Done when:** changing a layer or the glacis angle visibly changes the map and
the test shot result. **This is a small playable toy on its own; let Kelbo try it.**

### PR 4: Mobility, reliability and the range
Mobility and stress-based reliability sim. A grey-box 3D proving ground with
the acceleration, obstacle and endurance tests, director camera and replay.
**Done when:** an overweight tank visibly bogs and breaks its transmission.

### PR 5: Gunnery
Gunnery sim. Static, moving and night range tests. Loading drill.
Crew workload, comfort and fatigue (8.5).
**Done when:** rifled vs smoothbore and loader vs autoloader give clearly
different results.

### PR 6: Hits and the after-action report
Shot tracing through layers, the interior layout, damage results, protection
systems. The armour trial and hull-down berm. The full after-action report
with cutaway shot paths and fix links. Revision history and the comparison
view with ghost results (7.7).
**Done when:** design, proving ground and report work end to end.
**This is the first playable, 0.6.0.0. Stop and let Kelbo play. Decide voice here.**

### PR 7: Duels
Single-tank AI. Threat tanks. Rival designs built from the same parts by
bot designers. Multi-seed duel runs and the duel report.

### PR 8: Career core
Tenders, phases, budget, revisions, scoring and the decision. Three
reputations. Losing a tender. The chief engineer advisor (7.8). Service
designations. Save slots, `HD1:` save code, backup, reminder,
with migration tests.
**Done when:** a career can win or lose its first tender and be restored from a code.

### PR 9: Platoon battles
Scenario maps, battle AI, the battle report, the eight-tank performance budget.

### PR 10: Service life
Production settings, field reports (including crew quality in service),
growth margin, upgrade contracts, the bureau archive.

### PR 11: Generation two
New parts and materials, tandem and improved threats, thermal sights, R&D
tree, intelligence files that sharpen over time. Developing your own
ammunition (7.5).

### PR 12: The export desk
Ministry approval, customer requirements, variants, climate and terrain
(desert, jungle, mountain), export trials.

### PR 13: Generation three
Active protection, top-attack and drone threats, unmanned turret, roof
protection, power demands.

### PR 14: Teaching
The first contract as a guided tutorial (improve the Radan baseline design).
Tap-to-explain glossary for every term. All text in a string table, with the
hard-coded-text test.
**Done when:** someone who knows nothing about tanks can win the first tender.

### PR 15: Blender art pass
The scripted kit, ranges and props, built in Actions. Paint and camouflage
schemes. Graphics tiers.
First-load and frame-rate checks.

### PR 16: Sound pass
Synth engine, gun and impact sounds, ambience, cue map with tests. Generated
audio only after a quote and Kelbo's yes (13.2).

### PR 17: Sandbox, balance, offline
Design office sandbox mode. Bot designers in `npm run sim` to check no single
build wins every tender. Service worker and install prompt. Challenge of the day.

### PR 18: Launch and the studio site
`publish-release.yml`, crash screen with save code, credits, brand check,
cover and card clip from the live game, the studio site listing (section 15).
**Done when:** 1.0.0.0 is live and listed on longlight.games.

### After 1.0
Other armoured vehicles (infantry fighting vehicles, tank destroyers,
self-propelled guns), each as its own tender type.

Kelbo's pick: the tank destroyer first, as a career tender, in small PRs.
1. The casemate (1.3.0.0): a new turret shape, the gun fixed in a low box on
   the hull behind a steep plate. Light and cheap, and a big gun fits a
   smaller mount, but the whole tank turns to aim, so it is slower onto each
   new target. Allowed only on a tank destroyer's tender, and in the sandbox.
2. The tank destroyer tender in the career (1.3.1.0), with its own weights and
   limits, and saves carried over. Kelbo's pick: 1991, between the first
   tender and 2001.
3. Rival bureaus bid casemates on it (1.3.2.0): the light and the gunnery
   bureau; the heavy bureau keeps a turret.
4. The hull turns toward each new target in battle, not just the gun
   (1.3.3.0, Kelbo's pick).

Then the self-propelled gun, Kelbo's pick, in small PRs. Kelbo's picks: its
tender is in 2008, between 2001 and 2016, with generation two parts, and the
army judges it on a new fire mission trial rather than tank duels.
1. The howitzer (1.4.0.0): a 155 mm gun that lobs a heavy shell 22 km. It
   needs a big turret ring, so a turret only fits the heavy hull; a casemate
   takes it on any hull. Not a Pact tank calibre, so it is offered only where
   a tender asks for 155 mm, and in the sandbox with no limits.
2. The fire mission trial (1.4.1.0): shells onto map grids 11, 15 and 19 km
   off, judged on reach, time to the first round, rounds in a minute, and how
   close they land. It gets a card in the report, and runs for any howitzer.
3. The 2008 tender in the career (1.4.2.0). The fire mission takes the place
   of the tank duels and the armour-piercing shoots; the driving, endurance
   and armour tests stay. Saves carried over. Done: no duels and no
   exercise in service; the report hides the tank-only cards.
4. Rival bureaus bid self-propelled guns (1.4.3.0). Done: each bureau has
   its own picks for one, and its revisions learn from the fire mission.
5. Something to watch for the fire mission (1.4.4.0), such as shells landing
   on a map. Done: a replay in the fire mission card, an area map and a
   close-up of the grid, played eight times faster than the trial ran.

Then the infantry fighting vehicle, Kelbo's pick, in small PRs. Kelbo's
picks: its tender is in 1996, between 1991 and 2001, with generation one
parts; the troops ride in a compartment at the back; and the army judges it
on a new trial, carrying a squad and covering it with the cannon, rather
than tank duels.
1. The 30 mm cannon (1.5.0.0): light, small and fed from a belt, so it
   needs no loader. Each round carried is a burst of five. It bites light
   armour, not a tank's front. Offered only where a tender asks for 30 mm,
   and in the sandbox with no limits.
2. The troop compartment (1.5.1.0): a box at the back for 4 to 8 soldiers.
   It takes room and weight, and the engine has to go to the front. Done:
   each soldier takes 0.35 m³, 0.12 t and 1,500 kr, and the door 0.1 m³,
   0.5 t and 12,000 kr. A medium hull takes six, or eight with the smaller
   diesel and 600 L of fuel; a light hull has no room for a squad. With
   soldiers aboard, the racks and the fuel become strips along the walls.
   A round through the compartment puts soldiers out of action, a new
   result between "cannot move" and "crew out of action".
3. The squad trial (1.5.2.0): carry the squad to a drop point, let it out,
   and cover it with bursts on light targets. It gets a card in the report.
   Done: 4 km across firm ground at 0.6 of top speed, then 6 s for the door
   and 1.5 s a soldier. Four targets open up as it halts, 400 to 1,300 m
   off, and the gun has 60 s to put them out of action. The marks: six
   soldiers, the last one out within 600 s, and all four targets down. The
   crew is fresh. It runs for any design that carries soldiers; the 1996
   tender will set its own marks.
4. The 1996 tender in the career (1.5.3.0). Saves carried over. Done: it
   comes between 1991 and 2001, with generation one parts and only the
   30 mm cannon; 34 t and Kr 2.6M at most. It is judged on the drive, the
   endurance run, the armour (a carrier's cannon on the front and sides)
   and the squad drop, with no duels; firepower comes from the squad drop.
   Weights: firepower and mobility 25, cost 20, protection and reliability
   15. Careers saved from 2001 on move on one place.
5. Rival bureaus bid infantry fighting vehicles (1.5.4.0). Done: each
   carries six with the engine in front and no tiles. Heavy builds to the
   limit with plain sights, light is cheap with the small engine and the
   low turret, firepower fits the laser and the electronic computer. Their
   armour leans to the sides. The speed mark is 50 km/h, as for a tank.
6. Something to watch for the squad trial (1.5.5.0). Done: Watch the drop
   under the Squad drop card, played four times faster: a map from above
   with the squad getting out, tracer and crossed-out targets, and the
   gunner's sight on the target being fired at.

Then three more, Kelbo's picks, in this order: a wheeled scout car, an
anti-aircraft gun vehicle, and the export desk selling the new vehicles.

The wheeled scout car, in small PRs. Kelbo's picks: its tender is in 2004,
between 2001 and 2008, with generation two parts; four, six or eight wheels
are a design choice; only the 30 mm cannon is accepted; and the army judges
it on a new spot-and-report trial rather than tank duels.
1. Wheels (1.6.0.0): tracks, or four, six or eight wheels, in the sim and
   the design office, drawn on the blueprint. Offered only where a tender
   asks for a wheeled vehicle, and in the sandbox. Done: wheels are lighter
   and cheaper, geared half again as fast, use 0.7 of the fuel, and roll
   easily on a road; they press harder on the ground, drag in mud, bridge a
   shorter trench (0.08 of the hull length on four wheels, 0.28 on eight)
   and mount a lower step. Each tyre carries 3.8 t, and tyres seldom fail.
2. Wheels at the trials (1.6.1.0): the 3D range draws wheels, and the
   reports talk of tyres, not tracks. Done: each wheel is a tyre, a rim and
   a hub cap that turn as it drives; the obstacle, endurance and armour
   reports say tyres and wheels; the mud and tyre fix buttons and the chief
   engineer point at Tracks or wheels, not track width. A badly overloaded
   suspension can no longer sag the belly below the ground.
3. The spot-and-report trial (1.6.2.0): drive a mixed road and
   cross-country route to three lookout points, find vehicles hidden in the
   landscape with the sights, and report back. Marked on time, how many it
   found, and whether it was seen first. It gets a card in the report.
   Done: 33 km out and back, two vehicles hidden 1.4 to 3.2 km off at each
   lookout, up to 180 s watching at each. The commander finds them sooner
   with his own sight and a thermal sight; they notice the car sooner the
   more of it shows over a crest. Until the tender, every car on wheels is
   sent round it, marked at 50 min, five of six found and none seeing it
   first.
4. The 2004 tender in the career (1.6.3.0), with saves carried over. Done:
   between the tank of 2001 and the self-propelled gun of 2008, at most
   20 t and 2.4 million kr, wheels only, the 30 mm cannon only, no threat
   tanks to duel. It counts the drive, the endurance run, the armour (a
   carrier's cannon at long range) and spot and report. Of the obstacles
   only the mud pit is asked for: the trench, step and slope are run but
   count neither way, as no car on wheels can cross them. Firepower is
   scored from spot and report, 0.7 on what it found and 0.3 on not being
   seen first. Rivals put in eight-wheelers until step 5. Saves move on one
   place from 2008.
5. Rival bureaus bid scout cars (1.6.4.0). Done: each bureau has its own
   scout car. Heavy: the medium hull on eight wheels with the big engine,
   up to the weight limit, plain sights. Light: the light hull on six
   wheels, the low turret and the commander's own sight, at three quarters
   of the limit. Firepower: the light hull on eight wheels with the
   commander's sight and a thermal sight. From spot and report they learn
   the commander's sight, then a better night sight, for vehicles missed;
   and more wheels, then more power, for the mud.
6. Something to watch for the spot-and-report trial (1.6.5.0).

---

## 15. Hosting and the studio site

- Public repo `Jxstrr0/HullDown`. Pages source: GitHub Actions.
- Live address `hulldown.longlight.games`. Match how the Lombard repo is set
  up (no `CNAME` file; the domain is entered in the repo's Pages settings).
  **Kelbo does two things by hand:** adds the DNS record for the `hulldown`
  subdomain, and enters the custom domain in Pages settings.
- Until then the game is at `https://jxstrr0.github.io/HullDown/`, which
  shares storage with other Longlight pages. Keep every key and cache on the
  `hulldown` prefix.
- **Studio site listing:** Kelbo wants the game on longlight.games, so this
  plan allows **one PR to `Jxstrr0/Kelbo.Website`** for that. Read that repo's
  `.github/NOTES.md` first. Add one `projects.json` entry and the cover
  (`assets/covers/hull-down.jpg`, 640×480, plus `@2x`). Change nothing else.

```json
{
  "title": "Hull Down",
  "status": "Prototype",
  "category": "Game",
  "summary": "A tank design game. Run a state design bureau from the 1980s to today: build a tank part by part against a weight limit, send it to trial, and read the after-action report to find out why it failed.",
  "link": "https://hulldown.longlight.games/",
  "code": "https://github.com/Jxstrr0/HullDown",
  "image": "assets/covers/hull-down.jpg",
  "featured": false
}
```

- After listing, pitch Kelbo an update to the master `LONGLIGHT-STUDIO.md`
  (profile, storage table, names).

---

## 16. Questions for Kelbo (answered 11 November 2026)

| # | Question | Kelbo's answer |
| --- | --- | --- |
| Q1 | Bloc names: Kamen Pact, Radan Union, Northern Accord? | Yes, keep all three. |
| Q2 | In platoon battles, does the player set anything? | Yes: a couple of choices (a few at most) before the battle that steer how the tanks are used, so the player can play to the design's strengths. Still fully automated after that. |
| Q3 | Are rival designs fixed and authored, or built fresh each career by bot designers? | Bot-built, with a philosophy per bureau, so every career differs. |
| Q4 | How many revisions per tender? | Three, with a fourth that costs reputation. |
| Q5 | Does generation one start by modifying the Radan baseline, or with a clean sheet? | Modify the baseline first. |
| Q6 | How are crew shown in reports? | Icons at stations with "out of action". No names for trial crews. |
| Q7 | Light drafting-paper look by default, with a dark blueprint theme as an option? | Yes. |
| Q8 | List on the studio site hidden first, or public from the first playable? | Add the listing now, but hidden. Make it public later on Kelbo's word. |
| Q9 | Who sets up the `hulldown` DNS record and Pages domain, and when? | Kelbo, any time after PR 0. |

---

## 17. Risks to watch

- **Too many numbers at once.** The design office could overwhelm. Unlock
  areas across the first contracts, and keep the protection map as the main readout.
- **The hit model must be readable.** If a tester can't follow a shot path in
  the report, simplify the model before adding more to the report.
- **Balance.** With this many parts, one build may dominate. Run the bot
  designers from PR 7 onward, not just at the end.
- **Battle performance.** Eight tanks, effects and terrain on a phone. Run the
  sim ahead in a worker and keep the playback cheap.
- **Scope.** Eighteen PRs is a long road. The first playable at PR 6 has to
  be fun without the career, or the plan needs a rethink there.
- **Tone.** Keep it about engineering. No real nations, wars or insignia.

---

## 18. What "1.0" means

- A full career through three generations, with tenders, rivals, threat
  files, service life and the export desk.
- All three trial levels with after-action reports.
- Quick test shots, the comparison view, the crew system, the chief engineer,
  own-ammunition R&D, tank naming and paint.
- Tutorial contract, glossary, sandbox, save safety, offline play.
- Blender art and a sound pass.
- A balance run showing no single design wins every tender.
- Listed on longlight.games with a cover and a release.
