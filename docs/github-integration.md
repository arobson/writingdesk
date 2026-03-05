# GitHub Integration

## Strategy

All repository operations use the **GitHub REST API as the primary mechanism**, with **git CLI as a fallback** for operations the API cannot handle cleanly. The integration layer exposes a single unified interface; callers never need to know which mechanism was used.

```typescript
// src/lib/server/github/index.ts
// All exports here — consumers import from this file only
export { listPosts, getPost, savePost, deletePost, listBranches }
```

## GitHub REST API Operations (Primary)

These operations are fully supported by the GitHub Contents API and will always use the REST API.

### List posts

```
GET /repos/{owner}/{repo}/contents/{content_path}
```

Returns directory listing. Filter by `.md` extension. No CLI fallback needed.

### Read a post

```
GET /repos/{owner}/{repo}/contents/{content_path}/{slug}.md
```

Returns file content base64-encoded. Decode and parse with `gray-matter`. The response also includes the file's `sha`, which is required for updates and deletes.

### Create a post

```
PUT /repos/{owner}/{repo}/contents/{content_path}/{slug}.md
Body: { message, content (base64), branch }
```

### Update a post

```
PUT /repos/{owner}/{repo}/contents/{content_path}/{slug}.md
Body: { message, content (base64), sha, branch }
```

The `sha` of the current file **must** be included or the API returns 409. Always fetch the current sha before writing.

### Delete a post

```
DELETE /repos/{owner}/{repo}/contents/{content_path}/{slug}.md
Body: { message, sha, branch }
```

### List branches

```
GET /repos/{owner}/{repo}/branches
```

### Create a branch

```
POST /repos/{owner}/{repo}/git/refs
Body: { ref: "refs/heads/{branch_name}", sha: "{base_commit_sha}" }
```

Getting the base sha first:
```
GET /repos/{owner}/{repo}/git/ref/heads/{base_branch}
```

### Create a pull request (optional publish workflow)

```
POST /repos/{owner}/{repo}/pulls
Body: { title, body, head, base }
```

## git CLI Fallback

The CLI fallback is used only when the GitHub API is insufficient. The server must have:
- `git` installed
- The target repo cloned locally to a working directory (configured via `GIT_WORK_DIR` env var)
- The GitHub token available for authentication via `GIT_ASKPASS` or credential helper

### When CLI fallback is triggered

| Operation | API sufficient? | CLI fallback reason |
|---|---|---|
| Read file | Yes | — |
| Create file | Yes | — |
| Update file | Yes | — |
| Delete file | Yes | — |
| List files | Yes | — |
| List branches | Yes | — |
| Create branch | Yes | — |
| Rename file (slug change) | **No** | API has no rename; requires delete + create (loses history) |
| Move file (draft → published path) | **No** | Same as rename |
| Bulk commit (multiple files) | **Partially** | API can do it via Git Data API (tree/blob) but is complex |

### CLI fallback implementation

```typescript
// src/lib/server/github/cli.ts
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

async function gitExec(args: string[], workDir: string): Promise<string> {
  const { stdout } = await exec('git', args, {
    cwd: workDir,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
  })
  return stdout.trim()
}
```

For rename/move operations, the CLI fallback will:
1. `git pull` to ensure the working directory is current
2. `git mv {old_path} {new_path}`
3. Write updated content to the new path
4. `git add .`
5. `git commit -m "{message}"`
6. `git push origin {branch}`

### Security considerations for CLI fallback

- The working directory must be owned by the server process user
- All user-supplied values (slugs, branch names) must be validated against an allowlist pattern (`[a-z0-9-]+`) before being passed to shell commands — never use `exec` with shell interpolation
- Use `execFile` (not `exec`) to avoid shell injection

## Unified Interface

```typescript
// src/lib/server/github/index.ts

export async function savePost(options: SavePostOptions): Promise<void> {
  const needsRename = options.previousSlug && options.previousSlug !== options.slug
  if (needsRename) {
    // API cannot preserve history for renames — use CLI
    return cli.movePost(options)
  }
  return api.savePost(options)
}
```

## Rate Limiting

GitHub REST API allows 5,000 requests/hour for authenticated requests. For a single-user writing tool this is never a concern. No rate limit handling is needed in v1.

## Error Handling

| HTTP Status | Meaning | Handling |
|---|---|---|
| 401 | Bad token | Surface as config error — check `GITHUB_TOKEN` |
| 403 | Insufficient scope | Surface token scope requirements to operator |
| 404 | Repo or file not found | Surface as config error or "post not found" |
| 409 | SHA conflict (stale sha) | Re-fetch sha and retry once |
| 422 | Validation error | Log and surface message to user |
| 5xx | GitHub outage | Return error, allow user to retry |

## Required GitHub Token Scopes

The `GITHUB_TOKEN` configured on the server must have:

- `repo` — Full control of private repositories (or `public_repo` for public repos)

For fine-grained personal access tokens:
- **Repository permissions**: Contents (read and write), Pull requests (read and write if using PR workflow)

## Environment Variables

```
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=username-or-org
GITHUB_REPO=my-astro-blog
GITHUB_CONTENT_PATH=src/content/blog    # path within the repo where posts live
GITHUB_DEFAULT_BRANCH=main
GIT_WORK_DIR=/var/writingdesk/repo      # only required if CLI fallback is used
```
