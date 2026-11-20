import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT, readRepoFile } from './helpers'

// The page policy (Content-Security-Policy, 1.8.6.3): the built page tells the
// browser which files it may run and where it may send anything. These tests
// run the real build step against the real page.

interface PagePolicy {
  inlineScriptHashes: (html: string) => string[]
  pagePolicy: (html: string) => string
  withPolicy: (html: string) => string
}

const SCRIPT = join(ROOT, 'scripts/page-policy.mjs')
const load = async (): Promise<PagePolicy> => (await import(/* @vite-ignore */ SCRIPT)) as PagePolicy
const page = readRepoFile('index.html')

/** One part of the policy, as its list of words: `script-src` gives `'self'`, the fingerprints and so on. */
function part(policy: string, name: string): string[] {
  const found = policy.split('; ').find((each) => each.startsWith(`${name} `))
  return found ? found.split(' ').slice(1) : []
}

describe('page policy', () => {
  it('allows each of the page’s own inline scripts by fingerprint, and no others', async () => {
    const { inlineScriptHashes, pagePolicy } = await load()
    const hashes = inlineScriptHashes(page)
    // The saved look, and the Reload button. The game's bundle and the visit counter are files, not inline.
    expect(hashes).toHaveLength(2)
    const scripts = part(pagePolicy(page), 'script-src')
    for (const hash of hashes) expect(scripts).toContain(hash)
    expect(scripts).not.toContain("'unsafe-inline'")
    expect(scripts).not.toContain("'unsafe-eval'")
    // A fingerprint is of the exact text: one changed letter and the script would be refused.
    const sample = '<script>let a = 1</script>'
    expect(inlineScriptHashes(sample)).toEqual([`'sha256-${createHash('sha256').update('let a = 1').digest('base64')}'`])
    expect(inlineScriptHashes('<script>let a = 2</script>')).not.toEqual(inlineScriptHashes(sample))
    expect(inlineScriptHashes('<script type="module" src="./a.js"></script>')).toEqual([])
  })

  it('lets the page reach its own files and the visit counter, and nowhere else', async () => {
    const { pagePolicy } = await load()
    const policy = pagePolicy(page)
    const outside = policy.match(/https?:\/\/[^\s;]+/g) ?? []
    expect([...new Set(outside)].sort()).toEqual(['https://cloudflareinsights.com', 'https://static.cloudflareinsights.com'])
    expect(part(policy, 'default-src')).toEqual(["'self'"])
    expect(part(policy, 'object-src')).toEqual(["'none'"])
    expect(part(policy, 'base-uri')).toEqual(["'self'"])
    expect(part(policy, 'form-action')).toEqual(["'none'"])
    expect(policy).not.toContain('*')
    // What the game makes in the browser: share cards and the 3D kit's textures.
    expect(part(policy, 'img-src')).toEqual(expect.arrayContaining(["'self'", 'data:', 'blob:']))
    expect(part(policy, 'connect-src')).toEqual(expect.arrayContaining(["'self'", 'blob:', 'https://cloudflareinsights.com']))
    expect(part(policy, 'worker-src')).toEqual(["'self'"])
  })

  it('goes into the page before any script, once', async () => {
    const { withPolicy } = await load()
    const built = withPolicy(page)
    const at = built.indexOf('http-equiv="Content-Security-Policy"')
    expect(at).toBeGreaterThan(built.indexOf('<meta charset'))
    expect(at).toBeLessThan(built.indexOf('<script'))
    expect(built.replace(/\n {4}<meta http-equiv="Content-Security-Policy"[^>]*>/, '')).toBe(page)
    expect(() => withPolicy(built)).toThrow()
    expect(() => withPolicy('<html><head></head></html>')).toThrow()
  })

  it('is written after every build, before the offline copy is fingerprinted', () => {
    const scripts = (JSON.parse(readRepoFile('package.json')) as { scripts: Record<string, string> }).scripts
    const order = scripts.postbuild ?? ''
    expect(order).toContain('scripts/page-policy.mjs')
    expect(order.indexOf('scripts/page-policy.mjs')).toBeLessThan(order.indexOf('scripts/make-sw.mjs'))
    // The page in the repo carries no policy of its own: `npm run dev` needs none.
    expect(page).not.toContain('Content-Security-Policy')
  })
})
