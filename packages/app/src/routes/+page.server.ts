import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { listPosts } from '$lib/server/posts.js'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.blog) throw redirect(303, '/onboarding')

  const ctx = {
    token: locals.blog.token,
    owner: locals.blog.repoOwner,
    repo: locals.blog.repoName,
  }

  const posts = await listPosts(ctx)
  return {
    posts,
    blog: {
      repoOwner: locals.blog.repoOwner,
      repoName: locals.blog.repoName,
      pagesUrl: locals.blog.pagesUrl,
    },
  }
}
