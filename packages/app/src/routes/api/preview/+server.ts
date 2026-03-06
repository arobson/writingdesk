import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getBuildState, triggerBuild } from '$lib/server/preview/build.js'

// GET /api/preview — return current build state for the user's blog
export const GET: RequestHandler = ({ locals }) => {
  if (!locals.blog) throw error(403, 'No blog connected')
  const st = getBuildState(locals.blog.repoOwner, locals.blog.repoName)
  return json(st)
}

// POST /api/preview — trigger a build (no-op if one is already running)
export const POST: RequestHandler = ({ locals, url }) => {
  if (!locals.blog) throw error(403, 'No blog connected')

  triggerBuild(
    locals.blog.token,
    locals.blog.repoOwner,
    locals.blog.repoName,
    url.origin,
  )

  return json({ status: 'building' })
}
