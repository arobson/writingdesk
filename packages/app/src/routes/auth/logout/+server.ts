import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { clearSession } from '$lib/server/auth.js'

export const GET: RequestHandler = ({ cookies }) => {
  clearSession(cookies)
  throw redirect(303, '/auth/github')
}
