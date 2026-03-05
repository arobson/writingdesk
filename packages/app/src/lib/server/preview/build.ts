import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { getConfig } from '../config.js'
import { fetchBranch, ensureCloned } from '../github/index.js'
import { updateBuild } from './manifest.js'

const exec = promisify(execFile)

function run(cmd: string, args: string[], env?: NodeJS.ProcessEnv): Promise<void> {
  const config = getConfig()
  return exec(cmd, args, {
    cwd: config.git.workDir,
    env: { ...process.env, ...env },
  }).then(() => void 0)
}

export async function runBuild(buildId: string, branch: string, slug: string): Promise<void> {
  const config = getConfig()
  const outDir = join(config.astro.buildDir, buildId)

  await updateBuild(buildId, { status: 'building', startedAt: new Date().toISOString() })

  try {
    await ensureCloned()
    await fetchBranch(branch)
    await mkdir(outDir, { recursive: true })

    await run('npm', ['ci', '--prefer-offline'])
    await run('npx', ['astro', 'build', '--outDir', outDir], {
      ASTRO_BASE_PATH: `/preview/${buildId}`,
    })

    await updateBuild(buildId, {
      status: 'success',
      completedAt: new Date().toISOString(),
      previewPath: `/preview/${buildId}/`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    await updateBuild(buildId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      error: message,
    })
  }
}
