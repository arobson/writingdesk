/**
 * Storage layout and path utilities.
 *
 * All persistent data lives under a single DATA_DIR root, which should be
 * a PersistentVolumeClaim mount point in Kubernetes.
 *
 * Layout:
 *   DATA_DIR/
 *   ├── db.sqlite
 *   └── workspaces/
 *       └── {github_owner}/
 *           └── {repo_name}/     ← git clone of the user's blog repo
 *
 * Isolation guarantee:
 *   GitHub enforces global uniqueness of owner/repo pairs, so the two-level
 *   directory structure provides natural, collision-free isolation between
 *   all blogs managed by this WritingDesk instance.
 *
 *   getWorkspacePath() additionally validates that the resolved path is
 *   strictly inside DATA_DIR/workspaces/, preventing any path traversal
 *   via crafted owner or repo values.
 */

import { mkdirSync, realpathSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getConfig } from './config.js'

// ── Path helpers ──────────────────────────────────────────────────────────────

export function dataDir(): string {
  return getConfig().dataDir
}

export function dbPath(): string {
  return join(dataDir(), 'db.sqlite')
}

function workspacesRoot(): string {
  return join(dataDir(), 'workspaces')
}

/**
 * Returns the absolute path to the on-disk workspace for a given blog repo.
 *
 * Throws if either component contains path-traversal sequences or characters
 * that would escape the workspaces root, and after directory creation
 * additionally verifies the resolved real path is inside the expected root.
 */
export function getWorkspacePath(owner: string, repo: string): string {
  validatePathComponent(owner, 'owner')
  validatePathComponent(repo, 'repo')

  const root = workspacesRoot()
  const candidate = join(root, owner, repo)

  // Ensure parent directories exist before attempting realpathSync
  mkdirSync(candidate, { recursive: true })

  // Resolve symlinks and verify the real path stays inside the root.
  // This catches any symlink-based escape that survived the component check.
  const real = realpathSync(candidate)
  const expectedRoot = existsSync(root) ? realpathSync(root) : root
  if (!real.startsWith(expectedRoot + '/') && real !== expectedRoot) {
    throw new Error(
      `Workspace path escapes storage root: ${real} is not inside ${expectedRoot}`,
    )
  }

  return real
}

/**
 * Returns the workspace path only if it has already been initialised
 * (i.e. a git clone exists there). Returns null if the directory is absent.
 */
export function existingWorkspacePath(owner: string, repo: string): string | null {
  validatePathComponent(owner, 'owner')
  validatePathComponent(repo, 'repo')
  const candidate = join(workspacesRoot(), owner, repo)
  return existsSync(join(candidate, '.git')) ? candidate : null
}

// ── Validation ────────────────────────────────────────────────────────────────

const SAFE_COMPONENT = /^[a-zA-Z0-9._-]+$/

/**
 * Validates a single path component (owner or repo name).
 *
 * GitHub allows letters, digits, hyphens, underscores, and dots in owner/repo
 * names. We enforce the same character set and additionally prohibit:
 *   - Empty strings
 *   - Dot-only names (`.`, `..`)
 *   - Any character outside the safe set (catches `/`, `\`, null bytes, etc.)
 */
function validatePathComponent(value: string, label: string): void {
  if (!value || !SAFE_COMPONENT.test(value) || value === '.' || value === '..') {
    throw new Error(
      `Invalid ${label} for storage path: "${value}". ` +
      'Must be non-empty and contain only letters, digits, hyphens, underscores, or dots.',
    )
  }
}

// ── Kubernetes / deployment notes (surfaced at startup) ───────────────────────

/**
 * Emits a structured description of the storage layout to stdout.
 * Called once at server startup so operators can confirm the mount point.
 */
export function logStorageConfig(): void {
  const root = dataDir()
  console.info('[storage] DATA_DIR    :', root)
  console.info('[storage] database    :', dbPath())
  console.info('[storage] workspaces  :', workspacesRoot())
  console.info(
    '[storage] Kubernetes  : mount a PersistentVolumeClaim at DATA_DIR.',
    'Use ReadWriteOnce for single-replica, ReadWriteMany for HA.',
  )
}

/**
 * Resolves the absolute path for a component without creating directories.
 * Useful for constructing expected paths in tests.
 */
export function resolveWorkspacePath(owner: string, repo: string): string {
  validatePathComponent(owner, 'owner')
  validatePathComponent(repo, 'repo')
  return resolve(workspacesRoot(), owner, repo)
}
