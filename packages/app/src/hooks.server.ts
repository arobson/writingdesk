import { redirect } from '@sveltejs/kit'
import type { Handle } from '@sveltejs/kit'
import { getSession, refreshSessionIfNeeded, decryptToken } from '$lib/server/auth.js'
import { getDb, schema } from '$lib/server/db/index.js'
import { ensureStarted } from '$lib/server/startup.js'
import { eq } from 'drizzle-orm'

// Run once on the first request — validates config, logs storage layout,
// opens the DB connection, and applies migrations.
ensureStarted()

const PUBLIC_PATHS = ['/auth/']

export const handle: Handle = async ({ event, resolve }) => {
  const isPublic = PUBLIC_PATHS.some(p => event.url.pathname.startsWith(p))

  if (isPublic) {
    event.locals.user = null
    event.locals.blog = null
    return resolve(event)
  }

  const session = await getSession(event.cookies)
  if (!session) throw redirect(303, '/auth/github')

  event.locals.user = {
    userId: session.userId,
    githubId: session.githubId,
    login: session.login,
    avatarUrl: session.avatarUrl,
  }

  const db = getDb()
  const [dbUser] = await db.select().from(schema.users).where(eq(schema.users.id, session.userId))
  const [blog] = await db.select().from(schema.blogs).where(eq(schema.blogs.userId, session.userId))

  if (blog && dbUser) {
    event.locals.blog = {
      id: blog.id,
      repoOwner: blog.repoOwner,
      repoName: blog.repoName,
      pagesUrl: blog.pagesUrl,
      token: decryptToken(dbUser.accessToken),
    }
  } else {
    event.locals.blog = null
  }

  await refreshSessionIfNeeded(session, event.cookies)
  return resolve(event)
}
