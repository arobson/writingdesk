import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Cookies } from '@sveltejs/kit'

// Helper: create a minimal Cookies mock backed by a plain Map
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
    // Import after setup.ts has set JWT_SECRET
    const { createSession, getSession } = await import('$lib/server/auth.js')

    const cookies = makeCookies()
    const payload = {
      githubUserId: 42,
      login: 'alice',
      avatarUrl: 'https://avatars.githubusercontent.com/u/42',
      role: 'author' as const,
    }

    await createSession(payload, cookies)
    const session = await getSession(cookies)

    expect(session).not.toBeNull()
    expect(session!.githubUserId).toBe(42)
    expect(session!.login).toBe('alice')
    expect(session!.role).toBe('author')
  })

  it('returns null when no cookie is present', async () => {
    const { getSession } = await import('$lib/server/auth.js')
    const cookies = makeCookies()
    expect(await getSession(cookies)).toBeNull()
  })

  it('returns null for a tampered / invalid token', async () => {
    const { getSession } = await import('$lib/server/auth.js')
    const cookies = makeCookies({ wd_session: 'not.a.valid.jwt' })
    expect(await getSession(cookies)).toBeNull()
  })
})

describe('refreshSessionIfNeeded', () => {
  it('does not set a new cookie when plenty of time remains', async () => {
    const { createSession, getSession, refreshSessionIfNeeded } = await import('$lib/server/auth.js')

    const cookies = makeCookies()
    await createSession(
      { githubUserId: 1, login: 'bob', avatarUrl: '', role: 'author' },
      cookies,
    )
    const session = await getSession(cookies)!
    const setCalled = vi.spyOn(cookies, 'set')
    await refreshSessionIfNeeded(session!, cookies)
    // 8 hours remaining — no refresh needed
    expect(setCalled).not.toHaveBeenCalled()
  })

  it('issues a new cookie when expiry is within 1 hour', async () => {
    const { refreshSessionIfNeeded, createSession } = await import('$lib/server/auth.js')

    const cookies = makeCookies()
    const setCalled = vi.spyOn(cookies, 'set')

    // Craft a session that expires in 30 minutes (< REFRESH_THRESHOLD)
    const nowSec = Math.floor(Date.now() / 1000)
    const session = {
      githubUserId: 1,
      login: 'bob',
      avatarUrl: '',
      role: 'author' as const,
      iat: nowSec - (7 * 60 * 60 + 30 * 60), // issued 7.5 hours ago
      exp: nowSec + 30 * 60,                   // expires in 30 minutes
    }

    await refreshSessionIfNeeded(session, cookies)
    expect(setCalled).toHaveBeenCalledOnce()
  })
})

describe('clearSession', () => {
  it('deletes the session cookie', async () => {
    const { createSession, clearSession, getSession } = await import('$lib/server/auth.js')

    const cookies = makeCookies()
    await createSession(
      { githubUserId: 1, login: 'bob', avatarUrl: '', role: 'author' },
      cookies,
    )
    clearSession(cookies)
    expect(await getSession(cookies)).toBeNull()
  })
})

describe('requireRole', () => {
  it('allows access when user role meets minimum', async () => {
    const { requireRole } = await import('$lib/server/auth.js')
    const user = { githubUserId: 1, login: 'bob', avatarUrl: '', role: 'author' as const }
    expect(() => requireRole(user, 'author')).not.toThrow()
  })

  it('allows publisher to satisfy author requirement', async () => {
    const { requireRole } = await import('$lib/server/auth.js')
    const user = { githubUserId: 1, login: 'bob', avatarUrl: '', role: 'publisher' as const }
    expect(() => requireRole(user, 'author')).not.toThrow()
  })

  it('throws 403 when author tries publisher-only action', async () => {
    const { requireRole } = await import('$lib/server/auth.js')
    const user = { githubUserId: 1, login: 'bob', avatarUrl: '', role: 'author' as const }
    expect(() => requireRole(user, 'publisher')).toThrow()
  })

  it('throws 401 when user is null', async () => {
    const { requireRole } = await import('$lib/server/auth.js')
    expect(() => requireRole(null, 'author')).toThrow()
  })
})

describe('resolveRole', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns "author" for write permission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ permission: 'write' }),
    }))
    // Also mock the dynamic import of getInstallationToken
    vi.mock('$lib/server/github/index.js', () => ({
      getInstallationToken: vi.fn().mockResolvedValue('fake-token'),
      listPosts: vi.fn(),
      getPost: vi.fn(),
      savePost: vi.fn(),
      deletePost: vi.fn(),
    }))

    const { resolveRole } = await import('$lib/server/auth.js')
    expect(await resolveRole('alice')).toBe('author')
  })

  it('returns "publisher" for admin permission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ permission: 'admin' }),
    }))

    const { resolveRole } = await import('$lib/server/auth.js')
    expect(await resolveRole('alice')).toBe('publisher')
  })

  it('returns "publisher" for maintain permission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ permission: 'maintain' }),
    }))

    const { resolveRole } = await import('$lib/server/auth.js')
    expect(await resolveRole('alice')).toBe('publisher')
  })

  it('returns null for read permission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ permission: 'read' }),
    }))

    const { resolveRole } = await import('$lib/server/auth.js')
    expect(await resolveRole('alice')).toBeNull()
  })

  it('returns null when GitHub API returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const { resolveRole } = await import('$lib/server/auth.js')
    expect(await resolveRole('alice')).toBeNull()
  })
})
