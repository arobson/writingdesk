/**
 * Integration tests for API route handlers.
 *
 * Handlers are imported directly and called with a minimal mock RequestEvent.
 * The posts business logic layer is mocked — no GitHub calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RequestEvent } from '@sveltejs/kit'
import type { Post, PostSummary } from '$lib/types.js'

vi.mock('$lib/server/posts.js', () => ({
  listPosts: vi.fn(),
  getPost: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
  publishPost: vi.fn(),
  unpublishPost: vi.fn(),
  deletePost: vi.fn(),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEvent = any

function makeEvent(opts: {
  authed?: boolean
  params?: Record<string, string>
  body?: unknown
  method?: string
}): AnyEvent {
  const blog = opts.authed === false ? null : {
    id: 1,
    repoOwner: 'testowner',
    repoName: 'testrepo',
    pagesUrl: null,
    token: 'fake-token',
  }
  const user = opts.authed === false ? null : {
    userId: 1, githubId: 42, login: 'testuser', avatarUrl: '',
  }
  const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET')
  return {
    locals: { user, blog },
    params: opts.params ?? {},
    request: new Request('http://localhost/', {
      method,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      headers: { 'Content-Type': 'application/json' },
    }),
    url: new URL('http://localhost/'),
    route: { id: '' },
  }
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

// ── GET /api/posts ────────────────────────────────────────────────────────────

describe('GET /api/posts', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns list of posts for authenticated user', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.listPosts).mockResolvedValue([makeSummary()])

    const { GET } = await import('../../../src/routes/api/posts/+server.js')
    const res = await GET(makeEvent({}))

    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
  })

  it('returns 403 when user is authenticated but has no blog', async () => {
    const { GET } = await import('../../../src/routes/api/posts/+server.js')
    // Craft an event with a user but blog=null (mid-onboarding state)
    const event = makeEvent({})
    event.locals.blog = null
    await expect(GET(event)).rejects.toMatchObject({ status: 403 })
  })
})

// ── POST /api/posts ───────────────────────────────────────────────────────────

describe('POST /api/posts', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a post and returns 201 with slug and sha', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.createPost).mockResolvedValue('new-sha')

    const { POST } = await import('../../../src/routes/api/posts/+server.js')
    const res = await POST(makeEvent({
      body: { slug: 'new-post', frontmatter: { title: 'New Post', description: '', pubDate: '2024-06-01' }, body: 'Content' },
    }))

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.slug).toBe('new-post')
    expect(data.sha).toBe('new-sha')
  })

  it('returns 422 for invalid slug', async () => {
    const { POST } = await import('../../../src/routes/api/posts/+server.js')
    const res = await POST(makeEvent({
      body: { slug: 'Invalid Slug!', frontmatter: { title: 'T', description: '', pubDate: '' }, body: '' },
    }))
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('INVALID_SLUG')
  })
})

// ── GET /api/posts/:slug ──────────────────────────────────────────────────────

describe('GET /api/posts/:slug', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns the post', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.getPost).mockResolvedValue(makePost())

    const { GET } = await import('../../../src/routes/api/posts/[slug]/+server.js')
    const res = await GET(makeEvent({ params: { slug: 'hello-world' } }))

    expect(res.status).toBe(200)
    expect((await res.json()).slug).toBe('hello-world')
  })

  it('throws 404 when post is not found', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.getPost).mockRejectedValue(new Error('Not found'))

    const { GET } = await import('../../../src/routes/api/posts/[slug]/+server.js')
    await expect(GET(makeEvent({ params: { slug: 'missing' } }))).rejects.toMatchObject({ status: 404 })
  })
})

// ── PUT /api/posts/:slug ──────────────────────────────────────────────────────

describe('PUT /api/posts/:slug', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('updates the post and returns new sha', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.updatePost).mockResolvedValue('updated-sha')

    const { PUT } = await import('../../../src/routes/api/posts/[slug]/+server.js')
    const res = await PUT(makeEvent({
      method: 'PUT',
      params: { slug: 'hello-world' },
      body: { sha: 'abc123', frontmatter: { title: 'Updated', description: '', pubDate: '2024-06-01' }, body: 'Updated content' },
    }))

    expect(res.status).toBe(200)
    expect((await res.json()).sha).toBe('updated-sha')
  })

  it('returns 422 for invalid new slug', async () => {
    const { PUT } = await import('../../../src/routes/api/posts/[slug]/+server.js')
    const res = await PUT(makeEvent({
      method: 'PUT',
      params: { slug: 'hello-world' },
      body: { sha: 'abc', newSlug: 'Bad Slug!', frontmatter: {}, body: '' },
    }))
    expect(res.status).toBe(422)
  })

  it('passes previousSlug when slug changes', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.updatePost).mockResolvedValue('sha')

    const { PUT } = await import('../../../src/routes/api/posts/[slug]/+server.js')
    await PUT(makeEvent({
      method: 'PUT',
      params: { slug: 'old-slug' },
      body: { sha: 'abc', newSlug: 'new-slug', frontmatter: { title: 'T', description: '', pubDate: '' }, body: '' },
    }))

    expect(posts.updatePost).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'fake-token' }),
      expect.objectContaining({ slug: 'new-slug', previousSlug: 'old-slug' }),
    )
  })
})

// ── POST /api/posts/:slug/publish ─────────────────────────────────────────────

describe('POST /api/posts/:slug/publish', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('publishes the post and returns new sha', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.publishPost).mockResolvedValue('pub-sha')

    const { POST } = await import('../../../src/routes/api/posts/[slug]/publish/+server.js')
    const res = await POST(makeEvent({ params: { slug: 'hello-world' }, body: { sha: 'abc123' } }))

    expect((await res.json()).sha).toBe('pub-sha')
    expect(posts.publishPost).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'fake-token' }),
      'hello-world',
      'abc123',
    )
  })
})

// ── POST /api/posts/:slug/unpublish ──────────────────────────────────────────

describe('POST /api/posts/:slug/unpublish', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('unpublishes the post', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.unpublishPost).mockResolvedValue('unpub-sha')

    const { POST } = await import('../../../src/routes/api/posts/[slug]/unpublish/+server.js')
    const res = await POST(makeEvent({ params: { slug: 'hello-world' }, body: { sha: 'abc123' } }))

    expect((await res.json()).sha).toBe('unpub-sha')
  })
})

// ── DELETE /api/posts/:slug ───────────────────────────────────────────────────

describe('DELETE /api/posts/:slug', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('deletes the post and returns 204', async () => {
    const posts = await import('$lib/server/posts.js')
    vi.mocked(posts.deletePost).mockResolvedValue(undefined)

    const { DELETE } = await import('../../../src/routes/api/posts/[slug]/+server.js')
    const res = await DELETE(makeEvent({
      method: 'DELETE',
      params: { slug: 'hello-world' },
      body: { sha: 'abc123' },
    }))

    expect(res.status).toBe(204)
    expect(posts.deletePost).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'fake-token' }),
      'hello-world',
      'abc123',
    )
  })
})
