import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { unpublishPost } from '$lib/server/posts.js'
import { requireRole } from '$lib/server/auth.js'

export const POST: RequestHandler = async ({ locals, params, request }) => {
  requireRole(locals.user, 'publisher')
  const { sha } = await request.json() as { sha: string }
  const newSha = await unpublishPost(params.slug, sha)
  return json({ sha: newSha })
}
