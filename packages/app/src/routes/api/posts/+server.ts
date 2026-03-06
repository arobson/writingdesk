import { json, error, redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { listPosts, createPost } from '$lib/server/posts.js'
import { isValidSlug } from '$lib/utils.js'

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/github')
  if (!locals.blog) throw error(403, 'No blog configured')

  const ctx = { token: locals.blog.token, owner: locals.blog.repoOwner, repo: locals.blog.repoName }
  return json(await listPosts(ctx))
}

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) throw redirect(303, '/auth/github')
  if (!locals.blog) throw error(403, 'No blog configured')

  const ctx = { token: locals.blog.token, owner: locals.blog.repoOwner, repo: locals.blog.repoName }
  const body = await request.json() as { slug: string; frontmatter: Record<string, unknown>; body: string }

  if (!body.slug || !isValidSlug(body.slug)) {
    return json({ error: 'Invalid slug', code: 'INVALID_SLUG' }, { status: 422 })
  }

  const sha = await createPost(ctx, {
    slug: body.slug,
    frontmatter: body.frontmatter as never,
    body: body.body ?? '',
  })

  return json({ slug: body.slug, sha }, { status: 201 })
}
