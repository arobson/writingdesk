import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireRole } from '$lib/server/auth.js'
import { getConfig } from '$lib/server/config.js'

export const GET: RequestHandler = ({ locals }) => {
  requireRole(locals.user, 'publisher')
  const { owner, repo, contentPath, defaultBranch } = getConfig().github
  return json({
    owner,
    repo,
    contentPath,
    defaultBranch,
    repoUrl: `https://github.com/${owner}/${repo}`,
  })
}
