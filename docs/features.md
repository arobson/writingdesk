# Features

## v1 Scope

### Post Management

**List posts**
- Display all posts (drafts and published) fetched from the repository
- Show title, publish date, draft status, and last modified date
- Sort by publish date descending
- Link to edit each post

**Create post**
- New post form with slug, title, and description pre-filled
- Auto-generate slug from title as user types (debounced)
- Slug is editable before first save
- Post is saved as a draft on creation

**Edit post**
- Full markdown editor with syntax highlighting
- Frontmatter form (structured fields, not raw YAML)
- Live split-pane preview (optional — toggle-able)
- Auto-save to draft on a short idle timer (e.g. 3s after last keystroke)
- Manual save button always available

**Delete post**
- Confirmation dialog before delete
- Deletes the file from the repository with a commit

**Publish / unpublish post**
- Toggle post between draft and published by updating the `draft` frontmatter field
- Publish = set `draft: false` and set `pubDate` if not already set
- Unpublish = set `draft: true`
- One-click button in the editor header and on the post list

### Frontmatter Editor

Fields exposed in the UI form:

| Field | UI control | Notes |
|---|---|---|
| `title` | Text input | Required |
| `description` | Textarea | Required; character count shown |
| `pubDate` | Date picker | Defaults to today on new post |
| `updatedDate` | Date picker | Auto-set on save; can be cleared |
| `heroImage` | Text input | URL or repo-relative path |
| `tags` | Tag input (add/remove chips) | Optional |
| `draft` | Toggle | Controlled via Publish/Unpublish button |

### Markdown Editor

- CodeMirror 6 base
- Markdown syntax highlighting
- Keyboard shortcuts: `Cmd/Ctrl+B` bold, `Cmd/Ctrl+I` italic, `Cmd/Ctrl+K` link
- Toolbar buttons for common formatting (bold, italic, heading, code block, link, image)
- Tab key inserts spaces (not literal tab)
- Line wrapping enabled by default

### Preview

- Rendered HTML preview of the markdown body
- Respects code fence syntax highlighting (via `shiki` or `highlight.js`)
- Split-pane layout (editor left, preview right) on wide viewports
- Toggle to full-width editor or full-width preview
- Preview updates on a short debounce (not on every keystroke)

### Authentication and Authorization

- Users sign in with their GitHub account via **GitHub App OAuth** — no separate password
- Access is controlled by the user's collaborator permission level on the target Astro blog repository
- Two roles, derived from GitHub repo collaborator permission at login:
  - **Author** (`write`): create, edit, save drafts, trigger preview builds
  - **Publisher** (`maintain`/`admin`): all author actions + publish, unpublish, delete, settings, merge previews
- Users with `read`/`triage` permissions or no repo access are denied — shown an "Access denied" page
- Session stored as a signed JWT in an httpOnly, SameSite=Strict cookie
- Session lifetime: 8 hours; silently refreshed near expiry with the same role (no live GitHub re-check)

See [GitHub OAuth](./auth-oauth.md) for full details.

### Settings Page

- Display current configuration (repo, owner, branch, content path)
- Test repository connection and display repo info
- No editing of config in v1 — operator must update env vars

## v2 Scope (Future)

These are explicitly out of scope for v1 but should be designed around:

- **Image upload** — upload images to the repository's public assets folder
- **Custom frontmatter schema** — define additional fields per-repo via config
- **Branch workflow** — write to a feature branch and open a PR instead of committing directly to main
- **Multiple repos** — support more than one target Astro blog repo
- **Post templates** — pre-fill new posts from a saved template
- **Full-text search** — search post titles and content locally
- **Keyboard shortcut to publish** — `Cmd+Shift+P`
