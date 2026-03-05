# Data Model

## Post

A post is a markdown file on disk/in the repository. There is no database. The canonical representation is the `.md` file.

```typescript
interface Post {
  slug: string           // derived from filename, e.g. "my-first-post"
  path: string           // full repo path, e.g. "src/content/blog/my-first-post.md"
  frontmatter: Frontmatter
  body: string           // raw markdown content (without frontmatter)
  sha: string            // GitHub blob sha — required for updates/deletes
  status: 'draft' | 'published'
}
```

## Frontmatter

WritingDesk targets Astro's built-in blog content collection schema. The frontmatter model maps directly to Astro's default blog template schema.

```typescript
interface Frontmatter {
  title: string           // required
  description: string     // required — used for SEO meta
  pubDate: string         // ISO date string, e.g. "2024-03-05"
  updatedDate?: string    // ISO date string — set automatically on edit
  heroImage?: string      // optional relative path or URL
  tags?: string[]         // optional array of tag strings
  draft?: boolean         // if true, Astro will not build this page
}
```

### Serialized form (file on disk)

```markdown
---
title: My First Post
description: A short description for SEO and previews.
pubDate: 2024-03-05
updatedDate: 2024-03-06
heroImage: /images/my-first-post.jpg
tags:
  - svelte
  - web
draft: false
---

Post body content begins here...
```

## Slug Rules

- Derived from the filename: `my-first-post.md` → slug `my-first-post`
- Must match pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Generated from title on new post creation (auto-slugify), editable by user
- Slug change = file rename = git CLI operation (see [GitHub Integration](./github-integration.md))

## Draft vs Published

Two strategies are considered. **Strategy A is preferred** for Astro compatibility.

### Strategy A: `draft` frontmatter field (preferred)

All posts live in the same directory. Draft status is controlled by `draft: true` in frontmatter. Astro natively respects this field and excludes drafts from production builds.

- Pro: simpler file structure, no moves required to publish
- Pro: no git history disruption
- Con: drafts are visible in the repository to anyone with repo access

### Strategy B: Separate `_drafts/` directory

Drafts live at `src/content/blog/_drafts/{slug}.md`. Publishing moves them to `src/content/blog/{slug}.md`.

- Pro: cleaner separation at the filesystem level
- Con: requires a file move on publish (needs git CLI fallback)
- Con: Astro may not automatically handle the `_drafts/` exclusion without config

## Commit Messages

All commits made by WritingDesk follow a consistent format:

| Action | Commit message |
|---|---|
| Create post | `content: add "{title}"` |
| Update post | `content: update "{title}"` |
| Publish post | `content: publish "{title}"` |
| Unpublish post (set draft) | `content: unpublish "{title}"` |
| Delete post | `content: delete "{title}"` |
| Rename post | `content: rename {old-slug} to {new-slug}` |

## Settings / Configuration

Application configuration lives in environment variables (see [Deployment](./deployment.md)). There is no user-editable settings database in v1.

A potential future settings model for persisting per-repo configuration would be a `writingdesk.config.json` file committed to the root of the target repository.

```typescript
// Future: writingdesk.config.json in the target repo
interface RepoConfig {
  contentPath: string       // e.g. "src/content/blog"
  defaultBranch: string     // e.g. "main"
  publishBranch?: string    // if different from defaultBranch
  frontmatterSchema?: FrontmatterFieldConfig[]  // custom fields
}
```
