/**
 * Integration tests for API route handlers.
 *
 * These tests import the handler functions directly and call them with a
 * minimal mock RequestEvent, bypassing SvelteKit's routing layer.
 * The GitHub / posts layer is mocked so no network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestEvent } from '@sveltejs/kit'
import type { Post, PostSummary } from '$lib/types.js'

// ──────────────────────────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────────────────────────

vi.mock('$lib/server/posts.js', () => ({
  listPosts: vi.fn(),
  getPost: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
  publishPost: vi.fn(),
  unpublishPost: vi.fn(),
  deletePost: vi.fn(),
}))

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

type UserRole = 'author' | 'publisher'

function makeUser(role: UserRole = 'author') {
  return { githubUserId: 1, login: 'testuser', avatarUrl: '', role }
}

function makeEvent(opts: {
  role?: UserRole | null
  params?: Record<string, string>
  body?: unknown
  method?: string
}): RequestEvent {
  const user = opts.role === null ? null : makeUser(opts.role ?? 'author')
  const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET')
  return {
    locals: { user },
    params: opts.params ?? {},
    request: new Request('http://localhost/', {
      method,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      headers: { 'Content-Type': 'application/json' },
    }),
    url: new URL('http://localhost/'),
    route: { id: '' },
  } as unknown as RequestEvent
}

function makePost(slug = 'hello-world'): Post {
  return {
    slug,
    path: `src/content/blog/${slug}.md`,
    sha: 'abc123',
    frontmatter: { title: 'Hello World', description: 'A post', pubDate: '2024-06-01', draft: true },
    body: '# Hello\nContent here.',
    status: 'draft',
  }
}

function makeSummary(slug = 'hello-world'): PostSummary {
  const { body: _body, ...summary } = makePost(slug)
  return summary
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/posts
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /api/posts', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns list of posts for author', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.listPosts).mockResolvedValue([makeSummary()])

    const { GET } = await import('../../../src/routes/api/posts/+server.js')
    const res = await GET(makeEvent({}))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].slug).toBe('hello-world')
  })

  it('throws 401 when unauthenticated', async () => {
    const { GET } = await import('../../../src/routes/api/posts/+server.js')
    await expect(GET(makeEvent({ role: null }))).rejects.toMatchObject({ status: 401 })
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/posts
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /api/posts', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a post and returns 201 with slug and sha', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.createPost).mockResolvedValue('new-sha')

    const { POST } = await import('../../../src/routes/api/posts/+server.js')
    const res = await POST(makeEvent({
      body: {
        slug: 'new-post',
        frontmatter: { title: 'New Post', description: '', pubDate: '2024-06-01' },
        body: 'Content',
      },
    }))

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.slug).toBe('new-post')
    expect(data.sha).toBe('new-sha')
  })

  it('returns 422 for invalid slug', async () => {
    const { POST } = await import('../../../src/routes/api/posts/+server.js')
    const res = await POST(makeEvent({
      body: {
        slug: 'Invalid Slug!',
        frontmatter: { title: 'T', description: '', pubDate: '' },
        body: '',
      },
    }))

    expect(res.status).toBe(422)
    const data = await res.json()
    expect(data.code).toBe('INVALID_SLUG')
  })

  it('throws 401 when unauthenticated', async () => {
    const { POST } = await import('../../../src/routes/api/posts/+server.js')
    await expect(POST(makeEvent({ role: null, body: {} }))).rejects.toMatchObject({ status: 401 })
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/posts/:slug
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /api/posts/:slug', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns the post for a valid slug', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.getPost).mockResolvedValue(makePost())

    const { GET } = await import('../../../src/routes/api/posts/[slug]/+server.js')
    const res = await GET(makeEvent({ params: { slug: 'hello-world' } }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.slug).toBe('hello-world')
  })

  it('throws 404 when post is not found', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.getPost).mockRejectedValue(new Error('Not found'))

    const { GET } = await import('../../../src/routes/api/posts/[slug]/+server.js')
    await expect(GET(makeEvent({ params: { slug: 'missing' } }))).rejects.toMatchObject({ status: 404 })
  })

  it('throws 401 when unauthenticated', async () => {
    const { GET } = await import('../../../src/routes/api/posts/[slug]/+server.js')
    await expect(GET(makeEvent({ role: null, params: { slug: 'x' } }))).rejects.toMatchObject({ status: 401 })
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/posts/:slug
// ──────────────────────────────────────────────────────────────────────────────

describe('PUT /api/posts/:slug', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('updates the post and returns new sha', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.updatePost).mockResolvedValue('updated-sha')

    const { PUT } = await import('../../../src/routes/api/posts/[slug]/+server.js')
    const res = await PUT(makeEvent({
      method: 'PUT',
      params: { slug: 'hello-world' },
      body: {
        sha: 'abc123',
        frontmatter: { title: 'Updated', description: '', pubDate: '2024-06-01' },
        body: 'Updated content',
      },
    }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.sha).toBe('updated-sha')
    expect(data.slug).toBe('hello-world')
  })

  it('returns 422 for invalid new slug', async () => {
    const { PUT } = await import('../../../src/routes/api/posts/[slug]/+server.js')
    const res = await PUT(makeEvent({
      method: 'PUT',
      params: { slug: 'hello-world' },
      body: {
        sha: 'abc',
        newSlug: 'Bad Slug!',
        frontmatter: {},
        body: '',
      },
    }))

    expect(res.status).toBe(422)
  })

  it('handles slug rename by passing previousSlug', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.updatePost).mockResolvedValue('sha')

    const { PUT } = await import('../../../src/routes/api/posts/[slug]/+server.js')
    await PUT(makeEvent({
      method: 'PUT',
      params: { slug: 'old-slug' },
      body: {
        sha: 'abc',
        newSlug: 'new-slug',
        frontmatter: { title: 'T', description: '', pubDate: '' },
        body: '',
      },
    }))

    expect(posts.updatePost).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'new-slug', previousSlug: 'old-slug' }),
    )
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/posts/:slug/publish
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /api/posts/:slug/publish', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('requires publisher role', async () => {
    const { POST } = await import('../../../src/routes/api/posts/[slug]/publish/+server.js')
    await expect(
      POST(makeEvent({ role: 'author', params: { slug: 'x' }, body: { sha: 'abc' } })),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('publishes the post and returns new sha for publisher', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.publishPost).mockResolvedValue('pub-sha')

    const { POST } = await import('../../../src/routes/api/posts/[slug]/publish/+server.js')
    const res = await POST(makeEvent({
      role: 'publisher',
      params: { slug: 'hello-world' },
      body: { sha: 'abc123' },
    }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.sha).toBe('pub-sha')
    expect(posts.publishPost).toHaveBeenCalledWith('hello-world', 'abc123')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/posts/:slug/unpublish
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /api/posts/:slug/unpublish', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('requires publisher role', async () => {
    const { POST } = await import('../../../src/routes/api/posts/[slug]/unpublish/+server.js')
    await expect(
      POST(makeEvent({ role: 'author', params: { slug: 'x' }, body: { sha: 'abc' } })),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('unpublishes the post for publisher', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.unpublishPost).mockResolvedValue('unpub-sha')

    const { POST } = await import('../../../src/routes/api/posts/[slug]/unpublish/+server.js')
    const res = await POST(makeEvent({
      role: 'publisher',
      params: { slug: 'hello-world' },
      body: { sha: 'abc123' },
    }))

    const data = await res.json()
    expect(data.sha).toBe('unpub-sha')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/posts/:slug
// ──────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/posts/:slug', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('requires publisher role', async () => {
    const { DELETE } = await import('../../../src/routes/api/posts/[slug]/+server.js')
    await expect(
      DELETE(makeEvent({ role: 'author', method: 'DELETE', params: { slug: 'x' }, body: { sha: 'abc' } })),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('deletes the post and returns 204 for publisher', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.deletePost).mockResolvedValue(undefined)

    const { DELETE } = await import('../../../src/routes/api/posts/[slug]/+server.js')
    const res = await DELETE(makeEvent({
      role: 'publisher',
      method: 'DELETE',
      params: { slug: 'hello-world' },
      body: { sha: 'abc123' },
    }))

    expect(res.status).toBe(204)
    expect(posts.deletePost).toHaveBeenCalledWith('hello-world', 'abc123')
  })
})
