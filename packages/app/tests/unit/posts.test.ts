import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Post, PostSummary } from '$lib/types.js'

// Mock the GitHub layer before importing posts
vi.mock('$lib/server/github/index.js', () => ({
  listPosts: vi.fn(),
  getPost: vi.fn(),
  savePost: vi.fn(),
  deletePost: vi.fn(),
  createBranch: vi.fn(),
  mergeBranch: vi.fn(),
  deleteBranch: vi.fn(),
  getInstallationToken: vi.fn(),
}))

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    slug: 'my-post',
    path: 'src/content/blog/my-post.md',
    sha: 'abc123',
    frontmatter: {
      title: 'My Post',
      description: 'A test post',
      pubDate: '2024-06-01',
      draft: true,
    },
    body: 'Hello world',
    status: 'draft',
    ...overrides,
  }
}

describe('createPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('always creates with draft: true', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.savePost).mockResolvedValue('new-sha')

    const { createPost } = await import('$lib/server/posts.js')
    await createPost({
      slug: 'hello',
      frontmatter: { title: 'Hello', description: '', pubDate: '' },
      body: 'body text',
    })

    expect(github.savePost).toHaveBeenCalledOnce()
    const callArg = vi.mocked(github.savePost).mock.calls[0][0]
    expect(callArg.frontmatter.draft).toBe(true)
  })

  it('uses today() as pubDate when not supplied', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.savePost).mockResolvedValue('new-sha')

    const { createPost } = await import('$lib/server/posts.js')
    await createPost({
      slug: 'hello',
      // pubDate intentionally omitted (undefined) so ?? today() kicks in
      frontmatter: { title: 'Hello', description: '', pubDate: undefined },
      body: '',
    })

    const callArg = vi.mocked(github.savePost).mock.calls[0][0]
    // pubDate should be set to today (YYYY-MM-DD)
    expect(callArg.frontmatter.pubDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('preserves explicitly provided pubDate', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.savePost).mockResolvedValue('new-sha')

    const { createPost } = await import('$lib/server/posts.js')
    await createPost({
      slug: 'hello',
      frontmatter: { title: 'Hello', description: '', pubDate: '2023-01-15' },
      body: '',
    })

    const callArg = vi.mocked(github.savePost).mock.calls[0][0]
    expect(callArg.frontmatter.pubDate).toBe('2023-01-15')
  })

  it('returns the sha from savePost', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.savePost).mockResolvedValue('returned-sha')

    const { createPost } = await import('$lib/server/posts.js')
    const sha = await createPost({
      slug: 'hello',
      frontmatter: { title: 'Hello', description: '', pubDate: '' },
      body: '',
    })

    expect(sha).toBe('returned-sha')
  })
})

describe('updatePost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets updatedDate to today', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.savePost).mockResolvedValue('updated-sha')

    const { updatePost } = await import('$lib/server/posts.js')
    await updatePost({
      slug: 'my-post',
      frontmatter: { title: 'My Post', description: '', pubDate: '2024-01-01', draft: true },
      body: 'updated body',
      sha: 'abc123',
    })

    const callArg = vi.mocked(github.savePost).mock.calls[0][0]
    expect(callArg.frontmatter.updatedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('passes previousSlug through to savePost for renames', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.savePost).mockResolvedValue('sha')

    const { updatePost } = await import('$lib/server/posts.js')
    await updatePost({
      slug: 'new-slug',
      previousSlug: 'old-slug',
      frontmatter: { title: 'T', description: '', pubDate: '2024-01-01' },
      body: '',
      sha: 'abc',
    })

    const callArg = vi.mocked(github.savePost).mock.calls[0][0]
    expect(callArg.slug).toBe('new-slug')
    expect(callArg.previousSlug).toBe('old-slug')
  })
})

describe('publishPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets draft to false', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.getPost).mockResolvedValue(makePost({ frontmatter: { title: 'T', description: '', pubDate: '2024-01-01', draft: true } }))
    vi.mocked(github.savePost).mockResolvedValue('sha')

    const { publishPost } = await import('$lib/server/posts.js')
    await publishPost('my-post', 'abc123')

    const callArg = vi.mocked(github.savePost).mock.calls[0][0]
    expect(callArg.frontmatter.draft).toBe(false)
  })

  it('fills in pubDate if missing', async () => {
    const github = await import('$lib/server/github/index.js')
    const post = makePost()
    // Use undefined so the ?? operator defaults to today()
    post.frontmatter.pubDate = undefined as unknown as string
    vi.mocked(github.getPost).mockResolvedValue(post)
    vi.mocked(github.savePost).mockResolvedValue('sha')

    const { publishPost } = await import('$lib/server/posts.js')
    await publishPost('my-post', 'abc123')

    const callArg = vi.mocked(github.savePost).mock.calls[0][0]
    expect(callArg.frontmatter.pubDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('preserves existing pubDate', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.getPost).mockResolvedValue(
      makePost({ frontmatter: { title: 'T', description: '', pubDate: '2023-05-20', draft: true } }),
    )
    vi.mocked(github.savePost).mockResolvedValue('sha')

    const { publishPost } = await import('$lib/server/posts.js')
    await publishPost('my-post', 'abc123')

    const callArg = vi.mocked(github.savePost).mock.calls[0][0]
    expect(callArg.frontmatter.pubDate).toBe('2023-05-20')
  })
})

describe('unpublishPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets draft to true', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.getPost).mockResolvedValue(
      makePost({ frontmatter: { title: 'T', description: '', pubDate: '2024-01-01', draft: false } }),
    )
    vi.mocked(github.savePost).mockResolvedValue('sha')

    const { unpublishPost } = await import('$lib/server/posts.js')
    await unpublishPost('my-post', 'abc123')

    const callArg = vi.mocked(github.savePost).mock.calls[0][0]
    expect(callArg.frontmatter.draft).toBe(true)
  })

  it('sets updatedDate to today', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.getPost).mockResolvedValue(makePost())
    vi.mocked(github.savePost).mockResolvedValue('sha')

    const { unpublishPost } = await import('$lib/server/posts.js')
    await unpublishPost('my-post', 'abc123')

    const callArg = vi.mocked(github.savePost).mock.calls[0][0]
    expect(callArg.frontmatter.updatedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('deletePost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates to github.deletePost with slug and sha', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.deletePost).mockResolvedValue(undefined)

    const { deletePost } = await import('$lib/server/posts.js')
    await deletePost('my-post', 'abc123')

    expect(github.deletePost).toHaveBeenCalledWith('my-post', 'abc123')
  })
})
