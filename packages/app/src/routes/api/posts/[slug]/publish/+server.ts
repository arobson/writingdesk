import { json, error, redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { publishPost } from '$lib/server/posts.js'

export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw redirect(303, '/auth/github')
  if (!locals.blog) throw error(403, 'No blog configured')

  const ctx = { token: locals.blog.token, owner: locals.blog.repoOwner, repo: locals.blog.repoName }
  const { sha } = await request.json() as { sha: string }
  const newSha = await publishPost(ctx, params.slug, sha)
  return json({ sha: newSha })
}
