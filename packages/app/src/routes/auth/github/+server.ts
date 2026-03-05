import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getConfig } from '$lib/server/config.js'

export const GET: RequestHandler = ({ cookies, url }) => {
  const { clientId } = getConfig().github.oauth
  const state = crypto.randomUUID()

  cookies.set('oauth_state', state, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 10,
  })

  const origin = url.origin
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/auth/github/callback`,
    state,
  })

  throw redirect(303, `https://github.com/login/oauth/authorize?${params}`)
}
