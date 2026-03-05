import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireRole } from '$lib/server/auth.js'
import { getRepoInfo } from '$lib/server/github/index.js'

export const GET: RequestHandler = async ({ locals }) => {
  requireRole(locals.user, 'publisher')
  try {
    const info = await getRepoInfo()
    return json({ ok: true, repoFullName: info.fullName, repoPrivate: info.private })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ ok: false, error: message })
  }
}
