import { redirect, fail } from '@sveltejs/kit'
import type { PageServerLoad, Actions } from './$types'
import {
  createRepo,
  enableGithubPages,
  commitFiles,
  listUserRepos,
  checkRepoAccess,
} from '$lib/server/github/index.js'
import { scaffoldFiles } from '$lib/server/github/scaffold.js'
import { getDb, schema } from '$lib/server/db/index.js'
import { eq } from 'drizzle-orm'
import { isValidSlug } from '$lib/utils.js'
import { decryptToken } from '$lib/server/auth.js'

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.blog) throw redirect(303, '/')

  const db = getDb()
  const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.id, locals.user!.userId))
  const token = decryptToken(dbUser.accessToken)

  const repos = await listUserRepos(token)

  return { login: locals.user!.login, repos }
}

export const actions: Actions = {
  // Create a brand-new Astro blog repository and scaffold it
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
      const { owner, repo } = await createRepo(token, repoSlug, `${blogTitle} — built with Astro & WritingDesk`)
      const files = scaffoldFiles(blogTitle)
      await commitFiles(token, owner, repo, files, 'chore: initialise Astro blog with WritingDesk')

      try {
        await enableGithubPages(token, owner, repo)
      } catch {
        // Pages activation can fail transiently; don't block onboarding.
      }

      await db.insert(schema.blogs).values({
        userId: user.userId,
        repoName: repo,
        repoOwner: owner,
        pagesUrl: null,
        createdAt: new Date().toISOString(),
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return fail(500, { error: `Failed to create blog: ${message}` })
    }

    throw redirect(303, '/')
  },

  // Connect an existing GitHub repository as the user's blog
  connect: async ({ locals, request }) => {
    const user = locals.user!
    const db = getDb()

    const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.id, user.userId))
    if (!dbUser) return fail(401, { error: 'Session user not found.' })

    const token = decryptToken(dbUser.accessToken)

    const data = await request.formData()
    const repoFull = (data.get('repoFull') as string ?? '').trim()

    const parts = repoFull.split('/')
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return fail(422, { error: 'Enter the repository as owner/repo-name.' })
    }
    const [repoOwner, repoName] = parts

    try {
      await checkRepoAccess(token, repoOwner, repoName)
    } catch {
      return fail(422, { error: `Repository "${repoFull}" was not found or is not accessible with your GitHub account.` })
    }

    await db.insert(schema.blogs).values({
      userId: user.userId,
      repoName,
      repoOwner,
      pagesUrl: null,
      createdAt: new Date().toISOString(),
    })

    throw redirect(303, '/')
  },
}
