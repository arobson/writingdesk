# API Routes

All API routes are SvelteKit server routes under `src/routes/api/`. They are authenticated via the `Authorization: Bearer {token}` header. Unauthenticated requests receive `401`.

## Authentication Middleware

A shared auth guard is applied in the SvelteKit `handle` hook in `src/hooks.server.ts`. It checks the `Authorization` header against `WRITINGDESK_AUTH_TOKEN` for all `/api/*` routes.

## Endpoints

### `GET /api/posts`

Returns a list of all posts.

**Response `200`**
```json
[
  {
    "slug": "my-first-post",
    "path": "src/content/blog/my-first-post.md",
    "frontmatter": {
      "title": "My First Post",
      "description": "...",
      "pubDate": "2024-03-05",
      "draft": false,
      "tags": ["svelte"]
    },
    "status": "published"
  }
]
```

Note: `body` and `sha` are not included in the list response — only on individual fetch.

---

### `GET /api/posts/{slug}`

Returns a single post including full body and sha.

**Response `200`**
```json
{
  "slug": "my-first-post",
  "path": "src/content/blog/my-first-post.md",
  "frontmatter": { ... },
  "body": "Full markdown body...",
  "sha": "abc123...",
  "status": "published"
}
```

**Response `404`** — post not found

---

### `POST /api/posts`

Creates a new post.

**Request body**
```json
{
  "slug": "my-new-post",
  "frontmatter": {
    "title": "My New Post",
    "description": "Description here",
    "pubDate": "2024-03-05",
    "draft": true
  },
  "body": "Post content..."
}
```

**Response `201`**
```json
{
  "slug": "my-new-post",
  "sha": "def456..."
}
```

**Response `409`** — slug already exists

---

### `PUT /api/posts/{slug}`

Updates an existing post. Slug in the URL is the _current_ slug. If `newSlug` differs, a rename is performed.

**Request body**
```json
{
  "sha": "abc123...",
  "newSlug": "my-renamed-post",
  "frontmatter": { ... },
  "body": "Updated content..."
}
```

**Response `200`**
```json
{
  "slug": "my-renamed-post",
  "sha": "ghi789..."
}
```

**Response `409`** — sha conflict (stale). Client should re-fetch and retry.

---

### `DELETE /api/posts/{slug}`

Deletes a post.

**Request body**
```json
{
  "sha": "abc123..."
}
```

**Response `204`** — deleted

---

### `POST /api/posts/{slug}/publish`

Sets `draft: false` and `pubDate` (if unset) on the post.

**Request body**
```json
{
  "sha": "abc123..."
}
```

**Response `200`**
```json
{
  "sha": "newsha..."
}
```

---

### `POST /api/posts/{slug}/unpublish`

Sets `draft: true` on the post.

**Request body**
```json
{
  "sha": "abc123..."
}
```

**Response `200`**
```json
{
  "sha": "newsha..."
}
```

---

### `GET /api/config`

Returns the current (non-secret) server configuration for display in the settings page.

**Response `200`**
```json
{
  "owner": "username",
  "repo": "my-astro-blog",
  "contentPath": "src/content/blog",
  "defaultBranch": "main",
  "repoUrl": "https://github.com/username/my-astro-blog"
}
```

---

### `GET /api/config/status`

Pings the GitHub API to verify the token and repo are valid.

**Response `200`**
```json
{
  "ok": true,
  "repoFullName": "username/my-astro-blog",
  "repoPrivate": false,
  "tokenScopes": ["repo"]
}
```

**Response `200`** (error state — always 200, status in body)
```json
{
  "ok": false,
  "error": "Repository not found. Check GITHUB_OWNER and GITHUB_REPO."
}
```

## Error Response Format

All errors follow a consistent shape:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE"
}
```

## SvelteKit Page Load Functions

Page data is loaded via SvelteKit's `+page.server.ts` load functions, which call the same business logic as the API routes directly (not via HTTP). The API routes are for client-side fetches (save, publish, delete actions) after the initial page load.

| Route | Load data |
|---|---|
| `/` | `listPosts()` |
| `/posts/new` | nothing (empty form) |
| `/posts/[slug]` | `getPost(slug)` |
| `/settings` | `getConfig()`, `getStatus()` |
