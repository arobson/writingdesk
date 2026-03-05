import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireRole } from '$lib/server/auth.js'
import { getBuild, updateBuild } from '$lib/server/preview/manifest.js'
import { mergePreviewBranch } from '$lib/server/github/index.js'

export const POST: RequestHandler = async ({ locals, params }) => {
  requireRole(locals.user, 'publisher')

  const build = await getBuild(params.buildId)
  if (!build) throw error(404, 'Build not found')
  if (build.status !== 'success') throw error(409, 'Build has not succeeded')

  const sha = await mergePreviewBranch(build.branch, build.slug)
  await updateBuild(params.buildId, { status: 'success' })

  return json({ merged: true, sha })
}
