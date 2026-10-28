// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { verifyPublicData } from '../../scripts/verify-public-data'

const roots: string[] = []
function publicDirectory(): string {
  const root = mkdtempSync(join(tmpdir(), 'lemmings-public-'))
  roots.push(root)
  mkdirSync(join(root, 'data', 'lemmings'), { recursive: true })
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('public game-data protection', () => {
  it('allows only configuration and documentation', () => {
    const root = publicDirectory()
    writeFileSync(join(root, 'data', 'config.json'), '[]')
    writeFileSync(join(root, 'data', 'lemmings', 'README.md'), 'Local setup')
    expect(() => verifyPublicData(root)).not.toThrow()
  })

  it.each(['MAIN.DAT', 'main.dat', 'installer.EXE', 'game.cod'])(
    'rejects unexpected game file %s', (filename) => {
      const root = publicDirectory()
      writeFileSync(join(root, 'data', 'lemmings', filename), 'dummy')
      expect(() => verifyPublicData(root)).toThrow('Original game files must be imported privately')
    }
  )

  it('rejects symlinks, including those posing as documentation', () => {
    const root = publicDirectory()
    symlinkSync(join(root, 'missing'), join(root, 'data', 'lemmings', 'README.md'))
    expect(() => verifyPublicData(root)).toThrow('Unexpected file in public/data')
  })
})
