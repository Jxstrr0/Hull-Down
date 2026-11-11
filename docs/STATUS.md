# Hull Down: status

Newest first. One line per PR, plus anything waiting on Kelbo.

## Waiting on Kelbo

- Confirm or replace the working name "Pattern 3" for the Radan baseline tank.
- Choose how the hidden studio-site listing gets its cover image (see Notes).
- Say if the project numbers ("Project 101", counting up, never reused) suit
  you, or if you want a different scheme. See `docs/NAMES.md`.

Done: GitHub Pages is on and `hulldown.longlight.games` is live (checked
11 November 2026).

## Log

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
  ammunition lists and the two protection maps (0.3.1.0), 3c ERA tiles and the
  quick test shot (0.3.2.0). PR 4 is then 0.4.0.0.
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
