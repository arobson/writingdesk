import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// We need getConfig() to return a temp directory as astro.buildDir.
// Mock the entire config module before importing the manifest module.
let testBuildDir = ''

vi.mock('$lib/server/config.js', () => ({
  getConfig: () => ({
    astro: { buildDir: testBuildDir },
    github: {
      appId: 1, privateKey: '', installationId: 1,
      oauth: { clientId: '', clientSecret: '' },
      owner: 'owner', repo: 'repo',
      contentPath: 'src/content/blog', defaultBranch: 'main',
    },
    jwt: { secret: 'test-secret' },
    git: { workDir: '/tmp' },
  }),
}))

function makeRecord(id: string, slug = 'my-post') {
  return {
    id,
    slug,
    branch: `writingdesk/preview/${slug}`,
    status: 'queued' as const,
    startedAt: null,
    completedAt: null,
    previewPath: null,
    error: null,
  }
}

describe('manifest', () => {
  beforeEach(async () => {
    testBuildDir = await mkdtemp(join(tmpdir(), 'wd-manifest-'))
    vi.resetModules()
  })

  afterEach(async () => {
    await rm(testBuildDir, { recursive: true, force: true })
  })

  it('addBuild stores a record and getBuild retrieves it', async () => {
    const { addBuild, getBuild } = await import('$lib/server/preview/manifest.js')
    const record = makeRecord('build-001')
    await addBuild(record)
    const retrieved = await getBuild('build-001')
    expect(retrieved).toEqual(record)
  })

  it('getBuild returns null for unknown id', async () => {
    const { getBuild } = await import('$lib/server/preview/manifest.js')
    expect(await getBuild('nonexistent')).toBeNull()
  })

  it('updateBuild patches an existing record', async () => {
    const { addBuild, updateBuild, getBuild } = await import('$lib/server/preview/manifest.js')
    await addBuild(makeRecord('build-002'))
    await updateBuild('build-002', { status: 'building', startedAt: '2024-06-01T10:00:00Z' })
    const record = await getBuild('build-002')
    expect(record!.status).toBe('building')
    expect(record!.startedAt).toBe('2024-06-01T10:00:00Z')
  })

  it('updateBuild throws for unknown id', async () => {
    const { updateBuild } = await import('$lib/server/preview/manifest.js')
    await expect(updateBuild('nope', { status: 'failed' })).rejects.toThrow('Build not found: nope')
  })

  it('removeBuild deletes the record', async () => {
    const { addBuild, removeBuild, getBuild } = await import('$lib/server/preview/manifest.js')
    await addBuild(makeRecord('build-003'))
    await removeBuild('build-003')
    expect(await getBuild('build-003')).toBeNull()
  })

  it('removeBuild is idempotent for unknown id', async () => {
    const { removeBuild } = await import('$lib/server/preview/manifest.js')
    await expect(removeBuild('nonexistent')).resolves.toBeUndefined()
  })

  it('pruneOldBuilds removes builds beyond limit of 5', async () => {
    const { addBuild, getBuild, pruneOldBuilds } = await import('$lib/server/preview/manifest.js')

    // Add 7 builds for same slug
    for (let i = 1; i <= 7; i++) {
      await addBuild(makeRecord(`build-${String(i).padStart(3, '0')}`, 'prune-test'))
    }

    const removed = await pruneOldBuilds('prune-test')
    expect(removed).toHaveLength(2)

    // The 2 oldest (lowest id) should be removed
    for (const id of removed) {
      expect(await getBuild(id)).toBeNull()
    }
  })

  it('pruneOldBuilds does not affect other slugs', async () => {
    const { addBuild, getBuild, pruneOldBuilds } = await import('$lib/server/preview/manifest.js')

    for (let i = 1; i <= 6; i++) {
      await addBuild(makeRecord(`a-${i}`, 'slug-a'))
    }
    await addBuild(makeRecord('b-1', 'slug-b'))

    await pruneOldBuilds('slug-a')

    // slug-b record should be untouched
    expect(await getBuild('b-1')).not.toBeNull()
  })

  it('returns empty array when fewer than limit builds exist', async () => {
    const { addBuild, pruneOldBuilds } = await import('$lib/server/preview/manifest.js')

    await addBuild(makeRecord('only-1', 'sparse'))
    const removed = await pruneOldBuilds('sparse')
    expect(removed).toHaveLength(0)
  })

  it('reads empty array when manifest file does not exist yet', async () => {
    const { getBuild } = await import('$lib/server/preview/manifest.js')
    // No writes done — manifest.json doesn't exist — should gracefully return null
    expect(await getBuild('anything')).toBeNull()
  })
})
