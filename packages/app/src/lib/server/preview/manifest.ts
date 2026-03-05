import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getConfig } from '../config.js'

export type BuildStatus = 'queued' | 'building' | 'success' | 'failed'

export interface BuildRecord {
  id: string
  slug: string
  branch: string
  status: BuildStatus
  startedAt: string | null
  completedAt: string | null
  previewPath: string | null
  error: string | null
}

const MAX_BUILDS_PER_SLUG = 5

function manifestPath(): string {
  return join(getConfig().astro.buildDir, 'manifest.json')
}

async function readManifest(): Promise<BuildRecord[]> {
  try {
    const raw = await readFile(manifestPath(), 'utf-8')
    return JSON.parse(raw) as BuildRecord[]
  } catch {
    return []
  }
}

async function writeManifest(records: BuildRecord[]): Promise<void> {
  const dir = getConfig().astro.buildDir
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(manifestPath(), JSON.stringify(records, null, 2), 'utf-8')
}

export async function addBuild(record: BuildRecord): Promise<void> {
  const records = await readManifest()
  records.push(record)
  await writeManifest(records)
}

export async function updateBuild(id: string, patch: Partial<BuildRecord>): Promise<void> {
  const records = await readManifest()
  const idx = records.findIndex(r => r.id === id)
  if (idx === -1) throw new Error(`Build not found: ${id}`)
  records[idx] = { ...records[idx], ...patch }
  await writeManifest(records)
}

export async function getBuild(id: string): Promise<BuildRecord | null> {
  const records = await readManifest()
  return records.find(r => r.id === id) ?? null
}

export async function removeBuild(id: string): Promise<void> {
  const records = await readManifest()
  await writeManifest(records.filter(r => r.id !== id))
}

export async function pruneOldBuilds(slug: string): Promise<string[]> {
  const records = await readManifest()
  const forSlug = records.filter(r => r.slug === slug).sort((a, b) => (b.id > a.id ? 1 : -1))
  const toRemove = forSlug.slice(MAX_BUILDS_PER_SLUG)
  const removedIds = toRemove.map(r => r.id)
  await writeManifest(records.filter(r => !removedIds.includes(r.id)))
  return removedIds
}
