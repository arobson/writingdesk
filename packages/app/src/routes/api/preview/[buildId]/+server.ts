import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireRole } from '$lib/server/auth.js'
import { getBuild, removeBuild } from '$lib/server/preview/manifest.js'
import { cleanupBuild } from '$lib/server/preview/cleanup.js'
import { deleteBranch } from '$lib/server/github/api.js'

export const GET: RequestHandler = async ({ locals, params }) => {
  requireRole(locals.user, 'author')
  const build = await getBuild(params.buildId)
  if (!build) throw error(404, 'Build not found')
  return json(build)
}

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
  requireRole(locals.user, 'author')

  const build = await getBuild(params.buildId)
  if (!build) throw error(404, 'Build not found')

  const body = await request.json().catch(() => ({})) as { deleteBranch?: boolean }

  await cleanupBuild(params.buildId)
  await removeBuild(params.buildId)

  if (body.deleteBranch) {
    try {
      await deleteBranch(build.branch)
    } catch {
      // branch may already be deleted — not fatal
    }
  }

  return new Response(null, { status: 204 })
}
