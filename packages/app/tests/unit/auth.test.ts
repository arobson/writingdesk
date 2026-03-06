import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Cookies } from '@sveltejs/kit'

function makeCookies(initial: Record<string, string> = {}): Cookies {
  const store = new Map(Object.entries(initial))
  return {
    get: (name: string) => store.get(name),
    getAll: () => [...store.entries()].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => { store.set(name, value) },
    delete: (name: string) => { store.delete(name) },
    serialize: () => '',
  } as unknown as Cookies
}

describe('createSession / getSession', () => {
  it('round-trips a session payload through the cookie', async () => {
    const { createSession, getSession } = await import('$lib/server/auth.js')
    const cookies = makeCookies()
    const payload = { userId: 1, githubId: 42, login: 'alice', avatarUrl: 'https://avatars.githubusercontent.com/u/42' }

    await createSession(payload, cookies)
    const session = await getSession(cookies)

    expect(session).not.toBeNull()
    expect(session!.userId).toBe(1)
    expect(session!.githubId).toBe(42)
    expect(session!.login).toBe('alice')
  })

  it('returns null when no cookie is present', async () => {
    const { getSession } = await import('$lib/server/auth.js')
    expect(await getSession(makeCookies())).toBeNull()
  })

  it('returns null for a tampered / invalid token', async () => {
    const { getSession } = await import('$lib/server/auth.js')
    expect(await getSession(makeCookies({ wd_session: 'not.a.valid.jwt' }))).toBeNull()
  })
})

describe('refreshSessionIfNeeded', () => {
  it('does not set a new cookie when plenty of time remains', async () => {
    const { createSession, getSession, refreshSessionIfNeeded } = await import('$lib/server/auth.js')
    const cookies = makeCookies()
    await createSession({ userId: 1, githubId: 1, login: 'bob', avatarUrl: '' }, cookies)
    const session = (await getSession(cookies))!
    const setCalled = vi.spyOn(cookies, 'set')
    await refreshSessionIfNeeded(session, cookies)
    expect(setCalled).not.toHaveBeenCalled()
  })

  it('issues a new cookie when expiry is within 1 hour', async () => {
    const { refreshSessionIfNeeded } = await import('$lib/server/auth.js')
    const cookies = makeCookies()
    const setCalled = vi.spyOn(cookies, 'set')
    const nowSec = Math.floor(Date.now() / 1000)
    const session = {
      userId: 1, githubId: 1, login: 'bob', avatarUrl: '',
      iat: nowSec - (7 * 60 * 60 + 30 * 60),
      exp: nowSec + 30 * 60,
    }
    await refreshSessionIfNeeded(session, cookies)
    expect(setCalled).toHaveBeenCalledOnce()
  })
})

describe('clearSession', () => {
  it('deletes the session cookie', async () => {
    const { createSession, clearSession, getSession } = await import('$lib/server/auth.js')
    const cookies = makeCookies()
    await createSession({ userId: 1, githubId: 1, login: 'bob', avatarUrl: '' }, cookies)
    clearSession(cookies)
    expect(await getSession(cookies)).toBeNull()
  })
})

describe('encryptToken / decryptToken', () => {
  beforeEach(() => {
    // TOKEN_SECRET must be set — tests/setup.ts sets JWT_SECRET but not TOKEN_SECRET
    process.env.TOKEN_SECRET = 'test-token-secret-exactly-32chars'
  })

  it('round-trips a GitHub access token', async () => {
    const { encryptToken, decryptToken } = await import('$lib/server/auth.js')
    const original = 'gho_fake_github_access_token_12345'
    const encrypted = encryptToken(original)
    expect(encrypted).not.toBe(original)
    expect(decryptToken(encrypted)).toBe(original)
  })

  it('produces a different ciphertext each call (random IV)', async () => {
    const { encryptToken } = await import('$lib/server/auth.js')
    const a = encryptToken('same-token')
    const b = encryptToken('same-token')
    expect(a).not.toBe(b)
  })
})
