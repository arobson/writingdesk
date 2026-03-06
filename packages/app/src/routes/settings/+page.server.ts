import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = ({ locals }) => {
  if (!locals.blog) throw redirect(303, '/onboarding')

  return {
    blog: {
      repoOwner: locals.blog.repoOwner,
      repoName: locals.blog.repoName,
      pagesUrl: locals.blog.pagesUrl,
      repoUrl: `https://github.com/${locals.blog.repoOwner}/${locals.blog.repoName}`,
      actionsUrl: `https://github.com/${locals.blog.repoOwner}/${locals.blog.repoName}/actions`,
    },
  }
}
