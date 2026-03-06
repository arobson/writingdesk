import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let testDataDir = ''

vi.mock('$lib/server/config.js', () => ({
  getConfig: () => ({
    dataDir: testDataDir,
    github: { oauth: { clientId: '', clientSecret: '' } },
    jwt: { secret: 'test' },
    tokenSecret: 'test',
    origin: 'http://localhost',
  }),
}))

describe('dbPath', () => {
  beforeEach(async () => {
    testDataDir = await mkdtemp(join(tmpdir(), 'wd-storage-'))
    vi.resetModules()
  })
  afterEach(async () => {
    await rm(testDataDir, { recursive: true, force: true })
  })

  it('returns DATA_DIR/db.sqlite', async () => {
    const { dbPath } = await import('$lib/server/storage.js')
    expect(dbPath()).toBe(join(testDataDir, 'db.sqlite'))
  })
})

describe('getWorkspacePath', () => {
  beforeEach(async () => {
    testDataDir = await mkdtemp(join(tmpdir(), 'wd-storage-'))
    vi.resetModules()
  })
  afterEach(async () => {
    await rm(testDataDir, { recursive: true, force: true })
  })

  it('returns DATA_DIR/workspaces/{owner}/{repo}', async () => {
    const { getWorkspacePath } = await import('$lib/server/storage.js')
    const p = getWorkspacePath('alice', 'my-blog')
    expect(p).toBe(join(testDataDir, 'workspaces', 'alice', 'my-blog'))
  })

  it('creates the directory on first call', async () => {
    const { getWorkspacePath } = await import('$lib/server/storage.js')
    const { existsSync } = await import('node:fs')
    const p = getWorkspacePath('alice', 'my-blog')
    expect(existsSync(p)).toBe(true)
  })

  it('two different owners never share a path', async () => {
    const { getWorkspacePath } = await import('$lib/server/storage.js')
    const a = getWorkspacePath('alice', 'blog')
    const b = getWorkspacePath('bob', 'blog')
    expect(a).not.toBe(b)
  })

  it('two different repos for the same owner never share a path', async () => {
    const { getWorkspacePath } = await import('$lib/server/storage.js')
    const a = getWorkspacePath('alice', 'blog-one')
    const b = getWorkspacePath('alice', 'blog-two')
    expect(a).not.toBe(b)
  })

  it('is deterministic — same input always returns same path', async () => {
    const { getWorkspacePath } = await import('$lib/server/storage.js')
    expect(getWorkspacePath('alice', 'blog')).toBe(getWorkspacePath('alice', 'blog'))
  })
})

describe('getWorkspacePath — path traversal prevention', () => {
  beforeEach(async () => {
    testDataDir = await mkdtemp(join(tmpdir(), 'wd-storage-'))
    vi.resetModules()
  })
  afterEach(async () => {
    await rm(testDataDir, { recursive: true, force: true })
  })

  const traversalCases = [
    ['..', 'repo'],
    ['owner', '..'],
    ['../escape', 'repo'],
    ['owner', '../escape'],
    ['', 'repo'],
    ['owner', ''],
    ['own/er', 'repo'],
    ['owner', 're/po'],
    ['own\0er', 'repo'],
  ] as const

  for (const [owner, repo] of traversalCases) {
    it(`rejects owner="${owner}" repo="${repo}"`, async () => {
      const { getWorkspacePath } = await import('$lib/server/storage.js')
      expect(() => getWorkspacePath(owner, repo)).toThrow()
    })
  }
})

describe('existingWorkspacePath', () => {
  beforeEach(async () => {
    testDataDir = await mkdtemp(join(tmpdir(), 'wd-storage-'))
    vi.resetModules()
  })
  afterEach(async () => {
    await rm(testDataDir, { recursive: true, force: true })
  })

  it('returns null when no .git directory exists', async () => {
    const { existingWorkspacePath } = await import('$lib/server/storage.js')
    expect(existingWorkspacePath('alice', 'blog')).toBeNull()
  })

  it('returns the path when a .git directory is present', async () => {
    const { existingWorkspacePath, getWorkspacePath } = await import('$lib/server/storage.js')
    const { mkdirSync } = await import('node:fs')
    const workspacePath = getWorkspacePath('alice', 'blog')
    mkdirSync(join(workspacePath, '.git'), { recursive: true })
    expect(existingWorkspacePath('alice', 'blog')).toBe(workspacePath)
  })
})

describe('resolveWorkspacePath', () => {
  beforeEach(async () => {
    testDataDir = await mkdtemp(join(tmpdir(), 'wd-storage-'))
    vi.resetModules()
  })
  afterEach(async () => {
    await rm(testDataDir, { recursive: true, force: true })
  })

  it('returns the expected path without creating directories', async () => {
    const { resolveWorkspacePath } = await import('$lib/server/storage.js')
    const { existsSync } = await import('node:fs')
    const p = resolveWorkspacePath('alice', 'blog')
    expect(p).toBe(join(testDataDir, 'workspaces', 'alice', 'blog'))
    expect(existsSync(p)).toBe(false)
  })
})
