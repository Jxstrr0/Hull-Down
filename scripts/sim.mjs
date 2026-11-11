// `npm run sim`: the balance check. The three rival bureaus bid for every
// tender in the career over a spread of seeds, with no player, and this
// prints who won and why. If one bureau's way of building a tank takes
// every tender, the game has one right answer and the numbers in
// `src/data/` need another look.
//
//   npm run sim          the usual spread of seeds
//   npm run sim -- 60    more seeds, for a steadier answer
//
// The game's own code is loaded through Vite, so this runs the same sim the
// page does. Nothing here is shown to the player.
import { createServer } from 'vite'

const asked = Number(process.argv[2])
const server = await createServer({
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true },
})

try {
  const sim = await server.ssrLoadModule('/src/sim/career/balance.ts')
  const { BUREAU_IDS } = await server.ssrLoadModule('/src/data/opponents.ts')
  const { SCORE_AXES, TENDERS } = await server.ssrLoadModule('/src/data/tenders.ts')
  const seeds = sim.balanceSeeds(Number.isInteger(asked) && asked > 0 ? asked : undefined)
  const started = performance.now()
  const tallies = sim.tallyCareer(seeds)

  const pad = (text, width) => String(text).padStart(width)
  console.log(`Balance check: ${seeds.length} seeds for each tender, rival bureaus only.\n`)
  for (const tally of tallies) {
    const tender = TENDERS[tally.tender]
    const weights = SCORE_AXES.map((axis) => `${axis} ${tender.weights[axis]}`).join(', ')
    console.log(`${tally.tender} (${tender.year}). The army weighs: ${weights}.`)
    console.log(`  ${'bureau'.padEnd(10)}${pad('wins', 6)}${pad('marks', 7)}${pad('failed', 8)}${SCORE_AXES.map((axis) => pad(axis.slice(0, 5), 7)).join('')}${pad('thrown out', 12)}`)
    for (const bureau of BUREAU_IDS) {
      const each = tally.bureaus[bureau]
      console.log(
        `  ${bureau.padEnd(10)}${pad(each.wins, 6)}${pad(each.total.toFixed(1), 7)}${pad(each.failed.toFixed(1), 8)}` +
        `${SCORE_AXES.map((axis) => pad(Math.round(each.axes[axis]), 7)).join('')}${pad(each.illegal, 12)}`,
      )
    }
    console.log(`  Leader: ${sim.leaderOf(tally)}.\n`)
  }

  console.log('Share of all tenders run:')
  for (const bureau of BUREAU_IDS) console.log(`  ${bureau.padEnd(10)}${pad(Math.round(sim.shareOf(tallies, bureau) * 100), 4)} %`)
  const verdict = sim.verdictOf(tallies)
  console.log('')
  if (verdict.dominant) console.log(`NOT BALANCED: ${verdict.dominant} leads every tender.`)
  if (verdict.tooStrong.length) console.log(`Too strong: ${verdict.tooStrong.join(', ')}.`)
  if (verdict.tooWeak.length) console.log(`Too weak: ${verdict.tooWeak.join(', ')}.`)
  if (verdict.balanced) console.log('Balanced: no one bureau leads every tender, and every bureau wins its share.')
  console.log(`\n${((performance.now() - started) / 1000).toFixed(1)} s`)
} finally {
  await server.close()
}
