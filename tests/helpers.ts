import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('..', import.meta.url))

export function readRepoFile(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8')
}

/** Every file under a repo folder, as repo-relative paths with forward slashes. */
export function listFilesDeep(dir: string): string[] {
  const out: string[] = []
  const walk = (abs: string): void => {
    for (const name of readdirSync(abs)) {
      const path = join(abs, name)
      if (statSync(path).isDirectory()) walk(path)
      else out.push(relative(ROOT, path).split('\\').join('/'))
    }
  }
  try {
    walk(join(ROOT, dir))
  } catch {
    // A folder that does not exist yet has no files.
  }
  return out
}
