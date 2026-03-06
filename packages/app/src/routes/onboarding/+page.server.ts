import { redirect, fail } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'
import { createRepo, enableGithubPages, commitFiles } from '$lib/server/github/index.js'
import { scaffoldFiles } from '$lib/server/github/scaffold.js'
import { getDb, schema } from '$lib/server/db/index.js'
import { eq } from 'drizzle-orm'
import { isValidSlug } from '$lib/utils.js'
import { decryptToken } from '$lib/server/auth.js'

export const load: PageServerLoad = async ({ locals }) => {
  // If the user already has a blog, send them to the editor
  if (locals.blog) throw redirect(303, '/')
  return { login: locals.user!.login }
}

export const actions: Actions = {
  create: async ({ locals, request }) => {
    const user = locals.user!
    const db = getDb()

    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.id, user.userId))
    if (!dbUser) return fail(401, { error: 'Session user not found.' })

    const token = decryptToken(dbUser.accessToken)

    const data = await request.formData()
    const blogTitle = (data.get('blogTitle') as string ?? '').trim()
    const repoSlug = (data.get('repoSlug') as string ?? '').trim()

    if (!blogTitle) return fail(422, { error: 'Blog title is required.' })
    if (!repoSlug || !isValidSlug(repoSlug)) {
      return fail(422, { error: 'Repository name must be lowercase letters, numbers, and hyphens only.' })
    }

    try {
      // 1. Create the GitHub repository
      const { owner, repo } = await createRepo(token, repoSlug, `${blogTitle} — built with Astro & WritingDesk`)

      // 2. Scaffold all Astro files and commit them
      const files = scaffoldFiles(blogTitle)
      await commitFiles(token, owner, repo, files, 'chore: initialise Astro blog with WritingDesk')

      // 3. Enable GitHub Pages (Actions-based deploy)
      try {
        await enableGithubPages(token, owner, repo)
      } catch {
        // Pages activation can fail transiently or if Pages isn't enabled on the account;
        // the deploy workflow will still be in place — don't block onboarding.
      }

      // 4. Save blog record to the database
      await db.insert(schema.blogs).values({
        userId: user.userId,
        repoName: repo,
        repoOwner: owner,
        pagesUrl: null,  // GitHub Pages URL becomes available after first deploy
        createdAt: new Date().toISOString(),
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return fail(500, { error: `Failed to create blog: ${message}` })
    }

    throw redirect(303, '/')
  },
}
