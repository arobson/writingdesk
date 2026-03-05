# Preview Workflow

## Overview

WritingDesk supports a branch-based preview workflow that allows authors to see a fully-rendered Astro site before changes go live. When triggered, WritingDesk:

1. Creates a preview branch from `main` in the GitHub repository
2. Commits the current post changes to that branch
3. Clones/pulls the branch into the server's git working directory
4. Runs `astro build` on the branch
5. Serves the build output as a static preview accessible from the WritingDesk UI

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  WritingDesk Server                                             │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────┐ │
│  │  Editor UI   │───>│  Preview API │───>│  Build Runner     │ │
│  │              │    │  /api/preview│    │  (child_process)  │ │
│  └──────────────┘    └──────────────┘    └────────┬──────────┘ │
│                                                    │           │
│                      ┌─────────────────────────────▼─────────┐ │
│                      │  /var/writingdesk/astro-build/{id}/   │ │
│                      │  (static HTML output)                 │ │
│                      └───────────────────────────────────────┘ │
│                                                                 │
│  SvelteKit serves preview at:                                   │
│  /preview/{build-id}/**  (static file serving)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    GitHub API / git CLI
                              │
                ┌─────────────▼─────────────┐
                │  preview/post-slug branch  │
                │  github.com/user/my-blog   │
                └───────────────────────────┘
```

## Branch Strategy

Preview branches follow the naming convention:

```
writingdesk/preview/{slug}
```

For example: `writingdesk/preview/my-new-post`

This keeps preview branches grouped and easily identifiable. They are ephemeral — the author can delete them after reviewing.

**Branch lifecycle:**

```
main ──────────────────────────────────────────> (published)
       │
       └──> writingdesk/preview/my-new-post
                │ (Astro build runs here)
                │ (Author reviews preview)
                └──> merged to main (via UI or GitHub PR)
                └──> deleted (automatic or manual)
```

## GitHub Operations for Preview

### Create preview branch (GitHub API)

1. Get the SHA of `main` HEAD:
   ```
   GET /repos/{owner}/{repo}/git/ref/heads/main
   ```

2. Create the branch:
   ```
   POST /repos/{owner}/{repo}/git/refs
   Body: { ref: "refs/heads/writingdesk/preview/{slug}", sha: "{main-sha}" }
   ```

3. Commit the post to the preview branch:
   ```
   PUT /repos/{owner}/{repo}/contents/{path}/{slug}.md
   Body: { message, content (base64), branch: "writingdesk/preview/{slug}" }
   ```

### Fetch the branch for local build (git CLI — required)

The GitHub API cannot run `astro build`. The server must clone/pull the branch locally:

```bash
# First time: clone the repo
git clone --filter=blob:none --no-checkout https://x-access-token:{TOKEN}@github.com/{owner}/{repo}.git /var/writingdesk/repo

# On each preview: fetch and checkout the branch
cd /var/writingdesk/repo
git fetch origin writingdesk/preview/{slug}
git checkout writingdesk/preview/{slug}
```

The `--filter=blob:none` partial clone minimizes bandwidth if the blog repo is large.

## Build Process

### Prerequisites in Docker image

The Docker image must include:
- `node` (already present)
- `git` (already present)
- The blog's `package.json` dependencies — **not** bundled in the image; installed at first build

### Build steps

```
1. git fetch + checkout preview branch  (git CLI)
2. npm ci                               (install Astro + blog deps — cached)
3. npx astro build                      (produces dist/)
4. copy dist/ to /var/writingdesk/astro-build/{build-id}/
5. store build metadata (slug, branch, timestamp, build-id)
6. return build-id to client
```

### Build state machine

```
idle → queued → building → success
                         → failed
```

Only one build runs at a time in v1. A second preview request while a build is in progress returns the current build status (polling supported).

### Build ID

A build ID is a short unique identifier generated at queue time:

```
preview-{slug}-{unix-timestamp}
e.g. preview-my-new-post-1709654400
```

## API Routes for Preview

### `POST /api/preview`

Triggers a preview build for the current post.

**Request body**
```json
{
  "slug": "my-new-post",
  "frontmatter": { ... },
  "body": "Post content..."
}
```

**Response `202 Accepted`**
```json
{
  "buildId": "preview-my-new-post-1709654400",
  "branch": "writingdesk/preview/my-new-post",
  "status": "queued"
}
```

---

### `GET /api/preview/{buildId}`

Poll for build status.

**Response `200`**
```json
{
  "buildId": "preview-my-new-post-1709654400",
  "status": "building",
  "startedAt": "2024-03-05T12:00:00Z",
  "completedAt": null,
  "previewUrl": null,
  "error": null
}
```

When complete:
```json
{
  "buildId": "preview-my-new-post-1709654400",
  "status": "success",
  "startedAt": "2024-03-05T12:00:00Z",
  "completedAt": "2024-03-05T12:01:05Z",
  "previewUrl": "/preview/preview-my-new-post-1709654400/",
  "error": null
}
```

---

### `DELETE /api/preview/{buildId}`

Cleans up the build directory and optionally deletes the preview branch.

**Request body**
```json
{
  "deleteBranch": true
}
```

**Response `204`**

---

### `POST /api/preview/{buildId}/merge`

Merges the preview branch into `main` via the GitHub API and deletes the preview branch.

```
PUT /repos/{owner}/{repo}/merges
Body: { base: "main", head: "writingdesk/preview/{slug}", commit_message: "..." }
```

Then delete the branch:
```
DELETE /repos/{owner}/{repo}/git/refs/heads/writingdesk/preview/{slug}
```

**Response `200`**
```json
{
  "merged": true,
  "sha": "merge-commit-sha"
}
```

## Serving the Preview

SvelteKit serves the Astro build output as static files. The Node adapter supports this via a custom static file handler or by using SvelteKit's `+server.ts` to stream files from the build directory.

Preview URLs look like:
```
https://writingdesk.yourdomain.com/preview/preview-my-new-post-1709654400/
```

Astro sets a `base` path in `astro.config.mjs` — to serve a preview correctly from a subdirectory, Astro must be built with a matching `base` config. Two options:

**Option A (preferred):** Use a fixed base path in the blog's Astro config:
```js
// astro.config.mjs in the blog repo
base: process.env.ASTRO_BASE_PATH ?? '/'
```
WritingDesk sets `ASTRO_BASE_PATH=/preview/{buildId}` when running the build.

**Option B:** Serve the preview on a subdomain:
```
https://preview-{buildId}.writingdesk.yourdomain.com/
```
Requires wildcard DNS and TLS. More complex to set up but simpler for Astro.

Option A is recommended for v1.

## Editor UI

In the editor, a "Preview" button in the header triggers the preview workflow:

```
┌──────────────────────────────────────────────────────────────────┐
│  < Back   my-post-slug    [Save] [Preview ▼] [Publish]           │
│                                                                   │
│  [Preview ▼] dropdown:                                            │
│    > Build preview          — triggers POST /api/preview          │
│    > Open preview           — opens /preview/{buildId}/ in tab   │
│    > Merge to main          — triggers POST /api/preview/{id}/merge│
│    > Delete preview branch  — triggers DELETE /api/preview/{id}   │
└──────────────────────────────────────────────────────────────────┘
```

**Build in progress state:**

The Preview button shows a spinner and "Building..." label. The client polls `GET /api/preview/{buildId}` every 3 seconds until `status` is `success` or `failed`. On success, the button becomes "Open preview" and opens the preview URL.

## Build Output Cleanup

Build directories accumulate over time. Cleanup strategy:

- Maximum 5 builds retained per post slug (LRU eviction)
- All builds older than 7 days are deleted on server startup
- Manual delete via the API or UI

Build metadata is tracked in a lightweight JSON file at `/var/writingdesk/astro-build/manifest.json` to avoid scanning the filesystem.

## Security Considerations

- `astro build` runs in the git working directory — this executes code from the user's blog repository. This is acceptable because WritingDesk is a trusted single-user tool on a server the operator controls.
- Preview URLs are non-guessable (include a timestamp component) but are not authentication-protected in v1 — anyone who knows the URL can view the preview.
- Git credentials are passed via the token embedded in the clone URL (`https://x-access-token:{TOKEN}@github.com/...`), which is not exposed in logs if `GIT_TERMINAL_PROMPT=0` and the command is run with `execFile`.

## Node.js dependencies for the blog repo

The blog repo's `node_modules` are not included in the WritingDesk image. On the first preview build, `npm ci` installs them into the cloned working directory. Subsequent builds reuse `node_modules` if `package-lock.json` has not changed (standard npm caching behavior), making subsequent builds fast.

The volume at `/var/writingdesk/repo` must persist across container restarts to preserve the `node_modules` cache.
