import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'
import matter from 'gray-matter'
import { getConfig } from '../config.js'
import type { Frontmatter, Post, PostSummary } from '../../types.js'

function octokit(): Octokit {
  const { appId, privateKey, installationId } = getConfig().github
  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey, installationId },
  })
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
  return matter.stringify(body, frontmatter as Record<string, unknown>)
}

export async function listPosts(): Promise<PostSummary[]> {
  const { owner, repo, contentPath, defaultBranch } = getConfig().github
  const kit = octokit()

  let items: Array<{ name: string; path: string; type: string }>
  try {
    const { data } = await kit.repos.getContent({ owner, repo, path: contentPath, ref: defaultBranch })
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
        const post = await getPost(file.name.replace(/\.md$/, ''))
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

export async function getPost(slug: string): Promise<Post> {
  const { owner, repo, contentPath, defaultBranch } = getConfig().github
  const path = `${contentPath}/${slug}.md`
  const { data } = await octokit().repos.getContent({ owner, repo, path, ref: defaultBranch })
  if (Array.isArray(data) || data.type !== 'file') throw new Error(`Not a file: ${path}`)
  return parseFile(slug, path, data.sha, decode(data.content))
}

export interface SaveOptions {
  slug: string
  frontmatter: Frontmatter
  body: string
  sha?: string
  branch?: string
}

export async function savePost({ slug, frontmatter, body, sha, branch }: SaveOptions): Promise<string> {
  const { owner, repo, contentPath, defaultBranch } = getConfig().github
  const path = `${contentPath}/${slug}.md`
  const targetBranch = branch ?? defaultBranch
  const content = encode(serialize(frontmatter, body))
  const message = sha
    ? `content: update "${frontmatter.title}"`
    : `content: add "${frontmatter.title}"`

  const { data } = await octokit().repos.createOrUpdateFileContents({
    owner, repo, path, message, content,
    branch: targetBranch,
    ...(sha ? { sha } : {}),
  })

  return data.content!.sha!
}

export async function deletePost(slug: string, sha: string): Promise<void> {
  const { owner, repo, contentPath, defaultBranch } = getConfig().github
  const path = `${contentPath}/${slug}.md`
  await octokit().repos.deleteFile({
    owner, repo, path, sha,
    message: `content: delete "${slug}"`,
    branch: defaultBranch,
  })
}

export async function createBranch(branchName: string, fromBranch?: string): Promise<void> {
  const { owner, repo, defaultBranch } = getConfig().github
  const kit = octokit()
  const base = fromBranch ?? defaultBranch
  const { data } = await kit.git.getRef({ owner, repo, ref: `heads/${base}` })
  await kit.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha: data.object.sha })
}

export async function mergeBranch(head: string, base: string, commitMessage: string): Promise<string> {
  const { owner, repo } = getConfig().github
  const { data } = await octokit().repos.merge({ owner, repo, base, head, commit_message: commitMessage })
  return (data as { sha: string }).sha
}

export async function deleteBranch(branchName: string): Promise<void> {
  const { owner, repo } = getConfig().github
  await octokit().git.deleteRef({ owner, repo, ref: `heads/${branchName}` })
}

export async function getInstallationToken(): Promise<string> {
  const { appId, privateKey, installationId } = getConfig().github
  const auth = createAppAuth({ appId, privateKey, installationId })
  const { token } = await auth({ type: 'installation' })
  return token
}

export async function getRepoInfo() {
  const { owner, repo } = getConfig().github
  const { data } = await octokit().repos.get({ owner, repo })
  return { fullName: data.full_name, private: data.private, htmlUrl: data.html_url }
}
