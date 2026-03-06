import { json, error, redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getPost, updatePost, deletePost } from '$lib/server/posts.js'
import { isValidSlug } from '$lib/utils.js'

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) throw redirect(303, '/auth/github')
  if (!locals.blog) throw error(403, 'No blog configured')

  const ctx = { token: locals.blog.token, owner: locals.blog.repoOwner, repo: locals.blog.repoName }
  try {
    return json(await getPost(ctx, params.slug))
  } catch {
    throw error(404, 'Post not found')
  }
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw redirect(303, '/auth/github')
  if (!locals.blog) throw error(403, 'No blog configured')

  const ctx = { token: locals.blog.token, owner: locals.blog.repoOwner, repo: locals.blog.repoName }
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

  const sha = await updatePost(ctx, {
    slug: newSlug,
    previousSlug: params.slug !== newSlug ? params.slug : undefined,
    frontmatter: body.frontmatter as never,
    body: body.body,
    sha: body.sha,
  })

  return json({ slug: newSlug, sha })
}

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw redirect(303, '/auth/github')
  if (!locals.blog) throw error(403, 'No blog configured')

  const ctx = { token: locals.blog.token, owner: locals.blog.repoOwner, repo: locals.blog.repoName }
  const body = await request.json() as { sha: string }
  await deletePost(ctx, params.slug, body.sha)
  return new Response(null, { status: 204 })
}
