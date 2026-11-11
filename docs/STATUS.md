# Hull Down: status

Newest first. One line per PR, plus anything waiting on Kelbo.

## Waiting on Kelbo

- Confirm or replace the working name "Pattern 3" for the Radan baseline tank.
- Choose how the hidden studio-site listing gets its cover image (see Notes).

Done: GitHub Pages is on and `hulldown.longlight.games` is live (checked
11 November 2026).

## Log

- **0.2.0.0, PR 1: the vehicle model.** Spec format, generation-one parts,
  materials and tuning tables, weight, space and cost roll-up, derived stats,
  constraint checks that name the part to fix. The Radan baseline ("Pattern
  3", working name) comes out at 42.2 t against the 44 t Pact limit. The page
  shows its data sheet until the design office arrives in PR 2.
- **0.1.0.0, PR 0: scaffold and deploy.** Vite, TypeScript, Vitest, ESLint
  with the sim bans, deploy workflow, studio splash, empty blueprint sheet
  with paper and blueprint looks. Plan questions Q1 to Q9 answered.

## Notes

- Left out of the PR 1 spec on purpose, to be added when their PR needs them:
  barrel length, recoil system and gunnery numbers (PR 5), driver position
  (PR 2), protection values per zone (PR 3).
- All PR 1 numbers are first-pass game values. Expect them to move once
  trials exist.
- The repo is `Jxstrr0/Hull-Down` (the plan said `HullDown`). The live site
  is `https://hulldown.longlight.games/`.
- Studio site listing: Kelbo wants it added now but hidden (`"hidden": true`
  in `projects.json`). It needs a cover image first; see the plan, section 15.
