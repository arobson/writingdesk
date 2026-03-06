import { redirect, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getConfig } from '$lib/server/config.js'
import { createSession, encryptToken } from '$lib/server/auth.js'
import { getAuthenticatedUser } from '$lib/server/github/index.js'
import { getDb, schema } from '$lib/server/db/index.js'
import { eq } from 'drizzle-orm'

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const storedState = cookies.get('oauth_state')
  cookies.delete('oauth_state', { path: '/' })

  if (!code || !state || state !== storedState) {
    throw error(400, 'Invalid OAuth state')
  }

  const { clientId, clientSecret } = getConfig().github.oauth

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  })

  const tokenData = await tokenRes.json() as { access_token?: string; error?: string }
  if (tokenData.error || !tokenData.access_token) throw redirect(303, '/auth/denied')

  const accessToken = tokenData.access_token
  const ghUser = await getAuthenticatedUser(accessToken)

  // Upsert user in the database — update token on every login so it stays fresh
  const db = getDb()
  const now = new Date().toISOString()
  const encryptedToken = encryptToken(accessToken)

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.githubId, ghUser.id))

  let userId: number
  if (existing) {
    await db.update(schema.users)
      .set({ login: ghUser.login, avatarUrl: ghUser.avatarUrl, accessToken: encryptedToken })
      .where(eq(schema.users.githubId, ghUser.id))
    userId = existing.id
  } else {
    const [inserted] = await db.insert(schema.users).values({
      githubId: ghUser.id,
      login: ghUser.login,
      avatarUrl: ghUser.avatarUrl,
      accessToken: encryptedToken,
      createdAt: now,
    }).returning({ id: schema.users.id })
    userId = inserted.id
  }

  await createSession({
    userId,
    githubId: ghUser.id,
    login: ghUser.login,
    avatarUrl: ghUser.avatarUrl,
  }, cookies)

  throw redirect(303, '/')
}
