import { error, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { getPost, updatePost, publishPost, unpublishPost, deletePost } from '$lib/server/posts.js'
import { requireRole } from '$lib/server/auth.js'
import { isValidSlug } from '$lib/utils.js'

export const load: PageServerLoad = async ({ locals, params }) => {
  requireRole(locals.user, 'author')
  try {
    const post = await getPost(params.slug)
    return { post }
  } catch {
    throw error(404, 'Post not found')
  }
}

export const actions: Actions = {
  save: async ({ locals, params, request }) => {
    requireRole(locals.user, 'author')

    const form = await request.formData()
    const sha = String(form.get('sha') ?? '')
    const newSlug = String(form.get('slug') ?? params.slug).trim()
    const title = String(form.get('title') ?? '').trim()
    const description = String(form.get('description') ?? '').trim()
    const pubDate = String(form.get('pubDate') ?? '').trim()
    const heroImage = String(form.get('heroImage') ?? '').trim() || undefined
    const tagsRaw = String(form.get('tags') ?? '')
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
    const body = String(form.get('body') ?? '')
    const draft = form.get('draft') !== 'false'

    if (!isValidSlug(newSlug)) return { error: 'Invalid slug' }

    const newSha = await updatePost({
      slug: newSlug,
      previousSlug: params.slug !== newSlug ? params.slug : undefined,
      frontmatter: { title, description, pubDate, heroImage, tags, draft },
      body,
      sha,
    })

    if (newSlug !== params.slug) throw redirect(303, `/posts/${newSlug}`)
    return { sha: newSha }
  },

  publish: async ({ locals, params, request }) => {
    requireRole(locals.user, 'publisher')
    const form = await request.formData()
    const sha = String(form.get('sha') ?? '')
    const newSha = await publishPost(params.slug, sha)
    return { sha: newSha }
  },

  unpublish: async ({ locals, params, request }) => {
    requireRole(locals.user, 'publisher')
    const form = await request.formData()
    const sha = String(form.get('sha') ?? '')
    const newSha = await unpublishPost(params.slug, sha)
    return { sha: newSha }
  },

  delete: async ({ locals, params, request }) => {
    requireRole(locals.user, 'publisher')
    const form = await request.formData()
    const sha = String(form.get('sha') ?? '')
    await deletePost(params.slug, sha)
    throw redirect(303, '/')
  },
}
