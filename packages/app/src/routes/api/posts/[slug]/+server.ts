import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getPost, updatePost, deletePost } from '$lib/server/posts.js'
import { requireRole } from '$lib/server/auth.js'
import { isValidSlug } from '$lib/utils.js'

export const GET: RequestHandler = async ({ locals, params }) => {
  requireRole(locals.user, 'author')
  try {
    return json(await getPost(params.slug))
  } catch {
    throw error(404, 'Post not found')
  }
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  requireRole(locals.user, 'author')

  const body = await request.json() as {
    sha: string
    newSlug?: string
    frontmatter: Record<string, unknown>
    body: string
  }

  const newSlug = body.newSlug ?? params.slug
  if (!isValidSlug(newSlug)) {
    return json({ error: 'Invalid slug', code: 'INVALID_SLUG' }, { status: 422 })
  }

  const sha = await updatePost({
    slug: newSlug,
    previousSlug: params.slug !== newSlug ? params.slug : undefined,
    frontmatter: body.frontmatter as never,
    body: body.body,
    sha: body.sha,
  })

  return json({ slug: newSlug, sha })
}

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
  requireRole(locals.user, 'publisher')

  const body = await request.json() as { sha: string }
  await deletePost(params.slug, body.sha)
  return new Response(null, { status: 204 })
}
