import type { Frontmatter, Post, PostSummary } from '../types.js'
import * as github from './github/index.js'
import { today } from '../utils.js'

export async function listPosts(): Promise<PostSummary[]> {
  return github.listPosts()
}

export async function getPost(slug: string): Promise<Post> {
  return github.getPost(slug)
}

export interface CreatePostInput {
  slug: string
  frontmatter: Omit<Frontmatter, 'pubDate'> & { pubDate?: string }
  body: string
}

export async function createPost({ slug, frontmatter, body }: CreatePostInput): Promise<string> {
  const full: Frontmatter = {
    ...frontmatter,
    pubDate: frontmatter.pubDate ?? today(),
    draft: true,
  }
  return github.savePost({ slug, frontmatter: full, body })
}

export interface UpdatePostInput {
  slug: string
  previousSlug?: string
  frontmatter: Frontmatter
  body: string
  sha: string
}

export async function updatePost({ slug, previousSlug, frontmatter, body, sha }: UpdatePostInput): Promise<string> {
  const updated: Frontmatter = { ...frontmatter, updatedDate: today() }
  return github.savePost({ slug, previousSlug, frontmatter: updated, body, sha })
}

export async function publishPost(slug: string, sha: string): Promise<string> {
  const post = await github.getPost(slug)
  const frontmatter: Frontmatter = {
    ...post.frontmatter,
    draft: false,
    pubDate: post.frontmatter.pubDate ?? today(),
    updatedDate: today(),
  }
  return github.savePost({ slug, frontmatter, body: post.body, sha })
}

export async function unpublishPost(slug: string, sha: string): Promise<string> {
  const post = await github.getPost(slug)
  const frontmatter: Frontmatter = { ...post.frontmatter, draft: true, updatedDate: today() }
  return github.savePost({ slug, frontmatter, body: post.body, sha })
}

export async function deletePost(slug: string, sha: string): Promise<void> {
  return github.deletePost(slug, sha)
}
