export interface Frontmatter {
  title: string
  description: string
  pubDate: string
  updatedDate?: string
  heroImage?: string
  tags?: string[]
  draft?: boolean
}

export interface PostSummary {
  slug: string
  path: string
  sha: string
  frontmatter: Frontmatter
  status: 'draft' | 'published'
}

export interface Post extends PostSummary {
  body: string
}

export type Role = 'author' | 'publisher'

export interface SessionUser {
  githubUserId: number
  login: string
  avatarUrl: string
  role: Role
}
