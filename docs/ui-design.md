# UI Design

## Pages

### Dashboard / Post List (`/`)

```
┌─────────────────────────────────────────────────────┐
│  WritingDesk                          [New Post]     │
├─────────────────────────────────────────────────────┤
│  All posts (12)                                      │
│  ┌─────────────────────────────────────────────────┐│
│  │ My Latest Post                    [Published]   ││
│  │ Mar 5, 2024 · svelte, web                 [Edit]││
│  ├─────────────────────────────────────────────────┤│
│  │ Draft: A Post In Progress           [Draft]     ││
│  │ Not published · svelte                    [Edit]││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

- Filter tabs: All | Published | Drafts
- Search bar to filter by title (client-side, no network request)
- Each row: title, tags, date, status badge, edit link

### Post Editor (`/posts/[slug]` and `/posts/new`)

```
┌─────────────────────────────────────────────────────────────────┐
│  < Back to posts    my-post-slug               [Save] [Publish] │
├───────────────────────────┬─────────────────────────────────────┤
│  FRONTMATTER              │  EDITOR          [Preview]          │
│  ─────────────            │  ─────────────────────────────      │
│  Title                    │  # My Post Title                    │
│  [____________________]   │                                     │
│                           │  Body content here...               │
│  Description              │                                     │
│  [____________________]   │                                     │
│  [____________________]   │                                     │
│                           │                                     │
│  Publish date             │                                     │
│  [2024-03-05_________]    │                                     │
│                           │                                     │
│  Tags                     │                                     │
│  [svelte x] [web x] [+]   │                                     │
│                           │                                     │
│  Hero image               │                                     │
│  [____________________]   │                                     │
│                           │                                     │
│  [Delete post]            │                                     │
└───────────────────────────┴─────────────────────────────────────┘
```

**Editor states:**
- Default: frontmatter panel left, editor right
- Narrow viewport: frontmatter panel above editor (stacked)
- Preview mode: editor hidden, preview rendered right (or full width toggle)
- Saving: Save button shows spinner, disabled during save

**Header actions:**
- `Save` — saves current state as draft (no status change)
- `Publish` — saves and sets `draft: false` (changes to `Unpublish` when published)
- Status indicator: "Saved", "Saving...", "Unsaved changes"

### Settings (`/settings`)

```
┌─────────────────────────────────────────────────────┐
│  Settings                                            │
├─────────────────────────────────────────────────────┤
│  Repository Configuration                            │
│  ─────────────────────────                          │
│  Owner:         my-github-username                   │
│  Repository:    my-astro-blog                        │
│  Content path:  src/content/blog                     │
│  Branch:        main                                 │
│  Repo URL:      github.com/user/my-astro-blog        │
│                                                      │
│  Connection status:  Connected  [Test connection]    │
└─────────────────────────────────────────────────────┘
```

### Login (`/auth/github` → GitHub → `/auth/github/callback`)

No form — the login page shows a single "Sign in with GitHub" button that initiates the GitHub OAuth flow. On return from GitHub, the server checks repo permissions and redirects to `/` (success) or `/auth/denied` (no access).

The `/auth/denied` page explains that access requires collaborator status on the target repository and provides the repo URL.

### Authenticated header

The app header shows the signed-in user's GitHub avatar and display name in the top-right corner, with a dropdown for "Sign out".

```
┌──────────────────────────────────────────────────────────────┐
│  WritingDesk              [New Post]   [@username ▼]         │
│                                        ┌─────────────────┐   │
│                                        │ Sign out        │   │
│                                        └─────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Design Principles

- **Writing-first**: the editor takes maximum space; chrome is minimal
- **No distractions**: frontmatter panel collapses on narrow screens
- **Keyboard-driven**: all primary actions have keyboard shortcuts
- **Responsive**: usable on a tablet; desktop is the primary target
- **No animations** on data operations (save, publish) — use direct state updates

## Color System

- Light and dark mode support (follows system preference via `prefers-color-scheme`)
- Neutral base palette — writing tools should not fight for attention with the content
- Single accent color for interactive elements (buttons, links, focus rings)
- Status badges: green (published), yellow (draft), red (error)

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+S` | Save post |
| `Cmd/Ctrl+Shift+P` | Publish / unpublish |
| `Cmd/Ctrl+B` | Bold selected text |
| `Cmd/Ctrl+I` | Italic selected text |
| `Cmd/Ctrl+K` | Insert link |
| `Cmd/Ctrl+Shift+\`` | Insert code block |
| `Cmd/Ctrl+P` | Toggle preview |

## Component Inventory

| Component | Description |
|---|---|
| `PostList.svelte` | Filterable, searchable list of posts |
| `PostListItem.svelte` | Single row in the post list |
| `Editor.svelte` | CodeMirror 6 wrapper with toolbar |
| `EditorToolbar.svelte` | Formatting buttons above the editor |
| `FrontmatterForm.svelte` | Structured form for all frontmatter fields |
| `TagInput.svelte` | Chip-style tag add/remove input |
| `Preview.svelte` | Rendered markdown preview pane |
| `SaveStatus.svelte` | "Saved / Saving... / Unsaved" indicator |
| `StatusBadge.svelte` | Draft / Published / Error pill badge |
| `DeleteConfirm.svelte` | Modal confirmation for post delete |
