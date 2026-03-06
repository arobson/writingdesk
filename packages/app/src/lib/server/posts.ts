import type { Frontmatter, Post, PostSummary } from '../types.js'
import * as github from './github/index.js'
import { today } from '../utils.js'

export interface BlogContext {
  token: string    // decrypted GitHub OAuth token
  owner: string
  repo: string
}

export async function listPosts(ctx: BlogContext): Promise<PostSummary[]> {
  return github.listPosts(ctx.token, ctx.owner, ctx.repo)
}

export async function getPost(ctx: BlogContext, slug: string): Promise<Post> {
  return github.getPost(ctx.token, ctx.owner, ctx.repo, slug)
}

export interface CreatePostInput {
  slug: string
  frontmatter: Omit<Frontmatter, 'pubDate'> & { pubDate?: string }
  body: string
}

export async function createPost(ctx: BlogContext, { slug, frontmatter, body }: CreatePostInput): Promise<string> {
  const full: Frontmatter = {
    ...frontmatter,
    pubDate: frontmatter.pubDate ?? today(),
    draft: true,
  }
  return github.savePost({ token: ctx.token, owner: ctx.owner, repo: ctx.repo, slug, frontmatter: full, body })
}

export interface UpdatePostInput {
  slug: string
  previousSlug?: string
  frontmatter: Frontmatter
  body: string
  sha: string
}

export async function updatePost(ctx: BlogContext, { slug, frontmatter, body, sha }: UpdatePostInput): Promise<string> {
  const updated: Frontmatter = { ...frontmatter, updatedDate: today() }
  return github.savePost({ token: ctx.token, owner: ctx.owner, repo: ctx.repo, slug, frontmatter: updated, body, sha })
}

export async function publishPost(ctx: BlogContext, slug: string, sha: string): Promise<string> {
  const post = await github.getPost(ctx.token, ctx.owner, ctx.repo, slug)
  const frontmatter: Frontmatter = {
    ...post.frontmatter,
    draft: false,
    pubDate: post.frontmatter.pubDate ?? today(),
    updatedDate: today(),
  }
  return github.savePost({ token: ctx.token, owner: ctx.owner, repo: ctx.repo, slug, frontmatter, body: post.body, sha })
}

export async function unpublishPost(ctx: BlogContext, slug: string, sha: string): Promise<string> {
  const post = await github.getPost(ctx.token, ctx.owner, ctx.repo, slug)
  const frontmatter: Frontmatter = { ...post.frontmatter, draft: true, updatedDate: today() }
  return github.savePost({ token: ctx.token, owner: ctx.owner, repo: ctx.repo, slug, frontmatter, body: post.body, sha })
}

export async function deletePost(ctx: BlogContext, slug: string, sha: string): Promise<void> {
  return github.deletePost(ctx.token, ctx.owner, ctx.repo, slug, sha)
}
