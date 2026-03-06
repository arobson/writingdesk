import { redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { createPost } from '$lib/server/posts.js'
import { isValidSlug, today } from '$lib/utils.js'

export const load: PageServerLoad = ({ locals }) => {
  if (!locals.blog) throw redirect(303, '/onboarding')
  return {}
}

export const actions: Actions = {
  default: async ({ locals, request }) => {
    if (!locals.blog) throw redirect(303, '/onboarding')
    const ctx = { token: locals.blog.token, owner: locals.blog.repoOwner, repo: locals.blog.repoName }

    const form = await request.formData()
    const slug = String(form.get('slug') ?? '').trim()
    const title = String(form.get('title') ?? '').trim()
    const description = String(form.get('description') ?? '').trim()
    const body = String(form.get('body') ?? '')
    const tags = String(form.get('tags') ?? '').split(',').map(t => t.trim()).filter(Boolean)

    if (!isValidSlug(slug)) return { error: 'Invalid slug' }
    if (!title) return { error: 'Title is required' }

    await createPost(ctx, {
      slug,
      frontmatter: { title, description, pubDate: today(), tags, draft: true },
      body,
    })

    throw redirect(303, `/posts/${slug}`)
  },
}
