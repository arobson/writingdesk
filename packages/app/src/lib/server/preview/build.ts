/**
 * Async Astro blog build runner.
 *
 * Clones (or pulls) the user's GitHub repo into the local workspace, runs
 * `npm install` + `npm run build` with ASTRO_SITE/ASTRO_BASE set so that
 * internal links resolve correctly when served at /preview/{owner}/{repo}/.
 *
 * Build state is kept in an in-memory Map — it resets on server restart,
 * which just means the user has to trigger a rebuild. Acceptable for previews.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getWorkspacePath, existingWorkspacePath } from '../storage.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type BuildStatus = 'idle' | 'building' | 'success' | 'error'

export interface BuildState {
  status: BuildStatus
  startedAt?: string
  finishedAt?: string
  error?: string
}

// ── In-memory state ───────────────────────────────────────────────────────────

const state = new Map<string, BuildState>()

function key(owner: string, repo: string) {
  return `${owner}/${repo}`
}

export function getBuildState(owner: string, repo: string): BuildState {
  return state.get(key(owner, repo)) ?? { status: 'idle' }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Starts an async build for the given repo. Returns immediately; callers poll
 * getBuildState() to track progress. Ignores the call if a build is already
 * running.
 */
export function triggerBuild(
  token: string,
  owner: string,
  repo: string,
  origin: string,
): void {
  const k = key(owner, repo)
  if (state.get(k)?.status === 'building') return

  state.set(k, { status: 'building', startedAt: new Date().toISOString() })

  runBuild(token, owner, repo, origin)
    .then(() => {
      state.set(k, { status: 'success', finishedAt: new Date().toISOString() })
    })
    .catch((err: unknown) => {
      const error = err instanceof Error ? err.message : String(err)
      state.set(k, { status: 'error', error, finishedAt: new Date().toISOString() })
    })
}

// ── Build steps ───────────────────────────────────────────────────────────────

async function runBuild(
  token: string,
  owner: string,
  repo: string,
  origin: string,
): Promise<void> {
  const workspace = getWorkspacePath(owner, repo)
  const hasGit = existsSync(join(workspace, '.git'))

  if (hasGit) {
    // Pull latest changes, authenticating via a transient http header so the
    // token is never written to .git/config.
    await exec(
      'git',
      ['-c', `http.extraHeader=Authorization: Bearer ${token}`, 'pull', '--rebase', '--autostash'],
      workspace,
    )
  } else {
    // First-time clone — embed the token in the URL, then immediately clear it
    // from the stored remote so it isn't persisted to disk.
    const cloneUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`
    await exec('git', ['clone', cloneUrl, '.'], workspace)
    await exec('git', ['remote', 'set-url', 'origin', `https://github.com/${owner}/${repo}.git`], workspace)
  }

  // Install dependencies (uses lock file if present, falls back to npm install)
  const hasLockfile = existsSync(join(workspace, 'package-lock.json'))
  await exec('npm', hasLockfile ? ['ci'] : ['install'], workspace)

  // Build with preview-specific ASTRO_SITE / ASTRO_BASE so internal links work
  // when served from /preview/{owner}/{repo}/.
  await exec('npm', ['run', 'build'], workspace, {
    ASTRO_SITE: origin,
    ASTRO_BASE: `/preview/${owner}/${repo}`,
  })
}

// ── Subprocess helper ─────────────────────────────────────────────────────────

function exec(
  cmd: string,
  args: string[],
  cwd: string,
  extraEnv?: Record<string, string>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...extraEnv },
      stdio: 'pipe',
    })

    const output: string[] = []
    child.stdout.on('data', (d: Buffer) => output.push(d.toString()))
    child.stderr.on('data', (d: Buffer) => output.push(d.toString()))

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(
          `\`${cmd} ${args.join(' ')}\` exited with code ${code}:\n${output.join('').slice(-2000)}`,
        ))
      }
    })

    child.on('error', reject)
  })
}
