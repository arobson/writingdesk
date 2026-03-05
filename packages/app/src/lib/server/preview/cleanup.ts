import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { getConfig } from '../config.js'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { BuildRecord } from './manifest.js'

const MAX_AGE_DAYS = 7

function manifestPath(): string {
  return join(getConfig().astro.buildDir, 'manifest.json')
}

export async function cleanupBuild(buildId: string): Promise<void> {
  const outDir = join(getConfig().astro.buildDir, buildId)
  if (existsSync(outDir)) {
    await rm(outDir, { recursive: true, force: true })
  }
}

export async function cleanupStaleBuilds(): Promise<void> {
  if (!existsSync(manifestPath())) return

  const raw = await readFile(manifestPath(), 'utf-8')
  const records = JSON.parse(raw) as BuildRecord[]
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  const stale = records.filter(r => {
    const ts = r.completedAt ? new Date(r.completedAt).getTime() : 0
    return ts > 0 && ts < cutoff
  })

  await Promise.all(stale.map(r => cleanupBuild(r.id)))
  const remaining = records.filter(r => !stale.includes(r))
  await writeFile(manifestPath(), JSON.stringify(remaining, null, 2), 'utf-8')
}
