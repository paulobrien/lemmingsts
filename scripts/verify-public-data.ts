import { existsSync, lstatSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** Do not let Vite serve or copy private game files from its public directory. */
export function verifyPublicData(publicDir: string): void {
  const dataDir = join(publicDir, 'data')
  if (!existsSync(dataDir)) return
  if (!lstatSync(dataDir).isDirectory()) {
    throw new Error('public/data must be a real directory, not a symlink or file')
  }

  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      const relativePath = relative(dataDir, path).split(sep).join('/')
      if (entry.isDirectory()) {
        visit(path)
      } else if (!(entry.isFile() && (entry.name === 'README.md' || relativePath === 'config.json'))) {
        throw new Error(
          `Unexpected file in public/data: ${relativePath}. ` +
          'Original game files must be imported privately, not served or included in the build.'
        )
      }
    }
  }
  visit(dataDir)
}
