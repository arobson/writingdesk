import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Post } from '$lib/types.js'

vi.mock('$lib/server/github/index.js', () => ({
  listPosts: vi.fn(),
  getPost: vi.fn(),
  savePost: vi.fn(),
  deletePost: vi.fn(),
  createRepo: vi.fn(),
  enableGithubPages: vi.fn(),
  commitFiles: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  scaffoldFiles: vi.fn(),
}))

const CTX = { token: 'tok', owner: 'owner', repo: 'repo' }

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    slug: 'my-post',
    path: 'src/content/blog/my-post.md',
    sha: 'abc123',
    frontmatter: { title: 'My Post', description: 'A test post', pubDate: '2024-06-01', draft: true },
    body: 'Hello world',
    status: 'draft',
    ...overrides,
  }
}

describe('createPost', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('always creates with draft: true', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.savePost).mockResolvedValue('new-sha')

    const { createPost } = await import('$lib/server/posts.js')
    await createPost(CTX, { slug: 'hello', frontmatter: { title: 'Hello', description: '', pubDate: undefined }, body: '' })

    expect(vi.mocked(github.savePost).mock.calls[0][0].frontmatter.draft).toBe(true)
  })

  it('uses today() as pubDate when not supplied', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.savePost).mockResolvedValue('new-sha')

    const { createPost } = await import('$lib/server/posts.js')
    await createPost(CTX, { slug: 'hello', frontmatter: { title: 'Hello', description: '', pubDate: undefined }, body: '' })

    expect(vi.mocked(github.savePost).mock.calls[0][0].frontmatter.pubDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('preserves explicitly provided pubDate', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.savePost).mockResolvedValue('new-sha')

    const { createPost } = await import('$lib/server/posts.js')
    await createPost(CTX, { slug: 'hello', frontmatter: { title: 'Hello', description: '', pubDate: '2023-01-15' }, body: '' })

    expect(vi.mocked(github.savePost).mock.calls[0][0].frontmatter.pubDate).toBe('2023-01-15')
  })

  it('returns the sha from savePost', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.savePost).mockResolvedValue('returned-sha')

    const { createPost } = await import('$lib/server/posts.js')
    expect(await createPost(CTX, { slug: 'hello', frontmatter: { title: 'Hello', description: '', pubDate: undefined }, body: '' })).toBe('returned-sha')
  })
})

describe('updatePost', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sets updatedDate to today', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.savePost).mockResolvedValue('updated-sha')

    const { updatePost } = await import('$lib/server/posts.js')
    await updatePost(CTX, { slug: 'my-post', frontmatter: { title: 'My Post', description: '', pubDate: '2024-01-01', draft: true }, body: 'updated body', sha: 'abc123' })

    expect(vi.mocked(github.savePost).mock.calls[0][0].frontmatter.updatedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('publishPost', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sets draft to false', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.getPost).mockResolvedValue(makePost({ frontmatter: { title: 'T', description: '', pubDate: '2024-01-01', draft: true } }))
    vi.mocked(github.savePost).mockResolvedValue('sha')

    const { publishPost } = await import('$lib/server/posts.js')
    await publishPost(CTX, 'my-post', 'abc123')

    expect(vi.mocked(github.savePost).mock.calls[0][0].frontmatter.draft).toBe(false)
  })

  it('fills in pubDate if missing', async () => {
    const github = await import('$lib/server/github/index.js')
    const post = makePost()
    post.frontmatter.pubDate = undefined as unknown as string
    vi.mocked(github.getPost).mockResolvedValue(post)
    vi.mocked(github.savePost).mockResolvedValue('sha')

    const { publishPost } = await import('$lib/server/posts.js')
    await publishPost(CTX, 'my-post', 'abc123')

    expect(vi.mocked(github.savePost).mock.calls[0][0].frontmatter.pubDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('preserves existing pubDate', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.getPost).mockResolvedValue(makePost({ frontmatter: { title: 'T', description: '', pubDate: '2023-05-20', draft: true } }))
    vi.mocked(github.savePost).mockResolvedValue('sha')

    const { publishPost } = await import('$lib/server/posts.js')
    await publishPost(CTX, 'my-post', 'abc123')

    expect(vi.mocked(github.savePost).mock.calls[0][0].frontmatter.pubDate).toBe('2023-05-20')
  })
})

describe('unpublishPost', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sets draft to true', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.getPost).mockResolvedValue(makePost({ frontmatter: { title: 'T', description: '', pubDate: '2024-01-01', draft: false } }))
    vi.mocked(github.savePost).mockResolvedValue('sha')

    const { unpublishPost } = await import('$lib/server/posts.js')
    await unpublishPost(CTX, 'my-post', 'abc123')

    expect(vi.mocked(github.savePost).mock.calls[0][0].frontmatter.draft).toBe(true)
  })
})

describe('deletePost', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('delegates to github.deletePost with ctx, slug and sha', async () => {
    const github = await import('$lib/server/github/index.js')
    vi.mocked(github.deletePost).mockResolvedValue(undefined)

    const { deletePost } = await import('$lib/server/posts.js')
    await deletePost(CTX, 'my-post', 'abc123')

    expect(github.deletePost).toHaveBeenCalledWith(CTX.token, CTX.owner, CTX.repo, 'my-post', 'abc123')
  })
})
