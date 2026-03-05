import type { Frontmatter, Post, PostSummary } from '../../types.js'
import * as api from './api.js'
import * as cli from './cli.js'

export async function listPosts(): Promise<PostSummary[]> {
  return api.listPosts()
}

export async function getPost(slug: string): Promise<Post> {
  return api.getPost(slug)
}

export interface SaveOptions {
  slug: string
  previousSlug?: string
  frontmatter: Frontmatter
  body: string
  sha?: string
  branch?: string
}

export async function savePost({ slug, previousSlug, frontmatter, body, sha, branch }: SaveOptions): Promise<string> {
  if (previousSlug && previousSlug !== slug) {
    await cli.movePost(previousSlug, slug, frontmatter as Record<string, unknown>, body)
    return api.getPost(slug).then(p => p.sha)
  }
  return api.savePost({ slug, frontmatter, body, sha, branch })
}

export async function deletePost(slug: string, sha: string): Promise<void> {
  return api.deletePost(slug, sha)
}

export async function createPreviewBranch(slug: string): Promise<string> {
  const branch = `writingdesk/preview/${slug}`
  await api.createBranch(branch)
  return branch
}

export async function mergePreviewBranch(branch: string, title: string): Promise<string> {
  const { getConfig } = await import('../config.js')
  const sha = await api.mergeBranch(branch, getConfig().github.defaultBranch, `content: merge preview "${title}"`)
  await api.deleteBranch(branch)
  return sha
}

export { getInstallationToken } from './api.js'
export { fetchBranch, ensureCloned } from './cli.js'
export { getRepoInfo } from './api.js'
