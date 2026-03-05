import { error } from '@sveltejs/kit'
import { SignJWT, jwtVerify } from 'jose'
import type { Cookies } from '@sveltejs/kit'
import { getConfig } from './config.js'

const COOKIE_NAME = 'wd_session'
const SESSION_SECONDS = 8 * 60 * 60   // 8 hours
const REFRESH_THRESHOLD = 60 * 60     // refresh when <1 hour remains

export interface SessionPayload {
  githubUserId: number
  login: string
  avatarUrl: string
  role: 'author' | 'publisher'
  iat?: number
  exp?: number
}

function secret(): Uint8Array {
  return new TextEncoder().encode(getConfig().jwt.secret)
}

export async function createSession(payload: SessionPayload, cookies: Cookies): Promise<void> {
  const token = await new SignJWT({
    githubUserId: payload.githubUserId,
    login: payload.login,
    avatarUrl: payload.avatarUrl,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secret())

  cookies.set(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_SECONDS,
  })
}

export async function getSession(cookies: Cookies): Promise<SessionPayload | null> {
  const token = cookies.get(COOKIE_NAME)
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function refreshSessionIfNeeded(session: SessionPayload, cookies: Cookies): Promise<void> {
  if (!session.exp) return
  const remaining = session.exp - Math.floor(Date.now() / 1000)
  if (remaining < REFRESH_THRESHOLD) {
    await createSession(session, cookies)
  }
}

export function clearSession(cookies: Cookies): void {
  cookies.delete(COOKIE_NAME, { path: '/' })
}

export function requireRole(user: App.Locals['user'], minimum: 'author' | 'publisher'): void {
  if (!user) throw error(401, 'Unauthenticated')
  const order = ['author', 'publisher'] as const
  if (order.indexOf(user.role) < order.indexOf(minimum)) {
    throw error(403, 'Insufficient permissions')
  }
}

export async function resolveRole(login: string): Promise<'author' | 'publisher' | null> {
  const { owner, repo } = getConfig().github
  const { getInstallationToken } = await import('./github/index.js')
  const token = await getInstallationToken()

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/collaborators/${login}/permission`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
  )

  if (!res.ok) return null

  const { permission } = await res.json() as { permission: string }
  if (permission === 'write') return 'author'
  if (permission === 'maintain' || permission === 'admin') return 'publisher'
  return null
}
