import { redirect, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getConfig } from '$lib/server/config.js'
import { createSession, resolveRole } from '$lib/server/auth.js'

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

  if (tokenData.error || !tokenData.access_token) {
    throw redirect(303, '/auth/denied')
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
    },
  })

  if (!userRes.ok) throw redirect(303, '/auth/denied')

  const { id: githubUserId, login, avatar_url: avatarUrl } = await userRes.json() as {
    id: number
    login: string
    avatar_url: string
  }

  // User token is discarded after this — we use installation token for all ops
  const role = await resolveRole(login)
  if (!role) throw redirect(303, '/auth/denied')

  await createSession({ githubUserId, login, avatarUrl, role }, cookies)
  throw redirect(303, '/')
}
