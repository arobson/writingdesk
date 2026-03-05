import { redirect } from '@sveltejs/kit'
import type { Handle } from '@sveltejs/kit'
import { getSession, refreshSessionIfNeeded } from '$lib/server/auth.js'

const PUBLIC_PATHS = ['/auth/', '/health', '/preview/']

export const handle: Handle = async ({ event, resolve }) => {
  const isPublic = PUBLIC_PATHS.some(p => event.url.pathname.startsWith(p))

  if (!isPublic) {
    const session = await getSession(event.cookies)
    if (!session) throw redirect(303, '/auth/github')
    event.locals.user = session
    await refreshSessionIfNeeded(session, event.cookies)
  } else {
    event.locals.user = null
  }

  return resolve(event)
}
