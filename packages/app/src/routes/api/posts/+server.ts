import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { listPosts, createPost } from '$lib/server/posts.js'
import { requireRole } from '$lib/server/auth.js'
import { isValidSlug } from '$lib/utils.js'

export const GET: RequestHandler = async ({ locals }) => {
  requireRole(locals.user, 'author')
  return json(await listPosts())
}

export const POST: RequestHandler = async ({ locals, request }) => {
  requireRole(locals.user, 'author')

  const body = await request.json() as { slug: string; frontmatter: Record<string, unknown>; body: string }

  if (!body.slug || !isValidSlug(body.slug)) {
    return json({ error: 'Invalid slug', code: 'INVALID_SLUG' }, { status: 422 })
  }

  const sha = await createPost({
    slug: body.slug,
    frontmatter: body.frontmatter as never,
    body: body.body ?? '',
  })

  return json({ slug: body.slug, sha }, { status: 201 })
}
