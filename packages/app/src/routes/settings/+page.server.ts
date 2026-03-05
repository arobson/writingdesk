import type { PageServerLoad } from './$types'
import { requireRole } from '$lib/server/auth.js'
import { getConfig } from '$lib/server/config.js'
import { getRepoInfo } from '$lib/server/github/index.js'

export const load: PageServerLoad = async ({ locals }) => {
  requireRole(locals.user, 'publisher')
  const { owner, repo, contentPath, defaultBranch } = getConfig().github

  let repoStatus: { ok: boolean; repoFullName?: string; repoPrivate?: boolean; error?: string }
  try {
    const info = await getRepoInfo()
    repoStatus = { ok: true, repoFullName: info.fullName, repoPrivate: info.private }
  } catch (err: unknown) {
    repoStatus = { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }

  return {
    config: { owner, repo, contentPath, defaultBranch, repoUrl: `https://github.com/${owner}/${repo}` },
    repoStatus,
  }
}
