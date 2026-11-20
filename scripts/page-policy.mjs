// Writes the page's Content-Security-Policy into dist/index.html after a build.
// The policy is a list the browser enforces: which files the page may run and
// where it may send anything. A script slipped in from anywhere else (a
// tampered package, a hostile browser add-on's leftovers, markup from a save)
// is refused, and so is sending a save to an outside address.
//
// The page's own two small inline scripts (the saved look, the Reload button)
// are allowed by fingerprint: this script hashes each one as built, so editing
// them needs no change here. `npm run dev` has no policy; only builds do.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Cloudflare Web Analytics, the one outside address the game uses (CLAUDE.md, Stack). */
const COUNTER_SCRIPT = 'https://static.cloudflareinsights.com'
const COUNTER_REPORT = 'https://cloudflareinsights.com'

/** The sha256 fingerprint of each inline script in the page, in the form the policy wants. */
export function inlineScriptHashes(html) {
  const hashes = []
  for (const match of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    const attrs = match[1] ?? ''
    if (/\ssrc\s*=/.test(attrs)) continue
    hashes.push(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`)
  }
  return hashes
}

/** The policy for a built page. Everything is the game's own files unless a line says otherwise. */
export function pagePolicy(html) {
  return [
    "default-src 'self'",
    // The game's own scripts, its inline scripts by fingerprint, and the visit counter. No eval.
    ['script-src', "'self'", ...inlineScriptHashes(html), COUNTER_SCRIPT].join(' '),
    // Screens set sizes and colours with style attributes, and the splash has an inline style block.
    "style-src 'self' 'unsafe-inline'",
    // Share cards and the 3D kit's textures are pictures made in the browser (blob: and data:).
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "media-src 'self' blob:",
    // The game fetches only its own files; blob: is the 3D kit reading its own textures.
    `connect-src 'self' blob: ${COUNTER_REPORT}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ')
}

/** The page with the policy as the first thing after the charset line, before any script. */
export function withPolicy(html) {
  if (html.includes('http-equiv="Content-Security-Policy"')) throw new Error('The page already has a policy.')
  const charset = /<meta charset="[^"]*"\s*\/?>/i
  if (!charset.test(html)) throw new Error('No charset line to put the policy after.')
  const policy = pagePolicy(html).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  return html.replace(charset, (line) => `${line}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
}

function main() {
  const page = fileURLToPath(new URL('../dist/index.html', import.meta.url))
  const html = readFileSync(page, 'utf8')
  writeFileSync(page, withPolicy(html))
  console.log(`Page policy: written, ${inlineScriptHashes(html).length} inline scripts allowed by fingerprint.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
