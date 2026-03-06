import { Octokit } from '@octokit/rest'
import matter from 'gray-matter'
import type { Frontmatter, Post, PostSummary } from '../../types.js'

// Every function takes the user's decrypted OAuth token so there are no
// module-level singletons — each request gets a fresh, correctly-scoped client.

function octokit(token: string): Octokit {
  return new Octokit({ auth: token })
}

function decode(encoded: string): string {
  return Buffer.from(encoded.replace(/\n/g, ''), 'base64').toString('utf-8')
}

function encode(content: string): string {
  return Buffer.from(content).toString('base64')
}

function parseFile(slug: string, path: string, sha: string, raw: string): Post {
  const { data, content } = matter(raw)
  const frontmatter = data as Frontmatter
  return {
    slug,
    path,
    sha,
    frontmatter,
    body: content.trimStart(),
    status: frontmatter.draft === true ? 'draft' : 'published',
  }
}

function serialize(frontmatter: Frontmatter, body: string): string {
  // js-yaml (used by gray-matter) throws on undefined values — strip them before
  // serializing so optional frontmatter fields don't cause a crash.
  const clean = Object.fromEntries(
    Object.entries(frontmatter).filter(([, v]) => v !== undefined),
  )
  return matter.stringify(body, clean)
}

// ── Post CRUD ────────────────────────────────────────────────────────────────

const CONTENT_PATH = 'src/content/blog'
const DEFAULT_BRANCH = 'main'

export async function listPosts(token: string, owner: string, repo: string): Promise<PostSummary[]> {
  const kit = octokit(token)
  let items: Array<{ name: string; path: string; type: string }>
  try {
    const { data } = await kit.repos.getContent({ owner, repo, path: CONTENT_PATH, ref: DEFAULT_BRANCH })
    if (!Array.isArray(data)) return []
    items = data
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return []
    throw err
  }

  const mdFiles = items.filter(f => f.type === 'file' && f.name.endsWith('.md'))
  const posts = await Promise.all(
    mdFiles.map(async (file) => {
      try {
        const post = await getPost(token, owner, repo, file.name.replace(/\.md$/, ''))
        const { body: _body, ...summary } = post
        return summary as PostSummary
      } catch {
        return null
      }
    }),
  )

  return (posts.filter(Boolean) as PostSummary[]).sort((a, b) => {
    const dA = a.frontmatter.pubDate ?? ''
    const dB = b.frontmatter.pubDate ?? ''
    return dB.localeCompare(dA)
  })
}

export async function getPost(token: string, owner: string, repo: string, slug: string): Promise<Post> {
  const path = `${CONTENT_PATH}/${slug}.md`
  const { data } = await octokit(token).repos.getContent({ owner, repo, path, ref: DEFAULT_BRANCH })
  if (Array.isArray(data) || data.type !== 'file') throw new Error(`Not a file: ${path}`)
  return parseFile(slug, path, data.sha, decode(data.content))
}

export interface SaveOptions {
  token: string
  owner: string
  repo: string
  slug: string
  frontmatter: Frontmatter
  body: string
  sha?: string
}

export async function savePost({ token, owner, repo, slug, frontmatter, body, sha }: SaveOptions): Promise<string> {
  const path = `${CONTENT_PATH}/${slug}.md`
  const content = encode(serialize(frontmatter, body))
  const message = sha
    ? `content: update "${frontmatter.title}"`
    : `content: add "${frontmatter.title}"`

  const { data } = await octokit(token).repos.createOrUpdateFileContents({
    owner, repo, path, message, content,
    branch: DEFAULT_BRANCH,
    ...(sha ? { sha } : {}),
  })

  return data.content!.sha!
}

export async function deletePost(token: string, owner: string, repo: string, slug: string, sha: string): Promise<void> {
  const path = `${CONTENT_PATH}/${slug}.md`
  await octokit(token).repos.deleteFile({
    owner, repo, path, sha,
    message: `content: delete "${slug}"`,
    branch: DEFAULT_BRANCH,
  })
}

// ── Blog provisioning ────────────────────────────────────────────────────────

export async function createRepo(token: string, name: string, description: string): Promise<{ owner: string; repo: string }> {
  const kit = octokit(token)
  const { data } = await kit.repos.createForAuthenticatedUser({
    name,
    description,
    private: false,
    auto_init: false,
  })
  return { owner: data.owner.login, repo: data.name }
}

export async function enableGithubPages(token: string, owner: string, repo: string): Promise<void> {
  // Enable Pages with GitHub Actions as the build source
  await octokit(token).request('POST /repos/{owner}/{repo}/pages', {
    owner,
    repo,
    build_type: 'workflow',
  })
}

export interface CommitFile {
  path: string
  content: string  // plain text — will be base64-encoded
}

export async function commitFiles(
  token: string,
  owner: string,
  repo: string,
  files: CommitFile[],
  message: string,
): Promise<void> {
  const kit = octokit(token)

  // Get or create the default branch ref
  let baseSha: string
  try {
    const { data: ref } = await kit.git.getRef({ owner, repo, ref: 'heads/main' })
    baseSha = ref.object.sha
  } catch {
    // Repo is brand-new — create the initial commit directly
    const tree = await kit.git.createTree({
      owner,
      repo,
      tree: files.map(f => ({
        path: f.path,
        mode: '100644' as const,
        type: 'blob' as const,
        content: f.content,
      })),
    })
    const commit = await kit.git.createCommit({
      owner,
      repo,
      message,
      tree: tree.data.sha,
      parents: [],
    })
    await kit.git.createRef({
      owner,
      repo,
      ref: 'refs/heads/main',
      sha: commit.data.sha,
    })
    return
  }

  // Repo already has commits — build on top of the existing tree
  const { data: baseCommit } = await kit.git.getCommit({ owner, repo, commit_sha: baseSha })
  const tree = await kit.git.createTree({
    owner,
    repo,
    base_tree: baseCommit.tree.sha,
    tree: files.map(f => ({
      path: f.path,
      mode: '100644' as const,
      type: 'blob' as const,
      content: f.content,
    })),
  })
  const commit = await kit.git.createCommit({
    owner,
    repo,
    message,
    tree: tree.data.sha,
    parents: [baseSha],
  })
  await kit.git.updateRef({ owner, repo, ref: 'heads/main', sha: commit.data.sha })
}

export async function getAuthenticatedUser(token: string): Promise<{ id: number; login: string; avatarUrl: string }> {
  const { data } = await octokit(token).users.getAuthenticated()
  return { id: data.id, login: data.login, avatarUrl: data.avatar_url }
}

export async function listUserRepos(token: string): Promise<Array<{ owner: string; repo: string }>> {
  const { data } = await octokit(token).repos.listForAuthenticatedUser({
    sort: 'updated',
    per_page: 100,
  })
  return data.map(r => ({ owner: r.owner.login, repo: r.name }))
}

export async function checkRepoAccess(token: string, owner: string, repo: string): Promise<void> {
  // Throws if the repo doesn't exist or the token lacks access
  await octokit(token).repos.get({ owner, repo })
}
