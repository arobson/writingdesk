import { redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { createPost } from '$lib/server/posts.js'
import { requireRole } from '$lib/server/auth.js'
import { isValidSlug, today } from '$lib/utils.js'

export const load: PageServerLoad = ({ locals }) => {
  requireRole(locals.user, 'author')
  return {}
}

export const actions: Actions = {
  default: async ({ locals, request }) => {
    requireRole(locals.user, 'author')

    const form = await request.formData()
    const slug = String(form.get('slug') ?? '').trim()
    const title = String(form.get('title') ?? '').trim()
    const description = String(form.get('description') ?? '').trim()
    const body = String(form.get('body') ?? '')
    const tagsRaw = String(form.get('tags') ?? '')
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)

    if (!isValidSlug(slug)) return { error: 'Invalid slug' }
    if (!title) return { error: 'Title is required' }

    await createPost({
      slug,
      frontmatter: { title, description, pubDate: today(), tags, draft: true },
      body,
    })

    throw redirect(303, `/posts/${slug}`)
  },
}
